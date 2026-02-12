// Client
export { AtlasClient, RelationalMigratorClient } from "./client/index.js";

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
} from "./config/index.js";

export type {
  LlmProviderName,
  OutputFormat,
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
export {
  AtlasApiError,
  AtlasConfigError,
  RelationalMigratorError,
  RelationalMigratorUnavailableError,
  RelationalMigratorConfigError,
} from "./errors/index.js";

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
  // Relational Migrator types
  RelationalMigratorConfig,
  ResolvedRelationalMigratorConfig,
  RelationalMigratorErrorBody,
  RelationalDatabaseType,
  ProjectSummary,
  Project,
  MappingRule,
  JdbcConnection,
  MongoDBConnection,
  MigrationJob,
  JobStatus,
  SystemInfo,
  HealthStatus,
} from "./types/index.js";
