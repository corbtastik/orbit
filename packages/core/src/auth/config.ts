import type { AtlasConfig, ResolvedAtlasConfig } from "../types/index.js";
import { AtlasConfigError } from "../errors/index.js";

const DEFAULT_BASE_URL = "https://cloud.mongodb.com";
const DEFAULT_API_VERSION = "2025-03-12";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Resolve an AtlasConfig by applying defaults and validating required fields.
 * Reads from the provided config object first, then falls back to environment variables.
 */
export function resolveConfig(
  config?: Partial<AtlasConfig>,
): ResolvedAtlasConfig {
  const publicKey =
    config?.publicKey ?? process.env.ATLAS_PUBLIC_KEY ?? "";
  const privateKey =
    config?.privateKey ?? process.env.ATLAS_PRIVATE_KEY ?? "";

  if (!publicKey || !privateKey) {
    throw new AtlasConfigError(
      "Atlas API credentials are required. Provide publicKey/privateKey in config " +
        "or set ATLAS_PUBLIC_KEY and ATLAS_PRIVATE_KEY environment variables.",
    );
  }

  return {
    publicKey,
    privateKey,
    orgId: config?.orgId ?? process.env.ATLAS_ORG_ID,
    groupId: config?.groupId ?? process.env.ATLAS_GROUP_ID,
    baseUrl: config?.baseUrl ?? process.env.ATLAS_BASE_URL ?? DEFAULT_BASE_URL,
    apiVersion:
      config?.apiVersion ??
      process.env.ATLAS_API_VERSION ??
      DEFAULT_API_VERSION,
    retryOnRateLimit: config?.retryOnRateLimit ?? true,
    maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
    timeoutMs: config?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}
