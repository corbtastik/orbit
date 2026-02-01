import { homedir } from "node:os";
import { join } from "node:path";

/** Directory for orbit-ai configuration files. */
export const CONFIG_DIR = join(homedir(), ".orbit-ai");

/** Default config file path. */
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

/** Environment variable names. */
export const ENV = {
  // Atlas credentials
  ATLAS_PUBLIC_KEY: "ATLAS_PUBLIC_KEY",
  ATLAS_PRIVATE_KEY: "ATLAS_PRIVATE_KEY",
  ATLAS_ORG_ID: "ATLAS_ORG_ID",
  ATLAS_GROUP_ID: "ATLAS_GROUP_ID",
  ATLAS_BASE_URL: "ATLAS_BASE_URL",

  // LLM provider
  LLM_PROVIDER: "ORBIT_LLM_PROVIDER",
  LLM_API_KEY: "ORBIT_LLM_API_KEY",
  LLM_MODEL: "ORBIT_LLM_MODEL",
  LLM_BASE_URL: "ORBIT_LLM_BASE_URL",
  LLM_MAX_TOKENS: "ORBIT_LLM_MAX_TOKENS",

  // Convenience keys per provider
  ANTHROPIC_API_KEY: "ANTHROPIC_API_KEY",
  OPENAI_API_KEY: "OPENAI_API_KEY",
  GOOGLE_API_KEY: "GOOGLE_API_KEY",
} as const;

/** Default LLM settings. */
export const LLM_DEFAULTS = {
  provider: "anthropic" as const,
  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
  temperature: 0,
};

/** Default CLI behavior. */
export const CLI_DEFAULTS = {
  outputFormat: "markdown" as const,
  maxToolTurns: 10,
  verbose: false,
};

/** Atlas cloud API base URL. */
export const ATLAS_BASE_URL = "https://cloud.mongodb.com";
