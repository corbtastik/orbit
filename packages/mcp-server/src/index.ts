#!/usr/bin/env node

import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  AtlasClient,
  RelationalMigratorClient,
  loadConfig,
  hasAtlasCredentials,
  CONFIG_FILE,
  type ResolvedOrbitConfig,
} from "@orbit/core";
import { ConnectionManager } from "./tools/index.js";
import { createServer } from "./server.js";
import { createHttpServer } from "./transport/index.js";

/**
 * Register MongoDB connections from config.
 */
function registerConnections(
  conn: ConnectionManager,
  config: ResolvedOrbitConfig,
): void {
  // Register named connections from config file and env vars
  for (const [name, connString] of Object.entries(config.mongodb.connections)) {
    conn.registerConnection(name, connString);
  }
}

/** Parse CLI arguments. */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      http: { type: "boolean", default: false },
      port: { type: "string" },
      host: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  return {
    http: values.http,
    port: values.port ? parseInt(values.port, 10) : undefined,
    host: values.host,
    help: values.help ?? false,
  };
}

/** Print help text. */
function printHelp(): void {
  console.log(`
orbit-mcp-server — OrbitAI MCP Server

USAGE
  orbit-mcp-server              Start in stdio mode (default)
  orbit-mcp-server --http       Start in HTTP mode

OPTIONS
  --http              Run in HTTP mode (StreamableHTTP transport)
  --port <port>       HTTP port (default: 3600)
  --host <host>       HTTP host (default: 127.0.0.1)
  -h, --help          Show this help message

CONFIG FILE
  ${CONFIG_FILE}

  Example:
    {
      "atlas": {
        "publicKey": "your-public-key",
        "privateKey": "your-private-key"
      },
      "mongodb": {
        "default": "mongodb://localhost:27017",
        "connections": {
          "local": "mongodb://localhost:27017"
        }
      },
      "server": {
        "http": false,
        "port": 3600,
        "readOnly": false
      }
    }

ENVIRONMENT (overrides config file)
  ATLAS_PUBLIC_KEY              Atlas API public key
  ATLAS_PRIVATE_KEY             Atlas API private key
  ORBIT_MCP_HTTP=true           Enable HTTP mode
  ORBIT_MCP_PORT=<port>         HTTP port (default: 3600)
  ORBIT_MCP_HOST=<host>         HTTP host (default: 127.0.0.1)
  ORBIT_READ_ONLY=true          Block database write operations
  MONGODB_CONNECTION_STRING     Default MongoDB connection string
  MONGODB_CONN_<NAME>           Named MongoDB connection strings
`);
}

/**
 * Start the server in stdio mode (for Claude Desktop, etc.).
 */
async function runStdioMode(config: ResolvedOrbitConfig): Promise<void> {
  // Create Atlas client with credentials from config
  const client = new AtlasClient({
    publicKey: config.atlas.publicKey,
    privateKey: config.atlas.privateKey,
    orgId: config.atlas.orgId,
    groupId: config.atlas.groupId,
    baseUrl: config.atlas.baseUrl,
  });

  const conn = new ConnectionManager();

  // Register named connections from config
  registerConnections(conn, config);

  // Auto-connect default connection if configured
  if (config.mongodb.default) {
    await conn.connect(config.mongodb.default);
  }

  // Create Relational Migrator client if enabled
  const rmClient = new RelationalMigratorClient({
    baseUrl: config.relationalMigrator.url,
    timeoutMs: config.relationalMigrator.timeout,
    enabled: config.relationalMigrator.enabled,
  });

  const server = createServer(client, conn, rmClient, { readOnly: config.server.readOnly });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  const shutdown = async () => {
    await conn.disconnectAll();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Start the server in HTTP mode (for CLI and other HTTP clients).
 */
async function runHttpMode(config: ResolvedOrbitConfig, port: number, host: string): Promise<void> {
  // Create Atlas client with credentials from config
  const client = new AtlasClient({
    publicKey: config.atlas.publicKey,
    privateKey: config.atlas.privateKey,
    orgId: config.atlas.orgId,
    groupId: config.atlas.groupId,
    baseUrl: config.atlas.baseUrl,
  });

  // Create Relational Migrator client if enabled
  const rmClient = new RelationalMigratorClient({
    baseUrl: config.relationalMigrator.url,
    timeoutMs: config.relationalMigrator.timeout,
    enabled: config.relationalMigrator.enabled,
  });

  const httpServer = createHttpServer({
    port,
    host,
    atlasClient: client,
    rmClient,
    readOnly: config.server.readOnly,
  });

  const { port: actualPort, host: actualHost } = await httpServer.listen();

  console.log(`OrbitAI MCP server listening on http://${actualHost}:${actualPort}/mcp`);

  const shutdown = async () => {
    console.log("\nShutting down...");
    await httpServer.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function main(): Promise<void> {
  const args = parseCliArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  // Load unified configuration
  const config = loadConfig();

  // Validate Atlas credentials
  if (!hasAtlasCredentials(config)) {
    console.error(`
Error: Atlas API credentials are required.

Configure credentials in one of these ways:

1. Config file (${CONFIG_FILE}):
   {
     "atlas": {
       "publicKey": "your-public-key",
       "privateKey": "your-private-key"
     }
   }

2. Environment variables:
   export ATLAS_PUBLIC_KEY="your-public-key"
   export ATLAS_PRIVATE_KEY="your-private-key"

Get your API keys from: https://cloud.mongodb.com/v2#/org/.../access/apiKeys
`);
    process.exit(1);
  }

  // Determine mode: CLI flag overrides config file
  const httpMode = args.http ?? config.server.http;
  const port = args.port ?? config.server.port;
  const host = args.host ?? config.server.host;

  if (httpMode) {
    await runHttpMode(config, port, host);
  } else {
    await runStdioMode(config);
  }
}

main().catch((err) => {
  process.stderr.write(`orbit-mcp-server fatal: ${err}\n`);
  process.exit(1);
});
