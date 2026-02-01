import type {
  AtlasConfig,
  AtlasApiErrorBody,
  ResolvedAtlasConfig,
  RequestOptions,
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
} from "../types/index.js";
import { resolveConfig } from "../auth/index.js";
import { parseDigestChallenge, computeDigestAuth } from "../auth/index.js";
import { AtlasApiError } from "../errors/index.js";

const USER_AGENT = "OrbitAI/1.0";

/**
 * HTTP client for the MongoDB Atlas Admin API v2.
 *
 * Handles Digest authentication, rate-limit retries, and request/response formatting.
 * This is the single point of contact with the Atlas API — all domain modules use this.
 */
export class AtlasClient {
  private readonly config: ResolvedAtlasConfig;

  constructor(config?: Partial<AtlasConfig>) {
    this.config = resolveConfig(config);
  }

  /** The resolved base URL. */
  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /** The default org ID if configured. */
  get orgId(): string | undefined {
    return this.config.orgId;
  }

  /** The default group (project) ID if configured. */
  get groupId(): string | undefined {
    return this.config.groupId;
  }

  /**
   * Execute a request against the Atlas Admin API.
   * Handles Digest auth challenge/response automatically.
   */
  async request<T = unknown>(options: RequestOptions): Promise<ApiResponse<T>> {
    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.headers);
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;

    let lastError: Error | null = null;
    const maxAttempts = this.config.retryOnRateLimit
      ? this.config.maxRetries + 1
      : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // First request — may get 401 Digest challenge
        const response = await this.fetch(url, {
          method: options.method,
          headers,
          body: options.body ? JSON.stringify(options.body) : undefined,
          timeoutMs,
        });

        // Handle Digest auth challenge
        if (response.status === 401) {
          const wwwAuth = response.headers.get("www-authenticate") ?? "";
          if (wwwAuth.toLowerCase().startsWith("digest")) {
            const challenge = parseDigestChallenge(wwwAuth);
            const uri = new URL(url).pathname + new URL(url).search;
            const authHeader = computeDigestAuth(
              this.config.publicKey,
              this.config.privateKey,
              options.method,
              uri,
              challenge,
            );
            headers["authorization"] = authHeader;

            // Retry with auth
            const authedResponse = await this.fetch(url, {
              method: options.method,
              headers,
              body: options.body ? JSON.stringify(options.body) : undefined,
              timeoutMs,
            });
            return await this.handleResponse<T>(authedResponse, options);
          }
        }

        // Handle rate limiting
        if (response.status === 429 && this.config.retryOnRateLimit) {
          const retryAfter = response.headers.get("retry-after");
          const waitMs = retryAfter
            ? parseInt(retryAfter, 10) * 1000
            : Math.min(1000 * Math.pow(2, attempt), 30_000);
          await sleep(waitMs);
          lastError = new AtlasApiError(429, null, options.path);
          continue;
        }

        return await this.handleResponse<T>(response, options);
      } catch (err) {
        if (err instanceof AtlasApiError) throw err;
        lastError = err instanceof Error ? err : new Error(String(err));
        // Retry on network errors
        if (attempt < maxAttempts - 1) {
          await sleep(Math.min(1000 * Math.pow(2, attempt), 30_000));
          continue;
        }
      }
    }

    throw lastError ?? new Error("Request failed after all retries");
  }

  /**
   * Convenience method for GET requests.
   */
  async get<T = unknown>(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    const resp = await this.request<T>({ method: "GET", path, query });
    return resp.data;
  }

  /**
   * Convenience method for paginated GET requests.
   * Returns all results by following pagination links.
   */
  async list<T = unknown>(
    path: string,
    params?: PaginationParams & Record<string, string | number | boolean | undefined>,
  ): Promise<PaginatedResponse<T>> {
    const query: Record<string, string | number | boolean | undefined> = {
      ...params,
    };
    const resp = await this.request<PaginatedResponse<T>>({
      method: "GET",
      path,
      query,
    });
    return resp.data;
  }

  /**
   * Convenience method for POST requests.
   */
  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    const resp = await this.request<T>({ method: "POST", path, body });
    return resp.data;
  }

  /**
   * Convenience method for PUT requests.
   */
  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    const resp = await this.request<T>({ method: "PUT", path, body });
    return resp.data;
  }

  /**
   * Convenience method for PATCH requests.
   */
  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    const resp = await this.request<T>({ method: "PATCH", path, body });
    return resp.data;
  }

  /**
   * Convenience method for DELETE requests.
   */
  async delete<T = unknown>(path: string): Promise<T> {
    const resp = await this.request<T>({ method: "DELETE", path });
    return resp.data;
  }

  // ---- internal ----

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const url = new URL(path, this.config.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const mediaType = `application/vnd.atlas.${this.config.apiVersion}+json`;
    return {
      accept: mediaType,
      "content-type": mediaType,
      "user-agent": USER_AGENT,
      ...extra,
    };
  }

  private async fetch(
    url: string,
    options: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeoutMs: number;
    },
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      return await fetch(url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async handleResponse<T>(
    response: Response,
    options: RequestOptions,
  ): Promise<ApiResponse<T>> {
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    if (!response.ok) {
      let body: AtlasApiErrorBody | null = null;
      try {
        body = (await response.json()) as AtlasApiErrorBody;
      } catch {
        // Response body may not be JSON
      }
      throw new AtlasApiError(response.status, body, options.path);
    }

    // Some DELETE responses have no body
    let data: T;
    const contentType = response.headers.get("content-type") ?? "";
    if (
      response.status === 204 ||
      !contentType.includes("json")
    ) {
      data = {} as T;
    } else {
      data = (await response.json()) as T;
    }

    return { status: response.status, data, headers: responseHeaders };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
