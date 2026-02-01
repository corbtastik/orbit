import type { ChatMessage, ContentBlock } from "../providers/index.js";

/**
 * Manages the conversation history between user and assistant.
 */
export class ConversationHistory {
  private messages: ChatMessage[] = [];

  /** Add a user message. */
  addUser(text: string): void {
    this.messages.push({ role: "user", content: text });
  }

  /** Add an assistant text response. */
  addAssistantText(text: string): void {
    this.messages.push({ role: "assistant", content: text });
  }

  /** Add an assistant message with tool calls. */
  addAssistantBlocks(blocks: ContentBlock[]): void {
    this.messages.push({ role: "assistant", content: blocks });
  }

  /** Add tool results as a user message (Anthropic convention). */
  addToolResults(results: ContentBlock[]): void {
    this.messages.push({ role: "user", content: results });
  }

  /** Get all messages for the next API call. */
  getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  /** Get the current message count. */
  get length(): number {
    return this.messages.length;
  }

  /** Clear conversation history. */
  clear(): void {
    this.messages = [];
  }
}
