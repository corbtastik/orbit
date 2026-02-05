#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AtlasClient } from "@orbit/core";
import { ConnectionManager } from "./tools/index.js";
import { createServer } from "./server.js";

/** Prefix for named MongoDB connection env vars. */
const MONGODB_CONN_PREFIX = "MONGODB_CONN_";

/**
 * Scan environment for MONGODB_CONN_* variables and register them
 * as named connections (lazy connect on first use).
 *
 * Example env vars:
 *   MONGODB_CONN_LOCAL="mongodb://localhost:27017"
 *   MONGODB_CONN_ATLAS="mongodb+srv://user:pass@cluster.mongodb.net"
 *
 * These become connections named "local" and "atlas" (lowercase).
 */
function registerEnvConnections(conn: ConnectionManager): void {
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(MONGODB_CONN_PREFIX) && value) {
      // Extract name from env var: MONGODB_CONN_LOCAL → "local"
      const name = key.slice(MONGODB_CONN_PREFIX.length).toLowerCase();
      if (name) {
        conn.registerConnection(name, value);
      }
    }
  }
}

async function main(): Promise<void> {
  const client = new AtlasClient();

  // Create the MongoDB connection manager
  const conn = new ConnectionManager();

  // Register MONGODB_CONN_* env vars as named connections (lazy connect)
  registerEnvConnections(conn);

  // Auto-connect the default connection if MONGODB_CONNECTION_STRING is set
  // (backward compat with existing deployments)
  const mongoUri = process.env.MONGODB_CONNECTION_STRING;
  if (mongoUri) {
    await conn.connect(mongoUri);
  }

  // Read-only mode blocks database write operations
  const readOnly = process.env.ORBIT_READ_ONLY === "true";

  const server = createServer(client, conn, { readOnly });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Graceful shutdown — close all MongoDB connections and MCP server
  const shutdown = async () => {
    await conn.disconnectAll();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  process.stderr.write(`orbit-mcp-server fatal: ${err}\n`);
  process.exit(1);
});
