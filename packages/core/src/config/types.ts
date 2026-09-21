/**
 * Unified configuration types for OrbitAI.
 *
 * Both MCP Server and CLI use this shared configuration structure.
 * Config file: ~/.orbit-ai/config.json
 */

import { homedir } from "node:os";
import { join } from "node:path";

/** Directory for orbit-ai configuration files. */
export const CONFIG_DIR = join(homedir(), ".orbit-ai");

/** Default config file path. */
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/** LLM provider identifiers. */
export type LlmProviderName = "anthropic" | "openai" | "google" | "ollama";

/** Output format options. */
export type OutputFormat = "markdown" | "json" | "table";

/**
 * Atlas API credentials for a single profile.
 */
export interface AtlasProfile {
  publicKey: string;
  privateKey: string;
  orgId?: string;
  groupId?: string;
  baseUrl?: string;
}

/**
 * Atlas API configuration.
 *
 * Supports two formats:
 * 1. Legacy single-credential format (publicKey, privateKey at root)
 * 2. Multi-profile format (default + profiles map)
 *
 * Both can coexist - legacy credentials become the "default" profile.
 */
export interface AtlasConfigSection {
  /** Legacy: single public key (becomes default profile) */
  publicKey?: string;
  /** Legacy: single private key (becomes default profile) */
  privateKey?: string;
  /** Legacy: default org ID */
  orgId?: string;
  /** Legacy: default group/project ID */
  groupId?: string;
  /** Legacy: API base URL */
  baseUrl?: string;
  /** Name of the default profile to use when none specified */
  default?: string;
  /** Named Atlas profiles for cross-org operations */
  profiles?: Record<string, AtlasProfile>;
}

/**
 * MongoDB connection configuration.
 */
export interface MongoDbConfigSection {
  /** Default connection string (used when no connection name specified). */
  default?: string;
  /** Named connections for multi-database workflows. */
  connections?: Record<string, string>;
}

/**
 * MCP Server configuration.
 */
export interface ServerConfigSection {
  /** Block write operations when true. */
  readOnly?: boolean;
  /** Enable HTTP transport (vs stdio). */
  http?: boolean;
  /** HTTP port. Default: 3600 */
  port?: number;
  /** HTTP bind address. Default: 127.0.0.1 */
  host?: string;
  /**
   * Host header allowlist for DNS rebinding protection.
   * Empty (default) keeps the SDK behaviour: localhost hostnames only.
   */
  allowedHosts?: string[];
  /**
   * CORS origin allowlist for browser-based clients.
   * Empty (default) disables CORS entirely. "*" allows any origin.
   */
  corsOrigins?: string[];
}

/**
 * LLM provider configuration.
 */
export interface LlmConfigSection {
  /** Provider name: anthropic, openai, google, ollama */
  provider?: LlmProviderName;
  /** API key for the provider. */
  apiKey?: string;
  /** Model name. */
  model?: string;
  /** Custom API base URL (for proxies or Ollama). */
  baseUrl?: string;
  /** Max response tokens. Default: 4096 */
  maxTokens?: number;
  /**
   * Sampling temperature. No default — left unset unless configured.
   * Current Anthropic models reject it, so the Anthropic provider omits it
   * from the request when undefined.
   */
  temperature?: number;
}

/**
 * MCP client configuration (CLI connecting to server).
 */
export interface McpConfigSection {
  /** MCP server URL. Default: http://127.0.0.1:3600/mcp */
  url?: string;
  /** Force stdio transport (skip HTTP attempt). */
  forceStdio?: boolean;
  /** HTTP connection timeout in ms. Default: 2000 */
  httpTimeout?: number;
}

/**
 * CLI default behavior.
 */
export interface DefaultsConfigSection {
  /** Output format. Default: markdown */
  outputFormat?: OutputFormat;
  /** Max tool call loops. Default: 10 */
  maxToolTurns?: number;
  /** Show verbose output. Default: false */
  verbose?: boolean;
}

/**
 * Complete OrbitAI configuration structure.
 *
 * This is the shape of ~/.orbit-ai/config.json
 */
export interface OrbitConfig {
  atlas?: AtlasConfigSection;
  mongodb?: MongoDbConfigSection;
  server?: ServerConfigSection;
  llm?: LlmConfigSection;
  mcp?: McpConfigSection;
  defaults?: DefaultsConfigSection;
}

/**
 * Resolved Atlas profile with baseUrl defaulted.
 */
export interface ResolvedAtlasProfile {
  publicKey: string;
  privateKey: string;
  orgId?: string;
  groupId?: string;
  baseUrl: string;
}

/**
 * Resolved configuration with all values populated.
 */
export interface ResolvedOrbitConfig {
  atlas: {
    /** Name of the default profile */
    default: string;
    /** All resolved Atlas profiles */
    profiles: Record<string, ResolvedAtlasProfile>;
  };
  mongodb: {
    default?: string;
    connections: Record<string, string>;
  };
  server: Required<ServerConfigSection>;
  llm: Required<
    Omit<LlmConfigSection, "apiKey" | "baseUrl" | "temperature">
  > & {
    apiKey?: string;
    baseUrl?: string;
    /** Stays undefined unless explicitly set in the config file. */
    temperature?: number;
  };
  mcp: Required<McpConfigSection>;
  defaults: Required<DefaultsConfigSection>;
}

/**
 * Environment variable names.
 */
export const ENV = {
  // Atlas credentials (legacy single-profile)
  ATLAS_PUBLIC_KEY: "ATLAS_PUBLIC_KEY",
  ATLAS_PRIVATE_KEY: "ATLAS_PRIVATE_KEY",
  ATLAS_ORG_ID: "ATLAS_ORG_ID",
  ATLAS_GROUP_ID: "ATLAS_GROUP_ID",
  ATLAS_BASE_URL: "ATLAS_BASE_URL",
  // Atlas multi-profile pattern: ATLAS_<PROFILE>_PUBLIC_KEY, ATLAS_<PROFILE>_PRIVATE_KEY
  ATLAS_PROFILE_SUFFIX_PUBLIC: "_PUBLIC_KEY",
  ATLAS_PROFILE_SUFFIX_PRIVATE: "_PRIVATE_KEY",
  ATLAS_PROFILE_SUFFIX_ORG: "_ORG_ID",
  ATLAS_PROFILE_SUFFIX_GROUP: "_GROUP_ID",
  ATLAS_PROFILE_SUFFIX_BASE_URL: "_BASE_URL",
  // Default profile name
  ATLAS_DEFAULT_PROFILE: "ATLAS_DEFAULT_PROFILE",

  // MongoDB
  MONGODB_CONNECTION_STRING: "MONGODB_CONNECTION_STRING",
  MONGODB_CONN_PREFIX: "MONGODB_CONN_",

  // Server
  ORBIT_READ_ONLY: "ORBIT_READ_ONLY",
  ORBIT_MCP_HTTP: "ORBIT_MCP_HTTP",
  ORBIT_MCP_PORT: "ORBIT_MCP_PORT",
  ORBIT_MCP_HOST: "ORBIT_MCP_HOST",
  ORBIT_MCP_ALLOWED_HOSTS: "ORBIT_MCP_ALLOWED_HOSTS",
  ORBIT_MCP_CORS_ORIGINS: "ORBIT_MCP_CORS_ORIGINS",

  // LLM provider
  ORBIT_LLM_PROVIDER: "ORBIT_LLM_PROVIDER",
  ORBIT_LLM_API_KEY: "ORBIT_LLM_API_KEY",
  ORBIT_LLM_MODEL: "ORBIT_LLM_MODEL",
  ORBIT_LLM_BASE_URL: "ORBIT_LLM_BASE_URL",
  ORBIT_LLM_MAX_TOKENS: "ORBIT_LLM_MAX_TOKENS",

  // Provider-specific API keys
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  OPENAI_API_KEY: "OPENAI_API_KEY",
  GOOGLE_API_KEY: "GOOGLE_API_KEY",

  // MCP client
  ORBIT_MCP_URL: "ORBIT_MCP_URL",
  ORBIT_MCP_STDIO: "ORBIT_MCP_STDIO",
  ORBIT_MCP_HTTP_TIMEOUT: "ORBIT_MCP_HTTP_TIMEOUT",
} as const;

/**
 * Default values.
 */
export const DEFAULTS = {
  atlas: {
    baseUrl: "https://cloud.mongodb.com",
  },
  server: {
    readOnly: false,
    http: false,
    port: 3600,
    host: "127.0.0.1",
    allowedHosts: [] as string[],
    corsOrigins: [] as string[],
  },
  llm: {
    provider: "anthropic" as LlmProviderName,
    maxTokens: 4096,
  },
  mcp: {
    url: "http://127.0.0.1:3600/mcp",
    forceStdio: false,
    httpTimeout: 2000,
  },
  defaults: {
    outputFormat: "markdown" as OutputFormat,
    maxToolTurns: 10,
    verbose: false,
  },
  /**
   * Default model per provider — the single source of truth.
   *
   * Provider classes deliberately have no fallback models of their own; the
   * resolved config always supplies one. Update models here and nowhere else.
   */
  providerModels: {
    anthropic: "claude-opus-5",
    openai: "gpt-4o",
    google: "gemini-2.5-flash",
    ollama: "llama3.1",
  } as Record<LlmProviderName, string>,
} as const;
