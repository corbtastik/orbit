import { readFileSync, existsSync } from "node:fs";
import {
  CONFIG_FILE,
  ENV,
  LLM_DEFAULTS,
  PROVIDER_MODEL_DEFAULTS,
  CLI_DEFAULTS,
  ATLAS_BASE_URL,
} from "./defaults.js";

/** Supported LLM provider identifiers. */
export type LlmProviderName = "anthropic" | "openai" | "google" | "ollama";

/** Full CLI configuration. */
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
  defaults: {
    outputFormat: "markdown" | "json" | "table";
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
 * Load configuration from the JSON config file.
 * Returns an empty partial if the file doesn't exist or is invalid.
 */
export function loadConfigFile(path = CONFIG_FILE): Partial<CliConfig> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as Partial<CliConfig>;
  } catch {
    return {};
  }
}

/**
 * Resolve the API key for a given provider.
 * Checks ORBIT_LLM_API_KEY first, then provider-specific env vars.
 */
function resolveApiKey(
  provider: LlmProviderName,
  fileKey?: string,
  flagKey?: string,
): string | undefined {
  if (flagKey) return flagKey;

  const generic = process.env[ENV.LLM_API_KEY];
  if (generic) return generic;

  const providerEnvMap: Record<LlmProviderName, string | undefined> = {
    anthropic: process.env[ENV.ANTHROPIC_API_KEY],
    openai: process.env[ENV.OPENAI_API_KEY],
    google: process.env[ENV.GOOGLE_API_KEY],
    ollama: undefined, // local, no key needed
  };

  return providerEnvMap[provider] ?? fileKey;
}

/**
 * Resolve full CLI configuration.
 * Priority: CLI flags > env vars > config file > defaults.
 */
export function resolveCliConfig(flags: CliFlags = {}): CliConfig {
  const file = loadConfigFile();

  const provider = (
    flags.provider ??
    process.env[ENV.LLM_PROVIDER] ??
    file.llm?.provider ??
    LLM_DEFAULTS.provider
  ) as LlmProviderName;

  return {
    atlas: {
      publicKey:
        process.env[ENV.ATLAS_PUBLIC_KEY] ?? file.atlas?.publicKey,
      privateKey:
        process.env[ENV.ATLAS_PRIVATE_KEY] ?? file.atlas?.privateKey,
      orgId:
        process.env[ENV.ATLAS_ORG_ID] ?? file.atlas?.orgId,
      groupId:
        process.env[ENV.ATLAS_GROUP_ID] ?? file.atlas?.groupId,
      baseUrl:
        process.env[ENV.ATLAS_BASE_URL] ?? file.atlas?.baseUrl ?? ATLAS_BASE_URL,
    },
    llm: {
      provider,
      apiKey: resolveApiKey(provider, file.llm?.apiKey, flags.apiKey),
      model:
        flags.model ??
        process.env[ENV.LLM_MODEL] ??
        file.llm?.model ??
        PROVIDER_MODEL_DEFAULTS[provider] ??
        LLM_DEFAULTS.model,
      baseUrl:
        process.env[ENV.LLM_BASE_URL] ?? file.llm?.baseUrl,
      maxTokens:
        flags.maxTokens ??
        toInt(process.env[ENV.LLM_MAX_TOKENS]) ??
        file.llm?.maxTokens ??
        LLM_DEFAULTS.maxTokens,
      temperature:
        file.llm?.temperature ?? LLM_DEFAULTS.temperature,
    },
    defaults: {
      outputFormat:
        file.defaults?.outputFormat ?? CLI_DEFAULTS.outputFormat,
      maxToolTurns:
        file.defaults?.maxToolTurns ?? CLI_DEFAULTS.maxToolTurns,
      verbose:
        flags.verbose ?? file.defaults?.verbose ?? CLI_DEFAULTS.verbose,
    },
  };
}

function toInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return isNaN(n) ? undefined : n;
}
