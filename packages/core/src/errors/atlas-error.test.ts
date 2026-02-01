import { describe, it, expect } from "vitest";
import { AtlasApiError, AtlasConfigError } from "./atlas-error.js";

// ---------------------------------------------------------------------------
// AtlasApiError
// ---------------------------------------------------------------------------
describe("AtlasApiError", () => {
  it("formats the error message from errorCode and detail", () => {
    const err = new AtlasApiError(400, {
      errorCode: "INVALID_PARAM",
      detail: "clusterName is required",
    });

    expect(err.message).toBe(
      "Atlas API error (INVALID_PARAM): clusterName is required",
    );
    expect(err.name).toBe("AtlasApiError");
    expect(err.status).toBe(400);
    expect(err.errorCode).toBe("INVALID_PARAM");
    expect(err.detail).toBe("clusterName is required");
  });

  it("includes context in the message when provided", () => {
    const err = new AtlasApiError(
      404,
      { errorCode: "NOT_FOUND", detail: "Cluster not found" },
      "GET /clusters/xyz",
    );

    expect(err.message).toBe(
      "Atlas API error (NOT_FOUND): Cluster not found [GET /clusters/xyz]",
    );
  });

  it("handles null body by using HTTP status fallback", () => {
    const err = new AtlasApiError(502, null);

    expect(err.errorCode).toBe("HTTP_502");
    expect(err.detail).toBe("Unknown error");
    expect(err.message).toBe("Atlas API error (HTTP_502): Unknown error");
  });

  it("uses reason as detail fallback when detail is not present", () => {
    const err = new AtlasApiError(400, {
      errorCode: "VALIDATION",
      reason: "Field validation failed",
    });

    expect(err.detail).toBe("Field validation failed");
  });

  it("is an instance of Error", () => {
    const err = new AtlasApiError(500, null);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AtlasApiError);
  });

  // ---- status-based suggestions ----

  it("suggests verifying API keys for 401", () => {
    const err = new AtlasApiError(401, null);
    expect(err.suggestion).toContain("Verify your Atlas API");
  });

  it("suggests checking permissions for 403", () => {
    const err = new AtlasApiError(403, null);
    expect(err.suggestion).toContain("may lack the required role");
  });

  it("suggests resource not found for 404", () => {
    const err = new AtlasApiError(404, null);
    expect(err.suggestion).toContain("not found");
  });

  it("suggests rate limit for 429", () => {
    const err = new AtlasApiError(429, null);
    expect(err.suggestion).toContain("Rate limit");
  });

  it("suggests checking parameters for 400", () => {
    const err = new AtlasApiError(400, null);
    expect(err.suggestion).toContain("Check request parameters");
  });

  it("suggests conflict info for 409", () => {
    const err = new AtlasApiError(409, null);
    expect(err.suggestion).toContain("conflicting state");
  });

  it("suggests retry for 5xx errors", () => {
    const err = new AtlasApiError(500, null);
    expect(err.suggestion).toContain("server error");
  });

  it("provides generic suggestion for other status codes", () => {
    const err = new AtlasApiError(418, null);
    expect(err.suggestion).toContain("Atlas API documentation");
  });

  // ---- toJSON ----

  it("returns structured error object from toJSON()", () => {
    const err = new AtlasApiError(
      403,
      { errorCode: "FORBIDDEN", detail: "Access denied" },
      "POST /clusters",
    );

    expect(err.toJSON()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: "Access denied",
        atlas_error_code: 403,
        suggestion:
          "Your API key may lack the required role. Check project/org permissions.",
      },
    });
  });
});

// ---------------------------------------------------------------------------
// AtlasConfigError
// ---------------------------------------------------------------------------
describe("AtlasConfigError", () => {
  it("sets the name to AtlasConfigError", () => {
    const err = new AtlasConfigError("missing keys");
    expect(err.name).toBe("AtlasConfigError");
  });

  it("sets the message from the constructor argument", () => {
    const err = new AtlasConfigError("publicKey is required");
    expect(err.message).toBe("publicKey is required");
  });

  it("is an instance of Error", () => {
    const err = new AtlasConfigError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AtlasConfigError);
  });
});
