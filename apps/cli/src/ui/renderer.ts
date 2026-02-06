import { Marked } from "marked";
import { markedTerminal } from "marked-terminal";
import chalk from "chalk";
import { colors, icons } from "./theme.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const terminalRenderer = (markedTerminal as any)({
  // Remove ### prefixes from headings, render as styled text
  showSectionPrefix: false,
  // Style headings with bold + color
  heading: chalk.bold.cyan,
  // Style other elements
  strong: chalk.bold,
  em: chalk.italic,
  codespan: chalk.yellow,
  code: chalk.gray,
  blockquote: chalk.gray.italic,
  // Links
  href: chalk.blue.underline,
  // Tables
  tableOptions: {
    style: { head: ["cyan", "bold"] },
  },
  // Text width
  width: 100,
  reflowText: true,
});

const marked = new Marked(terminalRenderer);

/**
 * Post-process rendered markdown to handle inline formatting
 * that marked-terminal misses in certain contexts (like list items).
 */
function postProcessInlineFormatting(text: string): string {
  // Process bold: **text** -> bold
  text = text.replace(/\*\*([^*]+)\*\*/g, (_, content) => chalk.bold(content));
  // Process inline code: `code` -> yellow
  text = text.replace(/`([^`]+)`/g, (_, content) => chalk.yellow(content));
  // Process italic: *text* -> italic (but not ** which is bold)
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_, content) => chalk.italic(content));
  return text;
}

/**
 * Render markdown text for terminal display.
 */
export function renderMarkdown(text: string): string {
  const rendered = (marked.parse(text) as string).trimEnd();
  // Post-process to catch any inline formatting that marked-terminal missed
  return postProcessInlineFormatting(rendered);
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
