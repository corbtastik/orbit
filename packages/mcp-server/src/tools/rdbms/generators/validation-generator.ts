/**
 * ValidationGenerator — generates MongoDB JSON Schema validation from RDBMS constraints.
 *
 * Translates column types, nullable constraints, and size limits to
 * MongoDB's $jsonSchema validator format.
 */

import type { Db } from "mongodb";
import type { TableMapping, ColumnMapping, BsonType } from "../types.js";
import type { ColumnInfo } from "../drivers/types.js";

/**
 * JSON Schema property definition.
 */
export interface JsonSchemaProperty {
  bsonType: string | string[];
  description?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: unknown[];
}

/**
 * MongoDB $jsonSchema validator.
 */
export interface ValidationSchema {
  $jsonSchema: {
    bsonType: "object";
    title?: string;
    description?: string;
    required: string[];
    properties: Record<string, JsonSchemaProperty>;
    additionalProperties?: boolean;
  };
}

/**
 * Result of validation generation.
 */
export interface ValidationGenerationResult {
  /** Target collection. */
  collection: string;

  /** Generated validation schema. */
  schema: ValidationSchema;

  /** MongoDB shell command. */
  command: string;

  /** Fields that couldn't be fully translated. */
  warnings: Array<{
    field: string;
    reason: string;
  }>;
}

/**
 * Generates MongoDB JSON Schema validation from RDBMS column metadata.
 */
export class ValidationGenerator {
  /**
   * Generate a validation schema for a mapping.
   *
   * @param mapping Table mapping configuration.
   * @param columns Source RDBMS columns.
   * @returns Validation generation result.
   */
  generate(
    mapping: TableMapping,
    columns: ColumnInfo[],
  ): ValidationGenerationResult {
    const collection = mapping.targetCollection;
    const required: string[] = [];
    const properties: Record<string, JsonSchemaProperty> = {};
    const warnings: ValidationGenerationResult["warnings"] = [];

    // Build column mapping lookup
    const columnMappings = new Map<string, ColumnMapping>();
    if (mapping.columns) {
      for (const col of mapping.columns) {
        columnMappings.set(col.source, col);
      }
    }

    for (const column of columns) {
      const colMapping = columnMappings.get(column.name);

      // Skip excluded columns
      if (colMapping?.exclude) {
        continue;
      }

      // Determine target field name
      const fieldName = colMapping?.target ?? this.camelCase(column.name);

      // Determine BSON type
      const bsonType = colMapping?.targetType ?? this.inferBsonType(column);

      // Build property schema
      const property = this.buildPropertySchema(column, bsonType);

      // Handle nullable
      if (!column.nullable) {
        required.push(fieldName);
      } else {
        // Allow null for nullable fields
        property.bsonType = [property.bsonType as string, "null"];
      }

      properties[fieldName] = property;

      // Add warnings for complex types
      if (this.isComplexType(column.dataType)) {
        warnings.push({
          field: fieldName,
          reason: `Complex type '${column.dataType}' may need manual review`,
        });
      }
    }

    // Add embedded document schemas
    if (mapping.embeds) {
      for (const embed of mapping.embeds) {
        const embedProperty: JsonSchemaProperty = {
          bsonType: embed.cardinality === "one" ? ["object", "null"] : "array",
          description: `Embedded from ${embed.sourceTable}`,
        };
        properties[embed.targetField] = embedProperty;
      }
    }

    // Add reference schemas
    if (mapping.references) {
      for (const ref of mapping.references) {
        const refProperty: JsonSchemaProperty = ref.copyFields?.length
          ? { bsonType: ["object", "null"], description: `Reference to ${ref.sourceTable}` }
          : { bsonType: ["string", "int", "long", "null"], description: `ID reference to ${ref.sourceTable}` };
        properties[ref.targetField] = refProperty;
      }
    }

    const schema: ValidationSchema = {
      $jsonSchema: {
        bsonType: "object",
        title: collection,
        description: `Migrated from ${mapping.sourceTable}`,
        required,
        properties,
      },
    };

    const command = this.toShellCommand(collection, schema);

    return {
      collection,
      schema,
      command,
      warnings,
    };
  }

  /**
   * Apply validation schema to a MongoDB collection.
   *
   * @param db MongoDB database.
   * @param collection Collection name.
   * @param schema Validation schema.
   * @param action Validation action: "error" (reject) or "warn" (allow with warning).
   */
  async apply(
    db: Db,
    collection: string,
    schema: ValidationSchema,
    action: "error" | "warn" = "error",
  ): Promise<void> {
    await db.command({
      collMod: collection,
      validator: schema,
      validationLevel: "moderate",
      validationAction: action,
    });
  }

  /**
   * Build a JSON Schema property from column metadata.
   */
  private buildPropertySchema(
    column: ColumnInfo,
    bsonType: BsonType,
  ): JsonSchemaProperty {
    const property: JsonSchemaProperty = {
      bsonType: bsonType,
    };

    // Add description from column name
    if (column.name.includes("_")) {
      property.description = this.humanize(column.name);
    }

    // Add string constraints
    if (bsonType === "string" && column.maxLength) {
      property.maxLength = column.maxLength;
    }

    // Add numeric constraints based on type
    if (bsonType === "int") {
      const range = this.getIntegerRange(column.dataType);
      if (range) {
        property.minimum = range.min;
        property.maximum = range.max;
      }
    }

    return property;
  }

  /**
   * Infer BSON type from RDBMS column type.
   */
  private inferBsonType(column: ColumnInfo): BsonType {
    const type = column.dataType.toLowerCase();

    // Integer types
    if (/^(int|integer|smallint|tinyint|mediumint)$/i.test(type)) {
      return "int";
    }

    // Long types
    if (/^(bigint|serial|bigserial)$/i.test(type)) {
      return "long";
    }

    // Floating point
    if (/^(float|real|double|double precision)$/i.test(type)) {
      return "double";
    }

    // Decimal/numeric
    if (/^(decimal|numeric|money)$/i.test(type)) {
      // If scale is 0, use int or long based on precision
      if (column.scale === 0) {
        return column.precision && column.precision > 9 ? "long" : "int";
      }
      return "decimal";
    }

    // Boolean
    if (/^(bool|boolean|bit)$/i.test(type)) {
      return "bool";
    }

    // Date/time
    if (/^(date|time|datetime|timestamp|timestamptz)$/i.test(type)) {
      return "date";
    }

    // Binary
    if (/^(bytea|blob|binary|varbinary|image)$/i.test(type)) {
      return "binData";
    }

    // JSON
    if (/^(json|jsonb)$/i.test(type)) {
      return "object";
    }

    // Arrays
    if (type.endsWith("[]") || type.includes("array")) {
      return "array";
    }

    // Default to string
    return "string";
  }

  /**
   * Check if a type is complex and may need manual review.
   */
  private isComplexType(type: string): boolean {
    const complexTypes = [
      "json", "jsonb", "xml", "geometry", "geography",
      "hstore", "array", "composite", "enum", "range",
    ];

    return complexTypes.some((t) => type.toLowerCase().includes(t));
  }

  /**
   * Get integer range based on SQL type.
   */
  private getIntegerRange(
    type: string,
  ): { min: number; max: number } | null {
    const ranges: Record<string, { min: number; max: number }> = {
      tinyint: { min: 0, max: 255 },
      smallint: { min: -32768, max: 32767 },
      int: { min: -2147483648, max: 2147483647 },
      integer: { min: -2147483648, max: 2147483647 },
    };

    return ranges[type.toLowerCase()] ?? null;
  }

  /**
   * Convert schema to MongoDB shell command.
   */
  private toShellCommand(collection: string, schema: ValidationSchema): string {
    const schemaJson = JSON.stringify(schema, null, 2);

    return `db.runCommand({
  collMod: "${collection}",
  validator: ${schemaJson},
  validationLevel: "moderate",
  validationAction: "error"
})`;
  }

  /**
   * Convert snake_case to camelCase.
   */
  private camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Convert snake_case to human-readable text.
   */
  private humanize(str: string): string {
    return str
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
