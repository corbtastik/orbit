import type { Writable } from "node:stream";
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
  colors,
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
  signal?: AbortSignal;
  /** Write function for streaming text fragments. */
  write?: (text: string) => void;
  /** Write function for complete lines (tool calls, usage, errors). */
  writeLine?: (text: string) => void;
  /** Stream for ora spinner (ScreenManager proxy or default). */
  outputStream?: Writable;
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
    signal,
    outputStream,
  } = options;

  const write = options.write ?? ((t: string) => { process.stdout.write(t); });
  const writeLine = options.writeLine ?? ((t: string) => { console.log(t); });

  const tools = buildToolDefinitions();
  const systemPrompt = buildSystemPrompt({ orgId, groupId });
  const spinner = new SpinnerManager(outputStream);

  conversation.addUser(userInput);

  let turns = 0;

  while (turns < maxToolTurns) {
    if (signal?.aborted) {
      spinner.stop();
      return "[Cancelled]";
    }

    turns++;

    // Collect streaming response
    const textChunks: string[] = [];
    const toolCalls: { id: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }[] = [];
    let usage: { inputTokens: number; outputTokens: number } | undefined;
    let isFirstText = true;

    spinner.thinking();

    const stream = provider.chat({
      messages: conversation.getMessages(),
      tools,
      system: systemPrompt,
      model,
      maxTokens,
      temperature,
      signal,
    });

    for await (const event of stream) {
      handleStreamEvent(event, {
        spinner,
        write,
        writeLine,
        textChunks,
        toolCalls,
        isFirstText,
        verbose,
        onUsage: (u) => { usage = u; },
        onFirstText: () => { isFirstText = false; },
      });
    }

    const fullText = textChunks.join("");

    // Check if cancelled during streaming
    if (signal?.aborted) {
      spinner.stop();
      if (fullText) {
        write("\n");
        conversation.addAssistantText(fullText + "\n\n[Response interrupted]");
      }
      return fullText || "[Cancelled]";
    }

    // If we got tool calls, execute them and continue the loop
    if (toolCalls.length > 0) {
      // Build assistant content blocks
      const assistantBlocks: ContentBlock[] = [];
      if (fullText) {
        assistantBlocks.push({ type: "text", text: fullText });
      }
      for (const tc of toolCalls) {
        const block: ContentBlock = {
          type: "tool_use",
          id: tc.id,
          name: tc.name,
          input: tc.args,
        };
        if (tc.thoughtSignature) block.thoughtSignature = tc.thoughtSignature;
        assistantBlocks.push(block);
      }
      conversation.addAssistantBlocks(assistantBlocks);

      // Execute each tool call
      const resultBlocks: ContentBlock[] = [];
      for (const tc of toolCalls) {
        if (signal?.aborted) {
          spinner.stop();
          resultBlocks.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: "[Cancelled by user]",
            is_error: true,
          });
          continue;
        }

        const action = (tc.args.action as string) ?? "unknown";
        spinner.tool(tc.name, action);

        const result = await executeTool(client, tc.name, tc.args);

        spinner.stop();
        writeLine(formatToolCall(tc.name, action));
        if (verbose) {
          writeLine(formatToolResult(result.success, result.content));
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
        writeLine(formatUsage(usage.inputTokens, usage.outputTokens));
      }

      // Continue loop — LLM needs to process tool results
      continue;
    }

    // No tool calls — this is the final text response
    if (fullText) {
      // Newline after streamed text
      write("\n");
      conversation.addAssistantText(fullText);
    }

    if (verbose && usage) {
      writeLine(formatUsage(usage.inputTokens, usage.outputTokens));
    }

    return fullText;
  }

  // Safety valve: too many tool turns
  const msg = `Reached maximum tool turns (${maxToolTurns}). Stopping.`;
  writeLine(formatError(msg));
  return msg;
}

/** Handle a single stream event. */
function handleStreamEvent(
  event: ChatEvent,
  ctx: {
    spinner: SpinnerManager;
    write: (text: string) => void;
    writeLine: (text: string) => void;
    textChunks: string[];
    toolCalls: { id: string; name: string; args: Record<string, unknown>; thoughtSignature?: string }[];
    isFirstText: boolean;
    verbose?: boolean;
    onUsage: (u: { inputTokens: number; outputTokens: number }) => void;
    onFirstText: () => void;
  },
): void {
  switch (event.type) {
    case "text_delta":
      if (ctx.isFirstText) {
        ctx.spinner.stop();
        ctx.write("\n"); // blank line before response
        ctx.onFirstText();
      }
      ctx.write(event.text);
      ctx.textChunks.push(event.text);
      break;
    case "tool_call":
      ctx.spinner.stop();
      ctx.toolCalls.push({ id: event.id, name: event.name, args: event.args, thoughtSignature: event.thoughtSignature });
      break;
    case "done":
      ctx.spinner.stop();
      if (event.usage) {
        ctx.onUsage(event.usage);
      }
      break;
    case "error":
      ctx.spinner.stop();
      ctx.writeLine(formatError(event.error.message));
      if (ctx.verbose && event.error.stack) {
        ctx.writeLine(colors.dim(event.error.stack));
      }
      break;
  }
}

/**
 * Create a new conversation context.
 */
export function createConversation(): ConversationHistory {
  return new ConversationHistory();
}
