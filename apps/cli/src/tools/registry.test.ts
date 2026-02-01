import { describe, it, expect } from "vitest";
import { TOOL_REGISTRY } from "./registry.js";

describe("TOOL_REGISTRY", () => {
  it("has 41 tools", () => {
    expect(TOOL_REGISTRY).toHaveLength(41);
  });

  it("all names are snake_case", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it("all tools have non-empty descriptions", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("all tools have at least one action", () => {
    for (const tool of TOOL_REGISTRY) {
      expect(Object.keys(tool.actions).length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate names", () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("includes key management tools", () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    expect(names).toContain("manage_clusters");
    expect(names).toContain("manage_projects");
    expect(names).toContain("manage_database_users");
    expect(names).toContain("manage_billing");
    expect(names).toContain("manage_cloud_backups");
    expect(names).toContain("manage_atlas_search");
  });
});
