import type { AtlasClient } from "../client/index.js";
import type { HttpMethod, PaginationParams, PaginatedResponse } from "../types/index.js";

/**
 * Describes a single API operation that a domain tool can dispatch.
 */
export interface OperationSpec {
  /** The HTTP method. */
  method: HttpMethod;
  /**
   * URL path template with placeholders like {groupId}, {clusterName}.
   * These get resolved from the params object at dispatch time.
   */
  path: string;
  /** Whether this operation sends a request body. */
  hasBody?: boolean;
}

/**
 * A map of action names to their operation specs.
 * This is the contract between the MCP tool layer and the domain layer.
 */
export type ActionMap = Record<string, OperationSpec>;

/**
 * Common parameters passed to every domain operation.
 */
export interface DomainParams {
  /** The action name from the tool's action parameter. */
  action: string;
  /** Path parameters (groupId, orgId, clusterName, etc). */
  pathParams?: Record<string, string>;
  /** Query parameters (pagination, filters, etc). */
  query?: Record<string, string | number | boolean | undefined>;
  /** Request body for POST/PUT/PATCH operations. */
  body?: unknown;
}

/**
 * Resolve a path template by replacing {placeholders} with actual values.
 */
export function resolvePath(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (!value) {
      throw new Error(`Missing required path parameter: ${key}`);
    }
    return encodeURIComponent(value);
  });
}

/**
 * Execute a domain operation by looking up the action in the action map
 * and dispatching through the AtlasClient.
 */
export async function dispatch<T = unknown>(
  client: AtlasClient,
  actions: ActionMap,
  params: DomainParams,
): Promise<T> {
  const spec = actions[params.action];
  if (!spec) {
    const available = Object.keys(actions).join(", ");
    throw new Error(
      `Unknown action '${params.action}'. Available actions: ${available}`,
    );
  }

  const path = resolvePath(spec.path, params.pathParams ?? {});

  if (spec.method === "GET") {
    return client.get<T>(path, params.query);
  }

  const resp = await client.request<T>({
    method: spec.method,
    path,
    query: params.query,
    body: spec.hasBody ? params.body : undefined,
  });

  return resp.data;
}
