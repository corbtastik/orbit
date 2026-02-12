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
import {
  AtlasClient,
  RelationalMigratorClient,
  dispatch,
} from "@orbit/core";
import type { ActionMap } from "@orbit/core";
import {
  TOOL_REGISTRY,
  buildToolSchema,
  DATABASE_TOOLS,
  RM_TOOL_REGISTRY,
} from "./tools/index.js";
import type { DatabaseToolDef, RMToolDef } from "./tools/index.js";
import type { ConnectionManager } from "./tools/index.js";
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
 *   3. Relational Migrator tools — routed through RelationalMigratorClient
 *
 * The ConnectionManager is optional. If omitted (or no connection is active),
 * database tools return a clear "not connected" error. Connection tools are
 * always available so the LLM can establish a connection at runtime.
 *
 * The RelationalMigratorClient is optional. If omitted, RM tools are still
 * listed but will return an error when called.
 *
 * Multi-connection support: Tools can specify a `connection` parameter to
 * target a specific named connection. If not specified, uses the default
 * connection for backward compatibility.
 */
export function createServer(
  client: AtlasClient,
  conn?: ConnectionManager,
  rmClient?: RelationalMigratorClient,
  options: ServerOptions = {},
): Server {
  const server = new Server(
    { name: "orbit-mcp-server", version: "1.2.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      instructions:
        "OrbitAI MCP Server — provides 100% coverage of the MongoDB Atlas Admin API v2, " +
        "direct MongoDB database operations, and Relational Migrator integration. " +
        "Use Atlas tools (manage_*) for infrastructure: clusters, security, backups, monitoring. " +
        "Use database tools (find, aggregate, insert-many, etc.) for querying and managing data. " +
        "Use RM tools (manage_rm_*, get_rm_*) for relational-to-MongoDB migrations. " +
        "Use the connect tool to establish a MongoDB connection before running database operations. " +
        "Use list-connections to see available connections. " +
        "Specify a connection parameter on database tools to target a specific named connection. " +
        "Use resources for quick read-only snapshots. Use prompts for guided multi-step workflows.",
    },
  );

  const readOnly = options.readOnly ?? false;

  registerTools(server, client, conn, rmClient, readOnly);
  registerResources(server, client, conn, rmClient);
  registerPrompts(server);

  return server;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function registerTools(
  server: Server,
  client: AtlasClient,
  conn: ConnectionManager | undefined,
  rmClient: RelationalMigratorClient | undefined,
  readOnly: boolean,
): void {
  // --- Atlas Admin API tool index ---
  const toolIndex = new Map<
    string,
    { description: string; actions: ActionMap; inputSchema: ReturnType<typeof buildToolSchema> }
  >();

  for (const def of TOOL_REGISTRY) {
    toolIndex.set(def.name, {
      description: def.description,
      actions: def.actions,
      inputSchema: buildToolSchema(def.actions),
    });
  }

  // --- Database tool index ---
  const dbToolIndex = new Map<string, DatabaseToolDef>();

  for (const def of DATABASE_TOOLS) {
    dbToolIndex.set(def.name, def);
  }

  // --- Relational Migrator tool index ---
  const rmToolIndex = new Map<
    string,
    { description: string; actions: ActionMap; inputSchema: ReturnType<typeof buildToolSchema> }
  >();

  for (const def of RM_TOOL_REGISTRY) {
    rmToolIndex.set(def.name, {
      description: def.description,
      actions: def.actions,
      inputSchema: buildToolSchema(def.actions),
    });
  }

  // tools/list — return Atlas tools + database tools + RM tools in a single list
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
      // Relational Migrator tools
      ...RM_TOOL_REGISTRY.map((def) => {
        const entry = rmToolIndex.get(def.name)!;
        return {
          name: def.name,
          description: def.description,
          inputSchema: entry.inputSchema,
        };
      }),
    ],
  }));

  // tools/call — route to database tools, RM tools, or Atlas tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // --- Check database tools first ---
    const dbTool = dbToolIndex.get(name);
    if (dbTool) {
      return handleDatabaseTool(dbTool, conn, args, readOnly);
    }

    // --- Check Relational Migrator tools ---
    const rmEntry = rmToolIndex.get(name);
    if (rmEntry) {
      return handleRelationalMigratorTool(rmEntry, rmClient, args);
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
 * Handle a Relational Migrator tool call.
 */
async function handleRelationalMigratorTool(
  entry: { actions: ActionMap },
  rmClient: RelationalMigratorClient | undefined,
  args: Record<string, unknown>,
) {
  if (!rmClient) {
    return errorResult(
      "Relational Migrator client is not configured. " +
      "Ensure Relational Migrator is running at http://127.0.0.1:8278.",
    );
  }

  if (!rmClient.enabled) {
    return errorResult(
      "Relational Migrator integration is disabled. " +
      "Set ORBIT_RM_ENABLED=true to enable.",
    );
  }

  const action = args.action as string | undefined;
  if (!action) {
    return errorResult(
      `Missing required parameter "action". Available actions: ${Object.keys(entry.actions).join(", ")}`,
    );
  }

  const spec = entry.actions[action];
  if (!spec) {
    return errorResult(
      `Unknown action "${action}". Available actions: ${Object.keys(entry.actions).join(", ")}`,
    );
  }

  // Guard against body as stringified JSON
  let body = args.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return errorResult("body must be a JSON object, not a string.");
    }
  }

  // Resolve path parameters
  const pathParams = (args.params as Record<string, string>) ?? {};
  let path = spec.path;
  for (const [key, value] of Object.entries(pathParams)) {
    path = path.replace(`{${key}}`, encodeURIComponent(value));
  }

  // Check for unresolved path parameters
  const unresolvedMatch = path.match(/\{(\w+)\}/);
  if (unresolvedMatch) {
    return errorResult(
      `Missing required path parameter: ${unresolvedMatch[1]}`,
    );
  }

  try {
    const query = args.query as Record<string, string | number | boolean | undefined> | undefined;

    let result: unknown;
    switch (spec.method) {
      case "GET":
        result = await rmClient.get(path, query);
        break;
      case "POST":
        result = await rmClient.post(path, spec.hasBody ? body : undefined);
        break;
      case "PUT":
        result = await rmClient.put(path, spec.hasBody ? body : undefined);
        break;
      case "DELETE":
        result = await rmClient.delete(path);
        break;
      default:
        return errorResult(`Unsupported HTTP method: ${spec.method}`);
    }

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
    // Pass connection name through to tool via _connectionName
    const toolArgs = connectionName
      ? { ...args, _connectionName: connectionName }
      : args;

    const result = await tool.execute(conn, toolArgs);
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

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

function registerResources(
  server: Server,
  client: AtlasClient,
  conn: ConnectionManager | undefined,
  rmClient: RelationalMigratorClient | undefined,
): void {
  const staticResources = RESOURCE_REGISTRY.filter((r) => !r.isTemplate);
  const templateResources = RESOURCE_REGISTRY.filter((r) => r.isTemplate);

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

      // Try static match first
      for (const res of staticResources) {
        if (res.uri === uri) {
          const data = await res.read(client, conn, rmClient, {});
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
          const data = await res.read(client, conn, rmClient, vars);
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
