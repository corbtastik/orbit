/**
 * MCP Client Wrapper for CLI.
 *
 * Provides a high-level interface for connecting to the MCP server,
 * listing tools, and executing tool calls.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { createTransport, type TransportOptions, type TransportType } from "./transport.js";

/** Tool definition compatible with LLM providers. */
export interface McpToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
}

/** Result of a tool call. */
export interface McpToolResult {
  success: boolean;
  content: string;
}

/** Options for McpClientWrapper. */
export interface McpClientOptions extends TransportOptions {
  /** Client name for MCP protocol. */
  clientName?: string;
  /** Client version for MCP protocol. */
  clientVersion?: string;
}

/**
 * MCP Client Wrapper.
 *
 * Provides a simplified interface for CLI to interact with MCP server:
 * - Automatic transport selection (HTTP → stdio fallback)
 * - Tool listing with caching
 * - Tool execution with result handling
 */
export class McpClientWrapper {
  private client: Client | null = null;
  private transport: Transport | null = null;
  private _transportType: TransportType | null = null;
  private cachedTools: McpToolDefinition[] | null = null;
  private options: McpClientOptions;

  constructor(options: McpClientOptions = {}) {
    this.options = {
      clientName: "orbit-ai-cli",
      clientVersion: "0.1.0",
      ...options,
    };
  }

  /**
   * Get the current transport type.
   */
  get transportType(): TransportType | null {
    return this._transportType;
  }

  /**
   * Check if client is connected.
   */
  get isConnected(): boolean {
    return this.client !== null && this.transport !== null;
  }

  /**
   * Connect to the MCP server.
   *
   * Tries HTTP transport first, falls back to stdio if unavailable.
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    // Create transport (HTTP → stdio fallback)
    const { transport, type } = await createTransport(this.options);
    this.transport = transport;
    this._transportType = type;

    // Create MCP client
    this.client = new Client(
      {
        name: this.options.clientName!,
        version: this.options.clientVersion!,
      },
      {
        capabilities: {},
      },
    );

    // Connect to server
    await this.client.connect(transport);

    // Clear cached tools on new connection
    this.cachedTools = null;
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }

    if (this.client) {
      await this.client.close();
      this.client = null;
    }

    this._transportType = null;
    this.cachedTools = null;
  }

  /**
   * List available tools.
   *
   * Fetches tools from server and caches them. Returns cached tools
   * on subsequent calls unless refresh is true.
   */
  async listTools(refresh = false): Promise<McpToolDefinition[]> {
    if (!this.client) {
      throw new Error("Not connected to MCP server");
    }

    if (this.cachedTools && !refresh) {
      return this.cachedTools;
    }

    const response = await this.client.listTools();

    this.cachedTools = response.tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? "",
      input_schema: {
        type: "object" as const,
        properties: tool.inputSchema.properties as Record<string, unknown> | undefined,
        required: tool.inputSchema.required,
      },
    }));

    return this.cachedTools;
  }

  /**
   * Call a tool with the given arguments.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpToolResult> {
    if (!this.client) {
      throw new Error("Not connected to MCP server");
    }

    try {
      const response = await this.client.callTool({
        name,
        arguments: args,
      });

      // Extract text content from response
      const content = this.extractContent(response);
      const isError = "isError" in response && response.isError === true;

      return {
        success: !isError,
        content,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        content: message,
      };
    }
  }

  /**
   * Extract text content from MCP tool result.
   */
  private extractContent(response: Awaited<ReturnType<Client["callTool"]>>): string {
    // Handle standard content array format
    if ("content" in response && Array.isArray(response.content)) {
      const textParts: string[] = [];

      for (const block of response.content) {
        if (block.type === "text" && "text" in block) {
          textParts.push(block.text);
        }
      }

      return textParts.join("\n");
    }

    // Handle toolResult format (compatibility mode)
    if ("toolResult" in response) {
      return typeof response.toolResult === "string"
        ? response.toolResult
        : JSON.stringify(response.toolResult, null, 2);
    }

    return "";
  }

  /**
   * Get server instructions (if available).
   */
  getServerInstructions(): string | undefined {
    return this.client?.getInstructions();
  }

  /**
   * Get server version info.
   */
  getServerVersion(): { name: string; version: string } | undefined {
    return this.client?.getServerVersion();
  }
}

/**
 * Create and connect an MCP client.
 *
 * Convenience function for one-liner setup.
 */
export async function createMcpClient(options?: McpClientOptions): Promise<McpClientWrapper> {
  const client = new McpClientWrapper(options);
  await client.connect();
  return client;
}
