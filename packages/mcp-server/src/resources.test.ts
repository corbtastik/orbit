import { describe, it, expect } from "vitest";
import { RESOURCE_REGISTRY, extractVariables } from "./resources.js";

describe("RESOURCE_REGISTRY", () => {
  it("has 15 entries", () => {
    expect(RESOURCE_REGISTRY).toHaveLength(15);
  });

  it("has exactly 2 static resources", () => {
    const statics = RESOURCE_REGISTRY.filter((r) => !r.isTemplate);
    expect(statics).toHaveLength(2);
  });

  it("has exactly 13 template resources", () => {
    const templates = RESOURCE_REGISTRY.filter((r) => r.isTemplate);
    expect(templates).toHaveLength(13);
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
