// Client
export { AtlasClient, AtlasClientManager } from "./client/index.js";

// Auth
export { resolveConfig } from "./auth/index.js";

// Config (unified)
export {
  CONFIG_DIR,
  CONFIG_FILE,
  ENV,
  DEFAULTS,
  loadConfigFile,
  loadConfig,
  hasAtlasCredentials,
  hasLlmConfig,
  getDefaultAtlasProfile,
  getAtlasProfile,
  listAtlasProfiles,
} from "./config/index.js";

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
} from "./config/index.js";

// Errors
export { AtlasApiError, AtlasConfigError } from "./errors/index.js";

// Domains
export * from "./domains/index.js";

// Types
export type {
  AtlasConfig,
  ResolvedAtlasConfig,
  PaginationParams,
  PaginatedResponse,
  AtlasApiErrorBody,
  HttpMethod,
  RequestOptions,
  ApiResponse,
} from "./types/index.js";
