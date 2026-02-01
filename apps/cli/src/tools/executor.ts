import { dispatch } from "@orbit/core";
import type { AtlasClient, ActionMap } from "@orbit/core";
import { TOOL_REGISTRY } from "./registry.js";

/** Index tools by name for O(1) lookup. */
const toolIndex = new Map<string, { actions: ActionMap }>();
for (const def of TOOL_REGISTRY) {
  toolIndex.set(def.name, { actions: def.actions });
}

export interface ToolResult {
  success: boolean;
  content: string;
}

/**
 * Execute a tool call from the LLM.
 * Looks up the tool, extracts action/params/query/body, dispatches through @orbit/core.
 */
export async function executeTool(
  client: AtlasClient,
  toolName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const entry = toolIndex.get(toolName);
  if (!entry) {
    return {
      success: false,
      content: `Unknown tool: ${toolName}. Available tools: ${[...toolIndex.keys()].join(", ")}`,
    };
  }

  const action = args.action as string | undefined;
  if (!action) {
    return {
      success: false,
      content: `Missing required parameter "action". Available actions: ${Object.keys(entry.actions).join(", ")}`,
    };
  }

  try {
    const result = await dispatch(client, entry.actions, {
      action,
      pathParams: (args.params as Record<string, string>) ?? {},
      query: (args.query as Record<string, string>) ?? {},
      body: args.body,
    });

    return {
      success: true,
      content: JSON.stringify(result, null, 2),
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, content: message };
  }
}
