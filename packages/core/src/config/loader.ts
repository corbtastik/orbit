/**
 * Unified configuration loader for OrbitAI.
 *
 * Priority: CLI flags > Environment variables > Config file > Defaults
 */

import { readFileSync, existsSync } from "node:fs";
import {
  CONFIG_FILE,
  ENV,
  DEFAULTS,
  type OrbitConfig,
  type ResolvedOrbitConfig,
  type LlmProviderName,
} from "./types.js";

/**
 * Load configuration from the JSON config file.
 * Returns an empty object if the file doesn't exist or is invalid.
 */
export function loadConfigFile(path = CONFIG_FILE): OrbitConfig {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, "utf-8");
    return JSON.parse(raw) as OrbitConfig;
  } catch {
    return {};
  }
}

/**
 * Parse a boolean from string or boolean value.
 */
function toBool(value: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

/**
 * Parse an integer from string or number value.
 */
function toInt(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number") return value;
  if (value === undefined) return fallback;
  const n = parseInt(value, 10);
  return isNaN(n) ? fallback : n;
}

/**
 * Scan environment for MONGODB_CONN_* variables.
 * Returns a map of connection name -> connection string.
 */
function scanMongoDbConnections(): Record<string, string> {
  const connections: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith(ENV.MONGODB_CONN_PREFIX) && value) {
      const name = key.slice(ENV.MONGODB_CONN_PREFIX.length).toLowerCase();
      if (name) {
        connections[name] = value;
      }
    }
  }
  return connections;
}

/**
 * Resolve the API key for a given LLM provider.
 * Checks generic ORBIT_LLM_API_KEY first, then provider-specific env vars, then config.
 */
function resolveApiKey(
  provider: LlmProviderName,
  configKey?: string,
): string | undefined {
  // Generic env var
  const generic = process.env[ENV.ORBIT_LLM_API_KEY];
  if (generic) return generic;

  // Provider-specific env var
  const providerEnvMap: Record<LlmProviderName, string | undefined> = {
    anthropic: process.env[ENV.ANTHROPIC_API_KEY],
    openai: process.env[ENV.OPENAI_API_KEY],
    google: process.env[ENV.GOOGLE_API_KEY],
    ollama: undefined, // local, no key needed
  };

  return providerEnvMap[provider] ?? configKey;
}

/**
 * Load and resolve the complete OrbitAI configuration.
 *
 * Merges config file with environment variables, applying defaults.
 *
 * @param configPath - Optional path to config file (default: ~/.orbit-ai/config.json)
 */
export function loadConfig(configPath?: string): ResolvedOrbitConfig {
  const file = loadConfigFile(configPath);

  // Determine LLM provider first (needed for model/apiKey defaults)
  const provider = (
    process.env[ENV.ORBIT_LLM_PROVIDER] ??
    file.llm?.provider ??
    DEFAULTS.llm.provider
  ) as LlmProviderName;

  // Scan for MONGODB_CONN_* env vars
  const envMongoConnections = scanMongoDbConnections();

  return {
    atlas: {
      publicKey:
        process.env[ENV.ATLAS_PUBLIC_KEY] ??
        file.atlas?.publicKey ??
        "",
      privateKey:
        process.env[ENV.ATLAS_PRIVATE_KEY] ??
        file.atlas?.privateKey ??
        "",
      orgId:
        process.env[ENV.ATLAS_ORG_ID] ??
        file.atlas?.orgId,
      groupId:
        process.env[ENV.ATLAS_GROUP_ID] ??
        file.atlas?.groupId,
      baseUrl:
        process.env[ENV.ATLAS_BASE_URL] ??
        file.atlas?.baseUrl ??
        DEFAULTS.atlas.baseUrl,
    },

    mongodb: {
      default:
        process.env[ENV.MONGODB_CONNECTION_STRING] ??
        file.mongodb?.default,
      connections: {
        ...file.mongodb?.connections,
        ...envMongoConnections, // Env vars override config file
      },
    },

    server: {
      readOnly: toBool(
        process.env[ENV.ORBIT_READ_ONLY] ?? file.server?.readOnly,
        DEFAULTS.server.readOnly,
      ),
      http: toBool(
        process.env[ENV.ORBIT_MCP_HTTP] ?? file.server?.http,
        DEFAULTS.server.http,
      ),
      port: toInt(
        process.env[ENV.ORBIT_MCP_PORT] ?? file.server?.port,
        DEFAULTS.server.port,
      ),
      host:
        process.env[ENV.ORBIT_MCP_HOST] ??
        file.server?.host ??
        DEFAULTS.server.host,
    },

    llm: {
      provider,
      apiKey: resolveApiKey(provider, file.llm?.apiKey),
      model:
        process.env[ENV.ORBIT_LLM_MODEL] ??
        file.llm?.model ??
        DEFAULTS.providerModels[provider] ??
        DEFAULTS.llm.model,
      baseUrl:
        process.env[ENV.ORBIT_LLM_BASE_URL] ??
        file.llm?.baseUrl,
      maxTokens: toInt(
        process.env[ENV.ORBIT_LLM_MAX_TOKENS] ?? file.llm?.maxTokens,
        DEFAULTS.llm.maxTokens,
      ),
      temperature: file.llm?.temperature ?? DEFAULTS.llm.temperature,
    },

    mcp: {
      url:
        process.env[ENV.ORBIT_MCP_URL] ??
        file.mcp?.url ??
        DEFAULTS.mcp.url,
      forceStdio: toBool(
        process.env[ENV.ORBIT_MCP_STDIO] ?? file.mcp?.forceStdio,
        DEFAULTS.mcp.forceStdio,
      ),
      httpTimeout: toInt(
        process.env[ENV.ORBIT_MCP_HTTP_TIMEOUT] ?? file.mcp?.httpTimeout,
        DEFAULTS.mcp.httpTimeout,
      ),
    },

    defaults: {
      outputFormat:
        file.defaults?.outputFormat ??
        DEFAULTS.defaults.outputFormat,
      maxToolTurns:
        file.defaults?.maxToolTurns ??
        DEFAULTS.defaults.maxToolTurns,
      verbose:
        file.defaults?.verbose ??
        DEFAULTS.defaults.verbose,
    },

    relationalMigrator: {
      enabled: toBool(
        process.env[ENV.ORBIT_RM_ENABLED] ?? file.relationalMigrator?.enabled,
        DEFAULTS.relationalMigrator.enabled,
      ),
      url:
        process.env[ENV.ORBIT_RM_URL] ??
        file.relationalMigrator?.url ??
        DEFAULTS.relationalMigrator.url,
      timeout: toInt(
        process.env[ENV.ORBIT_RM_TIMEOUT] ?? file.relationalMigrator?.timeout,
        DEFAULTS.relationalMigrator.timeout,
      ),
    },
  };
}

/**
 * Check if Atlas credentials are configured.
 */
export function hasAtlasCredentials(config: ResolvedOrbitConfig): boolean {
  return !!(config.atlas.publicKey && config.atlas.privateKey);
}

/**
 * Check if LLM is configured (has API key or is Ollama).
 */
export function hasLlmConfig(config: ResolvedOrbitConfig): boolean {
  if (config.llm.provider === "ollama") return true;
  return !!config.llm.apiKey;
}
