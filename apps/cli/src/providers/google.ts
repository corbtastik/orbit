import {
  GoogleGenerativeAI,
  type Content,
  type Part,
  type FunctionDeclaration,
} from "@google/generative-ai";
import { randomUUID } from "node:crypto";
import type {
  LlmProvider,
  ChatRequest,
  ChatEvent,
  ChatMessage,
  ContentBlock,
} from "./types.js";

/**
 * Google Gemini provider using the official @google/generative-ai SDK.
 * Streams responses and supports function calling.
 */
export class GoogleProvider implements LlmProvider {
  readonly name = "google";
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, model = "gemini-2.0-flash") {
    this.apiKey = apiKey;
    this.defaultModel = model;
  }

  async *chat(request: ChatRequest): AsyncGenerator<ChatEvent> {
    const genAI = new GoogleGenerativeAI(this.apiKey);

    const functionDeclarations: FunctionDeclaration[] = request.tools.map(
      (t) => ({
        name: t.name,
        description: t.description,
        parameters: sanitizeSchema(t.input_schema) as unknown as FunctionDeclaration["parameters"],
      }),
    );

    const model = genAI.getGenerativeModel({
      model: request.model ?? this.defaultModel,
      systemInstruction: request.system,
      tools: [{ functionDeclarations }],
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0,
      },
    });

    const contents = toGeminiContents(request.messages);

    try {
      const requestOptions = request.signal ? { signal: request.signal } : {};
      const result = await model.generateContentStream({ contents }, requestOptions);

      let hasToolCalls = false;

      for await (const chunk of result.stream) {
        const candidate = chunk.candidates?.[0];
        if (!candidate?.content?.parts) continue;

        for (const part of candidate.content.parts) {
          if ("text" in part && part.text) {
            yield { type: "text_delta", text: part.text };
          }

          if ("functionCall" in part && part.functionCall) {
            hasToolCalls = true;
            const sig = (part as unknown as Record<string, unknown>).thoughtSignature as string | undefined;
            yield {
              type: "tool_call",
              id: randomUUID(),
              name: part.functionCall.name,
              args: (part.functionCall.args as Record<string, unknown>) ?? {},
              ...(sig ? { thoughtSignature: sig } : {}),
            };
          }
        }
      }

      if (hasToolCalls) {
        yield { type: "tool_calls_done" };
      }

      // Get final response for usage metadata
      const response = await result.response;
      const usage = response.usageMetadata;

      const stopReason = hasToolCalls
        ? "tool_use"
        : candidate0FinishReason(response) ?? "end_turn";

      yield {
        type: "done",
        stopReason,
        usage: usage
          ? {
              inputTokens: usage.promptTokenCount ?? 0,
              outputTokens: usage.candidatesTokenCount ?? 0,
            }
          : undefined,
      };
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
 * Recursively strip JSON Schema fields that Gemini doesn't support.
 * Gemini's FunctionDeclaration schema rejects `additionalProperties`.
 */
function sanitizeSchema(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(sanitizeSchema);
  }
  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (key === "additionalProperties") continue;
      result[key] = sanitizeSchema(value);
    }
    return result;
  }
  return obj;
}

/**
 * Extract finish reason from the final response.
 */
function candidate0FinishReason(
  response: { candidates?: Array<{ finishReason?: string }> },
): string | undefined {
  return response.candidates?.[0]?.finishReason?.toLowerCase();
}

/**
 * Convert our ChatMessage[] to Gemini Content[].
 *
 * Gemini uses:
 * - role "user" / "model"
 * - Parts: text, functionCall, functionResponse
 * - tool_result → functionResponse (matched by function name, not ID)
 */
function toGeminiContents(messages: ChatMessage[]): Content[] {
  const result: Content[] = [];

  // Build a mapping from tool_use_id → tool name for functionResponse matching
  const idToName = new Map<string, string>();

  for (const msg of messages) {
    if (typeof msg.content !== "string") {
      for (const block of msg.content) {
        if (block.type === "tool_use") {
          idToName.set(block.id, block.name);
        }
      }
    }
  }

  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";

    if (typeof msg.content === "string") {
      result.push({ role, parts: [{ text: msg.content }] });
      continue;
    }

    const parts: Part[] = [];

    for (const block of msg.content) {
      if (block.type === "text") {
        parts.push({ text: block.text });
      } else if (block.type === "tool_use") {
        const part: Part = {
          functionCall: {
            name: block.name,
            args: block.input,
          },
        };
        if (block.thoughtSignature) {
          (part as unknown as Record<string, unknown>).thoughtSignature = block.thoughtSignature;
        }
        parts.push(part);
      } else if (block.type === "tool_result") {
        const name = idToName.get(block.tool_use_id) ?? "unknown";
        parts.push({
          functionResponse: {
            name,
            response: { content: block.content },
          },
        });
      }
    }

    if (parts.length > 0) {
      result.push({ role, parts });
    }
  }

  return result;
}
