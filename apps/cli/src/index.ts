#!/usr/bin/env node

import { parseArgs } from "node:util";
import { AtlasClient, resolveConfig } from "@orbit/core";
import { resolveCliConfig } from "./config/index.js";
import { createProvider } from "./providers/index.js";
import { runAgentTurn, createConversation } from "./agent/index.js";
import { printBanner, Prompt, formatError, colors } from "./ui/index.js";

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

  const conversation = createConversation();
  const prompt = new Prompt();

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log(colors.dim("\n\nGoodbye."));
    prompt.close();
    process.exit(0);
  });

  while (true) {
    const input = await prompt.read();

    if (input === null) {
      // Ctrl+D or closed
      console.log(colors.dim("\nGoodbye."));
      break;
    }

    // Handle built-in commands
    if (input.startsWith("/")) {
      if (handleCommand(input, conversation)) continue;
    }

    prompt.pause();

    try {
      await runAgentTurn(input, conversation, agentOptions);
    } catch (err: unknown) {
      console.error(formatError(err instanceof Error ? err.message : String(err)));
    }

    console.log(); // blank line between turns
    prompt.resume();
  }

  prompt.close();
}

/** Handle slash commands. Returns true if the command was handled. */
function handleCommand(input: string, conversation: ReturnType<typeof createConversation>): boolean {
  const cmd = input.toLowerCase().trim();

  switch (cmd) {
    case "/help":
      console.log(`
${colors.bold("Commands")}
  /help     Show this help
  /clear    Clear conversation history
  /quit     Exit orbit-ai
`);
      return true;

    case "/clear":
      conversation.clear();
      console.log(colors.muted("  Conversation cleared.\n"));
      return true;

    case "/quit":
    case "/exit":
    case "/q":
      console.log(colors.dim("\nGoodbye."));
      process.exit(0);

    default:
      return false; // not a known command, pass to LLM
  }
}

main().catch((err) => {
  console.error(formatError(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
