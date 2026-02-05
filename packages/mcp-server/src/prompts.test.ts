import { describe, it, expect } from "vitest";
import { PROMPT_REGISTRY } from "./prompts.js";

const EXPECTED_NAMES = [
  "cluster_builder",
  "cost_analyzer",
  "security_reviewer",
  "performance_optimizer",
  "disaster_recovery_planner",
  "data_explorer",
  "query_optimizer",
];

describe("PROMPT_REGISTRY", () => {
  it("has 7 entries (5 Atlas + 2 database)", () => {
    expect(PROMPT_REGISTRY).toHaveLength(7);
  });

  it("has expected prompt names", () => {
    const names = PROMPT_REGISTRY.map((p) => p.name);
    expect(names).toEqual(EXPECTED_NAMES);
  });

  it("each Atlas prompt has at least one required argument", () => {
    const atlasPrompts = PROMPT_REGISTRY.filter(
      (p) => !["data_explorer"].includes(p.name),
    );
    for (const prompt of atlasPrompts) {
      const requiredArgs = prompt.arguments.filter((a) => a.required);
      expect(requiredArgs.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("data_explorer has no required arguments", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "data_explorer")!;
    const requiredArgs = prompt.arguments.filter((a) => a.required);
    expect(requiredArgs).toHaveLength(0);
  });

  it("cluster_builder build() returns non-empty messages with role and content", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "cluster_builder")!;
    const messages = prompt.build({
      workload_type: "transactional",
      cloud_provider: "AWS",
      region: "us-east-1",
    });
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      expect(msg.role).toBeDefined();
      expect(msg.content).toBeDefined();
    }
  });

  it("cost_analyzer build() returns non-empty messages with role and content", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "cost_analyzer")!;
    const messages = prompt.build({ orgId: "org123" });
    expect(messages.length).toBeGreaterThan(0);
    for (const msg of messages) {
      expect(msg.role).toBeDefined();
      expect(msg.content).toBeDefined();
    }
  });

  it("data_explorer build() includes connect step when connectionString provided", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "data_explorer")!;
    const messages = prompt.build({ connectionString: "mongodb://localhost:27017" });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content.text).toContain("connect");
    expect(messages[0].content.text).toContain("mongodb://localhost:27017");
  });

  it("data_explorer build() works without arguments", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "data_explorer")!;
    const messages = prompt.build({});
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content.text).toContain("list-databases");
  });

  it("query_optimizer build() includes the query filter in the message", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "query_optimizer")!;
    const messages = prompt.build({
      database: "test",
      collection: "users",
      query: '{ "status": "active" }',
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content.text).toContain("test.users");
    expect(messages[0].content.text).toContain("explain");
  });
});
