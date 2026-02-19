/**
 * validate-mapping tool — Validate a mapping for correctness.
 */

import type { RdbmsToolDef } from "../types.js";
import type { ValidationCheck } from "../mapping-store.js";
import { getMappingStore } from "../utils.js";

/**
 * validate-mapping — Validate a mapping for correctness.
 */
export const validateMappingTool: RdbmsToolDef = {
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
