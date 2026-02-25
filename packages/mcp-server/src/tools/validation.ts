/**
 * Input Validation Utilities for MCP Tool Arguments.
 *
 * Provides runtime validation for tool arguments to ensure type safety,
 * bounds checking, and protection against malicious input.
 *
 * Usage in tools:
 * ```typescript
 * const database = v.string(args.database, "database", { required: true });
 * const limit = v.integer(args.limit, "limit", { min: 1, max: 100, default: 20 });
 * const filter = v.object(args.filter, "filter");
 * ```
 */

/**
 * Error thrown when validation fails.
 */
export class ValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly reason: string,
  ) {
    super(`Invalid ${field}: ${reason}`);
    this.name = "ValidationError";
  }
}

// ---------------------------------------------------------------------------
// String Validation
// ---------------------------------------------------------------------------

export interface StringOptions {
  /** If true, throws if value is undefined/null. */
  required?: boolean;
  /** Default value if not provided. */
  default?: string;
  /** Minimum length. */
  minLength?: number;
  /** Maximum length. */
  maxLength?: number;
  /** Regex pattern to match. */
  pattern?: RegExp;
  /** Trim whitespace before validation. */
  trim?: boolean;
}

/**
 * Validate a string argument.
 */
export function string(
  value: unknown,
  field: string,
  options: StringOptions = {},
): string | undefined {
  // Handle undefined/null
  if (value === undefined || value === null || value === "") {
    if (options.required) {
      throw new ValidationError(field, "is required");
    }
    return options.default;
  }

  // Type check
  if (typeof value !== "string") {
    throw new ValidationError(field, `must be a string, got ${typeof value}`);
  }

  let str = options.trim ? value.trim() : value;

  // Empty string after trim
  if (str === "" && options.required) {
    throw new ValidationError(field, "cannot be empty");
  }

  // Length checks
  if (options.minLength !== undefined && str.length < options.minLength) {
    throw new ValidationError(field, `must be at least ${options.minLength} characters`);
  }
  if (options.maxLength !== undefined && str.length > options.maxLength) {
    throw new ValidationError(field, `must be at most ${options.maxLength} characters`);
  }

  // Pattern check
  if (options.pattern && !options.pattern.test(str)) {
    throw new ValidationError(field, "does not match required pattern");
  }

  return str;
}

/**
 * Validate a required string argument.
 * Shorthand for string(value, field, { required: true }).
 */
export function requiredString(
  value: unknown,
  field: string,
  options: Omit<StringOptions, "required" | "default"> = {},
): string {
  return string(value, field, { ...options, required: true }) as string;
}

// ---------------------------------------------------------------------------
// Integer Validation
// ---------------------------------------------------------------------------

export interface IntegerOptions {
  /** If true, throws if value is undefined/null. */
  required?: boolean;
  /** Default value if not provided. */
  default?: number;
  /** Minimum value (inclusive). */
  min?: number;
  /** Maximum value (inclusive). */
  max?: number;
}

/**
 * Validate an integer argument.
 */
export function integer(
  value: unknown,
  field: string,
  options: IntegerOptions = {},
): number | undefined {
  // Handle undefined/null
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(field, "is required");
    }
    return options.default;
  }

  // Convert to number
  const num = typeof value === "number" ? value : Number(value);

  // Check for NaN
  if (Number.isNaN(num)) {
    throw new ValidationError(field, `must be a number, got "${value}"`);
  }

  // Check for finite (must come before integer check since Infinity is not an integer)
  if (!Number.isFinite(num)) {
    throw new ValidationError(field, "must be a finite number");
  }

  // Check for integer
  if (!Number.isInteger(num)) {
    throw new ValidationError(field, `must be an integer, got ${num}`);
  }

  // Bounds checks
  if (options.min !== undefined && num < options.min) {
    throw new ValidationError(field, `must be at least ${options.min}, got ${num}`);
  }
  if (options.max !== undefined && num > options.max) {
    throw new ValidationError(field, `must be at most ${options.max}, got ${num}`);
  }

  return num;
}

/**
 * Validate an integer with bounds, returning a default if not provided.
 * Common pattern for limit/skip parameters.
 */
export function boundedInteger(
  value: unknown,
  field: string,
  defaultValue: number,
  min: number,
  max: number,
): number {
  const result = integer(value, field, { default: defaultValue, min, max });
  return result ?? defaultValue;
}

// ---------------------------------------------------------------------------
// Object Validation
// ---------------------------------------------------------------------------

export interface ObjectOptions {
  /** If true, throws if value is undefined/null. */
  required?: boolean;
  /** Default value if not provided. */
  default?: Record<string, unknown>;
  /** Maximum depth for nested objects. */
  maxDepth?: number;
  /** Maximum total keys across all nested objects. */
  maxKeys?: number;
}

/**
 * Count total keys in an object including nested objects.
 */
function countKeys(obj: unknown, depth: number, maxDepth: number): number {
  if (depth > maxDepth) {
    return Infinity; // Signal max depth exceeded
  }

  if (typeof obj !== "object" || obj === null) {
    return 0;
  }

  if (Array.isArray(obj)) {
    let count = 0;
    for (const item of obj) {
      count += countKeys(item, depth + 1, maxDepth);
      if (count === Infinity) return Infinity;
    }
    return count;
  }

  let count = 0;
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      count += 1;
      count += countKeys((obj as Record<string, unknown>)[key], depth + 1, maxDepth);
      if (count === Infinity) return Infinity;
    }
  }
  return count;
}

/**
 * Validate an object argument.
 */
export function object(
  value: unknown,
  field: string,
  options: ObjectOptions = {},
): Record<string, unknown> | undefined {
  // Handle undefined/null
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(field, "is required");
    }
    return options.default;
  }

  // Type check - must be object, not array, not null
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(field, `must be an object, got ${Array.isArray(value) ? "array" : typeof value}`);
  }

  const obj = value as Record<string, unknown>;
  const maxDepth = options.maxDepth ?? 10;
  const maxKeys = options.maxKeys ?? 1000;

  // Check depth and key count
  const keyCount = countKeys(obj, 0, maxDepth);
  if (keyCount === Infinity) {
    throw new ValidationError(field, `exceeds maximum nesting depth of ${maxDepth}`);
  }
  if (keyCount > maxKeys) {
    throw new ValidationError(field, `exceeds maximum of ${maxKeys} total keys`);
  }

  return obj;
}

// ---------------------------------------------------------------------------
// Array Validation
// ---------------------------------------------------------------------------

export interface ArrayOptions {
  /** If true, throws if value is undefined/null. */
  required?: boolean;
  /** Default value if not provided. */
  default?: unknown[];
  /** Minimum array length. */
  minLength?: number;
  /** Maximum array length. */
  maxLength?: number;
}

/**
 * Validate an array argument.
 */
export function array(
  value: unknown,
  field: string,
  options: ArrayOptions = {},
): unknown[] | undefined {
  // Handle undefined/null
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(field, "is required");
    }
    return options.default;
  }

  // Type check
  if (!Array.isArray(value)) {
    throw new ValidationError(field, `must be an array, got ${typeof value}`);
  }

  // Length checks
  if (options.minLength !== undefined && value.length < options.minLength) {
    throw new ValidationError(field, `must have at least ${options.minLength} items`);
  }
  if (options.maxLength !== undefined && value.length > options.maxLength) {
    throw new ValidationError(field, `must have at most ${options.maxLength} items`);
  }

  return value;
}

/**
 * Validate an array of objects (common for batch operations).
 */
export function objectArray(
  value: unknown,
  field: string,
  options: ArrayOptions & { maxDepth?: number; maxKeysPerObject?: number } = {},
): Record<string, unknown>[] | undefined {
  const arr = array(value, field, options);
  if (arr === undefined) return undefined;

  const maxDepth = options.maxDepth ?? 10;
  const maxKeys = options.maxKeysPerObject ?? 100;

  // Validate each item is an object
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new ValidationError(field, `item ${i} must be an object`);
    }

    // Check depth/size per object
    const keyCount = countKeys(item, 0, maxDepth);
    if (keyCount === Infinity) {
      throw new ValidationError(field, `item ${i} exceeds maximum nesting depth`);
    }
    if (keyCount > maxKeys) {
      throw new ValidationError(field, `item ${i} exceeds maximum of ${maxKeys} keys`);
    }
  }

  return arr as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Boolean Validation
// ---------------------------------------------------------------------------

/**
 * Validate a boolean argument.
 */
export function boolean(
  value: unknown,
  field: string,
  defaultValue?: boolean,
): boolean | undefined {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === "boolean") {
    return value;
  }

  // Accept string "true"/"false" for flexibility
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  throw new ValidationError(field, `must be a boolean, got ${typeof value}`);
}

// ---------------------------------------------------------------------------
// Enum Validation
// ---------------------------------------------------------------------------

/**
 * Validate an enum argument.
 */
export function enumValue<T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[],
  options: { required?: boolean; default?: T } = {},
): T | undefined {
  if (value === undefined || value === null) {
    if (options.required) {
      throw new ValidationError(field, "is required");
    }
    return options.default;
  }

  if (typeof value !== "string") {
    throw new ValidationError(field, `must be a string, got ${typeof value}`);
  }

  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(field, `must be one of: ${allowedValues.join(", ")}`);
  }

  return value as T;
}

// ---------------------------------------------------------------------------
// Convenience namespace export
// ---------------------------------------------------------------------------

/**
 * Validation namespace for cleaner imports.
 *
 * Usage:
 * ```typescript
 * import { v } from "../validation.js";
 *
 * const database = v.requiredString(args.database, "database");
 * const limit = v.boundedInteger(args.limit, "limit", 20, 1, 100);
 * ```
 */
export const v = {
  string,
  requiredString,
  integer,
  boundedInteger,
  object,
  array,
  objectArray,
  boolean,
  enumValue,
  ValidationError,
};
