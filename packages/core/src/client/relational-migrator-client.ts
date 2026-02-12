import type {
  RelationalMigratorConfig,
  ResolvedRelationalMigratorConfig,
  RelationalMigratorErrorBody,
  SpringBootErrorBody,
  SystemInfo,
  HealthStatus,
} from "../types/relational-migrator.js";
import type { HttpMethod, RequestOptions, ApiResponse } from "../types/index.js";
import {
  RelationalMigratorError,
  RelationalMigratorUnavailableError,
} from "../errors/relational-migrator-error.js";

const USER_AGENT = "OrbitAI/1.0";

const DEFAULT_CONFIG: ResolvedRelationalMigratorConfig = {
  baseUrl: "http://127.0.0.1:8278",
  apiVersion: "v1",
  timeoutMs: 30000,
  enabled: true,
};

/**
 * HTTP client for the MongoDB Relational Migrator REST API.
 *
 * Unlike the Atlas client, this does not require authentication.
 * Relational Migrator runs locally and does not expose remote access by default.
 */
export class RelationalMigratorClient {
  private readonly config: ResolvedRelationalMigratorConfig;
  private available: boolean | null = null;

  constructor(config?: Partial<RelationalMigratorConfig>) {
    this.config = resolveConfig(config);
  }

  /** The resolved base URL. */
  get baseUrl(): string {
    return this.config.baseUrl;
  }

  /** The API version path segment. */
  get apiVersion(): string {
    return this.config.apiVersion;
  }

  /** Whether the integration is enabled. */
  get enabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if Relational Migrator is available at the configured URL.
   * Caches the result until reset.
   */
  async isAvailable(): Promise<boolean> {
    if (this.available !== null) {
      return this.available;
    }

    try {
      await this.get<HealthStatus>("/actuator/health");
      this.available = true;
      return true;
    } catch {
      this.available = false;
      return false;
    }
  }

  /**
   * Reset the availability cache.
   * Call this to force a fresh check on the next isAvailable() call.
   */
  resetAvailabilityCache(): void {
    this.available = null;
  }

  /**
   * Get system information including version, drivers, and features.
   */
  async getSystemInfo(): Promise<SystemInfo> {
    return this.get<SystemInfo>("/api/v1/info");
  }

  /**
   * Get health status.
   */
  async getHealth(): Promise<HealthStatus> {
    return this.get<HealthStatus>("/actuator/health");
  }

  /**
   * Execute a request against the Relational Migrator API.
   */
  async request<T = unknown>(options: RequestOptions): Promise<ApiResponse<T>> {
    if (!this.config.enabled) {
      throw new RelationalMigratorUnavailableError(
        this.config.baseUrl,
        new Error("Relational Migrator integration is disabled"),
      );
    }

    const url = this.buildUrl(options.path, options.query);
    const headers = this.buildHeaders(options.headers);
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;

    try {
      const response = await this.fetch(url, {
        method: options.method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
        timeoutMs,
      });

      return await this.handleResponse<T>(response, options);
    } catch (err) {
      if (err instanceof RelationalMigratorError) {
        throw err;
      }

      // Network errors indicate RM is unavailable
      if (err instanceof TypeError || (err instanceof Error && err.name === "AbortError")) {
        this.available = false;
        throw new RelationalMigratorUnavailableError(this.config.baseUrl, err as Error);
      }

      throw err;
    }
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
    return {
      accept: "application/json",
      "content-type": "application/json",
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
      let body: RelationalMigratorErrorBody | SpringBootErrorBody | null = null;
      try {
        body = (await response.json()) as RelationalMigratorErrorBody | SpringBootErrorBody;
      } catch {
        // Response body may not be JSON
      }
      throw new RelationalMigratorError(response.status, body, options.path);
    }

    // Handle empty responses (204, or empty body)
    let data: T;
    const contentType = response.headers.get("content-type") ?? "";
    const contentLength = response.headers.get("content-length");

    if (
      response.status === 204 ||
      contentLength === "0" ||
      !contentType.includes("json")
    ) {
      data = {} as T;
    } else {
      const text = await response.text();
      if (!text || text.trim() === "") {
        data = {} as T;
      } else {
        data = JSON.parse(text) as T;
      }
    }

    return { status: response.status, data, headers: responseHeaders };
  }
}

/**
 * Resolve configuration with defaults.
 */
function resolveConfig(
  config?: Partial<RelationalMigratorConfig>,
): ResolvedRelationalMigratorConfig {
  const baseUrl =
    process.env.ORBIT_RM_URL ??
    config?.baseUrl ??
    DEFAULT_CONFIG.baseUrl;

  const enabled =
    process.env.ORBIT_RM_ENABLED !== undefined
      ? process.env.ORBIT_RM_ENABLED !== "false"
      : config?.enabled ?? DEFAULT_CONFIG.enabled;

  const timeoutMs =
    process.env.ORBIT_RM_TIMEOUT !== undefined
      ? parseInt(process.env.ORBIT_RM_TIMEOUT, 10)
      : config?.timeoutMs ?? DEFAULT_CONFIG.timeoutMs;

  return {
    baseUrl,
    apiVersion: config?.apiVersion ?? DEFAULT_CONFIG.apiVersion,
    timeoutMs,
    enabled,
  };
}
