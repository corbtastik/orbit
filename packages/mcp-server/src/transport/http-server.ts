/**
 * HTTP Server Transport for OrbitAI MCP Server.
 *
 * Uses Express with StreamableHTTPServerTransport for stateful HTTP sessions.
 * Each session gets isolated MongoDB connections via SessionManager.
 */

import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { AtlasClient, RelationalMigratorClient } from "@orbit/core";
import { SessionManager } from "./session-manager.js";
import { createServer as createMcpServer } from "../server.js";

/** Options for creating an HTTP server. */
export interface HttpServerOptions {
  /** Port to listen on. Default: 3600 */
  port?: number;
  /** Host to bind to. Default: "127.0.0.1" (localhost only) */
  host?: string;
  /** Atlas client for Atlas Admin API tools. */
  atlasClient: AtlasClient;
  /** Relational Migrator client (optional). */
  rmClient?: RelationalMigratorClient;
  /** Block database write operations when true. */
  readOnly?: boolean;
}

/** Result from createHttpServer. */
export interface HttpServerResult {
  /** Express application instance. */
  app: Express;
  /** Session manager for per-session isolation. */
  sessionManager: SessionManager;
  /** Start listening on the configured port. */
  listen: () => Promise<{ port: number; host: string }>;
  /** Graceful shutdown - closes all connections and sessions. */
  shutdown: () => Promise<void>;
}

/**
 * Create an HTTP server for the MCP protocol.
 *
 * Features:
 * - Stateful sessions with per-session MongoDB connection isolation
 * - DNS rebinding protection via createMcpExpressApp
 * - POST /mcp endpoint for all MCP messages
 * - DELETE /mcp/:sessionId for session cleanup
 */
export function createHttpServer(options: HttpServerOptions): HttpServerResult {
  const {
    port = 3600,
    host = "127.0.0.1",
    atlasClient,
    rmClient,
    readOnly = false,
  } = options;

  // Session manager for per-session ConnectionManager isolation
  const sessionManager = new SessionManager();

  // Per-session transports and servers
  const transports = new Map<string, StreamableHTTPServerTransport>();
  const servers = new Map<string, Server>();

  // Create Express app with DNS rebinding protection
  const app = createMcpExpressApp({ host });

  // Handle all MCP messages via POST /mcp
  app.post("/mcp", async (req, res) => {
    // Check for existing session ID in header
    const existingSessionId = req.headers["mcp-session-id"] as string | undefined;

    if (existingSessionId && transports.has(existingSessionId)) {
      // Existing session - reuse transport
      const transport = transports.get(existingSessionId)!;
      const session = sessionManager.getOrCreate(existingSessionId);

      // Update activity timestamp
      session.lastActivity = new Date();

      await transport.handleRequest(req, res, req.body);
      return;
    }

    // New session - create transport and server
    const sessionId = existingSessionId ?? randomUUID();
    const session = sessionManager.getOrCreate(sessionId);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => sessionId,
    });

    const server = createMcpServer(atlasClient, session.connectionManager, rmClient, { readOnly });

    // Store for reuse
    transports.set(sessionId, transport);
    servers.set(sessionId, server);

    // Clean up on transport close
    transport.onclose = async () => {
      transports.delete(sessionId);
      servers.delete(sessionId);
      await sessionManager.destroy(sessionId);
    };

    // Connect server to transport
    await server.connect(transport);

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  // Handle session cleanup via DELETE /mcp/:sessionId
  app.delete("/mcp/:sessionId", async (req, res) => {
    const { sessionId } = req.params;

    const transport = transports.get(sessionId);
    const server = servers.get(sessionId);

    if (transport) {
      await transport.close();
    }
    if (server) {
      await server.close();
    }

    transports.delete(sessionId);
    servers.delete(sessionId);
    await sessionManager.destroy(sessionId);

    res.status(204).end();
  });

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      sessions: sessionManager.size,
      timestamp: new Date().toISOString(),
    });
  });

  let httpServer: ReturnType<Express["listen"]> | null = null;

  return {
    app,
    sessionManager,

    listen: () => {
      return new Promise((resolve, reject) => {
        try {
          httpServer = app.listen(port, host, () => {
            resolve({ port, host });
          });

          httpServer.on("error", reject);
        } catch (err) {
          reject(err);
        }
      });
    },

    shutdown: async () => {
      // Close all transports
      for (const transport of transports.values()) {
        await transport.close().catch(() => {});
      }

      // Close all servers
      for (const server of servers.values()) {
        await server.close().catch(() => {});
      }

      transports.clear();
      servers.clear();

      // Destroy all sessions (closes MongoDB connections)
      await sessionManager.destroyAll();

      // Close HTTP server
      if (httpServer) {
        await new Promise<void>((resolve) => {
          httpServer!.close(() => resolve());
        });
      }
    },
  };
}
