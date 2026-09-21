/**
 * MCP Transport Selection Module.
 *
 * Provides transport creation with HTTP primary / stdio fallback strategy.
 */

import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from "@modelcontextprotocol/sdk/client/stdio.js";

/** Transport type identifier. */
export type TransportType = "http" | "stdio";

/** Result of transport creation. */
export interface TransportResult {
  transport: Transport;
  type: TransportType;
}

/** Options for transport creation. */
export interface TransportOptions {
  /** MCP server HTTP URL. Default: http://127.0.0.1:3600/mcp */
  httpUrl?: string;
  /** HTTP connection timeout in ms. Default: 2000 */
  httpTimeout?: number;
  /** Force stdio transport (skip HTTP attempt). */
  forceStdio?: boolean;
  /** Command to spawn for stdio transport. Default: orbit-mcp-server */
  stdioCommand?: string;
  /** Arguments for stdio command. */
  stdioArgs?: string[];
  /** Working directory for stdio command. */
  stdioCwd?: string;
}

/**
 * Default configuration values.
 */
const DEFAULTS = {
  httpUrl: "http://127.0.0.1:3600/mcp",
  httpTimeout: 2000,
  stdioCommand: "orbit-mcp-server",
};

/**
 * Environment variable prefixes the spawned MCP server needs.
 *
 * The MCP SDK's StdioClientTransport defaults to a minimal allowlist
 * (HOME, LOGNAME, PATH, SHELL, TERM, USER) when no `env` is given, so none of
 * our configuration reaches the child and it silently falls back to
 * ~/.orbit-ai/config.json. We forward by prefix rather than handing over all
 * of process.env — notably, LLM API keys stay in the CLI, which is the only
 * process that talks to a provider.
 */
const FORWARDED_ENV_PREFIXES = ["ATLAS_", "MONGODB_", "ORBIT_"];

/** Env vars that match a forwarded prefix but must not be passed through. */
const FORWARDED_ENV_DENYLIST = new Set(["ORBIT_LLM_API_KEY"]);

/**
 * Build the environment for the spawned MCP server: the SDK's safe defaults
 * plus our own configuration vars.
 */
function buildStdioEnv(): Record<string, string> {
  const env = getDefaultEnvironment();

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) continue;
    if (FORWARDED_ENV_DENYLIST.has(key)) continue;
    if (FORWARDED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      env[key] = value;
    }
  }

  return env;
}

/**
 * Check if HTTP server is reachable.
 */
async function isHttpServerAvailable(url: string, timeout: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    // Use a simple OPTIONS or HEAD request to check availability
    // POST with empty body to check MCP endpoint specifically
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", method: "ping", id: 0 }),
      signal: controller.signal,
    });

    // Any response means server is running (even 4xx/5xx)
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Create an HTTP transport.
 */
function createHttpTransport(url: string): TransportResult {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  return { transport, type: "http" };
}

/**
 * Create a stdio transport by spawning the MCP server process.
 */
function createStdioTransport(options: TransportOptions): TransportResult {
  const command = options.stdioCommand ?? DEFAULTS.stdioCommand;
  const args = options.stdioArgs ?? [];
  const cwd = options.stdioCwd;

  const transport = new StdioClientTransport({
    command,
    args,
    cwd,
    env: buildStdioEnv(),
    stderr: "inherit", // Pass stderr through to parent
  });

  return { transport, type: "stdio" };
}

/**
 * Create an MCP transport.
 *
 * Strategy:
 * 1. If forceStdio is true, use stdio transport directly
 * 2. Try HTTP transport first (check if server is running)
 * 3. Fall back to stdio transport if HTTP unavailable
 *
 * Environment variables:
 * - ORBIT_MCP_URL: HTTP endpoint URL (default: http://127.0.0.1:3600/mcp)
 * - ORBIT_MCP_STDIO: If "true", force stdio transport
 * - ORBIT_MCP_HTTP_TIMEOUT: HTTP timeout in ms (default: 2000)
 */
export async function createTransport(options: TransportOptions = {}): Promise<TransportResult> {
  // Check environment variables
  const forceStdio = options.forceStdio ?? (process.env.ORBIT_MCP_STDIO === "true");
  const httpUrl = options.httpUrl ?? process.env.ORBIT_MCP_URL ?? DEFAULTS.httpUrl;
  const httpTimeout = options.httpTimeout ??
    (process.env.ORBIT_MCP_HTTP_TIMEOUT ? parseInt(process.env.ORBIT_MCP_HTTP_TIMEOUT, 10) : DEFAULTS.httpTimeout);

  // Force stdio if requested
  if (forceStdio) {
    return createStdioTransport(options);
  }

  // Try HTTP first
  const httpAvailable = await isHttpServerAvailable(httpUrl, httpTimeout);

  if (httpAvailable) {
    return createHttpTransport(httpUrl);
  }

  // Fall back to stdio
  return createStdioTransport(options);
}
