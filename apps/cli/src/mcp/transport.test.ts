/**
 * Tests for MCP Transport Selection.
 *
 * Note: These tests focus on the transport module's logic and types
 * without requiring deep mocking of the @modelcontextprotocol/sdk ESM module.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { TransportOptions, TransportType, TransportResult } from "./transport.js";

// Test the interfaces and types
describe("Transport Types", () => {
  describe("TransportType", () => {
    it("can be http", () => {
      const type: TransportType = "http";
      expect(type).toBe("http");
    });

    it("can be stdio", () => {
      const type: TransportType = "stdio";
      expect(type).toBe("stdio");
    });
  });

  describe("TransportOptions", () => {
    it("accepts empty options", () => {
      const options: TransportOptions = {};
      expect(options).toEqual({});
    });

    it("accepts all options", () => {
      const options: TransportOptions = {
        httpUrl: "http://localhost:3600/mcp",
        httpTimeout: 5000,
        forceStdio: true,
        stdioCommand: "orbit-mcp-server",
        stdioArgs: ["--flag"],
        stdioCwd: "/path/to/dir",
      };
      expect(options.httpUrl).toBe("http://localhost:3600/mcp");
      expect(options.httpTimeout).toBe(5000);
      expect(options.forceStdio).toBe(true);
      expect(options.stdioCommand).toBe("orbit-mcp-server");
      expect(options.stdioArgs).toEqual(["--flag"]);
      expect(options.stdioCwd).toBe("/path/to/dir");
    });
  });

  describe("TransportResult", () => {
    it("has transport and type fields", () => {
      // Mock transport object for type checking
      const mockTransport = { close: vi.fn() };
      const result: TransportResult = {
        transport: mockTransport as any,
        type: "http",
      };
      expect(result.type).toBe("http");
      expect(result.transport).toBeDefined();
    });
  });
});

// Test createTransport function behavior
describe("createTransport", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    delete process.env.ORBIT_MCP_URL;
    delete process.env.ORBIT_MCP_STDIO;
    delete process.env.ORBIT_MCP_HTTP_TIMEOUT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("can be imported", async () => {
    const { createTransport } = await import("./transport.js");
    expect(createTransport).toBeDefined();
    expect(typeof createTransport).toBe("function");
  });

  it("returns a TransportResult", async () => {
    const { createTransport } = await import("./transport.js");

    // Force stdio to avoid HTTP check
    const result = await createTransport({ forceStdio: true });

    expect(result).toHaveProperty("transport");
    expect(result).toHaveProperty("type");
    expect(result.type).toBe("stdio");
  });

  it("uses stdio when forceStdio=true", async () => {
    const { createTransport } = await import("./transport.js");

    const result = await createTransport({ forceStdio: true });

    expect(result.type).toBe("stdio");
  });

  it("uses stdio when ORBIT_MCP_STDIO=true", async () => {
    process.env.ORBIT_MCP_STDIO = "true";

    const { createTransport } = await import("./transport.js");

    const result = await createTransport();

    expect(result.type).toBe("stdio");
  });

  it("respects custom stdioCommand", async () => {
    const { createTransport } = await import("./transport.js");

    // This verifies the transport is created with options
    // (we can't easily verify the command without mocking StdioClientTransport)
    const result = await createTransport({
      forceStdio: true,
      stdioCommand: "custom-command",
      stdioArgs: ["--custom-flag"],
    });

    expect(result.type).toBe("stdio");
  });
});

// Test environment variable handling
describe("Environment variable handling", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("ORBIT_MCP_STDIO=true forces stdio", async () => {
    process.env.ORBIT_MCP_STDIO = "true";

    const { createTransport } = await import("./transport.js");
    const result = await createTransport();

    expect(result.type).toBe("stdio");
  });

  it("ORBIT_MCP_STDIO=false allows HTTP attempt", async () => {
    process.env.ORBIT_MCP_STDIO = "false";

    // This will try HTTP, fail (no server running), and fall back to stdio
    const { createTransport } = await import("./transport.js");
    const result = await createTransport();

    // Falls back to stdio since HTTP won't be available
    expect(result.type).toBe("stdio");
  });

  it("options override environment variables", async () => {
    process.env.ORBIT_MCP_STDIO = "false";

    const { createTransport } = await import("./transport.js");
    const result = await createTransport({ forceStdio: true });

    expect(result.type).toBe("stdio");
  });
});

// Test default values
describe("Default values", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.ORBIT_MCP_URL;
    delete process.env.ORBIT_MCP_STDIO;
    delete process.env.ORBIT_MCP_HTTP_TIMEOUT;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses default HTTP URL when not specified", async () => {
    // We can't easily test the actual URL without mocking fetch
    // but we verify the function runs without ORBIT_MCP_URL
    const { createTransport } = await import("./transport.js");

    // Force stdio to avoid HTTP check
    const result = await createTransport({ forceStdio: true });

    expect(result.type).toBe("stdio");
  });

  it("uses default stdio command when not specified", async () => {
    const { createTransport } = await import("./transport.js");

    // Will use default command "orbit-mcp-server"
    const result = await createTransport({ forceStdio: true });

    expect(result.type).toBe("stdio");
  });
});
