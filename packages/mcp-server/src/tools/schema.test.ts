import { describe, it, expect } from "vitest";
import type { ActionMap } from "@orbit/core";
import { buildToolSchema } from "./schema.js";

const testActions: ActionMap = {
  list: { method: "GET", path: "/test" },
  create: { method: "POST", path: "/test", hasBody: true },
};

describe("buildToolSchema", () => {
  it("returns object with type 'object'", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.type).toBe("object");
  });

  it("has action property with enum of action names", () => {
    const schema = buildToolSchema(testActions);
    const actionProp = schema.properties.action;
    expect(actionProp.type).toBe("string");
    expect(actionProp.enum).toEqual(["list", "create"]);
  });

  it("has params, query, and body properties", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.properties.params).toBeDefined();
    expect(schema.properties.params.type).toBe("object");
    expect(schema.properties.query).toBeDefined();
    expect(schema.properties.query.type).toBe("object");
    expect(schema.properties.body).toBeDefined();
  });

  it("required contains only 'action'", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.required).toEqual(["action"]);
  });
});
