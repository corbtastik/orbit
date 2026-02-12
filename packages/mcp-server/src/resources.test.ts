import { describe, it, expect } from "vitest";
import { RESOURCE_REGISTRY, extractVariables } from "./resources.js";

describe("RESOURCE_REGISTRY", () => {
  it("has 26 entries (15 Atlas + 5 MongoDB + 6 RM)", () => {
    expect(RESOURCE_REGISTRY).toHaveLength(26);
  });

  it("has exactly 7 static resources (2 Atlas + 1 MongoDB + 4 RM)", () => {
    const statics = RESOURCE_REGISTRY.filter((r) => !r.isTemplate);
    expect(statics).toHaveLength(7);
  });

  it("has exactly 19 template resources (13 Atlas + 4 MongoDB + 2 RM)", () => {
    const templates = RESOURCE_REGISTRY.filter((r) => r.isTemplate);
    expect(templates).toHaveLength(19);
  });

  it("Atlas resources use atlas:// URI scheme", () => {
    const atlas = RESOURCE_REGISTRY.filter((r) => r.uri.startsWith("atlas://"));
    expect(atlas).toHaveLength(15);
  });

  it("MongoDB resources use mongodb:// URI scheme", () => {
    const mongo = RESOURCE_REGISTRY.filter((r) => r.uri.startsWith("mongodb://"));
    expect(mongo).toHaveLength(5);
  });

  it("Relational Migrator resources use rm:// URI scheme", () => {
    const rm = RESOURCE_REGISTRY.filter((r) => r.uri.startsWith("rm://"));
    expect(rm).toHaveLength(6);
  });
});

describe("extractVariables", () => {
  it("returns null for non-matching URIs", () => {
    const result = extractVariables("atlas://orgs/{orgId}", "atlas://projects/abc");
    expect(result).toBeNull();
  });

  it("extracts a single variable", () => {
    const result = extractVariables("atlas://orgs/{orgId}", "atlas://orgs/abc123");
    expect(result).toEqual({ orgId: "abc123" });
  });

  it("extracts multiple variables", () => {
    const result = extractVariables(
      "atlas://projects/{groupId}/clusters/{clusterName}",
      "atlas://projects/proj1/clusters/myCluster",
    );
    expect(result).toEqual({ groupId: "proj1", clusterName: "myCluster" });
  });
});
