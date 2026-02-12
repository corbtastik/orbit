import { describe, it, expect } from "vitest";
import type { ActionMap } from "../base.js";
import {
  rmSystemActions,
  rmProjectActions,
  rmConnectionActions,
  rmSchemaActions,
  rmJobActions,
  rmAnalysisActions,
} from "./index.js";

/**
 * All 6 Relational Migrator ActionMap objects with their names.
 */
const ALL_RM_ACTION_MAPS: { name: string; map: ActionMap }[] = [
  { name: "rmSystemActions", map: rmSystemActions },
  { name: "rmProjectActions", map: rmProjectActions },
  { name: "rmConnectionActions", map: rmConnectionActions },
  { name: "rmSchemaActions", map: rmSchemaActions },
  { name: "rmJobActions", map: rmJobActions },
  { name: "rmAnalysisActions", map: rmAnalysisActions },
];

/**
 * Valid HTTP methods for API operations.
 */
const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

describe("Relational Migrator ActionMaps", () => {
  it("has 6 action maps", () => {
    expect(ALL_RM_ACTION_MAPS).toHaveLength(6);
  });

  it("has 52 total actions across all maps", () => {
    let total = 0;
    for (const { map } of ALL_RM_ACTION_MAPS) {
      total += Object.keys(map).length;
    }
    expect(total).toBe(52);
  });

  describe("rmSystemActions", () => {
    it("has 5 actions", () => {
      expect(Object.keys(rmSystemActions)).toHaveLength(5);
    });

    it("has expected action names", () => {
      const actions = Object.keys(rmSystemActions);
      expect(actions).toContain("get_info");
      expect(actions).toContain("get_health");
      expect(actions).toContain("get_news");
      expect(actions).toContain("get_actuator");
      expect(actions).toContain("get_environment");
    });
  });

  describe("rmProjectActions", () => {
    it("has 15 actions", () => {
      expect(Object.keys(rmProjectActions)).toHaveLength(15);
    });

    it("has expected action names", () => {
      const actions = Object.keys(rmProjectActions);
      expect(actions).toContain("list");
      expect(actions).toContain("get");
      expect(actions).toContain("create");
      expect(actions).toContain("update");
      expect(actions).toContain("delete");
      expect(actions).toContain("export");
    });
  });

  describe("rmConnectionActions", () => {
    it("has 13 actions", () => {
      expect(Object.keys(rmConnectionActions)).toHaveLength(13);
    });

    it("has JDBC and MongoDB connection actions", () => {
      const actions = Object.keys(rmConnectionActions);
      expect(actions).toContain("list_jdbc");
      expect(actions).toContain("create_jdbc");
      expect(actions).toContain("test_jdbc");
      expect(actions).toContain("list_mongodb");
      expect(actions).toContain("create_mongodb");
      expect(actions).toContain("test_mongodb");
    });
  });

  describe("rmSchemaActions", () => {
    it("has 3 actions", () => {
      expect(Object.keys(rmSchemaActions)).toHaveLength(3);
    });

    it("has schema discovery actions", () => {
      const actions = Object.keys(rmSchemaActions);
      expect(actions).toContain("get");
      expect(actions).toContain("discover_jdbc");
      expect(actions).toContain("parse_ddl");
    });
  });

  describe("rmJobActions", () => {
    it("has 12 actions", () => {
      expect(Object.keys(rmJobActions)).toHaveLength(12);
    });

    it("has job lifecycle actions", () => {
      const actions = Object.keys(rmJobActions);
      expect(actions).toContain("list");
      expect(actions).toContain("create");
      expect(actions).toContain("stop");
      expect(actions).toContain("pause");
      expect(actions).toContain("resume");
      expect(actions).toContain("retry");
    });
  });

  describe("rmAnalysisActions", () => {
    it("has 4 actions", () => {
      expect(Object.keys(rmAnalysisActions)).toHaveLength(4);
    });

    it("has analysis actions", () => {
      const actions = Object.keys(rmAnalysisActions);
      expect(actions).toContain("get_report");
      expect(actions).toContain("get_task");
      expect(actions).toContain("cancel_task");
    });
  });
});

describe("Relational Migrator ActionMap structure validation", () => {
  it("every action has a valid HTTP method", () => {
    const invalid: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        if (!VALID_METHODS.includes(spec.method)) {
          invalid.push(`${mapName}.${actionName}: invalid method "${spec.method}"`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it("every action has a path starting with /", () => {
    const invalid: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        if (!spec.path.startsWith("/")) {
          invalid.push(`${mapName}.${actionName}: path "${spec.path}" does not start with /`);
        }
      }
    }
    expect(invalid).toEqual([]);
  });

  it("POST, PUT, PATCH actions that create/update have hasBody: true", () => {
    const suspiciousMethods = ["POST", "PUT", "PATCH"];
    const noBodyExpected = [
      "start", "stop", "pause", "resume", "retry", "cancel", "test",
    ];

    const missingBody: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        if (suspiciousMethods.includes(spec.method)) {
          // Skip actions that typically don't need a body
          const isNoBodyAction = noBodyExpected.some((keyword) =>
            actionName.toLowerCase().includes(keyword),
          );
          if (!isNoBodyAction && spec.hasBody !== true) {
            // Only warn for create/update type actions
            if (actionName.includes("create") || actionName.includes("update") || actionName.includes("parse")) {
              missingBody.push(`${mapName}.${actionName}: ${spec.method} should likely have hasBody: true`);
            }
          }
        }
      }
    }
    expect(missingBody).toEqual([]);
  });

  it("DELETE actions do not have hasBody", () => {
    const badDeleteActions: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        if (spec.method === "DELETE" && spec.hasBody === true) {
          badDeleteActions.push(`${mapName}.${actionName}: DELETE should not have hasBody`);
        }
      }
    }
    expect(badDeleteActions).toEqual([]);
  });

  it("GET actions do not have hasBody", () => {
    const badGetActions: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        if (spec.method === "GET" && spec.hasBody === true) {
          badGetActions.push(`${mapName}.${actionName}: GET should not have hasBody`);
        }
      }
    }
    expect(badGetActions).toEqual([]);
  });

  it("paths with {param} placeholders use proper format", () => {
    const badParams: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        // Check for malformed placeholders like {param or param}
        if (spec.path.includes("{") && !spec.path.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/)) {
          badParams.push(`${mapName}.${actionName}: path "${spec.path}" has malformed placeholder`);
        }
      }
    }
    expect(badParams).toEqual([]);
  });

  it("no duplicate paths with same method across all maps", () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];

    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        const key = `${spec.method} ${spec.path}`;
        const existing = seen.get(key);
        if (existing) {
          duplicates.push(`${key}: both ${existing} and ${mapName}.${actionName}`);
        } else {
          seen.set(key, `${mapName}.${actionName}`);
        }
      }
    }
    expect(duplicates).toEqual([]);
  });
});

describe("Relational Migrator ActionMap API paths", () => {
  it("all paths use /api/v1 or /actuator prefix", () => {
    const badPaths: string[] = [];
    for (const { name: mapName, map } of ALL_RM_ACTION_MAPS) {
      for (const [actionName, spec] of Object.entries(map)) {
        if (!spec.path.startsWith("/api/v1") && !spec.path.startsWith("/actuator")) {
          badPaths.push(`${mapName}.${actionName}: path "${spec.path}" does not start with /api/v1 or /actuator`);
        }
      }
    }
    expect(badPaths).toEqual([]);
  });
});
