/**
 * DocumentTransformer — transforms RDBMS rows to MongoDB documents.
 *
 * Handles column mappings, type conversions, and embed resolution.
 * Designed to be stateless and easily testable.
 */

import type { RdbmsDriver } from "../drivers/types.js";
import type {
  TableMapping,
  ColumnMapping,
  EmbedConfig,
  ReferenceConfig,
  BsonType,
} from "../types.js";

/**
 * Transforms RDBMS rows to MongoDB documents based on mapping configuration.
 */
export class DocumentTransformer {
  /**
   * Transform a single row to a document.
   *
   * @param row Source row from RDBMS.
   * @param mapping Table mapping configuration.
   * @returns Transformed document.
   */
  transformRow(
    row: Record<string, unknown>,
    mapping: TableMapping,
  ): Record<string, unknown> {
    const doc: Record<string, unknown> = {};

    // Apply column mappings
    for (const [key, value] of Object.entries(row)) {
      const colMapping = mapping.columns?.find((c) => c.source === key);

      // Skip excluded columns
      if (colMapping?.exclude) {
        continue;
      }

      // Determine target field name
      const targetKey = colMapping?.target ?? this.camelCase(key);

      // Apply transformation if specified
      let targetValue = value;
      if (colMapping?.transform) {
        targetValue = this.applyTransform(value, colMapping.transform);
      }

      // Convert type if specified
      if (colMapping?.targetType) {
        targetValue = this.convertType(targetValue, colMapping.targetType);
      }

      doc[targetKey] = targetValue;
    }

    return doc;
  }

  /**
   * Transform a batch of rows to documents.
   *
   * @param rows Source rows from RDBMS.
   * @param mapping Table mapping configuration.
   * @returns Transformed documents.
   */
  transformBatch(
    rows: Record<string, unknown>[],
    mapping: TableMapping,
  ): Record<string, unknown>[] {
    return rows.map((row) => this.transformRow(row, mapping));
  }

  /**
   * Resolve embedded documents for a batch of parent rows.
   *
   * Uses batch fetching to avoid N+1 queries.
   *
   * @param parentRows Parent rows from the main table.
   * @param embed Embed configuration.
   * @param driver RDBMS driver for fetching child rows.
   * @param schema Database schema.
   * @returns Map of parent ID to embedded documents.
   */
  async resolveEmbeds(
    parentRows: Record<string, unknown>[],
    embed: EmbedConfig,
    driver: RdbmsDriver,
    schema?: string,
  ): Promise<Map<unknown, Record<string, unknown>[]>> {
    if (parentRows.length === 0) {
      return new Map();
    }

    // Find the primary key column in parent rows
    const pkColumn = this.findPrimaryKeyColumn(parentRows[0]);
    const parentIds = parentRows.map((r) => r[pkColumn]);

    // Build query to fetch all children for these parents
    const placeholders = parentIds.map((_, i) =>
      driver.type === "sqlite" ? "?" : `$${i + 1}`
    ).join(", ");

    const tableName = driver.type === "sqlite"
      ? `"${embed.sourceTable}"`
      : `"${schema ?? "public"}"."${embed.sourceTable}"`;

    const sql = `
      SELECT * FROM ${tableName}
      WHERE "${embed.foreignKey}" IN (${placeholders})
      ${embed.orderBy ? `ORDER BY ${embed.orderBy.map(o => `"${o.column}" ${o.direction}`).join(", ")}` : ""}
    `;

    const childRows = await driver.query<Record<string, unknown>>(sql, parentIds);

    // Group children by parent ID
    const childrenByParent = new Map<unknown, Record<string, unknown>[]>();

    for (const childRow of childRows) {
      const parentId = childRow[embed.foreignKey];
      const existing = childrenByParent.get(parentId) ?? [];

      // Transform child row
      const transformedChild = this.transformChildRow(childRow, embed);

      // Respect maxItems limit
      if (!embed.maxItems || existing.length < embed.maxItems) {
        existing.push(transformedChild);
        childrenByParent.set(parentId, existing);
      }
    }

    return childrenByParent;
  }

  /**
   * Transform a child row for embedding.
   */
  private transformChildRow(
    row: Record<string, unknown>,
    embed: EmbedConfig,
  ): Record<string, unknown> {
    const doc: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      // Skip the foreign key column (redundant when embedded)
      if (key === embed.foreignKey) {
        continue;
      }

      // Check for column mapping
      const colMapping = embed.columns?.find((c) => c.source === key);

      if (colMapping?.exclude) {
        continue;
      }

      const targetKey = colMapping?.target ?? this.camelCase(key);
      let targetValue = value;

      if (colMapping?.transform) {
        targetValue = this.applyTransform(value, colMapping.transform);
      }

      doc[targetKey] = targetValue;
    }

    return doc;
  }

  /**
   * Resolve references for a batch of rows.
   *
   * For extended references, fetches additional fields from referenced table.
   *
   * @param rows Source rows.
   * @param reference Reference configuration.
   * @param driver RDBMS driver.
   * @param schema Database schema.
   * @returns Map of foreign key value to reference data.
   */
  async resolveReferences(
    rows: Record<string, unknown>[],
    reference: ReferenceConfig,
    driver: RdbmsDriver,
    schema?: string,
  ): Promise<Map<unknown, Record<string, unknown>>> {
    if (rows.length === 0 || !reference.copyFields?.length) {
      // No extended reference - just keep the FK value
      return new Map();
    }

    // Get unique FK values
    const fkValues = [...new Set(rows.map((r) => r[reference.foreignKey]))];
    const validFkValues = fkValues.filter((v) => v !== null && v !== undefined);

    if (validFkValues.length === 0) {
      return new Map();
    }

    // Fetch referenced rows
    const placeholders = validFkValues.map((_, i) =>
      driver.type === "sqlite" ? "?" : `$${i + 1}`
    ).join(", ");

    const columns = ["id", ...reference.copyFields].map((c) => `"${c}"`).join(", ");
    const tableName = driver.type === "sqlite"
      ? `"${reference.sourceTable}"`
      : `"${schema ?? "public"}"."${reference.sourceTable}"`;

    const sql = `SELECT ${columns} FROM ${tableName} WHERE "id" IN (${placeholders})`;
    const refRows = await driver.query<Record<string, unknown>>(sql, validFkValues);

    // Build lookup map
    const refMap = new Map<unknown, Record<string, unknown>>();

    for (const refRow of refRows) {
      const refData: Record<string, unknown> = {};

      for (const field of reference.copyFields) {
        refData[this.camelCase(field)] = refRow[field];
      }

      refMap.set(refRow.id, refData);
    }

    return refMap;
  }

  /**
   * Apply embeds and references to a batch of documents.
   *
   * @param rows Original source rows.
   * @param docs Transformed documents.
   * @param mapping Table mapping.
   * @param driver RDBMS driver.
   * @param schema Database schema.
   */
  async applyEmbedsAndReferences(
    rows: Record<string, unknown>[],
    docs: Record<string, unknown>[],
    mapping: TableMapping,
    driver: RdbmsDriver,
    schema?: string,
  ): Promise<void> {
    const pkColumn = rows.length > 0 ? this.findPrimaryKeyColumn(rows[0]) : "id";

    // Resolve embeds
    if (mapping.embeds) {
      for (const embed of mapping.embeds) {
        const embedMap = await this.resolveEmbeds(rows, embed, driver, schema);

        for (let i = 0; i < rows.length; i++) {
          const parentId = rows[i][pkColumn];
          const embedded = embedMap.get(parentId) ?? [];

          if (embed.cardinality === "one") {
            docs[i][embed.targetField] = embedded[0] ?? null;
          } else {
            docs[i][embed.targetField] = embedded;
          }
        }
      }
    }

    // Resolve references
    if (mapping.references) {
      for (const ref of mapping.references) {
        if (ref.copyFields && ref.copyFields.length > 0) {
          // Extended reference - fetch and embed additional fields
          const refMap = await this.resolveReferences(rows, ref, driver, schema);

          for (let i = 0; i < rows.length; i++) {
            const fkValue = rows[i][ref.foreignKey];
            const refData = refMap.get(fkValue);

            if (refData) {
              docs[i][ref.targetField] = {
                _id: fkValue,
                ...refData,
              };
            } else {
              docs[i][ref.targetField] = { _id: fkValue };
            }
          }
        } else {
          // Simple reference - just rename the FK field
          for (let i = 0; i < rows.length; i++) {
            docs[i][ref.targetField] = rows[i][ref.foreignKey];

            // Remove the original FK field if it was renamed
            const originalKey = this.camelCase(ref.foreignKey);
            if (originalKey !== ref.targetField && originalKey in docs[i]) {
              delete docs[i][originalKey];
            }
          }
        }
      }
    }
  }

  /**
   * Find the primary key column in a row.
   */
  private findPrimaryKeyColumn(row: Record<string, unknown>): string {
    const candidates = ["id", "ID", "_id", "pk"];
    for (const name of candidates) {
      if (name in row) {
        return name;
      }
    }
    // Fall back to first column
    return Object.keys(row)[0];
  }

  /**
   * Convert snake_case to camelCase.
   */
  private camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Apply a named transform to a value.
   */
  private applyTransform(value: unknown, transform: string): unknown {
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
      case "string":
        return String(value);
      case "number":
        return Number(value);
      case "boolean":
        return Boolean(value);
      case "date":
        if (value instanceof Date) return value;
        return new Date(String(value));
      case "objectId":
        // Keep as string - MongoDB driver will handle conversion
        return String(value);
      default:
        return value;
    }
  }

  /**
   * Convert a value to a target BSON type.
   */
  private convertType(value: unknown, targetType: BsonType): unknown {
    if (value === null || value === undefined) {
      return value;
    }

    switch (targetType) {
      case "string":
        return String(value);
      case "int":
        return Math.trunc(Number(value));
      case "long":
        return Number(value);
      case "double":
        return Number(value);
      case "decimal":
        return Number(value);
      case "bool":
        return Boolean(value);
      case "date":
        return value instanceof Date ? value : new Date(String(value));
      case "objectId":
        return String(value);
      case "null":
        return null;
      default:
        return value;
    }
  }
}
