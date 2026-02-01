import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import { colors, icons } from "./theme.js";

const marked = new Marked(markedTerminal() as Record<string, unknown>);

/**
 * Render markdown text for terminal display.
 */
export function renderMarkdown(text: string): string {
  return (marked.parse(text) as string).trimEnd();
}

/**
 * Format a tool call for display.
 */
export function formatToolCall(toolName: string, action: string): string {
  return colors.muted(
    `  ${icons.tool} ${colors.secondary(toolName)} ${colors.dim(`→ ${action}`)}`,
  );
}

/**
 * Format a tool result for display.
 */
export function formatToolResult(success: boolean, preview: string): string {
  const icon = success ? icons.success : icons.error;
  const color = success ? colors.secondary : colors.error;
  const truncated =
    preview.length > 200 ? preview.slice(0, 200) + "..." : preview;
  return colors.muted(`  ${color(icon)} ${colors.dim(truncated)}`);
}

/**
 * Format token usage for display.
 */
export function formatUsage(
  inputTokens: number,
  outputTokens: number,
): string {
  return colors.dim(
    `  tokens: ${inputTokens.toLocaleString()} in / ${outputTokens.toLocaleString()} out`,
  );
}

/**
 * Format an error message.
 */
export function formatError(message: string): string {
  return `\n${colors.error(`${icons.error} ${message}`)}\n`;
}

/**
 * Print a horizontal divider.
 */
export function divider(): string {
  return colors.dim("─".repeat(60));
}
