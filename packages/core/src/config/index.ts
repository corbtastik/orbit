/**
 * Unified configuration module exports.
 */

export {
  CONFIG_DIR,
  CONFIG_FILE,
  ENV,
  DEFAULTS,
} from "./types.js";

export type {
  LlmProviderName,
  OutputFormat,
  AtlasProfile,
  ResolvedAtlasProfile,
  AtlasConfigSection,
  MongoDbConfigSection,
  ServerConfigSection,
  LlmConfigSection,
  McpConfigSection,
  DefaultsConfigSection,
  OrbitConfig,
  ResolvedOrbitConfig,
} from "./types.js";

export {
  loadConfigFile,
  loadConfig,
  hasAtlasCredentials,
  hasLlmConfig,
  getDefaultAtlasProfile,
  getAtlasProfile,
  listAtlasProfiles,
} from "./loader.js";
