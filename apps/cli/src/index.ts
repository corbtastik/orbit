#!/usr/bin/env node

import { parseArgs } from "node:util";
import { resolveCliConfig, VERSION, CONFIG_FILE, type CliConfig } from "./config/index.js";
import { createProvider } from "./providers/index.js";
import { runAgentTurn, createConversation } from "./agent/index.js";
import { McpClientWrapper } from "./mcp/index.js";
import {
  printBanner,
  Prompt,
  Session,
  ScreenManager,
  CommandPalette,
  formatError,
  colors,
  icons,
} from "./ui/index.js";

/** Parse CLI arguments. */
function parseCliArgs() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      provider: { type: "string", short: "p" },
      model: { type: "string", short: "m" },
      "api-key": { type: "string" },
      verbose: { type: "boolean", short: "v", default: false },
      "max-tokens": { type: "string" },
      raw: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", default: false },
    },
  });

  return {
    provider: values.provider,
    model: values.model,
    apiKey: values["api-key"],
    verbose: values.verbose ?? false,
    maxTokens: values["max-tokens"] ? parseInt(values["max-tokens"], 10) : undefined,
    raw: values.raw ?? false,
    help: values.help ?? false,
    version: values.version ?? false,
    query: positionals.join(" ").trim() || undefined,
  };
}

/** Print help text. */
function printHelp(): void {
  console.log(`
${colors.primary("orbit-ai")} — Conversational AI Shell for MongoDB Atlas

${colors.bold("USAGE")}
  orbit-ai                     Interactive REPL mode
  orbit-ai "list my clusters"  One-shot query mode

${colors.bold("OPTIONS")}
  -p, --provider <name>   LLM provider: anthropic, openai, google, ollama
  -m, --model <model>     Model name (e.g. claude-sonnet-4-20250514)
      --api-key <key>     API key for the LLM provider
  -v, --verbose           Show tool details and token usage
      --max-tokens <n>    Max response tokens (default: 4096)
      --raw               Output raw markdown (disable pretty rendering)
  -h, --help              Show this help message
      --version           Show version

${colors.bold("CONFIG FILE")}
  ${CONFIG_FILE}

  Priority: CLI flags > Environment variables > Config file > Defaults

${colors.bold("ENVIRONMENT")} (overrides config file)
  ATLAS_PUBLIC_KEY        MongoDB Atlas public API key
  ATLAS_PRIVATE_KEY       MongoDB Atlas private API key
  ANTHROPIC_API_KEY       Anthropic API key
  OPENAI_API_KEY          OpenAI API key
  GOOGLE_API_KEY          Google AI API key
  ORBIT_MCP_URL           MCP server URL
  ORBIT_MCP_STDIO         Force stdio transport
`);
}

/** Main entry point. */
async function main(): Promise<void> {
  const args = parseCliArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  if (args.version) {
    console.log(`orbit-ai ${VERSION}`);
    process.exit(0);
  }

  // Resolve configuration
  const config = resolveCliConfig({
    provider: args.provider,
    model: args.model,
    apiKey: args.apiKey,
    verbose: args.verbose,
    maxTokens: args.maxTokens,
  });

  // Create LLM provider
  let provider;
  try {
    provider = createProvider(
      config.llm.provider,
      config.llm.apiKey,
      config.llm.model,
      config.llm.baseUrl,
    );
  } catch (err: unknown) {
    console.error(formatError(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }

  // Create and connect MCP client
  const mcpClient = new McpClientWrapper({
    clientName: "orbit-ai-cli",
    clientVersion: VERSION,
    httpUrl: config.mcp.url,
    httpTimeout: config.mcp.httpTimeout,
    forceStdio: config.mcp.forceStdio,
  });

  try {
    await mcpClient.connect();
  } catch (err: unknown) {
    console.error(formatError(`Failed to connect to MCP server: ${err instanceof Error ? err.message : String(err)}`));
    process.exit(1);
  }

  // Show connection info in verbose mode
  if (config.defaults.verbose) {
    const serverVersion = mcpClient.getServerVersion();
    console.log(colors.dim(`  Connected via ${mcpClient.transportType}${serverVersion ? ` to ${serverVersion.name} v${serverVersion.version}` : ""}`));
  }

  const agentOptions = {
    mcpClient,
    provider,
    model: config.llm.model,
    maxTokens: config.llm.maxTokens,
    temperature: config.llm.temperature,
    maxToolTurns: config.defaults.maxToolTurns,
    orgId: config.atlas.orgId,
    groupId: config.atlas.groupId,
    verbose: config.defaults.verbose,
    rawOutput: args.raw,
  };

  // One-shot mode: run a single query and exit
  if (args.query) {
    const conversation = createConversation();
    try {
      await runAgentTurn(args.query, conversation, agentOptions);
    } catch (err: unknown) {
      console.error(formatError(err instanceof Error ? err.message : String(err)));
      await mcpClient.disconnect();
      process.exit(1);
    }
    await mcpClient.disconnect();
    process.exit(0);
  }

  // Interactive REPL mode
  printBanner();

  // Set up screen layout (3-zone TUI) if running in a terminal
  const isTTY = process.stdout.isTTY ?? false;
  const screen = isTTY ? new ScreenManager() : null;

  if (screen) {
    screen.setup({
      left: "  /help \u00B7 /config \u00B7 /clear \u00B7 /quit",
      right: `  orbit-ai v${VERSION}  `,
    });
  }

  // Output routing — through ScreenManager when active, direct otherwise
  const write = screen
    ? (t: string) => screen.writeToScrollRegion(t)
    : (t: string) => { process.stdout.write(t); };
  const writeLine = screen
    ? (t: string) => screen.writeLine(t)
    : (t: string) => { console.log(t); };

  // Command palette for slash command typeahead
  const palette = screen
    ? new CommandPalette(
        [
          { name: "/help", description: "Show available commands" },
          { name: "/config", description: "Show current configuration" },
          { name: "/clear", description: "Clear conversation history" },
          { name: "/quit", description: "Exit orbit-ai" },
          { name: "/exit", description: "Exit orbit-ai" },
        ],
        () => screen.separatorRow,
        () => screen.termCols,
      )
    : null;

  const conversation = createConversation();
  const session = new Session(write);
  const prompt = new Prompt(screen ?? undefined, palette ?? undefined);

  // Readline is always active (continuous askQuestion loop), so the cursor
  // is always at the prompt row.  Keep promptActive=true so all output
  // writes use save/restore + explicit cursorTo positioning.
  if (screen) screen.setPromptActive(true);

  // Cleanup function
  const cleanup = async () => {
    await mcpClient.disconnect();
  };

  // Wire interrupt handling — Prompt delegates Ctrl+C / Escape here.
  // Session.handleInterrupt() handles both idle (double Ctrl+C exit)
  // and processing (abort agent) states.
  prompt.onInterrupt(() => {
    session.handleInterrupt();
    if (session.shouldExit) {
      if (screen) screen.teardown();
      prompt.close();
      cleanup().then(() => {
        console.log(colors.dim("\n\nGoodbye."));
        process.exit(0);
      });
    }
  });

  while (!session.shouldExit) {
    if (screen) {
      screen.setScreenState("idle");
    }

    const input = await prompt.read();

    if (input === null) {
      // Ctrl+D or closed
      break;
    }

    // Handle built-in commands
    if (input.startsWith("/")) {
      const result = handleCommand(input, config, mcpClient, conversation, writeLine);
      if (result === "quit") break;
      if (result) continue;
    }

    // Echo user input to the scroll region (like Claude Code)
    writeLine(`${colors.primary(icons.prompt)} ${colors.text(input)}`);

    if (screen) {
      screen.setScreenState("processing");
    }

    const signal = session.startProcessing();

    try {
      await runAgentTurn(input, conversation, {
        ...agentOptions,
        signal,
        write,
        writeLine,
        outputStream: screen?.outputStream,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        // Already handled by session
      } else {
        writeLine(formatError(err instanceof Error ? err.message : String(err)));
      }
    }

    writeLine(""); // blank line between turns
    session.endProcessing();

    if (session.shouldExit) {
      break;
    }
  }

  prompt.close();
  if (screen) screen.teardown();
  await cleanup();
  console.log(colors.dim("Goodbye."));
}

/** Handle slash commands. Returns true if handled, "quit" to exit, false if unknown. */
function handleCommand(
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

/** Mask a secret value: show **** if set, — if unset. */
function mask(value: string | undefined): string {
  return value ? "****" : "\u2014";
}

/** Display a config value: show the value if set, — if unset. */
function val(value: string | number | boolean | undefined): string {
  if (value === undefined || value === null) return "\u2014";
  return String(value);
}

/** Print current configuration with secrets masked. */
function printConfig(config: CliConfig, mcpClient: McpClientWrapper, writeLine: (text: string) => void): void {
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

main().catch((err) => {
  console.error(formatError(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
