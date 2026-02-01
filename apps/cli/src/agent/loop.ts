import type { AtlasClient } from "@orbit/core";
import type { LlmProvider, ContentBlock, ToolDefinition, ChatEvent } from "../providers/index.js";
import { TOOL_REGISTRY, buildToolSchema, executeTool } from "../tools/index.js";
import { ConversationHistory } from "./conversation.js";
import { buildSystemPrompt } from "./system-prompt.js";
import {
  SpinnerManager,
  formatToolCall,
  formatToolResult,
  formatUsage,
  formatError,
  renderMarkdown,
} from "../ui/index.js";

/** Options for the agent loop. */
export interface AgentLoopOptions {
  client: AtlasClient;
  provider: LlmProvider;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  maxToolTurns?: number;
  orgId?: string;
  groupId?: string;
  verbose?: boolean;
}

/** Pre-build tool definitions once for all requests. */
function buildToolDefinitions(): ToolDefinition[] {
  return TOOL_REGISTRY.map((def) => ({
    name: def.name,
    description: def.description,
    input_schema: buildToolSchema(def.actions),
  }));
}

/**
 * Run a single conversation turn: send user input, process LLM response,
 * execute any tool calls, and loop until the LLM produces a final text response.
 *
 * Returns the assistant's final text response.
 */
export async function runAgentTurn(
  userInput: string,
  conversation: ConversationHistory,
  options: AgentLoopOptions,
): Promise<string> {
  const {
    client,
    provider,
    model,
    maxTokens,
    temperature,
    maxToolTurns = 10,
    orgId,
    groupId,
    verbose,
  } = options;

  const tools = buildToolDefinitions();
  const systemPrompt = buildSystemPrompt({ orgId, groupId });
  const spinner = new SpinnerManager();

  conversation.addUser(userInput);

  let turns = 0;

  while (turns < maxToolTurns) {
    turns++;

    // Collect streaming response
    const textChunks: string[] = [];
    const toolCalls: { id: string; name: string; args: Record<string, unknown> }[] = [];
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    let isFirstText = true;

    spinner.stop();

    const stream = provider.chat({
      messages: conversation.getMessages(),
      tools,
      system: systemPrompt,
      model,
      maxTokens,
      temperature,
    });

    for await (const event of stream) {
      handleStreamEvent(event, {
        textChunks,
        toolCalls,
        isFirstText,
        verbose,
        onUsage: (u) => { usage = u; },
        onFirstText: () => { isFirstText = false; },
      });
    }

    const fullText = textChunks.join("");

    // If we got tool calls, execute them and continue the loop
    if (toolCalls.length > 0) {
      // Build assistant content blocks
      const assistantBlocks: ContentBlock[] = [];
      if (fullText) {
        assistantBlocks.push({ type: "text", text: fullText });
      }
      for (const tc of toolCalls) {
        assistantBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.args,
        });
      }
      conversation.addAssistantBlocks(assistantBlocks);

      // Execute each tool call
      const resultBlocks: ContentBlock[] = [];
      for (const tc of toolCalls) {
        const action = (tc.args.action as string) ?? "unknown";
        spinner.tool(tc.name, action);

        const result = await executeTool(client, tc.name, tc.args);

        spinner.stop();
        console.log(formatToolCall(tc.name, action));
        if (verbose) {
          console.log(formatToolResult(result.success, result.content));
        }

        resultBlocks.push({
          type: "tool_result",
          tool_use_id: tc.id,
          content: result.content,
          is_error: !result.success,
        });
      }

      conversation.addToolResults(resultBlocks);

      // Show usage if verbose
      if (verbose && usage) {
        console.log(formatUsage(usage.inputTokens, usage.outputTokens));
      }

      // Continue loop — LLM needs to process tool results
      continue;
    }

    // No tool calls — this is the final text response
    if (fullText) {
      // Newline after streamed text
      process.stdout.write("\n");
      conversation.addAssistantText(fullText);
    }

    if (verbose && usage) {
      console.log(formatUsage(usage.inputTokens, usage.outputTokens));
    }

    return fullText;
  }

  // Safety valve: too many tool turns
  const msg = `Reached maximum tool turns (${maxToolTurns}). Stopping.`;
  console.log(formatError(msg));
  return msg;
}

/** Handle a single stream event. */
function handleStreamEvent(
  event: ChatEvent,
  ctx: {
    textChunks: string[];
    toolCalls: { id: string; name: string; args: Record<string, unknown> }[];
    isFirstText: boolean;
    verbose?: boolean;
    onUsage: (u: { inputTokens: number; outputTokens: number }) => void;
    onFirstText: () => void;
  },
): void {
  switch (event.type) {
    case "text_delta":
      if (ctx.isFirstText) {
        console.log(); // blank line before response
        ctx.onFirstText();
      }
      process.stdout.write(event.text);
      ctx.textChunks.push(event.text);
      break;
    case "tool_call":
      ctx.toolCalls.push({ id: event.id, name: event.name, args: event.args });
      break;
    case "done":
      if (event.usage) {
        ctx.onUsage(event.usage);
      }
      break;
    case "error":
      console.error(formatError(event.error.message));
      break;
  }
}

/**
 * Create a new conversation context.
 */
export function createConversation(): ConversationHistory {
  return new ConversationHistory();
}
