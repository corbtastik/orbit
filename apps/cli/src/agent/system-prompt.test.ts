import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./system-prompt.js";
import { TOOL_REGISTRY } from "../tools/index.js";

describe("buildSystemPrompt", () => {
  it("mentions OrbitAI identity", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("OrbitAI");
  });

  it("includes the correct tool count", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain(`${TOOL_REGISTRY.length} tools`);
  });

  it("lists all tool names", () => {
    const prompt = buildSystemPrompt();
    for (const tool of TOOL_REGISTRY) {
      expect(prompt).toContain(tool.name);
    }
  });

  it("lists actions for each tool", () => {
    const prompt = buildSystemPrompt();
    // Spot check a few known tools
    expect(prompt).toContain("manage_clusters");
    expect(prompt).toContain("manage_projects");
    expect(prompt).toContain("manage_billing");
  });

  it("includes guidelines section", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Guidelines");
    expect(prompt).toContain("destructive operations");
  });

  it("includes tool usage section", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Tool Usage");
    expect(prompt).toContain("action");
    expect(prompt).toContain("params");
    expect(prompt).toContain("query");
    expect(prompt).toContain("body");
  });

  it("omits context section when no context provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("User Context");
    expect(prompt).not.toContain("Default Organization ID");
    expect(prompt).not.toContain("Default Project");
  });

  it("includes orgId in context when provided", () => {
    const prompt = buildSystemPrompt({ orgId: "org-abc" });
    expect(prompt).toContain("User Context");
    expect(prompt).toContain("org-abc");
    expect(prompt).toContain("Organization ID");
  });

  it("includes groupId in context when provided", () => {
    const prompt = buildSystemPrompt({ groupId: "grp-xyz" });
    expect(prompt).toContain("User Context");
    expect(prompt).toContain("grp-xyz");
    expect(prompt).toContain("Project");
  });

  it("includes both orgId and groupId when provided", () => {
    const prompt = buildSystemPrompt({ orgId: "org-1", groupId: "grp-2" });
    expect(prompt).toContain("org-1");
    expect(prompt).toContain("grp-2");
  });

  it("omits context section when empty values provided", () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).not.toContain("User Context");
  });
});
