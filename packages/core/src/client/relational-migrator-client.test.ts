import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RelationalMigratorClient } from "./relational-migrator-client.js";
import {
  RelationalMigratorError,
  RelationalMigratorUnavailableError,
} from "../errors/relational-migrator-error.js";

describe("RelationalMigratorClient", () => {
  describe("constructor and config", () => {
    it("uses default config when no config provided", () => {
      const client = new RelationalMigratorClient();
      expect(client.baseUrl).toBe("http://127.0.0.1:8278");
      expect(client.apiVersion).toBe("v1");
      expect(client.enabled).toBe(true);
    });

    it("uses custom config values", () => {
      const client = new RelationalMigratorClient({
        baseUrl: "http://custom:9000",
        apiVersion: "v2",
        timeoutMs: 60000,
        enabled: false,
      });
      expect(client.baseUrl).toBe("http://custom:9000");
      expect(client.apiVersion).toBe("v2");
      expect(client.enabled).toBe(false);
    });

    it("partial config merges with defaults", () => {
      const client = new RelationalMigratorClient({
        baseUrl: "http://localhost:8080",
      });
      expect(client.baseUrl).toBe("http://localhost:8080");
      expect(client.apiVersion).toBe("v1");
      expect(client.enabled).toBe(true);
    });
  });

  describe("enabled flag", () => {
    it("throws when disabled and request is made", async () => {
      const client = new RelationalMigratorClient({ enabled: false });
      await expect(client.get("/test")).rejects.toThrow(RelationalMigratorUnavailableError);
    });
  });

  describe("availability cache", () => {
    it("resetAvailabilityCache clears cached state", () => {
      const client = new RelationalMigratorClient();
      // Access the private available property via any
      (client as unknown as { available: boolean | null }).available = true;
      client.resetAvailabilityCache();
      expect((client as unknown as { available: boolean | null }).available).toBeNull();
    });
  });
});

describe("RelationalMigratorClient with mocked fetch", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("get() makes GET request and returns data", async () => {
    const mockData = { version: "1.15.2" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const client = new RelationalMigratorClient();
    const result = await client.get("/api/v1/info");

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toBe("http://127.0.0.1:8278/api/v1/info");
    expect(callArgs[1].method).toBe("GET");
  });

  it("post() makes POST request with body", async () => {
    const mockData = { id: "123", name: "test" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const client = new RelationalMigratorClient();
    const result = await client.post("/api/v1/projects", { name: "test" });

    expect(result).toEqual(mockData);
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].method).toBe("POST");
    expect(callArgs[1].body).toBe(JSON.stringify({ name: "test" }));
  });

  it("put() makes PUT request with body", async () => {
    const mockData = { id: "123", name: "updated" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const client = new RelationalMigratorClient();
    const result = await client.put("/api/v1/projects/123", { name: "updated" });

    expect(result).toEqual(mockData);
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].method).toBe("PUT");
  });

  it("delete() makes DELETE request", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 204,
      headers: new Headers(),
      text: () => Promise.resolve(""),
    });

    const client = new RelationalMigratorClient();
    const result = await client.delete("/api/v1/projects/123");

    expect(result).toEqual({});
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[1].method).toBe("DELETE");
  });

  it("get() with query parameters builds URL correctly", async () => {
    const mockData = { results: [] };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockData)),
    });

    const client = new RelationalMigratorClient();
    await client.get("/api/v1/projects", { limit: 10, active: true });

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const url = new URL(callArgs[0]);
    expect(url.searchParams.get("limit")).toBe("10");
    expect(url.searchParams.get("active")).toBe("true");
  });

  it("throws RelationalMigratorError on non-OK response", async () => {
    const errorBody = { message: "Not found", status: 404 };
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: () => Promise.resolve(errorBody),
    });

    const client = new RelationalMigratorClient();

    try {
      await client.get("/api/v1/projects/notfound");
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(RelationalMigratorError);
      const err = e as RelationalMigratorError;
      expect(err.status).toBe(404);
      expect(err.detail).toBe("Not found");
      expect(err.errorCode).toBe("RM_404");
    }
  });

  it("throws RelationalMigratorUnavailableError on network error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const client = new RelationalMigratorClient();
    await expect(client.get("/api/v1/info")).rejects.toThrow(RelationalMigratorUnavailableError);
  });

  it("isAvailable() returns true when health check succeeds", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ status: "UP" })),
    });

    const client = new RelationalMigratorClient();
    const available = await client.isAvailable();

    expect(available).toBe(true);
  });

  it("isAvailable() returns false when health check fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    const client = new RelationalMigratorClient();
    const available = await client.isAvailable();

    expect(available).toBe(false);
  });

  it("isAvailable() caches result", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify({ status: "UP" })),
    });

    const client = new RelationalMigratorClient();
    await client.isAvailable();
    await client.isAvailable();
    await client.isAvailable();

    // Should only call fetch once due to caching
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("getSystemInfo() returns system info", async () => {
    const mockInfo = {
      application: "Relational Migrator",
      version: "1.15.2",
      buildTimestamp: "2024-01-15",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockInfo)),
    });

    const client = new RelationalMigratorClient();
    const result = await client.getSystemInfo();

    expect(result).toEqual(mockInfo);
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toContain("/api/v1/info");
  });

  it("getHealth() returns health status", async () => {
    const mockHealth = { status: "UP" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve(JSON.stringify(mockHealth)),
    });

    const client = new RelationalMigratorClient();
    const result = await client.getHealth();

    expect(result).toEqual(mockHealth);
    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0]).toContain("/actuator/health");
  });

  it("handles empty response body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "0" }),
      text: () => Promise.resolve(""),
    });

    const client = new RelationalMigratorClient();
    const result = await client.get("/api/v1/empty");

    expect(result).toEqual({});
  });

  it("includes required headers in requests", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: () => Promise.resolve("{}"),
    });

    const client = new RelationalMigratorClient();
    await client.get("/test");

    const callArgs = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const headers = callArgs[1].headers;
    expect(headers["accept"]).toBe("application/json");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["user-agent"]).toContain("OrbitAI");
  });
});
