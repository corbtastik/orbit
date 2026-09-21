/**
 * Tests for configuration loader.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loadConfigFile, loadConfig, hasAtlasCredentials, hasLlmConfig } from "./loader.js";
import { DEFAULTS, type ResolvedOrbitConfig } from "./types.js";

// Mock fs module
vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

import { readFileSync, existsSync } from "node:fs";

describe("loadConfigFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty object if file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const config = loadConfigFile("/path/to/config.json");

    expect(config).toEqual({});
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("parses valid JSON config file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      atlas: {
        publicKey: "test-key",
        privateKey: "test-secret",
      },
    }));

    const config = loadConfigFile("/path/to/config.json");

    expect(config).toEqual({
      atlas: {
        publicKey: "test-key",
        privateKey: "test-secret",
      },
    });
  });

  it("returns empty object and warns on read error", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockImplementation(() => {
      throw new Error("Permission denied");
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = loadConfigFile("/path/to/config.json");

    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Could not read config file"),
    );
  });

  it("returns empty object and warns on invalid JSON", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("{ invalid json }");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const config = loadConfigFile("/path/to/config.json");

    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("invalid JSON"),
    );
  });

  it("handles empty config file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("{}");

    const config = loadConfigFile("/path/to/config.json");

    expect(config).toEqual({});
  });
});

describe("loadConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment to clean state
    process.env = { ...originalEnv };
    // Clear all ORBIT/ATLAS env vars
    Object.keys(process.env).forEach((key) => {
      if (key.startsWith("ORBIT_") || key.startsWith("ATLAS_") ||
          key.startsWith("MONGODB_") || key.startsWith("ANTHROPIC_") ||
          key.startsWith("OPENAI_") || key.startsWith("GOOGLE_")) {
        delete process.env[key];
      }
    });

    // Default mock behavior - no config file
    vi.mocked(existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("default values", () => {
    it("returns defaults when no config file or env vars", () => {
      const config = loadConfig();

      expect(config.atlas.default).toBe("default");
      expect(config.atlas.profiles).toEqual({});
      expect(config.server.port).toBe(DEFAULTS.server.port);
      expect(config.server.host).toBe(DEFAULTS.server.host);
      expect(config.server.readOnly).toBe(DEFAULTS.server.readOnly);
      expect(config.server.http).toBe(DEFAULTS.server.http);
      expect(config.llm.provider).toBe(DEFAULTS.llm.provider);
      expect(config.llm.maxTokens).toBe(DEFAULTS.llm.maxTokens);
      expect(config.mcp.url).toBe(DEFAULTS.mcp.url);
      expect(config.mcp.forceStdio).toBe(DEFAULTS.mcp.forceStdio);
      expect(config.defaults.outputFormat).toBe(DEFAULTS.defaults.outputFormat);
    });
  });

  describe("config file values", () => {
    it("loads atlas credentials from config file as default profile", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        atlas: {
          publicKey: "file-public-key",
          privateKey: "file-private-key",
          orgId: "org123",
          groupId: "group456",
        },
      }));

      const config = loadConfig();

      expect(config.atlas.default).toBe("default");
      expect(config.atlas.profiles.default.publicKey).toBe("file-public-key");
      expect(config.atlas.profiles.default.privateKey).toBe("file-private-key");
      expect(config.atlas.profiles.default.orgId).toBe("org123");
      expect(config.atlas.profiles.default.groupId).toBe("group456");
    });

    it("loads named atlas profiles from config file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        atlas: {
          default: "prod",
          profiles: {
            prod: {
              publicKey: "prod-public",
              privateKey: "prod-private",
              orgId: "org-prod",
            },
            dev: {
              publicKey: "dev-public",
              privateKey: "dev-private",
              orgId: "org-dev",
            },
          },
        },
      }));

      const config = loadConfig();

      expect(config.atlas.default).toBe("prod");
      expect(config.atlas.profiles.prod.publicKey).toBe("prod-public");
      expect(config.atlas.profiles.prod.orgId).toBe("org-prod");
      expect(config.atlas.profiles.dev.publicKey).toBe("dev-public");
      expect(config.atlas.profiles.dev.orgId).toBe("org-dev");
    });

    it("loads server settings from config file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        server: {
          readOnly: true,
          http: true,
          port: 4000,
          host: "0.0.0.0",
        },
      }));

      const config = loadConfig();

      expect(config.server.readOnly).toBe(true);
      expect(config.server.http).toBe(true);
      expect(config.server.port).toBe(4000);
      expect(config.server.host).toBe("0.0.0.0");
    });

    it("defaults allowedHosts and corsOrigins to empty arrays", () => {
      const config = loadConfig();

      expect(config.server.allowedHosts).toEqual([]);
      expect(config.server.corsOrigins).toEqual([]);
    });

    it("loads allowedHosts and corsOrigins arrays from config file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        server: {
          allowedHosts: ["localhost", "orbit.local"],
          corsOrigins: ["http://localhost:5173"],
        },
      }));

      const config = loadConfig();

      expect(config.server.allowedHosts).toEqual(["localhost", "orbit.local"]);
      expect(config.server.corsOrigins).toEqual(["http://localhost:5173"]);
    });

    it("parses comma-separated allowedHosts and corsOrigins env vars", () => {
      process.env.ORBIT_MCP_ALLOWED_HOSTS = "localhost, orbit.local ,";
      process.env.ORBIT_MCP_CORS_ORIGINS = "http://localhost:5173,http://localhost:3000";

      const config = loadConfig();

      expect(config.server.allowedHosts).toEqual(["localhost", "orbit.local"]);
      expect(config.server.corsOrigins).toEqual([
        "http://localhost:5173",
        "http://localhost:3000",
      ]);
    });

    it("env vars override config file for allowedHosts and corsOrigins", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        server: {
          allowedHosts: ["from-file"],
          corsOrigins: ["http://from-file"],
        },
      }));

      process.env.ORBIT_MCP_ALLOWED_HOSTS = "from-env";
      process.env.ORBIT_MCP_CORS_ORIGINS = "http://from-env";

      const config = loadConfig();

      expect(config.server.allowedHosts).toEqual(["from-env"]);
      expect(config.server.corsOrigins).toEqual(["http://from-env"]);
    });

    it("loads LLM settings from config file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        llm: {
          provider: "openai",
          apiKey: "file-api-key",
          model: "gpt-4",
          maxTokens: 8192,
        },
      }));

      const config = loadConfig();

      expect(config.llm.provider).toBe("openai");
      expect(config.llm.apiKey).toBe("file-api-key");
      expect(config.llm.model).toBe("gpt-4");
      expect(config.llm.maxTokens).toBe(8192);
    });

    it("loads MongoDB connections from config file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        mongodb: {
          default: "mongodb://localhost:27017/default",
          connections: {
            prod: "mongodb://prod:27017/db",
            dev: "mongodb://dev:27017/db",
          },
        },
      }));

      const config = loadConfig();

      expect(config.mongodb.default).toBe("mongodb://localhost:27017/default");
      expect(config.mongodb.connections.prod).toBe("mongodb://prod:27017/db");
      expect(config.mongodb.connections.dev).toBe("mongodb://dev:27017/db");
    });
  });

  describe("environment variable overrides", () => {
    it("env vars override config file for default atlas profile", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        atlas: {
          publicKey: "file-key",
          privateKey: "file-secret",
        },
      }));

      process.env.ATLAS_PUBLIC_KEY = "env-key";
      process.env.ATLAS_PRIVATE_KEY = "env-secret";

      const config = loadConfig();

      expect(config.atlas.profiles.default.publicKey).toBe("env-key");
      expect(config.atlas.profiles.default.privateKey).toBe("env-secret");
    });

    it("named profile env vars create profiles", () => {
      process.env.ATLAS_PROD_PUBLIC_KEY = "prod-key";
      process.env.ATLAS_PROD_PRIVATE_KEY = "prod-secret";
      process.env.ATLAS_PROD_ORG_ID = "prod-org";
      process.env.ATLAS_DEV_PUBLIC_KEY = "dev-key";
      process.env.ATLAS_DEV_PRIVATE_KEY = "dev-secret";

      const config = loadConfig();

      expect(config.atlas.profiles.prod.publicKey).toBe("prod-key");
      expect(config.atlas.profiles.prod.privateKey).toBe("prod-secret");
      expect(config.atlas.profiles.prod.orgId).toBe("prod-org");
      expect(config.atlas.profiles.dev.publicKey).toBe("dev-key");
      expect(config.atlas.profiles.dev.privateKey).toBe("dev-secret");
    });

    it("ATLAS_DEFAULT_PROFILE sets default profile name", () => {
      process.env.ATLAS_DEFAULT_PROFILE = "staging";
      process.env.ATLAS_STAGING_PUBLIC_KEY = "staging-key";
      process.env.ATLAS_STAGING_PRIVATE_KEY = "staging-secret";

      const config = loadConfig();

      expect(config.atlas.default).toBe("staging");
    });

    it("env profile vars override config file profile values", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        atlas: {
          profiles: {
            prod: {
              publicKey: "file-prod-key",
              privateKey: "file-prod-secret",
              orgId: "file-org",
            },
          },
        },
      }));

      process.env.ATLAS_PROD_PUBLIC_KEY = "env-prod-key";

      const config = loadConfig();

      expect(config.atlas.profiles.prod.publicKey).toBe("env-prod-key");
      expect(config.atlas.profiles.prod.privateKey).toBe("file-prod-secret");
      expect(config.atlas.profiles.prod.orgId).toBe("file-org");
    });

    it("env vars override config file for server", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        server: { port: 4000 },
      }));

      process.env.ORBIT_MCP_PORT = "5000";
      process.env.ORBIT_READ_ONLY = "true";

      const config = loadConfig();

      expect(config.server.port).toBe(5000);
      expect(config.server.readOnly).toBe(true);
    });

    it("ORBIT_LLM_PROVIDER overrides config file", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        llm: { provider: "anthropic" },
      }));

      process.env.ORBIT_LLM_PROVIDER = "openai";

      const config = loadConfig();

      expect(config.llm.provider).toBe("openai");
    });

    it("MONGODB_CONNECTION_STRING sets default connection", () => {
      process.env.MONGODB_CONNECTION_STRING = "mongodb://env:27017/db";

      const config = loadConfig();

      expect(config.mongodb.default).toBe("mongodb://env:27017/db");
    });

    it("MONGODB_CONN_* env vars add named connections", () => {
      process.env.MONGODB_CONN_STAGING = "mongodb://staging:27017/db";
      process.env.MONGODB_CONN_PROD = "mongodb://prod:27017/db";

      const config = loadConfig();

      expect(config.mongodb.connections.staging).toBe("mongodb://staging:27017/db");
      expect(config.mongodb.connections.prod).toBe("mongodb://prod:27017/db");
    });

    it("env connections override config file connections", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
        mongodb: {
          connections: {
            prod: "mongodb://file-prod:27017/db",
          },
        },
      }));

      process.env.MONGODB_CONN_PROD = "mongodb://env-prod:27017/db";

      const config = loadConfig();

      expect(config.mongodb.connections.prod).toBe("mongodb://env-prod:27017/db");
    });
  });

  describe("API key resolution", () => {
    it("uses ORBIT_LLM_API_KEY for any provider", () => {
      process.env.ORBIT_LLM_API_KEY = "generic-key";
      process.env.ORBIT_LLM_PROVIDER = "openai";

      const config = loadConfig();

      expect(config.llm.apiKey).toBe("generic-key");
    });

    it("uses ANTHROPIC_API_KEY for anthropic provider", () => {
      process.env.ANTHROPIC_API_KEY = "anthropic-key";

      const config = loadConfig();

      expect(config.llm.apiKey).toBe("anthropic-key");
    });

    it("uses OPENAI_API_KEY for openai provider", () => {
      process.env.ORBIT_LLM_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "openai-key";

      const config = loadConfig();

      expect(config.llm.apiKey).toBe("openai-key");
    });

    it("uses GOOGLE_API_KEY for google provider", () => {
      process.env.ORBIT_LLM_PROVIDER = "google";
      process.env.GOOGLE_API_KEY = "google-key";

      const config = loadConfig();

      expect(config.llm.apiKey).toBe("google-key");
    });

    it("ORBIT_LLM_API_KEY takes precedence over provider-specific", () => {
      process.env.ORBIT_LLM_API_KEY = "generic-key";
      process.env.ANTHROPIC_API_KEY = "anthropic-key";

      const config = loadConfig();

      expect(config.llm.apiKey).toBe("generic-key");
    });

    it("ollama provider does not require API key", () => {
      process.env.ORBIT_LLM_PROVIDER = "ollama";

      const config = loadConfig();

      expect(config.llm.provider).toBe("ollama");
      expect(config.llm.apiKey).toBeUndefined();
    });
  });

  describe("boolean parsing", () => {
    it("parses 'true' as true", () => {
      process.env.ORBIT_READ_ONLY = "true";

      const config = loadConfig();

      expect(config.server.readOnly).toBe(true);
    });

    it("parses '1' as true", () => {
      process.env.ORBIT_READ_ONLY = "1";

      const config = loadConfig();

      expect(config.server.readOnly).toBe(true);
    });

    it("parses 'false' as false", () => {
      process.env.ORBIT_MCP_HTTP = "false";

      const config = loadConfig();

      expect(config.server.http).toBe(false);
    });

    it("parses other strings as false", () => {
      process.env.ORBIT_READ_ONLY = "yes";

      const config = loadConfig();

      expect(config.server.readOnly).toBe(false);
    });
  });

  describe("integer parsing", () => {
    it("parses valid integer string", () => {
      process.env.ORBIT_MCP_PORT = "4500";

      const config = loadConfig();

      expect(config.server.port).toBe(4500);
    });

    it("uses default for invalid integer", () => {
      process.env.ORBIT_MCP_PORT = "not-a-number";

      const config = loadConfig();

      expect(config.server.port).toBe(DEFAULTS.server.port);
    });
  });

  describe("provider model defaults", () => {
    it("uses default model for anthropic", () => {
      process.env.ORBIT_LLM_PROVIDER = "anthropic";

      const config = loadConfig();

      expect(config.llm.model).toBe(DEFAULTS.providerModels.anthropic);
    });

    it("uses default model for openai", () => {
      process.env.ORBIT_LLM_PROVIDER = "openai";

      const config = loadConfig();

      expect(config.llm.model).toBe(DEFAULTS.providerModels.openai);
    });

    it("uses default model for google", () => {
      process.env.ORBIT_LLM_PROVIDER = "google";

      const config = loadConfig();

      expect(config.llm.model).toBe(DEFAULTS.providerModels.google);
    });

    it("uses default model for ollama", () => {
      process.env.ORBIT_LLM_PROVIDER = "ollama";

      const config = loadConfig();

      expect(config.llm.model).toBe(DEFAULTS.providerModels.ollama);
    });

    it("ORBIT_LLM_MODEL overrides default", () => {
      process.env.ORBIT_LLM_MODEL = "custom-model";

      const config = loadConfig();

      expect(config.llm.model).toBe("custom-model");
    });
  });
});

describe("hasAtlasCredentials", () => {
  it("returns true when at least one profile has both keys", () => {
    const config = {
      atlas: {
        default: "default",
        profiles: {
          default: {
            publicKey: "key",
            privateKey: "secret",
            baseUrl: "https://cloud.mongodb.com",
          },
        },
      },
    } as unknown as ResolvedOrbitConfig;

    expect(hasAtlasCredentials(config)).toBe(true);
  });

  it("returns true when any profile has valid credentials", () => {
    const config = {
      atlas: {
        default: "default",
        profiles: {
          prod: {
            publicKey: "prod-key",
            privateKey: "prod-secret",
            baseUrl: "https://cloud.mongodb.com",
          },
        },
      },
    } as unknown as ResolvedOrbitConfig;

    expect(hasAtlasCredentials(config)).toBe(true);
  });

  it("returns false when profile has empty publicKey", () => {
    const config = {
      atlas: {
        default: "default",
        profiles: {
          default: {
            publicKey: "",
            privateKey: "secret",
            baseUrl: "https://cloud.mongodb.com",
          },
        },
      },
    } as unknown as ResolvedOrbitConfig;

    expect(hasAtlasCredentials(config)).toBe(false);
  });

  it("returns false when profile has empty privateKey", () => {
    const config = {
      atlas: {
        default: "default",
        profiles: {
          default: {
            publicKey: "key",
            privateKey: "",
            baseUrl: "https://cloud.mongodb.com",
          },
        },
      },
    } as unknown as ResolvedOrbitConfig;

    expect(hasAtlasCredentials(config)).toBe(false);
  });

  it("returns false when no profiles exist", () => {
    const config = {
      atlas: {
        default: "default",
        profiles: {},
      },
    } as unknown as ResolvedOrbitConfig;

    expect(hasAtlasCredentials(config)).toBe(false);
  });
});

describe("hasLlmConfig", () => {
  it("returns true for ollama without API key", () => {
    const config = {
      llm: {
        provider: "ollama",
        model: "llama3.1",
        maxTokens: 4096,
        temperature: 0,
      },
    } as ResolvedOrbitConfig;

    expect(hasLlmConfig(config)).toBe(true);
  });

  it("returns true when API key is set", () => {
    const config = {
      llm: {
        provider: "anthropic",
        apiKey: "test-key",
        model: "test-model",
        maxTokens: 4096,
        temperature: 0,
      },
    } as ResolvedOrbitConfig;

    expect(hasLlmConfig(config)).toBe(true);
  });

  it("returns false for non-ollama without API key", () => {
    const config = {
      llm: {
        provider: "anthropic",
        model: "test-model",
        maxTokens: 4096,
        temperature: 0,
      },
    } as ResolvedOrbitConfig;

    expect(hasLlmConfig(config)).toBe(false);
  });
});
