/**
 * Shared helper functions for mapping tools.
 */

import type { TableMapping, ColumnMapping } from "../types.js";

/**
 * Convert snake_case to camelCase.
 */
export function camelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Get the primary key column name from a row.
 */
export function getPrimaryKeyColumn(row: Record<string, unknown>): string {
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
 * Apply a transform to a value.
 */
export function applyTransform(value: unknown, transform: string): unknown {
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
 * Transform a source row to a document based on column mappings.
 */
export function transformRow(
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
