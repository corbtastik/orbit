import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { AtlasClientManager, dispatch } from "@orbit/core";
import type { ActionMap } from "@orbit/core";
import {
  TOOL_REGISTRY,
  buildToolSchema,
  DATABASE_TOOLS,
  RDBMS_TOOLS,
} from "./tools/index.js";
import type { DatabaseToolDef, RdbmsToolDef } from "./tools/index.js";
import type { ConnectionManager, RdbmsConnectionManager } from "./tools/index.js";
import {
  RESOURCE_REGISTRY,
  extractVariables,
} from "./resources.js";
import { PROMPT_REGISTRY } from "./prompts.js";

/**
 * Options for configuring server behavior.
 */
export interface ServerOptions {
  /** Block database write tools when true. Atlas tools are unaffected. */
  readOnly?: boolean;
}

/**
 * Create and configure the OrbitAI MCP server.
 *
 * Supports three tool systems:
 *   1. Atlas Admin API tools — routed through dispatch() and ActionMaps
 *   2. Database tools — routed through the MongoDB driver via ConnectionManager
 *   3. RDBMS tools — routed through RdbmsConnectionManager for migration workflows
 *
 * The ConnectionManager and RdbmsConnectionManager are optional. If omitted
 * (or no connection is active), tools return a clear "not connected" error.
 * Connection tools are always available so the LLM can establish connections at runtime.
 *
 * Multi-connection support: Tools can specify a `connection` parameter to
 * target a specific named connection. If not specified, uses the default
 * connection for backward compatibility.
 */
export function createServer(
  atlasManager: AtlasClientManager,
  conn?: ConnectionManager,
  rdbmsConn?: RdbmsConnectionManager,
  options: ServerOptions = {},
): Server {
  const server = new Server(
    { name: "orbit-mcp-server", version: "1.1.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      instructions:
        "OrbitAI MCP Server — provides 100% coverage of the MongoDB Atlas Admin API v2, " +
        "direct MongoDB database operations, and RDBMS-to-MongoDB migration tools. " +
        "Use Atlas tools (manage_*) for infrastructure: clusters, security, backups, monitoring. " +
        "Atlas tools support an optional 'atlasProfile' parameter for cross-org operations. " +
        "Use database tools (find, aggregate, insert-many, etc.) for querying and managing data. " +
        "Use RDBMS tools (connect-rdbms, introspect-schema, etc.) for migrating from PostgreSQL, SQL Server, or SQLite. " +
        "Use the connect tool to establish a MongoDB connection before running database operations. " +
        "Use connect-rdbms to establish source database connections for migration workflows. " +
        "Use list-connections to see available MongoDB connections. Use list-rdbms to see RDBMS connections. " +
        "Use resources for quick read-only snapshots. Use prompts for guided multi-step workflows.",
    },
  );

  const readOnly = options.readOnly ?? false;

  registerTools(server, atlasManager, conn, rdbmsConn, readOnly);
  registerResources(server, atlasManager, conn);
  registerPrompts(server);

  return server;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function registerTools(
  server: Server,
  atlasManager: AtlasClientManager,
  conn: ConnectionManager | undefined,
  rdbmsConn: RdbmsConnectionManager | undefined,
  readOnly: boolean,
): void {
  // --- Atlas Admin API tool index ---
  // Build input schemas with optional atlasProfile parameter for all Atlas tools
  const toolIndex = new Map<
    string,
    { description: string; actions: ActionMap; inputSchema: ReturnType<typeof buildToolSchema> }
  >();

  for (const def of TOOL_REGISTRY) {
    const baseSchema = buildToolSchema(def.actions);
    // Add atlasProfile parameter to all Atlas tools
    const schemaWithProfile = {
      ...baseSchema,
      properties: {
        ...baseSchema.properties,
        atlasProfile: {
          type: "string",
          description: `Atlas profile to use for this operation. Available: ${atlasManager.listProfiles().join(", ") || "(none)"}. Default: ${atlasManager.getDefaultProfileName()}`,
        },
      },
    };
    toolIndex.set(def.name, {
      description: def.description,
      actions: def.actions,
      inputSchema: schemaWithProfile,
    });
  }

  // --- Database tool index ---
  const dbToolIndex = new Map<string, DatabaseToolDef>();

  for (const def of DATABASE_TOOLS) {
    dbToolIndex.set(def.name, def);
  }

  // --- RDBMS tool index ---
  const rdbmsToolIndex = new Map<string, RdbmsToolDef>();

  for (const def of RDBMS_TOOLS) {
    rdbmsToolIndex.set(def.name, def);
  }

  // tools/list — return Atlas tools + database tools + RDBMS tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // Atlas Admin API tools
      ...TOOL_REGISTRY.map((def) => {
        const entry = toolIndex.get(def.name)!;
        return {
          name: def.name,
          description: def.description,
          inputSchema: entry.inputSchema,
        };
      }),
      // Database tools
      ...DATABASE_TOOLS.map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
      })),
      // RDBMS migration tools
      ...RDBMS_TOOLS.map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
      })),
    ],
  }));

  // tools/call — route to database tools, RDBMS tools, or Atlas tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // --- Check database tools first ---
    const dbTool = dbToolIndex.get(name);
    if (dbTool) {
      return handleDatabaseTool(dbTool, conn, args, readOnly);
    }

    // --- Check RDBMS tools ---
    const rdbmsTool = rdbmsToolIndex.get(name);
    if (rdbmsTool) {
      return handleRdbmsTool(rdbmsTool, rdbmsConn, conn, args, readOnly);
    }

    // --- Fall through to Atlas Admin API tools ---
    const entry = toolIndex.get(name);
    if (!entry) {
      return errorResult(`Unknown tool: ${name}`);
    }

    const action = args.action as string | undefined;
    if (!action) {
      return errorResult(
        `Missing required parameter "action". Available actions: ${Object.keys(entry.actions).join(", ")}`,
      );
    }

    // Guard against the LLM sending body as a pre-stringified JSON string.
    // If that happens, parse it back to an object to avoid double-encoding.
    let body = args.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return errorResult(
          "body must be a JSON object, not a string.",
        );
      }
    }

    // Get the Atlas client for the specified profile (or default)
    const atlasProfile = args.atlasProfile as string | undefined;
    let client;
    try {
      client = atlasManager.getClient(atlasProfile);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }

    try {
      const result = await dispatch(client, entry.actions, {
        action,
        pathParams: (args.params as Record<string, string>) ?? {},
        query: (args.query as Record<string, string>) ?? {},
        body,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : String(err);
      return errorResult(message);
    }
  });
}

/**
 * Handle a database tool call with connection and access checks.
 *
 * Supports multi-connection by checking for a `connection` parameter:
 * - If specified, validates it exists and auto-connects if registered
 * - If not specified, uses backward-compat default connection behavior
 */
async function handleDatabaseTool(
  tool: DatabaseToolDef,
  conn: ConnectionManager | undefined,
  args: Record<string, unknown>,
  readOnly: boolean,
) {
  // Write operations are blocked in read-only mode
  if (tool.operationType === "write" && readOnly) {
    return errorResult(
      "Write operations are disabled in read-only mode.",
    );
  }

  // ConnectionManager must exist (even for connection tools)
  if (!conn) {
    return errorResult(
      "MongoDB support is not configured. ConnectionManager is not available.",
    );
  }

  // Extract connection name from args (used by multi-connection support)
  const connectionName = args.connection as string | undefined;

  // Non-connection tools require an active connection
  if (tool.operationType !== "connection") {
    if (connectionName) {
      // Named connection requested — validate it exists
      if (!conn.hasConnection(connectionName)) {
        return errorResult(
          `Connection "${connectionName}" not found. Use list-connections to see available connections.`,
        );
      }
      // Auto-connect on first use if registered but not connected
      if (!conn.isConnectedNamed(connectionName)) {
        try {
          await conn.connectNamed(connectionName);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return errorResult(`Failed to connect "${connectionName}": ${message}`);
        }
      }
    } else {
      // No connection specified — require default connection (backward compat)
      if (!conn.isConnected()) {
        return errorResult(
          "Not connected to MongoDB. Use the connect tool first, or specify a connection parameter.",
        );
      }
    }
  }

  try {
    // Connection name is already in args.connection, no need to rename
    const result = await tool.execute(conn, args);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

/**
 * Handle an RDBMS tool call with connection and access checks.
 *
 * RDBMS tools receive both the RDBMS connection manager (source databases)
 * and MongoDB connection manager (target database for migrations).
 */
async function handleRdbmsTool(
  tool: RdbmsToolDef,
  rdbmsConn: RdbmsConnectionManager | undefined,
  mongoConn: ConnectionManager | undefined,
  args: Record<string, unknown>,
  readOnly: boolean,
) {
  // Write operations are blocked in read-only mode
  if (tool.operationType === "write" && readOnly) {
    return errorResult(
      "Write operations are disabled in read-only mode.",
    );
  }

  // RdbmsConnectionManager must exist (even for connection tools)
  if (!rdbmsConn) {
    return errorResult(
      "RDBMS support is not configured. RdbmsConnectionManager is not available.",
    );
  }

  // MongoDB connection manager is required for migration operations
  // but not for connection/read operations
  if (!mongoConn && tool.operationType === "write") {
    return errorResult(
      "MongoDB connection is required for migration operations. " +
      "Configure a MongoDB connection first.",
    );
  }

  // Extract RDBMS connection name from args
  const connectionName = args.connection as string | undefined;

  // Non-connection tools require an active RDBMS connection
  if (tool.operationType !== "connection") {
    if (connectionName) {
      // Named connection requested — validate it exists and is connected
      if (!rdbmsConn.hasConnection(connectionName)) {
        return errorResult(
          `RDBMS connection "${connectionName}" not found. Use list-rdbms to see available connections.`,
        );
      }
      if (!rdbmsConn.isConnected(connectionName)) {
        return errorResult(
          `RDBMS connection "${connectionName}" is not connected. Use connect-rdbms first.`,
        );
      }
    } else {
      // No connection specified — require default connection
      const defaultName = rdbmsConn.getDefaultName();
      if (!defaultName || !rdbmsConn.isConnected(defaultName)) {
        return errorResult(
          "Not connected to any RDBMS. Use connect-rdbms first, or specify a connection parameter.",
        );
      }
    }
  }

  try {
    // Provide a stub ConnectionManager if not available (for non-write operations)
    const mongoConnForTool = mongoConn ?? createStubConnectionManager();

    const result = await tool.execute(rdbmsConn, mongoConnForTool, args);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

/**
 * Create a stub ConnectionManager for RDBMS tools that don't need MongoDB.
 * This avoids null checks in tools that only do schema introspection.
 */
function createStubConnectionManager(): ConnectionManager {
  // Import dynamically to avoid circular dependency issues
  const { ConnectionManager } = require("./tools/index.js");
  return new ConnectionManager();
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

function registerResources(
  server: Server,
  atlasManager: AtlasClientManager,
  conn: ConnectionManager | undefined,
): void {
  const staticResources = RESOURCE_REGISTRY.filter((r) => !r.isTemplate);
  const templateResources = RESOURCE_REGISTRY.filter((r) => r.isTemplate);

  // Use default Atlas client for resources (resources don't support profile selection yet)
  const getDefaultClient = () => {
    try {
      return atlasManager.getClient();
    } catch {
      // Return undefined if no profiles configured - resources will handle this
      return undefined;
    }
  };

  // resources/list — return static (non-template) resources
  server.setRequestHandler(
    ListResourcesRequestSchema,
    async () => ({
      resources: staticResources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    }),
  );

  // resources/templates/list — return template resources
  server.setRequestHandler(
    ListResourceTemplatesRequestSchema,
    async () => ({
      resourceTemplates: templateResources.map((r) => ({
        uriTemplate: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      })),
    }),
  );

  // resources/read — resolve URI against all resources
  server.setRequestHandler(
    ReadResourceRequestSchema,
    async (request) => {
      const { uri } = request.params;
      const client = getDefaultClient();

      // Try static match first
      for (const res of staticResources) {
        if (res.uri === uri) {
          const data = await res.read(client, conn, {});
          return {
            contents: [
              {
                uri,
                mimeType: res.mimeType,
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      }

      // Try template match
      for (const res of templateResources) {
        const vars = extractVariables(res.uri, uri);
        if (vars) {
          const data = await res.read(client, conn, vars);
          return {
            contents: [
              {
                uri,
                mimeType: res.mimeType,
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }
      }

      throw new Error(`Resource not found: ${uri}`);
    },
  );
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

function registerPrompts(server: Server): void {
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: PROMPT_REGISTRY.map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments.map((a) => ({
        name: a.name,
        description: a.description,
        required: a.required,
      })),
    })),
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<
      string,
      string
    >;

    const prompt = PROMPT_REGISTRY.find((p) => p.name === name);
    if (!prompt) {
      throw new Error(
        `Unknown prompt: ${name}. Available: ${PROMPT_REGISTRY.map((p) => p.name).join(", ")}`,
      );
    }

    // Validate required arguments
    for (const argDef of prompt.arguments) {
      if (argDef.required && !args[argDef.name]) {
        throw new Error(
          `Missing required argument "${argDef.name}" for prompt "${name}"`,
        );
      }
    }

    const messages = prompt.build(args);
    return {
      description: prompt.description,
      messages,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorResult(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
