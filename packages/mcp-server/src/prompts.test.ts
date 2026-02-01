import { describe, it, expect } from "vitest";
import { PROMPT_REGISTRY } from "./prompts.js";

const EXPECTED_NAMES = [
  "cluster_builder",
  "cost_analyzer",
  "security_reviewer",
  "performance_optimizer",
  "disaster_recovery_planner",
];

describe("PROMPT_REGISTRY", () => {
  it("has 5 entries", () => {
    expect(PROMPT_REGISTRY).toHaveLength(5);
  });

  it("has expected prompt names", () => {
    const names = PROMPT_REGISTRY.map((p) => p.name);
    expect(names).toEqual(EXPECTED_NAMES);
  });

  it("each prompt has at least one required argument", () => {
    for (const prompt of PROMPT_REGISTRY) {
      const requiredArgs = prompt.arguments.filter((a) => a.required);
      expect(requiredArgs.length).toBeGreaterThanOrEqual(1);
    }
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
});
