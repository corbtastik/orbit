import { describe, it, expect, beforeAll } from "vitest";
import { RelationalMigratorClient } from "./relational-migrator-client.js";

/**
 * Integration tests for RelationalMigratorClient.
 *
 * These tests require a running Relational Migrator instance.
 * They are skipped automatically when RM is not available.
 *
 * To run these tests:
 * 1. Start MongoDB Relational Migrator
 * 2. Set ORBIT_RM_ENABLED=true (optional, defaults to true)
 * 3. Run: npm test --workspace=@orbit/core
 */

let client: RelationalMigratorClient;
let isAvailable = false;

beforeAll(async () => {
  client = new RelationalMigratorClient({ enabled: true });
  try {
    isAvailable = await client.isAvailable();
  } catch {
    isAvailable = false;
  }
});

describe.skipIf(!isAvailable)("RelationalMigratorClient integration", () => {
  it("returns health status from /actuator/health", async () => {
    const health = await client.getHealth();
    expect(health).toBeDefined();
    expect(health.status).toBeDefined();
  });

  it("returns system info from /api/v1/info", async () => {
    const info = await client.getSystemInfo();
    expect(info).toBeDefined();
    // RM should return version info
    expect(typeof info).toBe("object");
  });

  it("can list projects", async () => {
    const result = await client.get<unknown[]>("/api/v1/projects");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("can list JDBC connections", async () => {
    const result = await client.get<unknown[]>("/api/v1/connections/jdbc");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("can list MongoDB connections", async () => {
    const result = await client.get<unknown[]>("/api/v1/connections/mongodb");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("can list jobs", async () => {
    const result = await client.get<unknown[]>("/api/v1/jobs");
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns news from /api/v1/news", async () => {
    const result = await client.get<unknown>("/api/v1/news");
    expect(result).toBeDefined();
  });
});

describe("RelationalMigratorClient availability check", () => {
  it("isAvailable returns boolean", async () => {
    const testClient = new RelationalMigratorClient({ enabled: true });
    const available = await testClient.isAvailable();
    expect(typeof available).toBe("boolean");
  });

  it("can detect when RM is not running", async () => {
    // Use a port that should not have RM running
    const testClient = new RelationalMigratorClient({
      baseUrl: "http://127.0.0.1:19999",
      enabled: true,
    });
    const available = await testClient.isAvailable();
    expect(available).toBe(false);
  });
});
