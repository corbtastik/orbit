/**
 * Tests for MCP Client Wrapper.
 *
 * Note: These tests focus on the client wrapper's logic without requiring
 * deep mocking of the @modelcontextprotocol/sdk ESM module.
 */

import { describe, it, expect } from "vitest";
import type { McpClientOptions, McpToolDefinition, McpToolResult } from "./client.js";

// Test the interfaces and types
describe("MCP Client Types", () => {
  describe("McpClientOptions", () => {
    it("accepts empty options", () => {
      const options: McpClientOptions = {};
      expect(options).toEqual({});
    });

    it("accepts all options", () => {
      const options: McpClientOptions = {
        clientName: "test-client",
        clientVersion: "1.0.0",
        httpUrl: "http://localhost:3600/mcp",
        httpTimeout: 5000,
        forceStdio: true,
        stdioCommand: "orbit-mcp-server",
        stdioArgs: ["--flag"],
        stdioCwd: "/path/to/dir",
      };
      expect(options.clientName).toBe("test-client");
      expect(options.clientVersion).toBe("1.0.0");
      expect(options.httpUrl).toBe("http://localhost:3600/mcp");
      expect(options.forceStdio).toBe(true);
    });
  });

  describe("McpToolDefinition", () => {
    it("has required fields", () => {
      const tool: McpToolDefinition = {
        name: "test-tool",
        description: "A test tool",
        input_schema: {
          type: "object",
          properties: { arg1: { type: "string" } },
          required: ["arg1"],
        },
      };
      expect(tool.name).toBe("test-tool");
      expect(tool.description).toBe("A test tool");
      expect(tool.input_schema.type).toBe("object");
    });

    it("allows empty properties and required", () => {
      const tool: McpToolDefinition = {
        name: "simple-tool",
        description: "",
        input_schema: {
          type: "object",
        },
      };
      expect(tool.input_schema.properties).toBeUndefined();
      expect(tool.input_schema.required).toBeUndefined();
    });
  });

  describe("McpToolResult", () => {
    it("represents success result", () => {
      const result: McpToolResult = {
        success: true,
        content: "Operation completed successfully",
      };
      expect(result.success).toBe(true);
      expect(result.content).toBe("Operation completed successfully");
    });

    it("represents error result", () => {
      const result: McpToolResult = {
        success: false,
        content: "Error: something went wrong",
      };
      expect(result.success).toBe(false);
      expect(result.content).toContain("Error");
    });
  });
});

// Test the McpClientWrapper class behavior
describe("McpClientWrapper", () => {
  // Import dynamically to avoid ESM mock issues
  it("can be imported", async () => {
    const { McpClientWrapper } = await import("./client.js");
    expect(McpClientWrapper).toBeDefined();
  });

  it("constructor creates instance with defaults", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    expect(client.transportType).toBeNull();
    expect(client.isConnected).toBe(false);
    expect(client.getServerVersion()).toBeUndefined();
  });

  it("constructor accepts custom options", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper({
      clientName: "custom-client",
      clientVersion: "2.0.0",
      httpUrl: "http://custom:9999/mcp",
    });

    // Instance is created (options stored internally)
    expect(client).toBeDefined();
    expect(client.isConnected).toBe(false);
  });

  it("listTools throws when not connected", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    await expect(client.listTools()).rejects.toThrow("Not connected to MCP server");
  });

  it("callTool throws when not connected", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    await expect(client.callTool("test", {})).rejects.toThrow("Not connected to MCP server");
  });

  it("disconnect is safe when not connected", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    // Should not throw
    await client.disconnect();
    expect(client.isConnected).toBe(false);
  });
});

// These tests verify expected behavior patterns
describe("McpClientWrapper behavior patterns", () => {
  it("isConnected reflects connection state", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    // Initially not connected
    expect(client.isConnected).toBe(false);

    // After disconnect (no-op), still not connected
    await client.disconnect();
    expect(client.isConnected).toBe(false);
  });

  it("transportType is null when not connected", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    expect(client.transportType).toBeNull();
  });

  it("getServerVersion returns undefined when not connected", async () => {
    const { McpClientWrapper } = await import("./client.js");
    const client = new McpClientWrapper();

    expect(client.getServerVersion()).toBeUndefined();
  });
});
