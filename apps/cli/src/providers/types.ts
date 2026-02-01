/**
 * A message in the conversation history.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

/**
 * Tool definition sent to the LLM.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Request sent to an LLM provider.
 */
export interface ChatRequest {
  messages: ChatMessage[];
  tools: ToolDefinition[];
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Streaming events emitted by the provider.
 */
export type ChatEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_calls_done" }
  | { type: "done"; stopReason: string; usage?: { inputTokens: number; outputTokens: number } }
  | { type: "error"; error: Error };

/**
 * Abstract interface for an LLM provider.
 * Each provider streams ChatEvents via an async generator.
 */
export interface LlmProvider {
  readonly name: string;
  chat(request: ChatRequest): AsyncGenerator<ChatEvent>;
}
