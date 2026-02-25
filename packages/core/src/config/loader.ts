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
  type ResolvedAtlasProfile,
  type LlmProviderName,
} from "./types.js";

/**
 * Load configuration from the JSON config file.
 * Returns an empty object if the file doesn't exist.
 * Logs a warning and returns empty object if the file is corrupted.
 */
export function loadConfigFile(path = CONFIG_FILE): OrbitConfig {
  if (!existsSync(path)) return {};

  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Could not read config file "${path}": ${message}`);
    return {};
  }

  try {
    return JSON.parse(raw) as OrbitConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`Warning: Config file "${path}" contains invalid JSON: ${message}`);
    console.warn("Using default configuration. Please fix or delete the config file.");
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
 * Scan environment for Atlas profile variables.
 * Pattern: ATLAS_<PROFILE>_PUBLIC_KEY, ATLAS_<PROFILE>_PRIVATE_KEY
 *
 * Returns a map of profile name -> partial profile config from env.
 */
function scanAtlasProfiles(): Record<string, Partial<ResolvedAtlasProfile>> {
  const profiles: Record<string, Partial<ResolvedAtlasProfile>> = {};
  const publicKeySuffix = ENV.ATLAS_PROFILE_SUFFIX_PUBLIC;
  const privateKeySuffix = ENV.ATLAS_PROFILE_SUFFIX_PRIVATE;
  const orgIdSuffix = ENV.ATLAS_PROFILE_SUFFIX_ORG;
  const groupIdSuffix = ENV.ATLAS_PROFILE_SUFFIX_GROUP;
  const baseUrlSuffix = ENV.ATLAS_PROFILE_SUFFIX_BASE_URL;

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("ATLAS_") || !value) continue;

    // Skip legacy single-credential vars
    if (key === ENV.ATLAS_PUBLIC_KEY || key === ENV.ATLAS_PRIVATE_KEY ||
        key === ENV.ATLAS_ORG_ID || key === ENV.ATLAS_GROUP_ID ||
        key === ENV.ATLAS_BASE_URL || key === ENV.ATLAS_DEFAULT_PROFILE) {
      continue;
    }

    // Extract profile name from ATLAS_<PROFILE>_<SUFFIX>
    let profileName: string | null = null;
    let field: keyof ResolvedAtlasProfile | null = null;

    if (key.endsWith(publicKeySuffix)) {
      profileName = key.slice(6, -publicKeySuffix.length).toLowerCase();
      field = "publicKey";
    } else if (key.endsWith(privateKeySuffix)) {
      profileName = key.slice(6, -privateKeySuffix.length).toLowerCase();
      field = "privateKey";
    } else if (key.endsWith(orgIdSuffix)) {
      profileName = key.slice(6, -orgIdSuffix.length).toLowerCase();
      field = "orgId";
    } else if (key.endsWith(groupIdSuffix)) {
      profileName = key.slice(6, -groupIdSuffix.length).toLowerCase();
      field = "groupId";
    } else if (key.endsWith(baseUrlSuffix)) {
      profileName = key.slice(6, -baseUrlSuffix.length).toLowerCase();
      field = "baseUrl";
    }

    if (profileName && field) {
      if (!profiles[profileName]) {
        profiles[profileName] = {};
      }
      profiles[profileName][field] = value;
    }
  }

  return profiles;
}

/**
 * Resolve Atlas profiles from config file and environment variables.
 * Env vars override config file values.
 */
function resolveAtlasProfiles(
  file: OrbitConfig,
): { default: string; profiles: Record<string, ResolvedAtlasProfile> } {
  const profiles: Record<string, ResolvedAtlasProfile> = {};
  const envProfiles = scanAtlasProfiles();

  // 1. Add profiles from config file
  if (file.atlas?.profiles) {
    for (const [name, profile] of Object.entries(file.atlas.profiles)) {
      profiles[name] = {
        publicKey: profile.publicKey,
        privateKey: profile.privateKey,
        orgId: profile.orgId,
        groupId: profile.groupId,
        baseUrl: profile.baseUrl ?? DEFAULTS.atlas.baseUrl,
      };
    }
  }

  // 2. Create/merge "default" profile from legacy single-credential config
  const legacyPublicKey = process.env[ENV.ATLAS_PUBLIC_KEY] ?? file.atlas?.publicKey;
  const legacyPrivateKey = process.env[ENV.ATLAS_PRIVATE_KEY] ?? file.atlas?.privateKey;

  if (legacyPublicKey && legacyPrivateKey) {
    profiles["default"] = {
      publicKey: legacyPublicKey,
      privateKey: legacyPrivateKey,
      orgId: process.env[ENV.ATLAS_ORG_ID] ?? file.atlas?.orgId,
      groupId: process.env[ENV.ATLAS_GROUP_ID] ?? file.atlas?.groupId,
      baseUrl: process.env[ENV.ATLAS_BASE_URL] ?? file.atlas?.baseUrl ?? DEFAULTS.atlas.baseUrl,
    };
  }

  // 3. Merge env var profiles (override config file)
  for (const [name, envProfile] of Object.entries(envProfiles)) {
    if (!profiles[name]) {
      // Only create if we have at least public and private keys
      if (envProfile.publicKey && envProfile.privateKey) {
        profiles[name] = {
          publicKey: envProfile.publicKey,
          privateKey: envProfile.privateKey,
          orgId: envProfile.orgId,
          groupId: envProfile.groupId,
          baseUrl: envProfile.baseUrl ?? DEFAULTS.atlas.baseUrl,
        };
      }
    } else {
      // Merge env vars into existing profile (env overrides config)
      if (envProfile.publicKey) profiles[name].publicKey = envProfile.publicKey;
      if (envProfile.privateKey) profiles[name].privateKey = envProfile.privateKey;
      if (envProfile.orgId) profiles[name].orgId = envProfile.orgId;
      if (envProfile.groupId) profiles[name].groupId = envProfile.groupId;
      if (envProfile.baseUrl) profiles[name].baseUrl = envProfile.baseUrl;
    }
  }

  // 4. Determine default profile name
  const defaultProfileName =
    process.env[ENV.ATLAS_DEFAULT_PROFILE] ??
    file.atlas?.default ??
    "default";

  return {
    default: defaultProfileName,
    profiles,
  };
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

  // Resolve Atlas profiles from config file and env vars
  const atlas = resolveAtlasProfiles(file);

  return {
    atlas,

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
  };
}

/**
 * Check if Atlas credentials are configured.
 * Returns true if at least one profile has valid credentials.
 */
export function hasAtlasCredentials(config: ResolvedOrbitConfig): boolean {
  const profiles = config.atlas.profiles;
  return Object.values(profiles).some(
    (profile) => profile.publicKey && profile.privateKey
  );
}

/**
 * Get the default Atlas profile.
 * Returns undefined if no default profile is configured.
 */
export function getDefaultAtlasProfile(
  config: ResolvedOrbitConfig,
): ResolvedAtlasProfile | undefined {
  return config.atlas.profiles[config.atlas.default];
}

/**
 * Get an Atlas profile by name.
 * Falls back to default profile if name is not provided.
 * Returns undefined if profile not found.
 */
export function getAtlasProfile(
  config: ResolvedOrbitConfig,
  name?: string,
): ResolvedAtlasProfile | undefined {
  const profileName = name ?? config.atlas.default;
  return config.atlas.profiles[profileName];
}

/**
 * List all available Atlas profile names.
 */
export function listAtlasProfiles(config: ResolvedOrbitConfig): string[] {
  return Object.keys(config.atlas.profiles);
}

/**
 * Check if LLM is configured (has API key or is Ollama).
 */
export function hasLlmConfig(config: ResolvedOrbitConfig): boolean {
  if (config.llm.provider === "ollama") return true;
  return !!config.llm.apiKey;
}
