/**
 * IndexGenerator — generates MongoDB index recommendations from RDBMS indexes.
 *
 * Translates relational indexes to MongoDB equivalents, accounting for
 * field name mappings and excluded columns.
 */

import type { Db } from "mongodb";
import type { TableMapping, ColumnMapping } from "../types.js";
import type { IndexInfo } from "../drivers/types.js";

/**
 * A recommended MongoDB index.
 */
export interface IndexRecommendation {
  /** Target collection name. */
  collection: string;

  /** Index keys with sort direction. */
  keys: Record<string, 1 | -1>;

  /** Index options. */
  options: {
    unique?: boolean;
    name?: string;
    sparse?: boolean;
  };

  /** Original RDBMS index name. */
  sourceIndex: string;

  /** Explanation of why this index is recommended. */
  reason: string;
}

/**
 * Result of index generation.
 */
export interface IndexGenerationResult {
  /** Target collection. */
  collection: string;

  /** Generated recommendations. */
  recommendations: IndexRecommendation[];

  /** MongoDB shell commands. */
  commands: string[];

  /** Indexes that couldn't be translated. */
  skipped: Array<{
    index: string;
    reason: string;
  }>;
}

/**
 * Generates MongoDB index recommendations from RDBMS index metadata.
 */
export class IndexGenerator {
  /**
   * Generate index recommendations for a mapping.
   *
   * @param mapping Table mapping configuration.
   * @param indexes Source RDBMS indexes.
   * @returns Index generation result.
   */
  generate(mapping: TableMapping, indexes: IndexInfo[]): IndexGenerationResult {
    const recommendations: IndexRecommendation[] = [];
    const skipped: IndexGenerationResult["skipped"] = [];
    const collection = mapping.targetCollection;

    // Build column name mapping (source -> target)
    const fieldMap = this.buildFieldMap(mapping.columns);

    for (const index of indexes) {
      // Skip primary key indexes (MongoDB handles _id automatically)
      if (index.isPrimary) {
        skipped.push({
          index: index.name,
          reason: "Primary key index — MongoDB creates _id index automatically",
        });
        continue;
      }

      // Map index columns to MongoDB field names
      const mappedColumns = this.mapIndexColumns(index.columns, fieldMap, mapping);

      if (mappedColumns.skipped.length > 0) {
        skipped.push({
          index: index.name,
          reason: `Excluded columns: ${mappedColumns.skipped.join(", ")}`,
        });
        continue;
      }

      if (mappedColumns.fields.length === 0) {
        skipped.push({
          index: index.name,
          reason: "No columns mapped to target fields",
        });
        continue;
      }

      // Build index keys
      const keys: Record<string, 1 | -1> = {};
      for (const field of mappedColumns.fields) {
        keys[field.name] = field.direction;
      }

      // Determine index type description
      const indexType = this.describeIndexType(index, mappedColumns.fields.length);

      recommendations.push({
        collection,
        keys,
        options: {
          unique: index.unique || undefined,
          name: this.generateIndexName(collection, mappedColumns.fields),
        },
        sourceIndex: index.name,
        reason: indexType,
      });
    }

    // Generate shell commands
    const commands = recommendations.map((rec) => this.toShellCommand(rec));

    return {
      collection,
      recommendations,
      commands,
      skipped,
    };
  }

  /**
   * Apply index recommendations to a MongoDB collection.
   *
   * @param db MongoDB database.
   * @param recommendations Index recommendations to apply.
   * @returns Number of indexes created.
   */
  async apply(
    db: Db,
    recommendations: IndexRecommendation[],
  ): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];

    for (const rec of recommendations) {
      try {
        const collection = db.collection(rec.collection);
        await collection.createIndex(rec.keys, {
          unique: rec.options.unique,
          name: rec.options.name,
          sparse: rec.options.sparse,
        });
        created++;
      } catch (err) {
        errors.push(
          `${rec.options.name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    return { created, errors };
  }

  /**
   * Build a map from source column names to target field names.
   */
  private buildFieldMap(
    columns: ColumnMapping[] | undefined,
  ): Map<string, string> {
    const map = new Map<string, string>();

    if (columns) {
      for (const col of columns) {
        if (!col.exclude) {
          const target = col.target ?? this.camelCase(col.source);
          map.set(col.source, target);
        }
      }
    }

    return map;
  }

  /**
   * Map RDBMS index columns to MongoDB field names.
   */
  private mapIndexColumns(
    columns: string[],
    fieldMap: Map<string, string>,
    mapping: TableMapping,
  ): {
    fields: Array<{ name: string; direction: 1 | -1 }>;
    skipped: string[];
  } {
    const fields: Array<{ name: string; direction: 1 | -1 }> = [];
    const skipped: string[] = [];

    // Check for excluded columns
    const excludedColumns = new Set(
      mapping.columns?.filter((c) => c.exclude).map((c) => c.source) ?? []
    );

    for (const col of columns) {
      // Check if column is excluded
      if (excludedColumns.has(col)) {
        skipped.push(col);
        continue;
      }

      // Get mapped field name (or convert to camelCase)
      const fieldName = fieldMap.get(col) ?? this.camelCase(col);

      // Default to ascending (RDBMS index direction isn't always available)
      fields.push({ name: fieldName, direction: 1 });
    }

    return { fields, skipped };
  }

  /**
   * Generate a descriptive index name.
   */
  private generateIndexName(
    collection: string,
    fields: Array<{ name: string; direction: 1 | -1 }>,
  ): string {
    const fieldPart = fields
      .map((f) => `${f.name}_${f.direction === 1 ? "1" : "-1"}`)
      .join("_");

    return `idx_${collection}_${fieldPart}`;
  }

  /**
   * Describe the index type for the reason field.
   */
  private describeIndexType(index: IndexInfo, fieldCount: number): string {
    const parts: string[] = [];

    if (index.unique) {
      parts.push("Unique");
    }

    if (fieldCount > 1) {
      parts.push("Compound");
    } else {
      parts.push("Single-field");
    }

    parts.push("index");

    if (index.columns.length > 0) {
      parts.push(`on ${index.columns.join(", ")}`);
    }

    return parts.join(" ");
  }

  /**
   * Convert a recommendation to a MongoDB shell command.
   */
  private toShellCommand(rec: IndexRecommendation): string {
    const keysJson = JSON.stringify(rec.keys);
    const optionsJson = JSON.stringify(
      Object.fromEntries(
        Object.entries(rec.options).filter(([, v]) => v !== undefined)
      )
    );

    return `db.${rec.collection}.createIndex(${keysJson}, ${optionsJson})`;
  }

  /**
   * Convert snake_case to camelCase.
   */
  private camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
