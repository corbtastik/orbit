import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY } from "./registry.js";
import { buildToolSchema } from "./schema.js";

describe("TOOL_REGISTRY", () => {
  it("has exactly 41 entries", () => {
    expect(TOOL_REGISTRY).toHaveLength(41);
  });

  it("all names are unique", () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("all names use snake_case", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("every tool has a non-empty description", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("buildToolSchema succeeds for every tool", () => {
    for (const tool of TOOL_REGISTRY) {
      const schema = buildToolSchema(tool.actions);
      expect(schema.type).toBe("object");
      expect(schema.properties.action.enum.length).toBeGreaterThan(0);
    }
  });
});
