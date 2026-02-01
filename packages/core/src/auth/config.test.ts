import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveConfig } from "./config.js";
import { AtlasConfigError } from "../errors/index.js";

describe("resolveConfig", () => {
  const savedEnv: Record<string, string | undefined> = {};

  const ENV_KEYS = [
    "ATLAS_PUBLIC_KEY",
    "ATLAS_PRIVATE_KEY",
    "ATLAS_ORG_ID",
    "ATLAS_GROUP_ID",
    "ATLAS_BASE_URL",
    "ATLAS_API_VERSION",
  ] as const;

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("returns resolved config with explicit values", () => {
    const result = resolveConfig({
      publicKey: "pub-123",
      privateKey: "priv-456",
      baseUrl: "https://custom.example.com",
      apiVersion: "2024-01-01",
      timeoutMs: 5000,
      maxRetries: 1,
      orgId: "org-1",
      groupId: "grp-1",
    });

    expect(result).toEqual({
      publicKey: "pub-123",
      privateKey: "priv-456",
      baseUrl: "https://custom.example.com",
      apiVersion: "2024-01-01",
      timeoutMs: 5000,
      maxRetries: 1,
      retryOnRateLimit: true,
      orgId: "org-1",
      groupId: "grp-1",
    });
  });

  it("falls back to environment variables for credentials", () => {
    process.env.ATLAS_PUBLIC_KEY = "env-pub";
    process.env.ATLAS_PRIVATE_KEY = "env-priv";
    process.env.ATLAS_ORG_ID = "env-org";
    process.env.ATLAS_GROUP_ID = "env-grp";

    const result = resolveConfig();

    expect(result.publicKey).toBe("env-pub");
    expect(result.privateKey).toBe("env-priv");
    expect(result.orgId).toBe("env-org");
    expect(result.groupId).toBe("env-grp");
  });

  it("config values take precedence over environment variables", () => {
    process.env.ATLAS_PUBLIC_KEY = "env-pub";
    process.env.ATLAS_PRIVATE_KEY = "env-priv";
    process.env.ATLAS_BASE_URL = "https://env.example.com";
    process.env.ATLAS_API_VERSION = "2024-06-01";

    const result = resolveConfig({
      publicKey: "cfg-pub",
      privateKey: "cfg-priv",
      baseUrl: "https://cfg.example.com",
      apiVersion: "2025-01-01",
    });

    expect(result.publicKey).toBe("cfg-pub");
    expect(result.privateKey).toBe("cfg-priv");
    expect(result.baseUrl).toBe("https://cfg.example.com");
    expect(result.apiVersion).toBe("2025-01-01");
  });

  it("throws AtlasConfigError when no credentials are provided", () => {
    expect(() => resolveConfig()).toThrow(AtlasConfigError);
    expect(() => resolveConfig()).toThrow("Atlas API credentials are required");
  });

  it("throws AtlasConfigError when only publicKey is provided", () => {
    expect(() => resolveConfig({ publicKey: "pub-only" })).toThrow(
      AtlasConfigError,
    );
  });

  it("throws AtlasConfigError when only privateKey is provided", () => {
    expect(() => resolveConfig({ privateKey: "priv-only" })).toThrow(
      AtlasConfigError,
    );
  });

  it("applies correct defaults for baseUrl, apiVersion, timeoutMs, and maxRetries", () => {
    const result = resolveConfig({
      publicKey: "pub",
      privateKey: "priv",
    });

    expect(result.baseUrl).toBe("https://cloud.mongodb.com");
    expect(result.apiVersion).toBe("2025-03-12");
    expect(result.timeoutMs).toBe(30_000);
    expect(result.maxRetries).toBe(3);
    expect(result.retryOnRateLimit).toBe(true);
  });

  it("falls back to env for baseUrl and apiVersion when not in config", () => {
    process.env.ATLAS_PUBLIC_KEY = "pub";
    process.env.ATLAS_PRIVATE_KEY = "priv";
    process.env.ATLAS_BASE_URL = "https://env-base.example.com";
    process.env.ATLAS_API_VERSION = "2024-12-01";

    const result = resolveConfig();

    expect(result.baseUrl).toBe("https://env-base.example.com");
    expect(result.apiVersion).toBe("2024-12-01");
  });
});
