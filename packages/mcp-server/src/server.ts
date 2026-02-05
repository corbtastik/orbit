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
import { AtlasClient, dispatch } from "@orbit/core";
import type { ActionMap } from "@orbit/core";
import {
  TOOL_REGISTRY,
  buildToolSchema,
  DATABASE_TOOLS,
} from "./tools/index.js";
import type { DatabaseToolDef } from "./tools/index.js";
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
 * Supports two tool systems:
 *   1. Atlas Admin API tools — routed through dispatch() and ActionMaps
 *   2. Database tools — routed through the MongoDB driver via ConnectionManager
 *
 * The ConnectionManager is optional. If omitted (or no connection is active),
 * database tools return a clear "not connected" error. Connection tools are
 * always available so the LLM can establish a connection at runtime.
 */
export function createServer(
  client: AtlasClient,
  conn?: ConnectionManager,
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
        "OrbitAI MCP Server — provides 100% coverage of the MongoDB Atlas Admin API v2 " +
        "and direct MongoDB database operations. " +
        "Use Atlas tools (manage_*) for infrastructure: clusters, security, backups, monitoring. " +
        "Use database tools (find, aggregate, insert-many, etc.) for querying and managing data. " +
        "Use the connect tool to establish a MongoDB connection before running database operations. " +
        "Use resources for quick read-only snapshots. Use prompts for guided multi-step workflows.",
    },
  );

  const readOnly = options.readOnly ?? false;

  registerTools(server, client, conn, readOnly);
  registerResources(server, client, conn);
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

  // tools/list — return Atlas tools + database tools in a single list
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
    ],
  }));

  // tools/call — route to database tools or Atlas tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // --- Check database tools first ---
    const dbTool = dbToolIndex.get(name);
    if (dbTool) {
      return handleDatabaseTool(dbTool, conn, args, readOnly);
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
 * Handle a database tool call with connection and access checks.
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

  // Non-connection tools require an active connection
  if (tool.operationType !== "connection" && !conn?.isConnected()) {
    return errorResult(
      "Not connected to MongoDB. Use the connect tool first.",
    );
  }

  // ConnectionManager must exist (even for connection tools)
  if (!conn) {
    return errorResult(
      "MongoDB support is not configured. ConnectionManager is not available.",
    );
  }

  try {
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

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

function registerResources(
  server: Server,
  client: AtlasClient,
  conn: ConnectionManager | undefined,
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
