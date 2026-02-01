import { describe, it, expect } from "vitest";
import type { ActionMap } from "@orbit/core";
import { buildToolSchema } from "./schema.js";

const testActions: ActionMap = {
  list: { method: "GET", path: "/api/atlas/v2/groups/{groupId}/items" },
  create: { method: "POST", path: "/api/atlas/v2/groups/{groupId}/items" },
  get: { method: "GET", path: "/api/atlas/v2/groups/{groupId}/items/{itemId}" },
};

describe("buildToolSchema", () => {
  it("returns object with type 'object'", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.type).toBe("object");
  });

  it("has action property with enum of action names", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.properties.action.type).toBe("string");
    expect(schema.properties.action.enum).toEqual(["list", "create", "get"]);
  });

  it("includes action names in description", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.properties.action.description).toContain("list");
    expect(schema.properties.action.description).toContain("create");
    expect(schema.properties.action.description).toContain("get");
  });

  it("has params property for path parameters", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.properties.params.type).toBe("object");
    expect(schema.properties.params.additionalProperties).toEqual({
      type: "string",
    });
  });

  it("has query property for query parameters", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.properties.query.type).toBe("object");
    expect(schema.properties.query.additionalProperties).toBe(true);
  });

  it("has body property for request body", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.properties.body).toBeDefined();
    expect(schema.properties.body.description).toContain("body");
  });

  it("requires only 'action'", () => {
    const schema = buildToolSchema(testActions);
    expect(schema.required).toEqual(["action"]);
  });

  it("handles single-action maps", () => {
    const single: ActionMap = {
      list: { method: "GET", path: "/api/v2/things" },
    };
    const schema = buildToolSchema(single);
    expect(schema.properties.action.enum).toEqual(["list"]);
  });
});
