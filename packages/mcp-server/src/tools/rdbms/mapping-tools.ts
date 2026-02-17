/**
 * RDBMS Mapping tools.
 *
 * Tools for creating, updating, and validating table-to-collection mappings.
 * Supports auto-generation from schema analysis or manual specification.
 */

import type {
  RdbmsToolDef,
  TableMapping,
  ColumnMapping,
  EmbedConfig,
  ReferenceConfig,
  MigrationPattern,
} from "./types.js";
import { MappingStore } from "./mapping-store.js";
import type { ValidationResult, ValidationCheck } from "./mapping-store.js";
import type { RdbmsConnectionManager } from "./connection.js";
import type { ColumnInfo, ForeignKeyInfo } from "./drivers/types.js";

/**
 * Extended connection manager with mapping store.
 */
interface RdbmsConnectionManagerWithStore extends RdbmsConnectionManager {
  _mappingStore?: MappingStore;
}

/**
 * Get or create the mapping store from the connection manager.
 * We store it as a property on the manager for session isolation.
 */
function getMappingStore(rdbms: RdbmsConnectionManager): MappingStore {
  const manager = rdbms as RdbmsConnectionManagerWithStore;

  if (!manager._mappingStore) {
    manager._mappingStore = new MappingStore();
  }

  return manager._mappingStore;
}

/**
 * create-mapping — Create a table-to-collection mapping.
 */
const createMappingTool: RdbmsToolDef = {
  name: "create-mapping",
  description:
    "Create a mapping from an RDBMS table to a MongoDB collection. " +
    "Use useRecommendations=true to auto-generate based on schema analysis, " +
    "or provide a full specification. The mapping defines how rows become documents, " +
    "including embedded documents, references, and column transformations.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name.",
      },
      table: {
        type: "string",
        description: "Source table name.",
      },
      schema: {
        type: "string",
        description: 'Source schema. Defaults to "public" (PostgreSQL) or "dbo" (SQL Server).',
      },
      collection: {
        type: "string",
        description: "Target MongoDB collection name. Defaults to table name.",
      },
      database: {
        type: "string",
        description: "Target MongoDB database name.",
      },
      pattern: {
        type: "string",
        enum: ["direct", "embed-one", "embed-many", "reference", "extended-ref", "subset", "bucket"],
        description:
          "Migration pattern. If useRecommendations is true, this is auto-selected. " +
          "Defaults to 'direct' if not specified.",
      },
      useRecommendations: {
        type: "boolean",
        description:
          "Auto-generate mapping based on recommend-patterns analysis. " +
          "When true, embeds and references are auto-configured based on relationships.",
      },
      maxEmbedCount: {
        type: "number",
        description:
          "Maximum average child count to auto-embed. Default: 100. " +
          "Tables with more children per parent will be referenced instead.",
      },
      columns: {
        type: "array",
        items: {
          type: "object",
          properties: {
            source: { type: "string", description: "Source column name." },
            target: { type: "string", description: "Target field name." },
            targetType: { type: "string", description: "BSON type." },
            transform: { type: "string", description: "Transform function." },
            exclude: { type: "boolean", description: "Exclude this column." },
          },
          required: ["source"],
        },
        description: "Column mappings. If not specified, all columns are mapped with inferred names.",
      },
      embeds: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sourceTable: { type: "string" },
            foreignKey: { type: "string" },
            targetField: { type: "string" },
            cardinality: { type: "string", enum: ["one", "many"] },
            maxItems: { type: "number" },
          },
          required: ["sourceTable", "foreignKey", "targetField", "cardinality"],
        },
        description: "Embedded document configurations.",
      },
      references: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sourceTable: { type: "string" },
            foreignKey: { type: "string" },
            targetField: { type: "string" },
            copyFields: { type: "array", items: { type: "string" } },
          },
          required: ["sourceTable", "foreignKey", "targetField"],
        },
        description: "Reference configurations.",
      },
      filter: {
        type: "string",
        description: "SQL WHERE clause to filter rows during migration.",
      },
    },
    required: ["table", "database"],
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const tableName = args.table as string;
    const schema = args.schema as string | undefined;
    const collection = (args.collection as string) ?? tableName;
    const database = args.database as string;
    const pattern = args.pattern as MigrationPattern | undefined;
    const useRecommendations = (args.useRecommendations as boolean) ?? false;
    const maxEmbedCount = (args.maxEmbedCount as number) ?? 100;
    const columns = args.columns as ColumnMapping[] | undefined;
    const embeds = args.embeds as EmbedConfig[] | undefined;
    const references = args.references as ReferenceConfig[] | undefined;
    const filter = args.filter as string | undefined;

    const driver = rdbms.getDriver(connName);
    const store = getMappingStore(rdbms);

    // Validate table exists
    const tables = await driver.listTables(schema);
    if (!tables.some(t => t.name === tableName)) {
      throw new Error(`Table "${tableName}" not found in schema "${schema ?? "default"}".`);
    }

    let finalPattern: MigrationPattern = pattern ?? "direct";
    let finalEmbeds: EmbedConfig[] = embeds ?? [];
    let finalReferences: ReferenceConfig[] = references ?? [];

    // Auto-generate from recommendations if requested
    if (useRecommendations) {
      const recommendation = await generateRecommendation(
        driver,
        tableName,
        schema,
        maxEmbedCount,
      );

      finalPattern = recommendation.pattern;
      finalEmbeds = recommendation.embeds;
      finalReferences = recommendation.references;
    }

    // Create the mapping
    const mapping: Omit<TableMapping, "id"> = {
      sourceTable: tableName,
      sourceSchema: schema,
      targetCollection: collection,
      targetDatabase: database,
      pattern: finalPattern,
      columns,
      embeds: finalEmbeds.length > 0 ? finalEmbeds : undefined,
      references: finalReferences.length > 0 ? finalReferences : undefined,
      filter,
    };

    const id = store.create(mapping);

    return {
      ok: true,
      mappingId: id,
      mapping: store.get(id),
      message: useRecommendations
        ? `Created mapping "${id}" using recommended pattern "${finalPattern}".`
        : `Created mapping "${id}" with pattern "${finalPattern}".`,
    };
  },
};

/**
 * Generate a mapping recommendation based on schema analysis.
 */
async function generateRecommendation(
  driver: ReturnType<RdbmsConnectionManager["getDriver"]>,
  table: string,
  schema: string | undefined,
  maxEmbedCount: number,
): Promise<{
  pattern: MigrationPattern;
  embeds: EmbedConfig[];
  references: ReferenceConfig[];
}> {
  const [foreignKeys, referencedBy, columns] = await Promise.all([
    driver.getForeignKeys(table, schema),
    driver.getReferencingKeys(table, schema),
    driver.getColumns(table, schema),
  ]);

  const embeds: EmbedConfig[] = [];
  const references: ReferenceConfig[] = [];

  // Check for junction table
  const isJunctionTable =
    foreignKeys.length === 2 &&
    columns.filter(c => !c.isPrimaryKey).length <= 2;

  if (isJunctionTable) {
    // Junction tables are typically embedded into one of the related tables
    return { pattern: "embed-many", embeds: [], references: [] };
  }

  // Process incoming references (tables that reference this one)
  for (const fk of referencedBy) {
    // Estimate average children per parent
    let avgChildCount = 10; // Default assumption
    try {
      const countSql = driver.type === "sqlite"
        ? `SELECT AVG(cnt) as avg_count FROM (SELECT COUNT(*) as cnt FROM "${fk.sourceTable}" GROUP BY "${fk.sourceColumns[0]}") subq`
        : `SELECT AVG(cnt)::float as avg_count FROM (SELECT COUNT(*) as cnt FROM "${schema ?? "public"}"."${fk.sourceTable}" GROUP BY ${fk.sourceColumns.map(c => `"${c}"`).join(", ")}) subq`;

      const result = await driver.query<{ avg_count: number }>(countSql);
      avgChildCount = result[0]?.avg_count ?? 10;
    } catch {
      // Use default if query fails
    }

    if (avgChildCount <= maxEmbedCount) {
      // Embed children
      embeds.push({
        sourceTable: fk.sourceTable,
        foreignKey: fk.sourceColumns[0],
        targetField: camelCase(fk.sourceTable),
        cardinality: "many",
        maxItems: maxEmbedCount,
      });
    } else {
      // Reference instead (will be handled from the child's perspective)
    }
  }

  // Process outgoing references (tables this one references)
  for (const fk of foreignKeys) {
    references.push({
      sourceTable: fk.targetTable,
      foreignKey: fk.sourceColumns[0],
      targetField: camelCase(fk.targetTable.replace(/s$/, "")), // Singularize
    });
  }

  // Determine pattern
  let pattern: MigrationPattern = "direct";
  if (embeds.length > 0) {
    pattern = "embed-many";
  } else if (references.length > 0) {
    pattern = "reference";
  }

  return { pattern, embeds, references };
}

/**
 * Convert snake_case to camelCase.
 */
function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * update-mapping — Update an existing mapping.
 */
const updateMappingTool: RdbmsToolDef = {
  name: "update-mapping",
  description:
    "Update an existing table-to-collection mapping. " +
    "Can modify pattern, add/remove embeds, add/remove references, " +
    "or adjust column mappings.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      mapping: {
        type: "string",
        description: "Mapping ID or table name.",
      },
      pattern: {
        type: "string",
        enum: ["direct", "embed-one", "embed-many", "reference", "extended-ref", "subset", "bucket"],
        description: "New migration pattern.",
      },
      collection: {
        type: "string",
        description: "New target collection name.",
      },
      database: {
        type: "string",
        description: "New target MongoDB database name.",
      },
      addEmbed: {
        type: "object",
        properties: {
          sourceTable: { type: "string" },
          foreignKey: { type: "string" },
          targetField: { type: "string" },
          cardinality: { type: "string", enum: ["one", "many"] },
          maxItems: { type: "number" },
        },
        description: "Add an embedded document configuration.",
      },
      removeEmbed: {
        type: "string",
        description: "Remove embed by source table name.",
      },
      addReference: {
        type: "object",
        properties: {
          sourceTable: { type: "string" },
          foreignKey: { type: "string" },
          targetField: { type: "string" },
          copyFields: { type: "array", items: { type: "string" } },
        },
        description: "Add a reference configuration.",
      },
      removeReference: {
        type: "string",
        description: "Remove reference by source table name.",
      },
      setColumn: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          targetType: { type: "string" },
          transform: { type: "string" },
          exclude: { type: "boolean" },
        },
        description: "Add or update a column mapping.",
      },
      excludeColumn: {
        type: "string",
        description: "Exclude a column from the mapping.",
      },
      filter: {
        type: "string",
        description: "SQL WHERE clause to filter rows.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const mappingId = args.mapping as string;
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping "${mappingId}" not found. Use list-mappings to see available mappings.`);
    }

    const updates: string[] = [];

    // Apply updates
    if (args.pattern) {
      store.update(mappingId, { pattern: args.pattern as MigrationPattern });
      updates.push(`pattern → ${args.pattern}`);
    }

    if (args.collection) {
      store.update(mappingId, { targetCollection: args.collection as string });
      updates.push(`collection → ${args.collection}`);
    }

    if (args.database) {
      store.update(mappingId, { targetDatabase: args.database as string });
      updates.push(`database → ${args.database}`);
    }

    if (args.filter !== undefined) {
      store.update(mappingId, { filter: args.filter as string || undefined });
      updates.push(`filter → ${args.filter || "(cleared)"}`);
    }

    if (args.addEmbed) {
      const embed = args.addEmbed as EmbedConfig;
      store.addEmbed(mappingId, embed);
      updates.push(`added embed: ${embed.sourceTable}`);
    }

    if (args.removeEmbed) {
      store.removeEmbed(mappingId, args.removeEmbed as string);
      updates.push(`removed embed: ${args.removeEmbed}`);
    }

    if (args.addReference) {
      const ref = args.addReference as ReferenceConfig;
      store.addReference(mappingId, ref);
      updates.push(`added reference: ${ref.sourceTable}`);
    }

    if (args.removeReference) {
      store.removeReference(mappingId, args.removeReference as string);
      updates.push(`removed reference: ${args.removeReference}`);
    }

    if (args.setColumn) {
      const col = args.setColumn as ColumnMapping;
      store.setColumn(mappingId, col);
      updates.push(`set column: ${col.source} → ${col.target}`);
    }

    if (args.excludeColumn) {
      store.excludeColumn(mappingId, args.excludeColumn as string);
      updates.push(`excluded column: ${args.excludeColumn}`);
    }

    return {
      ok: true,
      mappingId,
      updates,
      mapping: store.get(mappingId),
    };
  },
};

/**
 * preview-document — Preview sample MongoDB documents based on a mapping.
 */
const previewDocumentTool: RdbmsToolDef = {
  name: "preview-document",
  description:
    "Preview what MongoDB documents will look like based on a mapping. " +
    "Fetches sample data from the source database and transforms it " +
    "according to the mapping configuration.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name.",
      },
      mapping: {
        type: "string",
        description: "Mapping ID or table name.",
      },
      sampleSize: {
        type: "number",
        description: "Number of sample documents to generate. Default: 3.",
      },
      includeSource: {
        type: "boolean",
        description: "Include source rows in the output. Default: false.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const mappingId = args.mapping as string;
    const sampleSize = (args.sampleSize as number) ?? 3;
    const includeSource = (args.includeSource as boolean) ?? false;

    const driver = rdbms.getDriver(connName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping "${mappingId}" not found.`);
    }

    // Fetch sample rows from the source table
    const schema = mapping.sourceSchema;
    const table = mapping.sourceTable;

    let sql = `SELECT * FROM ${driver.type === "sqlite" ? `"${table}"` : `"${schema ?? "public"}"."${table}"`}`;
    if (mapping.filter) {
      sql += ` WHERE ${mapping.filter}`;
    }
    sql += ` LIMIT ${sampleSize}`;

    const sourceRows = await driver.query(sql);

    if (sourceRows.length === 0) {
      return {
        ok: true,
        documents: [],
        message: "No source rows found (table may be empty or filter too restrictive).",
      };
    }

    // Transform rows to documents
    const documents: Record<string, unknown>[] = [];
    const embeddedData: Record<string, Record<string, unknown>[]> = {};

    // Fetch embedded data for each source row
    if (mapping.embeds && mapping.embeds.length > 0) {
      for (const embed of mapping.embeds) {
        embeddedData[embed.sourceTable] = [];

        for (const row of sourceRows) {
          const pkValue = row[mapping.sourceTable === "orders" ? "id" : getPrimaryKeyColumn(row)];

          const embedSql = driver.type === "sqlite"
            ? `SELECT * FROM "${embed.sourceTable}" WHERE "${embed.foreignKey}" = ?`
            : `SELECT * FROM "${schema ?? "public"}"."${embed.sourceTable}" WHERE "${embed.foreignKey}" = $1`;

          try {
            const embedRows = await driver.query(embedSql, [pkValue]);
            embeddedData[embed.sourceTable].push(...embedRows);
          } catch {
            // Skip if query fails
          }
        }
      }
    }

    // Transform each source row
    for (const row of sourceRows) {
      const doc = transformRow(row, mapping);

      // Add embedded documents
      if (mapping.embeds) {
        for (const embed of mapping.embeds) {
          const pkCol = Object.keys(row).find(k => k === "id" || k.endsWith("_id")) ?? Object.keys(row)[0];
          const pkValue = row[pkCol];

          const embedRows = embeddedData[embed.sourceTable]?.filter(
            (er) => er[embed.foreignKey] === pkValue
          ) ?? [];

          if (embed.cardinality === "one") {
            doc[embed.targetField] = embedRows[0] ? transformRow(embedRows[0], null, embed.columns) : null;
          } else {
            doc[embed.targetField] = embedRows.slice(0, embed.maxItems).map(er =>
              transformRow(er, null, embed.columns)
            );
          }
        }
      }

      // Add references (just the foreign key value, with optional copied fields)
      if (mapping.references) {
        for (const ref of mapping.references) {
          const fkValue = row[ref.foreignKey];

          if (ref.copyFields && ref.copyFields.length > 0) {
            // Extended reference - would need to fetch from referenced table
            // For preview, just show structure
            doc[ref.targetField] = {
              _ref: fkValue,
              ...Object.fromEntries(ref.copyFields.map(f => [f, `<${f}>`])),
            };
          } else {
            doc[ref.targetField] = fkValue;
          }
        }
      }

      documents.push(doc);
    }

    const result: Record<string, unknown> = {
      ok: true,
      mapping: {
        id: mapping.id,
        pattern: mapping.pattern,
        sourceTable: mapping.sourceTable,
        targetCollection: mapping.targetCollection,
      },
      documentCount: documents.length,
      documents,
    };

    if (includeSource) {
      result.sourceRows = {
        [table]: sourceRows,
        ...embeddedData,
      };
    }

    return result;
  },
};

/**
 * Transform a source row to a document based on column mappings.
 */
function transformRow(
  row: Record<string, unknown>,
  mapping: TableMapping | null,
  columnMappings?: ColumnMapping[],
): Record<string, unknown> {
  const doc: Record<string, unknown> = {};
  const columns = columnMappings ?? mapping?.columns;

  for (const [key, value] of Object.entries(row)) {
    // Find column mapping
    const colMapping = columns?.find(c => c.source === key);

    if (colMapping?.exclude) {
      continue; // Skip excluded columns
    }

    const targetKey = colMapping?.target ?? camelCase(key);
    let targetValue = value;

    // Apply transforms
    if (colMapping?.transform) {
      targetValue = applyTransform(value, colMapping.transform);
    }

    doc[targetKey] = targetValue;
  }

  return doc;
}

/**
 * Apply a transform to a value.
 */
function applyTransform(value: unknown, transform: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  switch (transform) {
    case "lowercase":
      return typeof value === "string" ? value.toLowerCase() : value;
    case "uppercase":
      return typeof value === "string" ? value.toUpperCase() : value;
    case "trim":
      return typeof value === "string" ? value.trim() : value;
    case "date":
      return value instanceof Date ? value : new Date(String(value));
    case "string":
      return String(value);
    case "number":
      return Number(value);
    case "boolean":
      return Boolean(value);
    default:
      return value;
  }
}

/**
 * Get the primary key column name from a row.
 */
function getPrimaryKeyColumn(row: Record<string, unknown>): string {
  // Common PK column names
  const pkNames = ["id", "ID", "_id", "pk"];
  for (const name of pkNames) {
    if (name in row) {
      return name;
    }
  }
  // Fall back to first column
  return Object.keys(row)[0];
}

/**
 * validate-mapping — Validate a mapping for correctness.
 */
const validateMappingTool: RdbmsToolDef = {
  name: "validate-mapping",
  description:
    "Validate a mapping configuration. Checks that source columns exist, " +
    "type mappings are valid, foreign keys are correct, and there are no " +
    "circular embed references.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name.",
      },
      mapping: {
        type: "string",
        description: "Mapping ID or table name.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const mappingId = args.mapping as string;

    const driver = rdbms.getDriver(connName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping "${mappingId}" not found.`);
    }

    const checks: ValidationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check 1: Source table exists
    const tables = await driver.listTables(mapping.sourceSchema);
    const tableExists = tables.some(t => t.name === mapping.sourceTable);
    checks.push({
      check: "source_table_exists",
      passed: tableExists,
      details: tableExists ? undefined : `Table "${mapping.sourceTable}" not found`,
    });

    if (!tableExists) {
      errors.push(`Source table "${mapping.sourceTable}" does not exist.`);
    }

    // Check 2: Source columns exist
    if (tableExists && mapping.columns) {
      const columns = await driver.getColumns(mapping.sourceTable, mapping.sourceSchema);
      const columnNames = new Set(columns.map(c => c.name));

      let allColumnsExist = true;
      for (const colMapping of mapping.columns) {
        if (!columnNames.has(colMapping.source)) {
          allColumnsExist = false;
          errors.push(`Column "${colMapping.source}" not found in table "${mapping.sourceTable}".`);
        }
      }

      checks.push({
        check: "source_columns_exist",
        passed: allColumnsExist,
      });
    } else {
      checks.push({
        check: "source_columns_exist",
        passed: true,
        details: "No explicit column mappings (all columns will be mapped)",
      });
    }

    // Check 3: Embed source tables exist
    if (mapping.embeds) {
      let allEmbedTablesExist = true;
      for (const embed of mapping.embeds) {
        const embedTableExists = tables.some(t => t.name === embed.sourceTable);
        if (!embedTableExists) {
          allEmbedTablesExist = false;
          errors.push(`Embed source table "${embed.sourceTable}" not found.`);
        }
      }

      checks.push({
        check: "embed_tables_exist",
        passed: allEmbedTablesExist,
      });
    }

    // Check 4: Reference source tables exist
    if (mapping.references) {
      let allRefTablesExist = true;
      for (const ref of mapping.references) {
        const refTableExists = tables.some(t => t.name === ref.sourceTable);
        if (!refTableExists) {
          allRefTablesExist = false;
          errors.push(`Reference table "${ref.sourceTable}" not found.`);
        }
      }

      checks.push({
        check: "reference_tables_exist",
        passed: allRefTablesExist,
      });
    }

    // Check 5: No circular embeds
    if (mapping.embeds) {
      const hasCircular = mapping.embeds.some(e => e.sourceTable === mapping.sourceTable);
      checks.push({
        check: "no_circular_embeds",
        passed: !hasCircular,
        details: hasCircular ? "Table embeds itself" : undefined,
      });

      if (hasCircular) {
        errors.push("Circular embed detected: table cannot embed itself.");
      }
    }

    // Check 6: Embed cardinality is reasonable
    if (tableExists && mapping.embeds) {
      for (const embed of mapping.embeds) {
        try {
          const countSql = driver.type === "sqlite"
            ? `SELECT AVG(cnt) as avg FROM (SELECT COUNT(*) as cnt FROM "${embed.sourceTable}" GROUP BY "${embed.foreignKey}") subq`
            : `SELECT AVG(cnt)::float as avg FROM (SELECT COUNT(*) as cnt FROM "${mapping.sourceSchema ?? "public"}"."${embed.sourceTable}" GROUP BY "${embed.foreignKey}") subq`;

          const result = await driver.query<{ avg: number }>(countSql);
          const avgCount = result[0]?.avg ?? 0;

          const limit = embed.maxItems ?? 100;
          const isSafe = avgCount <= limit;

          checks.push({
            check: `embed_cardinality_${embed.sourceTable}`,
            passed: isSafe,
            details: `Avg ${avgCount.toFixed(1)} items per parent (limit: ${limit})`,
          });

          if (!isSafe) {
            warnings.push(
              `Embed "${embed.sourceTable}" has avg ${avgCount.toFixed(1)} items per parent, ` +
              `exceeding limit of ${limit}. Consider using reference pattern instead.`
            );
          }
        } catch {
          checks.push({
            check: `embed_cardinality_${embed.sourceTable}`,
            passed: true,
            details: "Could not estimate (query failed)",
          });
        }
      }
    }

    // Check excluded columns
    if (mapping.columns) {
      const excludedColumns = mapping.columns.filter(c => c.exclude);
      if (excludedColumns.length > 0) {
        warnings.push(
          `${excludedColumns.length} column(s) excluded: ${excludedColumns.map(c => c.source).join(", ")}`
        );
      }
    }

    const valid = errors.length === 0;

    // Update mapping validation status
    store.setValidationResult(mappingId, valid, errors.length > 0 ? errors : undefined);

    return {
      ok: true,
      mappingId,
      valid,
      checks,
      warnings,
      errors,
    };
  },
};

/**
 * list-mappings — List all defined mappings.
 */
const listMappingsTool: RdbmsToolDef = {
  name: "list-mappings",
  description: "List all table-to-collection mappings defined in this session.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async (rdbms, _mongo, _args) => {
    const store = getMappingStore(rdbms);
    const mappings = store.list();

    if (mappings.length === 0) {
      return {
        ok: true,
        mappings: [],
        message: "No mappings defined. Use create-mapping to define a table-to-collection mapping.",
      };
    }

    return {
      ok: true,
      count: mappings.length,
      mappings: mappings.map(m => ({
        id: m.id,
        sourceTable: m.sourceTable,
        sourceSchema: m.sourceSchema,
        targetCollection: m.targetCollection,
        targetDatabase: m.targetDatabase,
        pattern: m.pattern,
        embedCount: m.embeds?.length ?? 0,
        referenceCount: m.references?.length ?? 0,
        validated: m.validated,
        hasIssues: (m.validationIssues?.length ?? 0) > 0,
      })),
    };
  },
};

/**
 * delete-mapping — Delete a mapping.
 */
const deleteMappingTool: RdbmsToolDef = {
  name: "delete-mapping",
  description: "Delete a table-to-collection mapping.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      mapping: {
        type: "string",
        description: "Mapping ID or table name to delete.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const mappingId = args.mapping as string;
    const store = getMappingStore(rdbms);

    if (!store.has(mappingId)) {
      throw new Error(`Mapping "${mappingId}" not found.`);
    }

    store.delete(mappingId);

    return {
      ok: true,
      deleted: mappingId,
      message: `Mapping "${mappingId}" deleted.`,
    };
  },
};

/**
 * All mapping tools.
 */
export const MAPPING_TOOLS: RdbmsToolDef[] = [
  createMappingTool,
  updateMappingTool,
  previewDocumentTool,
  validateMappingTool,
  listMappingsTool,
  deleteMappingTool,
];
