#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AtlasClient } from "@orbit/core";
import { ConnectionManager } from "./tools/index.js";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const client = new AtlasClient();

  // Create the MongoDB connection manager
  const conn = new ConnectionManager();

  // Auto-connect if MONGODB_CONNECTION_STRING is set
  const mongoUri = process.env.MONGODB_CONNECTION_STRING;
  if (mongoUri) {
    await conn.connect(mongoUri);
  }

  // Read-only mode blocks database write operations
  const readOnly = process.env.ORBIT_READ_ONLY === "true";

  const server = createServer(client, conn, { readOnly });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Graceful shutdown — close MongoDB connection and MCP server
  const shutdown = async () => {
    await conn.disconnect();
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
