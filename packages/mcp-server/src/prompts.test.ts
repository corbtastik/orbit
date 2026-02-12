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
  "migration_planner",
  "schema_designer",
];

describe("PROMPT_REGISTRY", () => {
  it("has 9 entries (5 Atlas + 2 database + 2 RM)", () => {
    expect(PROMPT_REGISTRY).toHaveLength(9);
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

  it("migration_planner build() includes source database type and RM tools", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "migration_planner")!;
    const messages = prompt.build({
      source_database_type: "postgresql",
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content.text).toContain("postgresql");
    expect(messages[0].content.text).toContain("get_rm_system_info");
    expect(messages[0].content.text).toContain("manage_rm_connections");
    expect(messages[0].content.text).toContain("manage_rm_projects");
  });

  it("schema_designer build() includes project ID and schema recommendations", () => {
    const prompt = PROMPT_REGISTRY.find((p) => p.name === "schema_designer")!;
    const messages = prompt.build({
      projectId: "proj-123",
      optimization_goal: "read-heavy",
    });
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].content.text).toContain("proj-123");
    expect(messages[0].content.text).toContain("read-heavy");
    expect(messages[0].content.text).toContain("get_recommendations");
    expect(messages[0].content.text).toContain("manage_rm_schema");
  });
});
