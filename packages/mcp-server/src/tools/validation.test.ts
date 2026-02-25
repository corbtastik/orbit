/**
 * Tests for input validation utilities.
 */

import { describe, it, expect } from "vitest";
import {
  v,
  ValidationError,
  string,
  requiredString,
  integer,
  boundedInteger,
  object,
  array,
  objectArray,
  boolean,
  enumValue,
} from "./validation.js";

describe("ValidationError", () => {
  it("has correct properties", () => {
    const error = new ValidationError("field", "reason");
    expect(error.name).toBe("ValidationError");
    expect(error.field).toBe("field");
    expect(error.reason).toBe("reason");
    expect(error.message).toBe("Invalid field: reason");
  });
});

describe("string", () => {
  it("returns string value", () => {
    expect(string("hello", "field")).toBe("hello");
  });

  it("returns undefined for undefined when not required", () => {
    expect(string(undefined, "field")).toBeUndefined();
  });

  it("returns default for undefined", () => {
    expect(string(undefined, "field", { default: "default" })).toBe("default");
  });

  it("throws for undefined when required", () => {
    expect(() => string(undefined, "field", { required: true }))
      .toThrow(ValidationError);
  });

  it("throws for non-string", () => {
    expect(() => string(123, "field"))
      .toThrow("must be a string");
  });

  it("trims whitespace when option set", () => {
    expect(string("  hello  ", "field", { trim: true })).toBe("hello");
  });

  it("validates minLength", () => {
    expect(() => string("ab", "field", { minLength: 3 }))
      .toThrow("at least 3 characters");
  });

  it("validates maxLength", () => {
    expect(() => string("hello", "field", { maxLength: 3 }))
      .toThrow("at most 3 characters");
  });

  it("validates pattern", () => {
    expect(() => string("hello", "field", { pattern: /^\d+$/ }))
      .toThrow("does not match");
    expect(string("123", "field", { pattern: /^\d+$/ })).toBe("123");
  });
});

describe("requiredString", () => {
  it("returns string value", () => {
    expect(requiredString("hello", "field")).toBe("hello");
  });

  it("throws for undefined", () => {
    expect(() => requiredString(undefined, "field"))
      .toThrow("is required");
  });

  it("throws for empty string", () => {
    expect(() => requiredString("", "field"))
      .toThrow("is required");
  });
});

describe("integer", () => {
  it("returns number value", () => {
    expect(integer(42, "field")).toBe(42);
  });

  it("converts string to number", () => {
    expect(integer("42", "field")).toBe(42);
  });

  it("returns undefined for undefined when not required", () => {
    expect(integer(undefined, "field")).toBeUndefined();
  });

  it("returns default for undefined", () => {
    expect(integer(undefined, "field", { default: 10 })).toBe(10);
  });

  it("throws for undefined when required", () => {
    expect(() => integer(undefined, "field", { required: true }))
      .toThrow("is required");
  });

  it("throws for non-integer", () => {
    expect(() => integer(3.14, "field"))
      .toThrow("must be an integer");
  });

  it("throws for NaN", () => {
    expect(() => integer("not a number", "field"))
      .toThrow("must be a number");
  });

  it("throws for Infinity", () => {
    expect(() => integer(Infinity, "field"))
      .toThrow("must be a finite number");
  });

  it("validates min", () => {
    expect(() => integer(5, "field", { min: 10 }))
      .toThrow("at least 10");
  });

  it("validates max", () => {
    expect(() => integer(50, "field", { max: 10 }))
      .toThrow("at most 10");
  });
});

describe("boundedInteger", () => {
  it("returns value within bounds", () => {
    expect(boundedInteger(50, "field", 20, 1, 100)).toBe(50);
  });

  it("returns default for undefined", () => {
    expect(boundedInteger(undefined, "field", 20, 1, 100)).toBe(20);
  });

  it("throws for value below min", () => {
    expect(() => boundedInteger(0, "field", 20, 1, 100))
      .toThrow("at least 1");
  });

  it("throws for value above max", () => {
    expect(() => boundedInteger(200, "field", 20, 1, 100))
      .toThrow("at most 100");
  });
});

describe("object", () => {
  it("returns object value", () => {
    const obj = { a: 1 };
    expect(object(obj, "field")).toBe(obj);
  });

  it("returns undefined for undefined when not required", () => {
    expect(object(undefined, "field")).toBeUndefined();
  });

  it("returns default for undefined", () => {
    const defaultObj = { default: true };
    expect(object(undefined, "field", { default: defaultObj })).toBe(defaultObj);
  });

  it("throws for undefined when required", () => {
    expect(() => object(undefined, "field", { required: true }))
      .toThrow("is required");
  });

  it("throws for array", () => {
    expect(() => object([1, 2, 3], "field"))
      .toThrow("must be an object, got array");
  });

  it("throws for null", () => {
    expect(() => object(null, "field", { required: true }))
      .toThrow("is required");
  });

  it("throws for string", () => {
    expect(() => object("string", "field"))
      .toThrow("must be an object, got string");
  });

  it("validates maxDepth", () => {
    const deepObj = { a: { b: { c: { d: { e: {} } } } } };
    expect(() => object(deepObj, "field", { maxDepth: 3 }))
      .toThrow("exceeds maximum nesting depth");
  });

  it("validates maxKeys", () => {
    const largeObj = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`key${i}`, i])
    );
    expect(() => object(largeObj, "field", { maxKeys: 10 }))
      .toThrow("exceeds maximum of 10 total keys");
  });
});

describe("array", () => {
  it("returns array value", () => {
    const arr = [1, 2, 3];
    expect(array(arr, "field")).toBe(arr);
  });

  it("returns undefined for undefined when not required", () => {
    expect(array(undefined, "field")).toBeUndefined();
  });

  it("returns default for undefined", () => {
    const defaultArr = [1, 2];
    expect(array(undefined, "field", { default: defaultArr })).toBe(defaultArr);
  });

  it("throws for undefined when required", () => {
    expect(() => array(undefined, "field", { required: true }))
      .toThrow("is required");
  });

  it("throws for non-array", () => {
    expect(() => array("string", "field"))
      .toThrow("must be an array");
  });

  it("validates minLength", () => {
    expect(() => array([1], "field", { minLength: 2 }))
      .toThrow("at least 2 items");
  });

  it("validates maxLength", () => {
    expect(() => array([1, 2, 3, 4, 5], "field", { maxLength: 3 }))
      .toThrow("at most 3 items");
  });
});

describe("objectArray", () => {
  it("returns array of objects", () => {
    const arr = [{ a: 1 }, { b: 2 }];
    expect(objectArray(arr, "field")).toBe(arr);
  });

  it("throws for non-object items", () => {
    expect(() => objectArray([{ a: 1 }, "string"], "field"))
      .toThrow("item 1 must be an object");
  });

  it("throws for null items", () => {
    expect(() => objectArray([{ a: 1 }, null], "field"))
      .toThrow("item 1 must be an object");
  });

  it("throws for array items", () => {
    expect(() => objectArray([{ a: 1 }, [1, 2]], "field"))
      .toThrow("item 1 must be an object");
  });

  it("validates item depth", () => {
    const arr = [{ a: { b: { c: { d: {} } } } }];
    expect(() => objectArray(arr, "field", { maxDepth: 2 }))
      .toThrow("item 0 exceeds maximum nesting depth");
  });

  it("validates item key count", () => {
    const arr = [Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`key${i}`, i])
    )];
    expect(() => objectArray(arr, "field", { maxKeysPerObject: 10 }))
      .toThrow("item 0 exceeds maximum of 10 keys");
  });
});

describe("boolean", () => {
  it("returns boolean value", () => {
    expect(boolean(true, "field")).toBe(true);
    expect(boolean(false, "field")).toBe(false);
  });

  it("returns default for undefined", () => {
    expect(boolean(undefined, "field", true)).toBe(true);
    expect(boolean(undefined, "field", false)).toBe(false);
  });

  it("returns undefined for undefined with no default", () => {
    expect(boolean(undefined, "field")).toBeUndefined();
  });

  it("converts string 'true'", () => {
    expect(boolean("true", "field")).toBe(true);
    expect(boolean("TRUE", "field")).toBe(true);
  });

  it("converts string 'false'", () => {
    expect(boolean("false", "field")).toBe(false);
    expect(boolean("FALSE", "field")).toBe(false);
  });

  it("throws for invalid value", () => {
    expect(() => boolean("yes", "field"))
      .toThrow("must be a boolean");
    expect(() => boolean(1, "field"))
      .toThrow("must be a boolean");
  });
});

describe("enumValue", () => {
  const ALLOWED = ["a", "b", "c"] as const;

  it("returns enum value", () => {
    expect(enumValue("a", "field", ALLOWED)).toBe("a");
  });

  it("returns undefined for undefined when not required", () => {
    expect(enumValue(undefined, "field", ALLOWED)).toBeUndefined();
  });

  it("returns default for undefined", () => {
    expect(enumValue(undefined, "field", ALLOWED, { default: "b" })).toBe("b");
  });

  it("throws for undefined when required", () => {
    expect(() => enumValue(undefined, "field", ALLOWED, { required: true }))
      .toThrow("is required");
  });

  it("throws for invalid value", () => {
    expect(() => enumValue("d", "field", ALLOWED))
      .toThrow("must be one of: a, b, c");
  });

  it("throws for non-string", () => {
    expect(() => enumValue(1, "field", ALLOWED))
      .toThrow("must be a string");
  });
});

describe("v namespace", () => {
  it("exports all functions", () => {
    expect(v.string).toBe(string);
    expect(v.requiredString).toBe(requiredString);
    expect(v.integer).toBe(integer);
    expect(v.boundedInteger).toBe(boundedInteger);
    expect(v.object).toBe(object);
    expect(v.array).toBe(array);
    expect(v.objectArray).toBe(objectArray);
    expect(v.boolean).toBe(boolean);
    expect(v.enumValue).toBe(enumValue);
    expect(v.ValidationError).toBe(ValidationError);
  });
});
