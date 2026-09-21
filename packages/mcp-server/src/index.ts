#!/usr/bin/env node

import { parseArgs } from "node:util";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  AtlasClientManager,
  loadConfig,
  hasAtlasCredentials,
  listAtlasProfiles,
  CONFIG_FILE,
  type ResolvedOrbitConfig,
} from "@orbit/core";
import { ConnectionManager, RdbmsConnectionManager } from "./tools/index.js";
import { createServer } from "./server.js";
import { createHttpServer } from "./transport/index.js";

// Global error handlers - catch unhandled errors before they crash the server
process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled Promise Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("[FATAL] Uncaught Exception:", err);
  process.exit(1);
});

/**
 * Build the map of named MongoDB connections from config.
 *
 * Shared by both transports on purpose: stdio and HTTP previously seeded
 * connections independently, and HTTP simply never did it — leaving
 * list-connections empty for every HTTP client. One source, one behaviour.
 */
function mongoConnectionRegistry(
  config: ResolvedOrbitConfig,
): Record<string, string> {
  const registry: Record<string, string> = { ...config.mongodb.connections };

  // The legacy MONGODB_CONNECTION_STRING is a connection string, not a name;
  // it surfaces as the "default" connection.
  if (config.mongodb.default) {
    registry.default = config.mongodb.default;
  }

  return registry;
}

/**
 * Register MongoDB connections from config.
 */
function registerConnections(
  conn: ConnectionManager,
  config: ResolvedOrbitConfig,
): void {
  for (const [name, connString] of Object.entries(
    mongoConnectionRegistry(config),
  )) {
    conn.registerConnection(name, connString);
  }
}

/** Parse CLI arguments. */
function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      // No `default` here: the value must stay undefined when the flag is
      // absent so `args.http ?? config.server.http` can fall through to the
      // config file. A default of `false` silently overrides the file.
      http: { type: "boolean" },
      stdio: { type: "boolean" },
      port: { type: "string" },
      host: { type: "string" },
      "allowed-hosts": { type: "string" },
      "cors-origin": { type: "string", multiple: true },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  return {
    http: values.http,
    stdio: values.stdio ?? false,
    port: values.port ? parseInt(values.port, 10) : undefined,
    host: values.host,
    allowedHosts: values["allowed-hosts"]
      ? values["allowed-hosts"].split(",").map((h) => h.trim()).filter(Boolean)
      : undefined,
    corsOrigins: values["cors-origin"],
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
  --http                  Run in HTTP mode (StreamableHTTP transport)
  --stdio                 Force stdio mode (overrides config/env HTTP setting)
  --port <port>           HTTP port (default: 3600)
  --host <host>           HTTP host (default: 127.0.0.1)
  --allowed-hosts <list>  Comma-separated Host header allowlist for DNS
                          rebinding protection. Required when binding to a
                          non-loopback address. Default: localhost only.
  --cors-origin <origin>  Allow a browser origin (repeatable, or "*" for any).
                          Omitted means CORS stays off.
  -h, --help              Show this help message

CONFIG FILE
  ${CONFIG_FILE}

  Example (single profile - legacy):
    {
      "atlas": {
        "publicKey": "your-public-key",
        "privateKey": "your-private-key"
      }
    }

  Example (multi-profile - for cross-org operations):
    {
      "atlas": {
        "default": "prod",
        "profiles": {
          "prod": {
            "publicKey": "prod-public-key",
            "privateKey": "prod-private-key",
            "orgId": "prod-org-id"
          },
          "dev": {
            "publicKey": "dev-public-key",
            "privateKey": "dev-private-key",
            "orgId": "dev-org-id"
          }
        }
      },
      "mongodb": {
        "connections": {
          "local": "mongodb://localhost:27017",
          "atlas": "mongodb+srv://..."
        }
      }
    }

ENVIRONMENT (overrides config file)
  ATLAS_PUBLIC_KEY              Default Atlas API public key
  ATLAS_PRIVATE_KEY             Default Atlas API private key
  ATLAS_<PROFILE>_PUBLIC_KEY    Named profile public key (e.g., ATLAS_PROD_PUBLIC_KEY)
  ATLAS_<PROFILE>_PRIVATE_KEY   Named profile private key
  ATLAS_DEFAULT_PROFILE         Default profile name
  ORBIT_MCP_HTTP=true           Enable HTTP mode
  ORBIT_MCP_PORT=<port>         HTTP port (default: 3600)
  ORBIT_MCP_HOST=<host>         HTTP host (default: 127.0.0.1)
  ORBIT_MCP_ALLOWED_HOSTS       Comma-separated Host header allowlist
  ORBIT_MCP_CORS_ORIGINS        Comma-separated CORS origin allowlist
  ORBIT_READ_ONLY=true          Block database write operations
  MONGODB_CONNECTION_STRING     Default MongoDB connection string
  MONGODB_CONN_<NAME>           Named MongoDB connection strings
`);
}

/**
 * Start the server in stdio mode (for Claude Desktop, etc.).
 */
async function runStdioMode(config: ResolvedOrbitConfig): Promise<void> {
  // Create Atlas client manager with all configured profiles
  const atlasManager = new AtlasClientManager(config);

  const conn = new ConnectionManager();
  const rdbmsConn = new RdbmsConnectionManager();

  // Register named connections from config
  registerConnections(conn, config);

  // Auto-connect default connection if configured
  if (config.mongodb.default) {
    await conn.connect(config.mongodb.default);
  }

  const server = createServer(atlasManager, conn, rdbmsConn, { readOnly: config.server.readOnly });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Track if shutdown is in progress to prevent multiple attempts
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    // Set timeout for forced exit
    const shutdownTimeout = setTimeout(() => {
      console.error("[FATAL] Shutdown timeout - forcing exit");
      process.exit(1);
    }, 10000); // 10 second timeout

    try {
      await Promise.all([
        conn.disconnectAll(),
        rdbmsConn.disconnectAll(),
      ]);
      await server.close();
      clearTimeout(shutdownTimeout);
      process.exit(0);
    } catch (err) {
      console.error("[FATAL] Shutdown error:", err);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Start the server in HTTP mode (for CLI and other HTTP clients).
 */
async function runHttpMode(
  config: ResolvedOrbitConfig,
  port: number,
  host: string,
  allowedHosts: string[],
  corsOrigins: string[],
): Promise<void> {
  // Create Atlas client manager with all configured profiles
  const atlasManager = new AtlasClientManager(config);

  const httpServer = createHttpServer({
    port,
    host,
    atlasManager,
    readOnly: config.server.readOnly,
    allowedHosts,
    corsOrigins,
    mongoConnections: mongoConnectionRegistry(config),
  });

  const { port: actualPort, host: actualHost } = await httpServer.listen();

  console.log(`OrbitAI MCP server listening on http://${actualHost}:${actualPort}/mcp`);

  // Track if shutdown is in progress to prevent multiple attempts
  let isShuttingDown = false;

  const shutdown = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log("\nShutting down...");

    // Set timeout for forced exit
    const shutdownTimeout = setTimeout(() => {
      console.error("[FATAL] Shutdown timeout - forcing exit");
      process.exit(1);
    }, 10000); // 10 second timeout

    try {
      await httpServer.shutdown();
      clearTimeout(shutdownTimeout);
      process.exit(0);
    } catch (err) {
      console.error("[FATAL] Shutdown error:", err);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    }
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

1. Config file (${CONFIG_FILE}) - single profile:
   {
     "atlas": {
       "publicKey": "your-public-key",
       "privateKey": "your-private-key"
     }
   }

2. Config file - multiple profiles (for cross-org operations):
   {
     "atlas": {
       "default": "prod",
       "profiles": {
         "prod": { "publicKey": "...", "privateKey": "..." },
         "dev": { "publicKey": "...", "privateKey": "..." }
       }
     }
   }

3. Environment variables (single profile):
   export ATLAS_PUBLIC_KEY="your-public-key"
   export ATLAS_PRIVATE_KEY="your-private-key"

4. Environment variables (named profiles):
   export ATLAS_PROD_PUBLIC_KEY="..."
   export ATLAS_PROD_PRIVATE_KEY="..."
   export ATLAS_DEFAULT_PROFILE="prod"

Get your API keys from: https://cloud.mongodb.com/v2#/org/.../access/apiKeys
`);
    process.exit(1);
  }

  // Log configured profiles
  const profiles = listAtlasProfiles(config);
  if (profiles.length > 0) {
    console.error(`Atlas profiles configured: ${profiles.join(", ")} (default: ${config.atlas.default})`);
  }

  // Determine mode: CLI flags override env, which overrides the config file.
  // --stdio is an explicit opt-out for when the config/env enables HTTP.
  const httpMode = args.stdio ? false : (args.http ?? config.server.http);
  const port = args.port ?? config.server.port;
  const host = args.host ?? config.server.host;
  const allowedHosts = args.allowedHosts ?? config.server.allowedHosts;
  const corsOrigins = args.corsOrigins ?? config.server.corsOrigins;

  if (httpMode) {
    await runHttpMode(config, port, host, allowedHosts, corsOrigins);
  } else {
    await runStdioMode(config);
  }
}

main().catch((err) => {
  process.stderr.write(`orbit-mcp-server fatal: ${err}\n`);
  process.exit(1);
});
