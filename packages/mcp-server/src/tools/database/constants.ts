/**
 * Shared constants for database tools.
 *
 * Centralized limits and patterns used across multiple tool files.
 */

// ---------------------------------------------------------------------------
// Query Limits
// ---------------------------------------------------------------------------

/** Maximum number of documents returned by find to prevent unbounded results. */
export const MAX_FIND_LIMIT = 100;

/** Maximum number of documents returned by aggregate to prevent unbounded results. */
export const MAX_AGGREGATE_LIMIT = 1000;

/** Maximum number of documents that can be inserted in a single call. */
export const MAX_INSERT_BATCH = 1000;

// ---------------------------------------------------------------------------
// Date Conversion
// ---------------------------------------------------------------------------

/**
 * ISO date string patterns.
 *
 * Matches:
 * - YYYY-MM-DD (date only)
 * - YYYY-MM-DDTHH:mm:ss (datetime)
 * - YYYY-MM-DDTHH:mm:ssZ (datetime with Z)
 * - YYYY-MM-DDTHH:mm:ss.sssZ (datetime with milliseconds)
 * - YYYY-MM-DDTHH:mm:ss+00:00 (datetime with timezone offset)
 */
export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Check if a string is a valid ISO date.
 */
export function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!ISO_DATE_REGEX.test(value)) return false;

  // Validate it's actually a valid date
  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Recursively convert ISO date strings to Date objects in a document.
 *
 * Handles nested objects and arrays.
 */
export function convertDates<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  // Check for ISO date string
  if (isIsoDateString(value)) {
    return new Date(value) as T;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(convertDates) as T;
  }

  // Handle objects (but not Date instances)
  if (typeof value === "object" && !(value instanceof Date)) {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = convertDates(val);
    }
    return result as T;
  }

  return value;
}
