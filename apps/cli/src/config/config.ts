/**
 * CLI configuration wrapper.
 *
 * Uses the shared config loader from @orbit/core and applies CLI-specific
 * overrides from command-line flags.
 */

import {
  loadConfig,
  type ResolvedOrbitConfig,
  type LlmProviderName,
  type OutputFormat,
  DEFAULTS,
} from "@orbit/core";

/** Re-export types from core. */
export type { LlmProviderName, OutputFormat };

/**
 * CLI configuration structure.
 *
 * This is a flattened view of the config for CLI convenience.
 */
export interface CliConfig {
  atlas: {
    publicKey?: string;
    privateKey?: string;
    orgId?: string;
    groupId?: string;
    baseUrl?: string;
  };
  llm: {
    provider: LlmProviderName;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
    maxTokens?: number;
    temperature?: number;
  };
  mcp: {
    url: string;
    forceStdio: boolean;
    httpTimeout: number;
  };
  defaults: {
    outputFormat: OutputFormat;
    maxToolTurns: number;
    verbose: boolean;
  };
}

/** CLI flags that can override configuration. */
export interface CliFlags {
  provider?: string;
  model?: string;
  apiKey?: string;
  verbose?: boolean;
  maxTokens?: number;
}

/**
 * Resolve full CLI configuration.
 *
 * Priority: CLI flags > Environment variables > Config file > Defaults
 *
 * Uses the shared config loader from @orbit/core, then applies CLI flags.
 */
export function resolveCliConfig(flags: CliFlags = {}): CliConfig {
  // Load base config (env vars + config file + defaults)
  const config = loadConfig();

  // Apply CLI flag overrides
  const provider = (flags.provider as LlmProviderName) ?? config.llm.provider;
  const model = flags.model ?? config.llm.model;
  const apiKey = flags.apiKey ?? config.llm.apiKey;
  const verbose = flags.verbose ?? config.defaults.verbose;
  const maxTokens = flags.maxTokens ?? config.llm.maxTokens;

  // If provider changed via flag, update model to provider default if not specified
  const finalModel = flags.provider && !flags.model
    ? DEFAULTS.providerModels[provider] ?? model
    : model;

  // If provider changed via flag, need to resolve API key for new provider
  const finalApiKey = flags.provider && !flags.apiKey
    ? resolveApiKeyForProvider(provider)
    : apiKey;

  return {
    atlas: {
      publicKey: config.atlas.publicKey || undefined,
      privateKey: config.atlas.privateKey || undefined,
      orgId: config.atlas.orgId,
      groupId: config.atlas.groupId,
      baseUrl: config.atlas.baseUrl,
    },
    llm: {
      provider,
      apiKey: finalApiKey,
      model: finalModel,
      baseUrl: config.llm.baseUrl,
      maxTokens,
      temperature: config.llm.temperature,
    },
    mcp: {
      url: config.mcp.url,
      forceStdio: config.mcp.forceStdio,
      httpTimeout: config.mcp.httpTimeout,
    },
    defaults: {
      outputFormat: config.defaults.outputFormat,
      maxToolTurns: config.defaults.maxToolTurns,
      verbose,
    },
  };
}

/**
 * Resolve API key for a specific provider from environment.
 * Used when provider is changed via CLI flag.
 */
function resolveApiKeyForProvider(provider: LlmProviderName): string | undefined {
  const envMap: Record<LlmProviderName, string | undefined> = {
    anthropic: process.env.ANTHROPIC_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    google: process.env.GOOGLE_API_KEY,
    ollama: undefined,
  };
  return process.env.ORBIT_LLM_API_KEY ?? envMap[provider];
}

/**
 * Get the raw config from the shared loader.
 * Useful for tests or advanced use cases.
 */
export function getRawConfig(): ResolvedOrbitConfig {
  return loadConfig();
}
