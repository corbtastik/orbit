import type { AtlasApiErrorBody } from "../types/index.js";

/**
 * Error thrown when an Atlas Admin API request fails.
 */
export class AtlasApiError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly detail: string;
  readonly suggestion: string;

  constructor(
    status: number,
    body: AtlasApiErrorBody | null,
    context?: string,
  ) {
    const errorCode = body?.errorCode ?? `HTTP_${status}`;
    const detail = body?.detail ?? body?.reason ?? "Unknown error";
    const message = context
      ? `Atlas API error (${errorCode}): ${detail} [${context}]`
      : `Atlas API error (${errorCode}): ${detail}`;

    super(message);
    this.name = "AtlasApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
    this.suggestion = suggestionForStatus(status);
  }

  toJSON() {
    return {
      error: {
        code: this.errorCode,
        message: this.detail,
        atlas_error_code: this.status,
        suggestion: this.suggestion,
      },
    };
  }
}

/**
 * Error thrown when the client configuration is invalid or missing.
 */
export class AtlasConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AtlasConfigError";
  }
}

function suggestionForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Check request parameters and body for validation errors.";
    case 401:
      return "Verify your Atlas API public/private key pair.";
    case 403:
      return "Your API key may lack the required role. Check project/org permissions.";
    case 404:
      return "The requested resource was not found. Use a list action to discover available resources.";
    case 409:
      return "The resource is in a conflicting state. It may be updating or already exists.";
    case 429:
      return "Rate limit exceeded (100 req/min/project). Wait and retry.";
    default:
      return status >= 500
        ? "Atlas server error. Retry the request."
        : "Check the Atlas API documentation for this endpoint.";
  }
}
