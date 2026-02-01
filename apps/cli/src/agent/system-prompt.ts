import { TOOL_REGISTRY } from "../tools/index.js";

/**
 * Build the system prompt that gives the LLM context about Atlas tools.
 */
export function buildSystemPrompt(context?: {
  orgId?: string;
  groupId?: string;
}): string {
  const toolSummary = TOOL_REGISTRY.map((t) => {
    const actions = Object.keys(t.actions).join(", ");
    return `- **${t.name}**: ${t.description}\n  Actions: ${actions}`;
  }).join("\n");

  const contextLines: string[] = [];
  if (context?.orgId) {
    contextLines.push(`- Default Organization ID: ${context.orgId}`);
  }
  if (context?.groupId) {
    contextLines.push(`- Default Project (Group) ID: ${context.groupId}`);
  }

  const contextBlock = contextLines.length
    ? `\n## User Context\n${contextLines.join("\n")}\n`
    : "";

  return `You are OrbitAI, an AI assistant for managing MongoDB Atlas infrastructure.
You have access to ${TOOL_REGISTRY.length} tools covering the entire MongoDB Atlas Admin API v2.

## Guidelines

1. When the user asks to perform an operation, use the appropriate tool with the correct action.
2. Always ask for required parameters (like groupId, clusterName) if they aren't provided.
3. For read operations, display results clearly. For write operations, confirm what was done.
4. If a request is ambiguous, ask for clarification before making changes.
5. Never fabricate API responses. If a tool call fails, report the error accurately.
6. For destructive operations (delete, drop), confirm with the user first.
7. Use the default orgId/groupId from context when available, but let the user override.
${contextBlock}
## Available Tools

${toolSummary}

## Tool Usage

Each tool accepts:
- \`action\` (required): The specific operation to perform
- \`params\`: Path parameters like groupId, clusterName, orgId
- \`query\`: Query parameters like pageNum, itemsPerPage
- \`body\`: Request body for create/update operations

Respond in markdown. Be concise but thorough.`;
}
