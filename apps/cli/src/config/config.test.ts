import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfigFile, DEFAULTS } from "@orbit/core";
import { resolveCliConfig } from "./config.js";

// Prevent real ~/.orbit-ai/config.json from leaking into tests
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: (path: string) => {
      if (String(path).includes(".orbit-ai/config.json")) return false;
      return actual.existsSync(path);
    },
  };
});

describe("loadConfigFile", () => {
  it("returns empty object for non-existent file", () => {
    const result = loadConfigFile("/tmp/orbit-ai-no-such-file.json");
    expect(result).toEqual({});
  });

  it("returns empty object for invalid JSON", async () => {
    const fs = await import("node:fs");
    const tmp = "/tmp/orbit-ai-test-bad.json";
    fs.writeFileSync(tmp, "not-json{{{", "utf-8");
    try {
      const result = loadConfigFile(tmp);
      expect(result).toEqual({});
    } finally {
      fs.unlinkSync(tmp);
    }
  });

  it("loads valid config file", async () => {
    const fs = await import("node:fs");
    const tmp = "/tmp/orbit-ai-test-valid.json";
    fs.writeFileSync(
      tmp,
      JSON.stringify({
        llm: { provider: "openai", model: "gpt-4o" },
      }),
      "utf-8",
    );
    try {
      const result = loadConfigFile(tmp);
      expect(result.llm?.provider).toBe("openai");
      expect(result.llm?.model).toBe("gpt-4o");
    } finally {
      fs.unlinkSync(tmp);
    }
  });
});

describe("resolveCliConfig", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save env vars we'll modify
    const keys = [
      "ORBIT_LLM_PROVIDER",
      "ORBIT_LLM_API_KEY",
      "ORBIT_LLM_MODEL",
      "ORBIT_LLM_BASE_URL",
      "ORBIT_LLM_MAX_TOKENS",
      "ANTHROPIC_API_KEY",
      "OPENAI_API_KEY",
      "GOOGLE_API_KEY",
      "ATLAS_PUBLIC_KEY",
      "ATLAS_PRIVATE_KEY",
      "ATLAS_ORG_ID",
      "ATLAS_GROUP_ID",
      "ATLAS_BASE_URL",
    ];
    for (const key of keys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("returns defaults when no flags, env, or file config", () => {
    const config = resolveCliConfig();
    expect(config.llm.provider).toBe("anthropic");
    expect(config.llm.model).toBe(DEFAULTS.providerModels.anthropic);
    expect(config.llm.maxTokens).toBe(4096);
    // No default — current Anthropic models reject `temperature` outright.
    expect(config.llm.temperature).toBeUndefined();
    expect(config.defaults.verbose).toBe(false);
    expect(config.defaults.maxToolTurns).toBe(10);
    expect(config.atlas.baseUrl).toBe("https://cloud.mongodb.com");
  });

  it("CLI flags override everything", () => {
    process.env.ORBIT_LLM_PROVIDER = "google";
    process.env.ORBIT_LLM_MODEL = "gemini-pro";

    const config = resolveCliConfig({
      provider: "openai",
      model: "gpt-4-turbo",
      verbose: true,
      maxTokens: 8192,
    });

    expect(config.llm.provider).toBe("openai");
    expect(config.llm.model).toBe("gpt-4-turbo");
    expect(config.defaults.verbose).toBe(true);
    expect(config.llm.maxTokens).toBe(8192);
  });

  it("env vars override defaults", () => {
    process.env.ORBIT_LLM_PROVIDER = "google";
    process.env.ORBIT_LLM_MODEL = "gemini-2.0-flash";
    process.env.ORBIT_LLM_MAX_TOKENS = "2048";
    process.env.ATLAS_PUBLIC_KEY = "pub123";
    process.env.ATLAS_PRIVATE_KEY = "priv456";
    process.env.ATLAS_ORG_ID = "org789";
    process.env.ATLAS_GROUP_ID = "grp012";

    const config = resolveCliConfig();
    expect(config.llm.provider).toBe("google");
    expect(config.llm.model).toBe("gemini-2.0-flash");
    expect(config.llm.maxTokens).toBe(2048);
    expect(config.atlas.publicKey).toBe("pub123");
    expect(config.atlas.privateKey).toBe("priv456");
    expect(config.atlas.orgId).toBe("org789");
    expect(config.atlas.groupId).toBe("grp012");
  });

  it("resolves provider-specific API key from env", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-123";
    const config = resolveCliConfig();
    expect(config.llm.apiKey).toBe("sk-ant-123");
  });

  it("resolves OpenAI API key when provider is openai", () => {
    process.env.OPENAI_API_KEY = "sk-oai-456";
    const config = resolveCliConfig({ provider: "openai" });
    expect(config.llm.apiKey).toBe("sk-oai-456");
  });

  it("resolves Google API key when provider is google", () => {
    process.env.GOOGLE_API_KEY = "goog-789";
    const config = resolveCliConfig({ provider: "google" });
    expect(config.llm.apiKey).toBe("goog-789");
  });

  it("Ollama has no API key requirement", () => {
    const config = resolveCliConfig({ provider: "ollama" });
    expect(config.llm.apiKey).toBeUndefined();
  });

  it("generic ORBIT_LLM_API_KEY overrides provider-specific key", () => {
    process.env.ORBIT_LLM_API_KEY = "generic-key";
    process.env.ANTHROPIC_API_KEY = "specific-key";
    const config = resolveCliConfig();
    expect(config.llm.apiKey).toBe("generic-key");
  });

  it("flag apiKey overrides env vars", () => {
    process.env.ORBIT_LLM_API_KEY = "env-key";
    const config = resolveCliConfig({ apiKey: "flag-key" });
    expect(config.llm.apiKey).toBe("flag-key");
  });

  it("uses provider-specific default model", () => {
    const openai = resolveCliConfig({ provider: "openai" });
    expect(openai.llm.model).toBe(DEFAULTS.providerModels.openai);

    const google = resolveCliConfig({ provider: "google" });
    expect(google.llm.model).toBe(DEFAULTS.providerModels.google);

    const ollama = resolveCliConfig({ provider: "ollama" });
    expect(ollama.llm.model).toBe(DEFAULTS.providerModels.ollama);

    const anthropic = resolveCliConfig({ provider: "anthropic" });
    expect(anthropic.llm.model).toBe(DEFAULTS.providerModels.anthropic);
  });
});
