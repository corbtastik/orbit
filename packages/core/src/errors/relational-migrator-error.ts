import type {
  RelationalMigratorErrorBody,
  SpringBootErrorBody,
} from "../types/relational-migrator.js";

/**
 * Error thrown when a Relational Migrator API request fails.
 */
export class RelationalMigratorError extends Error {
  readonly status: number;
  readonly errorCode: string;
  readonly detail: string;
  readonly suggestion: string;
  readonly jobId: string | null;

  constructor(
    status: number,
    body: RelationalMigratorErrorBody | SpringBootErrorBody | null,
    context?: string,
  ) {
    const errorCode = `RM_${status}`;
    const detail = extractDetail(body);
    const jobId = isRMError(body) ? body.jobId ?? null : null;
    const message = context
      ? `Relational Migrator error (${errorCode}): ${detail} [${context}]`
      : `Relational Migrator error (${errorCode}): ${detail}`;

    super(message);
    this.name = "RelationalMigratorError";
    this.status = status;
    this.errorCode = errorCode;
    this.detail = detail;
    this.suggestion = suggestionForStatus(status);
    this.jobId = jobId;
  }

  toJSON() {
    return {
      error: {
        code: this.errorCode,
        message: this.detail,
        status: this.status,
        suggestion: this.suggestion,
        jobId: this.jobId,
      },
    };
  }
}

/**
 * Error thrown when Relational Migrator is not running or not reachable.
 */
export class RelationalMigratorUnavailableError extends Error {
  readonly baseUrl: string;

  constructor(baseUrl: string, cause?: Error) {
    const message = `Relational Migrator is not available at ${baseUrl}. ` +
      `Ensure the application is running and accessible.`;
    super(message, { cause });
    this.name = "RelationalMigratorUnavailableError";
    this.baseUrl = baseUrl;
  }

  toJSON() {
    return {
      error: {
        code: "RM_UNAVAILABLE",
        message: this.message,
        baseUrl: this.baseUrl,
        suggestion: "Start MongoDB Relational Migrator or check the configured URL.",
      },
    };
  }
}

/**
 * Error thrown when Relational Migrator configuration is invalid.
 */
export class RelationalMigratorConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RelationalMigratorConfigError";
  }
}

function isRMError(body: unknown): body is RelationalMigratorErrorBody {
  return body !== null && typeof body === "object" && "message" in body;
}

function extractDetail(
  body: RelationalMigratorErrorBody | SpringBootErrorBody | null,
): string {
  if (!body) {
    return "Unknown error";
  }

  // Check for RM-style error
  if ("message" in body && body.message) {
    return body.message;
  }

  // Check for Spring Boot error
  if ("error" in body && body.error) {
    return body.error;
  }

  return "Unknown error";
}

function suggestionForStatus(status: number): string {
  switch (status) {
    case 400:
      return "Check request parameters. The error message lists required fields.";
    case 403:
      return "Access denied. Remote access may be disabled in Relational Migrator settings.";
    case 404:
      return "The requested resource was not found. Verify the ID exists.";
    case 405:
      return "Method not allowed. Check the HTTP method (GET, POST, PUT, DELETE) for this endpoint.";
    case 409:
      return "Conflict. The resource may be in use or already exists.";
    case 500:
      return "Internal server error. Check Relational Migrator logs for details.";
    default:
      return status >= 500
        ? "Server error. Check Relational Migrator logs."
        : "Check the Relational Migrator API documentation.";
  }
}
