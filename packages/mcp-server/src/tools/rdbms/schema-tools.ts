/**
 * RDBMS Schema introspection tools.
 *
 * Tools for extracting and analyzing relational database schemas
 * to prepare for migration to MongoDB.
 */

import type { RdbmsToolDef, RelationshipAnalysis, PatternRecommendation, MigrationPattern } from "./types.js";
import type { TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo } from "./drivers/index.js";

/**
 * Full schema information for a table.
 */
interface TableSchema {
  name: string;
  schema?: string;
  type: "table" | "view";
  columns: ColumnInfo[];
  primaryKey: string[];
  foreignKeys: ForeignKeyInfo[];
  referencedBy: ForeignKeyInfo[];
  indexes: IndexInfo[];
  rowCount?: number;
}

/**
 * introspect-schema — Extract schema from an RDBMS.
 */
const introspectSchemaTool: RdbmsToolDef = {
  name: "introspect-schema",
  description:
    "Extract schema from a relational database: tables, columns, types, " +
    "primary keys, foreign keys, and indexes. Returns a complete picture " +
    "of the source schema for migration planning. " +
    "Use this as the first step in any migration workflow.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description:
          "RDBMS connection name. Use list-rdbms to see available connections. " +
          "If not specified, uses the default connection.",
      },
      schema: {
        type: "string",
        description:
          'Database schema to introspect. Defaults to "public" for PostgreSQL.',
      },
      tables: {
        type: "array",
        items: { type: "string" },
        description:
          "Specific tables to introspect. If not specified, introspects all tables.",
      },
      includeViews: {
        type: "boolean",
        description: "Include views in the introspection. Default: false.",
      },
    },
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const schema = (args.schema as string) ?? "public";
    const filterTables = args.tables as string[] | undefined;
    const includeViews = (args.includeViews as boolean) ?? false;

    const driver = rdbms.getDriver(connName);

    // Get all tables
    let allTables = await driver.listTables(schema);

    // Filter by type if needed
    if (!includeViews) {
      allTables = allTables.filter((t) => t.type === "table");
    }

    // Filter by name if specified
    const tables = filterTables
      ? allTables.filter((t) => filterTables.includes(t.name))
      : allTables;

    // Get detailed schema for each table
    const tableSchemas: TableSchema[] = await Promise.all(
      tables.map(async (table) => {
        const [columns, primaryKey, foreignKeys, referencedBy, indexes] =
          await Promise.all([
            driver.getColumns(table.name, schema),
            driver.getPrimaryKey(table.name, schema),
            driver.getForeignKeys(table.name, schema),
            driver.getReferencingKeys(table.name, schema),
            driver.getIndexes(table.name, schema),
          ]);

        return {
          name: table.name,
          schema,
          type: table.type,
          columns,
          primaryKey,
          foreignKeys,
          referencedBy,
          indexes,
          rowCount: table.rowCount,
        };
      }),
    );

    // Calculate summary statistics
    const totalColumns = tableSchemas.reduce(
      (sum, t) => sum + t.columns.length,
      0,
    );
    const totalForeignKeys = tableSchemas.reduce(
      (sum, t) => sum + t.foreignKeys.length,
      0,
    );
    const totalIndexes = tableSchemas.reduce(
      (sum, t) => sum + t.indexes.length,
      0,
    );

    return {
      ok: true,
      schema,
      summary: {
        tableCount: tableSchemas.length,
        totalColumns,
        totalForeignKeys,
        totalIndexes,
      },
      tables: tableSchemas,
    };
  },
};

/**
 * analyze-relationships — Analyze table relationships for migration planning.
 */
const analyzeRelationshipsTool: RdbmsToolDef = {
  name: "analyze-relationships",
  description:
    "Analyze relationships between tables to understand how they should be " +
    "migrated to MongoDB. Identifies 1:1, 1:N, and N:N relationships, " +
    "junction tables, and self-references. Use after introspect-schema.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name.",
      },
      schema: {
        type: "string",
        description: 'Database schema. Defaults to "public".',
      },
      table: {
        type: "string",
        description:
          "Specific table to analyze. If not specified, analyzes all tables.",
      },
    },
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const schema = (args.schema as string) ?? "public";
    const tableName = args.table as string | undefined;

    const driver = rdbms.getDriver(connName);

    // Get tables to analyze
    let tables = await driver.listTables(schema);
    tables = tables.filter((t) => t.type === "table");

    if (tableName) {
      tables = tables.filter((t) => t.name === tableName);
      if (tables.length === 0) {
        throw new Error(`Table "${tableName}" not found in schema "${schema}".`);
      }
    }

    // Analyze each table
    const analyses: RelationshipAnalysis[] = await Promise.all(
      tables.map(async (table) => {
        const [foreignKeys, referencedBy, columns] = await Promise.all([
          driver.getForeignKeys(table.name, schema),
          driver.getReferencingKeys(table.name, schema),
          driver.getColumns(table.name, schema),
        ]);

        // Determine cardinality for outgoing references
        const referencesTo = foreignKeys.map((fk) => {
          // Check if FK columns are unique (1:1) or not (N:1)
          const isUnique = fk.sourceColumns.every((col) => {
            const colInfo = columns.find((c) => c.name === col);
            return colInfo?.isPrimaryKey; // Simplification: PK implies unique
          });

          return {
            table: fk.targetTable,
            foreignKey: fk.sourceColumns.join(", "),
            cardinality: isUnique ? ("one" as const) : ("many" as const),
          };
        });

        // Determine cardinality for incoming references
        const referencedByAnalysis = await Promise.all(
          referencedBy.map(async (fk) => {
            // Get average count of referencing rows
            let averageCount: number | undefined;
            try {
              const countSql = `
                SELECT AVG(cnt) as avg_count FROM (
                  SELECT COUNT(*) as cnt
                  FROM "${schema}"."${fk.sourceTable}"
                  GROUP BY ${fk.sourceColumns.map((c) => `"${c}"`).join(", ")}
                ) subq
              `;
              const result = await driver.query<{ avg_count: string }>(countSql);
              averageCount = parseFloat(result[0]?.avg_count) || undefined;
            } catch {
              // Ignore errors in count estimation
            }

            return {
              table: fk.sourceTable,
              foreignKey: fk.sourceColumns.join(", "),
              cardinality: "many" as const, // Incoming refs are typically many
              averageCount,
            };
          }),
        );

        // Detect junction table (N:N relationship)
        // A junction table typically has:
        // - Exactly 2 foreign keys
        // - Primary key composed of the FK columns
        // - Few or no additional columns
        const isJunctionTable =
          foreignKeys.length === 2 &&
          columns.filter((c) => !c.isPrimaryKey).length <= 2;

        // Detect self-reference
        const hasSelfReference = foreignKeys.some(
          (fk) => fk.targetTable === table.name,
        );

        return {
          table: table.name,
          referencesTo,
          referencedBy: referencedByAnalysis,
          isJunctionTable,
          hasSelfReference,
        };
      }),
    );

    // Identify N:N relationships through junction tables
    const manyToManyRelationships: Array<{
      table1: string;
      table2: string;
      junctionTable: string;
    }> = [];

    for (const analysis of analyses) {
      if (analysis.isJunctionTable && analysis.referencesTo.length === 2) {
        manyToManyRelationships.push({
          table1: analysis.referencesTo[0].table,
          table2: analysis.referencesTo[1].table,
          junctionTable: analysis.table,
        });
      }
    }

    return {
      ok: true,
      schema,
      analyses: tableName ? analyses[0] : analyses,
      manyToManyRelationships,
      summary: {
        tablesAnalyzed: analyses.length,
        junctionTables: analyses.filter((a) => a.isJunctionTable).length,
        selfReferencingTables: analyses.filter((a) => a.hasSelfReference).length,
        manyToManyCount: manyToManyRelationships.length,
      },
    };
  },
};

/**
 * recommend-patterns — Recommend migration patterns for tables.
 */
const recommendPatternsTool: RdbmsToolDef = {
  name: "recommend-patterns",
  description:
    "Recommend MongoDB migration patterns for tables based on their " +
    "relationships, row counts, and structure. Suggests whether to use " +
    "embedding, referencing, or other patterns. Use after analyze-relationships.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name.",
      },
      schema: {
        type: "string",
        description: 'Database schema. Defaults to "public".',
      },
      table: {
        type: "string",
        description: "Table to get recommendations for.",
      },
      maxEmbedCount: {
        type: "number",
        description:
          "Maximum average child count to recommend embedding. Default: 100. " +
          "Tables with more children per parent will recommend referencing.",
      },
    },
    required: ["table"],
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const schema = (args.schema as string) ?? "public";
    const tableName = args.table as string;
    const maxEmbedCount = (args.maxEmbedCount as number) ?? 100;

    const driver = rdbms.getDriver(connName);

    // Get table info
    const [columns, primaryKey, foreignKeys, referencedBy, rowCount] =
      await Promise.all([
        driver.getColumns(tableName, schema),
        driver.getPrimaryKey(tableName, schema),
        driver.getForeignKeys(tableName, schema),
        driver.getReferencingKeys(tableName, schema),
        driver.countRows(tableName, schema),
      ]);

    const recommendations: PatternRecommendation[] = [];

    // Check if it's a junction table
    const isJunctionTable =
      foreignKeys.length === 2 &&
      columns.filter((c) => !c.isPrimaryKey).length <= 2;

    if (isJunctionTable) {
      recommendations.push({
        pattern: "embed-many",
        confidence: 0.8,
        reasoning:
          "This appears to be a junction table for a many-to-many relationship. " +
          "Consider embedding the relationship as an array in one of the related collections.",
        pros: [
          "Eliminates the junction collection",
          "Simplifies queries",
          "Atomic updates",
        ],
        cons: [
          "May duplicate data if embedded on both sides",
          "Document size limit if relationship count is high",
        ],
      });
    }

    // Analyze each incoming relationship (tables that reference this one)
    for (const fk of referencedBy) {
      // Estimate average children per parent
      let avgChildCount = 0;
      try {
        const countSql = `
          SELECT AVG(cnt)::float as avg_count FROM (
            SELECT COUNT(*) as cnt
            FROM "${schema}"."${fk.sourceTable}"
            GROUP BY ${fk.sourceColumns.map((c) => `"${c}"`).join(", ")}
          ) subq
        `;
        const result = await driver.query<{ avg_count: number }>(countSql);
        avgChildCount = result[0]?.avg_count || 0;
      } catch {
        // Default to assuming it's a 1:N with moderate count
        avgChildCount = 10;
      }

      const childTableName = fk.sourceTable;

      if (avgChildCount <= maxEmbedCount) {
        recommendations.push({
          pattern: "embed-many",
          confidence: avgChildCount <= 20 ? 0.9 : 0.7,
          reasoning:
            `Table "${childTableName}" references this table with ~${avgChildCount.toFixed(1)} ` +
            `children per parent on average. This is suitable for embedding.`,
          pros: [
            "Single document read for parent + children",
            "Atomic updates",
            `Moderate child count (${avgChildCount.toFixed(1)} avg)`,
          ],
          cons: [
            "Children cannot be queried independently",
            "Updates to children require updating parent document",
          ],
        });
      } else {
        recommendations.push({
          pattern: "reference",
          confidence: 0.8,
          reasoning:
            `Table "${childTableName}" has ~${avgChildCount.toFixed(1)} children per parent ` +
            `on average, exceeding the embedding threshold (${maxEmbedCount}). Use referencing.`,
          pros: [
            "Handles unlimited children",
            "Children can be queried independently",
            "Parent documents stay small",
          ],
          cons: [
            "Requires $lookup for joins",
            "Multiple queries for parent + children",
          ],
        });
      }
    }

    // If table has outgoing references, suggest extended-ref for common lookups
    for (const fk of foreignKeys) {
      recommendations.push({
        pattern: "extended-ref",
        confidence: 0.6,
        reasoning:
          `This table references "${fk.targetTable}". Consider copying frequently ` +
          `accessed fields from the referenced table to avoid $lookup.`,
        pros: [
          "Faster reads without $lookup",
          "Single document contains needed data",
        ],
        cons: [
          "Denormalized data requires sync",
          "Increased storage",
        ],
      });
    }

    // Default recommendation if no relationships
    if (recommendations.length === 0) {
      recommendations.push({
        pattern: "direct",
        confidence: 0.9,
        reasoning:
          "This table has no foreign key relationships. A direct 1:1 mapping " +
          "from table to collection is recommended.",
        pros: [
          "Simple migration",
          "Easy to understand",
          "No transformation needed",
        ],
        cons: [],
      });
    }

    // Sort by confidence
    recommendations.sort((a, b) => b.confidence - a.confidence);

    return {
      ok: true,
      table: tableName,
      schema,
      rowCount,
      columnCount: columns.length,
      primaryKey,
      foreignKeyCount: foreignKeys.length,
      referencedByCount: referencedBy.length,
      isJunctionTable,
      recommendations,
      topRecommendation: recommendations[0],
    };
  },
};

/**
 * All schema tools.
 */
export const SCHEMA_TOOLS: RdbmsToolDef[] = [
  introspectSchemaTool,
  analyzeRelationshipsTool,
  recommendPatternsTool,
];
