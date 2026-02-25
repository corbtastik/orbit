/**
 * preview-document tool — Preview sample MongoDB documents based on a mapping.
 */

import type { RdbmsToolDef } from "../types.js";
import { getMappingStore } from "../utils.js";
import { transformRow, getPrimaryKeyColumn, validateSqlFilter } from "./helpers.js";

/**
 * preview-document — Preview sample MongoDB documents based on a mapping.
 */
export const previewDocumentTool: RdbmsToolDef = {
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

    // Validate filter for SQL injection (defense in depth - also validated at creation)
    const safeFilter = validateSqlFilter(mapping.filter);

    let sql = `SELECT * FROM ${driver.type === "sqlite" ? `"${table}"` : `"${schema ?? "public"}"."${table}"`}`;
    if (safeFilter) {
      sql += ` WHERE ${safeFilter}`;
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
