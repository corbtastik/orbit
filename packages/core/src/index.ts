// Client
export { AtlasClient } from "./client/index.js";

// Auth
export { resolveConfig } from "./auth/index.js";

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
