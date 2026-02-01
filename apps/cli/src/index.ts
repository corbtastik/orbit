#!/usr/bin/env node

import { parseArgs } from "node:util";
import { AtlasClient, resolveConfig } from "@orbit/core";
import { resolveCliConfig } from "./config/index.js";
import { createProvider } from "./providers/index.js";
import { runAgentTurn, createConversation } from "./agent/index.js";
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
  -h, --help              Show this help message
      --version           Show version

${colors.bold("ENVIRONMENT")}
  ANTHROPIC_API_KEY       Anthropic API key
  OPENAI_API_KEY          OpenAI API key
  GOOGLE_API_KEY          Google AI API key
  ATLAS_PUBLIC_KEY        MongoDB Atlas public API key
  ATLAS_PRIVATE_KEY       MongoDB Atlas private API key
  ATLAS_GROUP_ID          Default project (group) ID
  ATLAS_ORG_ID            Default organization ID

${colors.bold("CONFIG")}
  ~/.orbit-ai/config.json
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
    console.log("orbit-ai 1.0.0");
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

  // Validate Atlas credentials
  if (!config.atlas.publicKey || !config.atlas.privateKey) {
    console.error(
      formatError(
        "Atlas credentials required. Set ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY environment variables.",
      ),
    );
    process.exit(1);
  }

  // Create Atlas client
  const atlasConfig = resolveConfig({
    publicKey: config.atlas.publicKey,
    privateKey: config.atlas.privateKey,
    baseUrl: config.atlas.baseUrl,
  });
  const client = new AtlasClient(atlasConfig);

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

  const agentOptions = {
    client,
    provider,
    model: config.llm.model,
    maxTokens: config.llm.maxTokens,
    temperature: config.llm.temperature,
    maxToolTurns: config.defaults.maxToolTurns,
    orgId: config.atlas.orgId,
    groupId: config.atlas.groupId,
    verbose: config.defaults.verbose,
  };

  // One-shot mode: run a single query and exit
  if (args.query) {
    const conversation = createConversation();
    try {
      await runAgentTurn(args.query, conversation, agentOptions);
    } catch (err: unknown) {
      console.error(formatError(err instanceof Error ? err.message : String(err)));
      process.exit(1);
    }
    process.exit(0);
  }

  // Interactive REPL mode
  printBanner(config.llm.provider, config.llm.model ?? "default");

  // Set up screen layout (3-zone TUI) if running in a terminal
  const isTTY = process.stdout.isTTY ?? false;
  const screen = isTTY ? new ScreenManager() : null;
  const modelLabel = config.llm.model ?? "default";

  if (screen) {
    screen.setup({
      left: "  /help \u00B7 /clear \u00B7 /quit",
      right: `${config.llm.provider} \u00B7 ${modelLabel}  `,
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

  // Wire interrupt handling — Prompt delegates Ctrl+C / Escape here.
  // Session.handleInterrupt() handles both idle (double Ctrl+C exit)
  // and processing (abort agent) states.
  prompt.onInterrupt(() => {
    session.handleInterrupt();
    if (session.shouldExit) {
      if (screen) screen.teardown();
      prompt.close();
      console.log(colors.dim("\n\nGoodbye."));
      process.exit(0);
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
      const result = handleCommand(input, conversation, writeLine);
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
  console.log(colors.dim("Goodbye."));
}

/** Handle slash commands. Returns true if handled, "quit" to exit, false if unknown. */
function handleCommand(
  input: string,
  conversation: ReturnType<typeof createConversation>,
  writeLine: (text: string) => void,
): boolean | "quit" {
  const cmd = input.toLowerCase().trim();

  switch (cmd) {
    case "/help":
      writeLine("");
      writeLine(colors.bold("Commands"));
      writeLine("  /help     Show this help");
      writeLine("  /clear    Clear conversation history");
      writeLine("  /quit     Exit orbit-ai");
      writeLine("");
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

main().catch((err) => {
  console.error(formatError(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
