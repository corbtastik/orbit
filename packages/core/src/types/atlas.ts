/**
 * Core types for the Atlas Admin API v2.
 */

/** Configuration for connecting to the Atlas Admin API. */
export interface AtlasConfig {
  /** Atlas API public key (username for Digest auth). */
  publicKey: string;
  /** Atlas API private key (password for Digest auth). */
  privateKey: string;
  /** Default organization ID. */
  orgId?: string;
  /** Default project (group) ID. */
  groupId?: string;
  /** Base URL for the Atlas Admin API. */
  baseUrl?: string;
  /** API version date string for the Accept header. */
  apiVersion?: string;
  /** Enable automatic retry on 429 rate-limit responses. */
  retryOnRateLimit?: boolean;
  /** Maximum number of retries for transient errors. */
  maxRetries?: number;
  /** Request timeout in milliseconds. */
  timeoutMs?: number;
}

/** Resolved config with all defaults applied. */
export interface ResolvedAtlasConfig {
  publicKey: string;
  privateKey: string;
  orgId?: string;
  groupId?: string;
  baseUrl: string;
  apiVersion: string;
  retryOnRateLimit: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/** Standard pagination parameters accepted by list endpoints. */
export interface PaginationParams {
  pageNum?: number;
  itemsPerPage?: number;
  includeCount?: boolean;
}

/** Paginated response wrapper returned by list endpoints. */
export interface PaginatedResponse<T> {
  results: T[];
  totalCount?: number;
  links?: Array<{ rel: string; href: string }>;
}

/** Standard Atlas API error response body. */
export interface AtlasApiErrorBody {
  detail?: string;
  error?: number;
  errorCode?: string;
  reason?: string;
  parameters?: unknown[];
}

/** HTTP methods used by the Atlas API. */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Options for a single API request. */
export interface RequestOptions {
  method: HttpMethod;
  path: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  /** Override the default timeout for this request. */
  timeoutMs?: number;
}

/** Raw API response before domain-level parsing. */
export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}
