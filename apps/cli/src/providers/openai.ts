import OpenAI from "openai";
import type {
  LlmProvider,
  ChatRequest,
  ChatEvent,
  ChatMessage,
  ContentBlock,
} from "./types.js";

/**
 * Options for creating an OpenAI-compatible provider.
 * Used by both OpenAiProvider and OllamaProvider.
 */
export interface OpenAiProviderOptions {
  apiKey: string;
  /** Resolved by the config layer; providers carry no model fallbacks. */
  model: string;
  baseUrl?: string;
  name?: string;
}

/**
 * OpenAI provider using the official SDK.
 * Streams responses and supports tool calling.
 *
 * Also serves as the base for Ollama (OpenAI-compatible API).
 */
export class OpenAiProvider implements LlmProvider {
  readonly name: string;
  private client: OpenAI;
  private defaultModel: string;

  constructor(opts: OpenAiProviderOptions) {
    this.name = opts.name ?? "openai";
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      ...(opts.baseUrl ? { baseURL: opts.baseUrl } : {}),
    });
    this.defaultModel = opts.model;
  }

  async *chat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    const messages = toOpenAiMessages(request.messages, request.system);

    try {
      const stream = await this.client.chat.completions.create(
        {
          model: request.model ?? this.defaultModel,
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0,
          messages,
          tools: request.tools.map((t) => ({
            type: "function" as const,
            function: {
              name: t.name,
              description: t.description,
              parameters: t.input_schema,
            },
          })),
          stream: true,
          stream_options: { include_usage: true },
        },
        request.signal ? { signal: request.signal } : undefined,
      );

      const pendingToolCalls: Map<
        number,
        { id: string; name: string; jsonChunks: string[] }
      > = new Map();
      let hasToolCalls = false;

      for await (const chunk of stream) {
        const choice = chunk.choices[0];

        if (!choice) {
          // Usage-only chunk at the end of stream
          if (chunk.usage) {
            yield {
              type: "done",
              stopReason: "end_turn",
              usage: {
                inputTokens: chunk.usage.prompt_tokens,
                outputTokens: chunk.usage.completion_tokens,
              },
            };
          }
          continue;
        }

        const delta = choice.delta;

        // Text content
        if (delta.content) {
          yield { type: "text_delta", text: delta.content };
        }

        // Tool calls (streamed incrementally)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.id) {
              // New tool call started
              pendingToolCalls.set(tc.index, {
                id: tc.id,
                name: tc.function?.name ?? "",
                jsonChunks: [],
              });
              hasToolCalls = true;
            }

            const pending = pendingToolCalls.get(tc.index);
            if (pending) {
              if (tc.function?.name) {
                pending.name = tc.function.name;
              }
              if (tc.function?.arguments) {
                pending.jsonChunks.push(tc.function.arguments);
              }
            }
          }
        }

        // Stream finished
        if (choice.finish_reason) {
          // Emit all collected tool calls
          for (const [, pending] of pendingToolCalls) {
            const jsonStr = pending.jsonChunks.join("");
            let args: Record<string, unknown> = {};
            try {
              args = jsonStr ? JSON.parse(jsonStr) : {};
            } catch {
              args = {};
            }
            yield {
              type: "tool_call",
              id: pending.id,
              name: pending.name,
              args,
            };
          }
          pendingToolCalls.clear();

          if (hasToolCalls) {
            yield { type: "tool_calls_done" };
          }

          const stopReason =
            choice.finish_reason === "tool_calls"
              ? "tool_use"
              : choice.finish_reason;

          if (chunk.usage) {
            yield {
              type: "done",
              stopReason,
              usage: {
                inputTokens: chunk.usage.prompt_tokens,
                outputTokens: chunk.usage.completion_tokens,
              },
            };
          } else {
            yield { type: "done", stopReason };
          }
        }
      }
    } catch (err: unknown) {
      // Abort is not an error — yield a clean cancellation event
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "done", stopReason: "cancelled" };
        return;
      }
      // Enrich connection errors with the URL for debugging
      let error: Error;
      if (err instanceof Error) {
        const cause = (err as { cause?: Error }).cause;
        const detail = cause ? `: ${cause.message}` : "";
        error = new Error(
          `${err.message}${detail} (provider: ${this.name}, baseURL: ${this.client.baseURL})`,
        );
      } else {
        error = new Error(String(err));
      }
      yield { type: "error", error };
    }
  }
}

/**
 * Convert our ChatMessage[] to OpenAI's message format.
 * Handles system prompt, text messages, tool_use, and tool_result blocks.
 */
function toOpenAiMessages(
  messages: ChatMessage[],
  system?: string,
): OpenAI.ChatCompletionMessageParam[] {
  const result: OpenAI.ChatCompletionMessageParam[] = [];

  if (system) {
    result.push({ role: "system", content: system });
  }

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      result.push({ role: msg.role, content: msg.content });
      continue;
    }

    // ContentBlock array
    if (msg.role === "assistant") {
      // Collect text + tool_use blocks into a single assistant message
      let text = "";
      const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

      for (const block of msg.content) {
        if (block.type === "text") {
          text += block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        }
      }

      result.push({
        role: "assistant",
        content: text || null,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      });
    } else {
      // User message — may contain text and/or tool_result blocks.
      // In our conversation format, tool_result blocks come in user messages
      // (following Anthropic's pattern). For OpenAI, tool results must be
      // separate {role: "tool"} messages.

      const textParts: string[] = [];
      const toolResults: Extract<ContentBlock, { type: "tool_result" }>[] = [];

      for (const block of msg.content) {
        if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "tool_result") {
          toolResults.push(block);
        }
      }

      // If there's plain text content, emit a user message
      if (textParts.length > 0) {
        result.push({ role: "user", content: textParts.join("\n") });
      }

      // Tool results become separate {role: "tool"} messages
      for (const tr of toolResults) {
        result.push({
          role: "tool",
          tool_call_id: tr.tool_use_id,
          content: tr.content,
        });
      }
    }
  }

  return result;
}
