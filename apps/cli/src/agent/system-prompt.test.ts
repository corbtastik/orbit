import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./system-prompt.js";

describe("buildSystemPrompt", () => {
  it("mentions OrbitAI identity", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("OrbitAI");
  });

  it("describes tool coverage areas", () => {
    const prompt = buildSystemPrompt();
    // New prompt describes tool coverage instead of listing specific tools
    expect(prompt).toContain("MongoDB Atlas Admin API");
    expect(prompt).toContain("MongoDB database operations");
  });

  it("mentions Atlas API tools", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("Atlas Admin API");
  });

  it("mentions database tools", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("database operations");
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

  it("mentions database tool parameters", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("database");
    expect(prompt).toContain("collection");
    expect(prompt).toContain("connection");
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
