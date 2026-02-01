#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { AtlasClient } from "@orbit/core";
import { createServer } from "./server.js";

async function main(): Promise<void> {
  const client = new AtlasClient();
  const server = createServer(client);
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await server.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  process.stderr.write(`orbit-mcp-server fatal: ${err}\n`);
  process.exit(1);
});
