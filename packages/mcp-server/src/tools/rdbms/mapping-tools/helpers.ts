/**
 * Shared helper functions for mapping tools.
 */

import type { TableMapping, ColumnMapping } from "../types.js";

/**
 * Dangerous SQL patterns that indicate potential SQL injection.
 *
 * These patterns are blocked in filter clauses to prevent:
 * - Multiple statement execution (;)
 * - SQL comments that could hide malicious code (--, /*, *‌/)
 * - DDL commands (DROP, CREATE, ALTER, TRUNCATE)
 * - DML commands that modify data (INSERT, UPDATE, DELETE)
 * - UNION-based injections
 * - Privilege escalation (GRANT, REVOKE)
 * - Transaction manipulation (COMMIT, ROLLBACK)
 * - System commands (EXEC, EXECUTE, xp_)
 */
const DANGEROUS_SQL_PATTERNS = [
  // Statement terminators and comments
  /;/,                          // Multiple statements
  /--/,                         // SQL comment
  /\/\*/,                       // Block comment start
  /\*\//,                       // Block comment end

  // DDL commands (case-insensitive, word boundaries)
  /\b(DROP|CREATE|ALTER|TRUNCATE)\b/i,

  // DML commands that modify data
  /\b(INSERT|UPDATE|DELETE)\b/i,

  // UNION injection
  /\bUNION\b/i,

  // Privilege commands
  /\b(GRANT|REVOKE)\b/i,

  // Transaction commands
  /\b(COMMIT|ROLLBACK|SAVEPOINT)\b/i,

  // System/stored procedure execution
  /\b(EXEC|EXECUTE)\b/i,
  /\bxp_/i,                     // SQL Server extended stored procedures

  // Information schema probing (common in reconnaissance)
  /\bINFORMATION_SCHEMA\b/i,
  /\bpg_catalog\b/i,
  /\bsys\./i,

  // Sleep/benchmark attacks (DoS)
  /\b(SLEEP|BENCHMARK|WAITFOR)\b/i,

  // File operations
  /\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i,
];

/**
 * Error thrown when a SQL filter contains dangerous patterns.
 */
export class SqlInjectionError extends Error {
  constructor(pattern: string) {
    super(
      `SQL filter rejected: contains potentially dangerous pattern "${pattern}". ` +
      `Filters should only contain simple comparison expressions (e.g., "status = 'active'" or "created_at > '2024-01-01'").`
    );
    this.name = "SqlInjectionError";
  }
}

/**
 * Validate a SQL filter clause for injection attacks.
 *
 * Throws SqlInjectionError if dangerous patterns are detected.
 * Returns the filter unchanged if valid.
 *
 * @param filter - SQL WHERE clause (without the WHERE keyword)
 * @returns The validated filter string
 * @throws SqlInjectionError if dangerous patterns are detected
 */
export function validateSqlFilter(filter: string | undefined): string | undefined {
  if (!filter) {
    return filter;
  }

  for (const pattern of DANGEROUS_SQL_PATTERNS) {
    if (pattern.test(filter)) {
      // Extract the matched pattern for the error message
      const match = filter.match(pattern);
      throw new SqlInjectionError(match?.[0] ?? pattern.source);
    }
  }

  return filter;
}

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
