import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmProvider,
  ChatRequest,
  ChatEvent,
  ChatMessage,
  ContentBlock,
} from "./types.js";

/**
 * Anthropic Claude provider using the official SDK.
 * Streams responses and supports tool_use natively.
 */
export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private client: Anthropic;
  private defaultModel: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.defaultModel = model;
  }

  async *chat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    const messages = request.messages.map((m) => toAnthropicMessage(m));

    try {
      const stream = this.client.messages.stream(
        {
          model: request.model ?? this.defaultModel,
          max_tokens: request.maxTokens ?? 4096,
          // Sampling params are removed on current models (Sonnet 5, Opus 5,
          // the 4.6+ family) and return 400. Only send when explicitly set.
          ...(request.temperature !== undefined
            ? { temperature: request.temperature }
            : {}),
          system: request.system,
          messages,
          tools: request.tools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.input_schema as Anthropic.Tool.InputSchema,
          })),
        },
        request.signal ? { signal: request.signal } : undefined,
      );

      // Collect tool calls as they arrive
      const pendingToolCalls: Map<number, { id: string; name: string; jsonChunks: string[] }> = new Map();

      for await (const event of stream) {
        if (event.type === "content_block_start") {
          const block = event.content_block;
          if (block.type === "tool_use") {
            pendingToolCalls.set(event.index, {
              id: block.id,
              name: block.name,
              jsonChunks: [],
            });
          }
        } else if (event.type === "content_block_delta") {
          const delta = event.delta;
          if (delta.type === "text_delta") {
            yield { type: "text_delta", text: delta.text };
          } else if (delta.type === "input_json_delta") {
            const pending = pendingToolCalls.get(event.index);
            if (pending) {
              pending.jsonChunks.push(delta.partial_json);
            }
          }
        } else if (event.type === "content_block_stop") {
          const pending = pendingToolCalls.get(event.index);
          if (pending) {
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
            pendingToolCalls.delete(event.index);
          }
        } else if (event.type === "message_delta") {
          if (event.delta.stop_reason === "tool_use") {
            yield { type: "tool_calls_done" };
          }
        } else if (event.type === "message_stop") {
          const finalMessage = await stream.finalMessage();
          yield {
            type: "done",
            stopReason: finalMessage.stop_reason ?? "end_turn",
            usage: {
              inputTokens: finalMessage.usage.input_tokens,
              outputTokens: finalMessage.usage.output_tokens,
            },
          };
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "done", stopReason: "cancelled" };
        return;
      }
      yield {
        type: "error",
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  }
}

/**
 * Convert our ChatMessage to Anthropic's message format.
 */
function toAnthropicMessage(msg: ChatMessage): Anthropic.MessageParam {
  if (typeof msg.content === "string") {
    return { role: msg.role, content: msg.content };
  }

  // Convert ContentBlock[] to Anthropic content blocks
  const content: Anthropic.ContentBlockParam[] = msg.content.map((block: ContentBlock) => {
    if (block.type === "text") {
      return { type: "text" as const, text: block.text };
    }
    if (block.type === "tool_use") {
      return {
        type: "tool_use" as const,
        id: block.id,
        name: block.name,
        input: block.input,
      };
    }
    if (block.type === "tool_result") {
      return {
        type: "tool_result" as const,
        tool_use_id: block.tool_use_id,
        content: block.content,
        is_error: block.is_error,
      };
    }
    return { type: "text" as const, text: "" };
  });

  return { role: msg.role, content };
}
