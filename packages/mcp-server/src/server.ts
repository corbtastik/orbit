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
import { TOOL_REGISTRY, buildToolSchema } from "./tools/index.js";
import {
  RESOURCE_REGISTRY,
  extractVariables,
} from "./resources.js";
import { PROMPT_REGISTRY } from "./prompts.js";

/**
 * Create and configure the OrbitAI MCP server.
 *
 * Uses the low-level Server class so we can register tools with
 * dynamically-generated JSON Schema (no Zod dependency required).
 */
export function createServer(client: AtlasClient): Server {
  const server = new Server(
    { name: "orbit-mcp-server", version: "1.0.0" },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
      instructions:
        "OrbitAI MCP Server — provides 100% coverage of the MongoDB Atlas Admin API v2. " +
        "Use tools to manage clusters, projects, security, backups, monitoring, and more. " +
        "Use resources for quick read-only snapshots. Use prompts for guided multi-step workflows.",
    },
  );

  registerTools(server, client);
  registerResources(server, client);
  registerPrompts(server);

  return server;
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

function registerTools(server: Server, client: AtlasClient): void {
  // Pre-build schemas and index by name for fast lookup
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

  // tools/list — return all 41 tools with their JSON Schema
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_REGISTRY.map((def) => {
      const entry = toolIndex.get(def.name)!;
      return {
        name: def.name,
        description: def.description,
        inputSchema: entry.inputSchema,
      };
    }),
  }));

  // tools/call — dispatch the requested action through @orbit/core
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

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

    try {
      const result = await dispatch(client, entry.actions, {
        action,
        pathParams: (args.params as Record<string, string>) ?? {},
        query: (args.query as Record<string, string>) ?? {},
        body: args.body,
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

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

function registerResources(
  server: Server,
  client: AtlasClient,
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
          const data = await res.read(client, {});
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
          const data = await res.read(client, vars);
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
