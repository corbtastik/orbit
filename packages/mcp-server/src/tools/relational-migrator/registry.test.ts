import { describe, it, expect } from "vitest";
import { RM_TOOL_REGISTRY } from "./registry.js";

describe("RM_TOOL_REGISTRY", () => {
  it("has 6 tools", () => {
    expect(RM_TOOL_REGISTRY).toHaveLength(6);
  });

  it("has expected tool names", () => {
    const names = RM_TOOL_REGISTRY.map((t) => t.name);
    expect(names).toContain("get_rm_system_info");
    expect(names).toContain("manage_rm_projects");
    expect(names).toContain("manage_rm_connections");
    expect(names).toContain("manage_rm_schema");
    expect(names).toContain("manage_rm_jobs");
    expect(names).toContain("manage_rm_analysis");
  });

  it("each tool has a name, description, and actions", () => {
    for (const tool of RM_TOOL_REGISTRY) {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe("string");
      expect(tool.description).toBeTruthy();
      expect(typeof tool.description).toBe("string");
      expect(tool.actions).toBeTruthy();
      expect(typeof tool.actions).toBe("object");
    }
  });

  it("each tool has at least one action", () => {
    for (const tool of RM_TOOL_REGISTRY) {
      const actionCount = Object.keys(tool.actions).length;
      expect(actionCount).toBeGreaterThan(0);
    }
  });

  it("tool names follow naming convention", () => {
    for (const tool of RM_TOOL_REGISTRY) {
      // Tools should be snake_case and include "rm"
      expect(tool.name).toMatch(/^(get|manage)_rm_/);
    }
  });

  it("tool descriptions are informative", () => {
    for (const tool of RM_TOOL_REGISTRY) {
      // Descriptions should be at least 20 characters
      expect(tool.description.length).toBeGreaterThan(20);
      // Descriptions should not start with lowercase
      expect(tool.description[0]).toBe(tool.description[0].toUpperCase());
    }
  });
});

describe("RM_TOOL_REGISTRY tool contents", () => {
  it("get_rm_system_info has system actions", () => {
    const tool = RM_TOOL_REGISTRY.find((t) => t.name === "get_rm_system_info");
    expect(tool).toBeDefined();
    expect(tool!.actions.get_info).toBeDefined();
    expect(tool!.actions.get_health).toBeDefined();
  });

  it("manage_rm_projects has project CRUD actions", () => {
    const tool = RM_TOOL_REGISTRY.find((t) => t.name === "manage_rm_projects");
    expect(tool).toBeDefined();
    const actions = Object.keys(tool!.actions);
    expect(actions).toContain("list");
    expect(actions).toContain("create");
    expect(actions).toContain("get");
    expect(actions).toContain("update");
    expect(actions).toContain("delete");
  });

  it("manage_rm_connections has JDBC and MongoDB actions", () => {
    const tool = RM_TOOL_REGISTRY.find((t) => t.name === "manage_rm_connections");
    expect(tool).toBeDefined();
    const actions = Object.keys(tool!.actions);
    expect(actions).toContain("list_jdbc");
    expect(actions).toContain("create_jdbc");
    expect(actions).toContain("list_mongodb");
    expect(actions).toContain("create_mongodb");
  });

  it("manage_rm_schema has schema discovery actions", () => {
    const tool = RM_TOOL_REGISTRY.find((t) => t.name === "manage_rm_schema");
    expect(tool).toBeDefined();
    const actions = Object.keys(tool!.actions);
    expect(actions).toContain("get");
    expect(actions).toContain("discover_jdbc");
  });

  it("manage_rm_jobs has job lifecycle actions", () => {
    const tool = RM_TOOL_REGISTRY.find((t) => t.name === "manage_rm_jobs");
    expect(tool).toBeDefined();
    const actions = Object.keys(tool!.actions);
    expect(actions).toContain("list");
    expect(actions).toContain("create");
    expect(actions).toContain("stop");
    expect(actions).toContain("pause");
    expect(actions).toContain("resume");
  });

  it("manage_rm_analysis has analysis actions", () => {
    const tool = RM_TOOL_REGISTRY.find((t) => t.name === "manage_rm_analysis");
    expect(tool).toBeDefined();
    const actions = Object.keys(tool!.actions);
    expect(actions).toContain("get_report");
  });
});

describe("RM_TOOL_REGISTRY action coverage", () => {
  it("has 52 total actions across all tools", () => {
    let total = 0;
    for (const tool of RM_TOOL_REGISTRY) {
      total += Object.keys(tool.actions).length;
    }
    expect(total).toBe(52);
  });

  it("all tools have unique names", () => {
    const names = RM_TOOL_REGISTRY.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
