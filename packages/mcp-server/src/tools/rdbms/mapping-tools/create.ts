/**
 * create-mapping tool — Create a table-to-collection mapping.
 */

import type {
  RdbmsToolDef,
  TableMapping,
  ColumnMapping,
  EmbedConfig,
  ReferenceConfig,
  MigrationPattern,
} from "../types.js";
import type { RdbmsConnectionManager } from "../connection.js";
import { getMappingStore } from "../utils.js";
import { camelCase } from "./helpers.js";

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
    }
    // Reference instead will be handled from the child's perspective
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
 * create-mapping — Create a table-to-collection mapping.
 */
export const createMappingTool: RdbmsToolDef = {
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
