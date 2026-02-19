/**
 * CLI command handlers.
 *
 * Handles built-in slash commands like /help, /config, /clear, /quit.
 */

import type { CliConfig } from "./config/index.js";
import type { McpClientWrapper } from "./mcp/index.js";
import type { createConversation } from "./agent/index.js";
import { colors } from "./ui/index.js";

/** Mask a secret value: show **** if set, — if unset. */
export function mask(value: string | undefined): string {
  return value ? "****" : "\u2014";
}

/** Display a config value: show the value if set, — if unset. */
export function val(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "\u2014";
  return String(value);
}

/** Print current configuration with secrets masked. */
export function printConfig(
  config: CliConfig,
  mcpClient: McpClientWrapper,
  writeLine: (text: string) => void,
): void {
  const label = (name: string, value: string) =>
    `    ${colors.dim(name.padEnd(16))}${colors.text(value)}`;

  writeLine("");
  writeLine(colors.bold("  Configuration"));
  writeLine("");
  writeLine(colors.bold("  LLM"));
  writeLine(label("Provider", val(config.llm.provider)));
  writeLine(label("Model", val(config.llm.model)));
  writeLine(label("API Key", mask(config.llm.apiKey)));
  writeLine(label("Base URL", val(config.llm.baseUrl)));
  writeLine(label("Max Tokens", val(config.llm.maxTokens)));
  writeLine(label("Temperature", val(config.llm.temperature)));
  writeLine("");
  writeLine(colors.bold("  Atlas"));
  writeLine(label("Public Key", mask(config.atlas.publicKey)));
  writeLine(label("Private Key", mask(config.atlas.privateKey)));
  writeLine(label("Org ID", val(config.atlas.orgId)));
  writeLine(label("Group ID", val(config.atlas.groupId)));
  writeLine(label("Base URL", val(config.atlas.baseUrl)));
  writeLine("");
  writeLine(colors.bold("  MCP"));
  writeLine(label("URL", val(config.mcp.url)));
  writeLine(label("Force Stdio", val(config.mcp.forceStdio)));
  writeLine(label("HTTP Timeout", `${config.mcp.httpTimeout}ms`));
  writeLine(label("Transport", val(mcpClient.transportType ?? undefined)));
  const serverVersion = mcpClient.getServerVersion();
  if (serverVersion) {
    writeLine(label("Server", `${serverVersion.name} v${serverVersion.version}`));
  }
  writeLine("");
  writeLine(colors.bold("  Defaults"));
  writeLine(label("Output Format", val(config.defaults.outputFormat)));
  writeLine(label("Max Tool Turns", val(config.defaults.maxToolTurns)));
  writeLine(label("Verbose", val(config.defaults.verbose)));
  writeLine("");
}

/** Handle slash commands. Returns true if handled, "quit" to exit, false if unknown. */
export function handleCommand(
  input: string,
  config: CliConfig,
  mcpClient: McpClientWrapper,
  conversation: ReturnType<typeof createConversation>,
  writeLine: (text: string) => void,
): boolean | "quit" {
  const cmd = input.toLowerCase().trim();

  switch (cmd) {
    case "/help":
      writeLine("");
      writeLine(colors.bold("Commands"));
      writeLine("  /help     Show this help");
      writeLine("  /config   Show current configuration");
      writeLine("  /clear    Clear conversation history");
      writeLine("  /quit     Exit orbit-ai");
      writeLine("");
      return true;

    case "/config":
      printConfig(config, mcpClient, writeLine);
      return true;

    case "/clear":
      conversation.clear();
      writeLine(colors.muted("  Conversation cleared."));
      return true;

    case "/quit":
    case "/exit":
    case "/q":
      return "quit";

    default:
      return false; // not a known command, pass to LLM
  }
}
