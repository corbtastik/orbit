/**
 * Tests for the HTTP transport's CORS middleware.
 */

import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { createCorsMiddleware } from "./http-server.js";

/** Build a minimal Express-like req/res pair. */
function mockExchange(method: string, headers: Record<string, string | undefined> = {}) {
  const setHeaders: Record<string, string> = {};

  const req = { method, headers } as unknown as Request;

  const res = {
    setHeader: vi.fn((name: string, value: string) => {
      setHeaders[name] = value;
    }),
    status: vi.fn(() => res),
    end: vi.fn(),
  } as unknown as Response & { status: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };

  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next, setHeaders };
}

describe("createCorsMiddleware", () => {
  describe("allowed origins", () => {
    it("echoes an allowlisted origin and exposes the session header", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, next, setHeaders } = mockExchange("POST", {
        origin: "http://localhost:5173",
      });

      middleware(req, res, next);

      expect(setHeaders["Access-Control-Allow-Origin"]).toBe("http://localhost:5173");
      expect(setHeaders["Vary"]).toBe("Origin");
      expect(setHeaders["Access-Control-Expose-Headers"]).toContain("mcp-session-id");
      expect(next).toHaveBeenCalled();
    });

    it("echoes any origin when '*' is allowed", () => {
      const middleware = createCorsMiddleware(["*"]);
      const { req, res, next, setHeaders } = mockExchange("POST", {
        origin: "http://anything.example",
      });

      middleware(req, res, next);

      expect(setHeaders["Access-Control-Allow-Origin"]).toBe("http://anything.example");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("disallowed origins", () => {
    it("omits CORS headers for an origin not on the allowlist", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, next, setHeaders } = mockExchange("POST", {
        origin: "http://evil.example",
      });

      middleware(req, res, next);

      expect(setHeaders["Access-Control-Allow-Origin"]).toBeUndefined();
      // The request still proceeds; the browser enforces the policy.
      expect(next).toHaveBeenCalled();
    });

    it("omits CORS headers when no Origin header is present", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, next, setHeaders } = mockExchange("POST");

      middleware(req, res, next);

      expect(setHeaders["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });

  describe("preflight", () => {
    it("answers OPTIONS with 204 and does not call next", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, next, setHeaders } = mockExchange("OPTIONS", {
        origin: "http://localhost:5173",
      });

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
      expect(setHeaders["Access-Control-Allow-Methods"]).toContain("DELETE");
      expect(setHeaders["Access-Control-Max-Age"]).toBe("86400");
    });

    it("reflects the requested headers on preflight", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, next, setHeaders } = mockExchange("OPTIONS", {
        origin: "http://localhost:5173",
        "access-control-request-headers": "mcp-session-id, content-type",
      });

      middleware(req, res, next);

      expect(setHeaders["Access-Control-Allow-Headers"]).toBe("mcp-session-id, content-type");
    });

    it("falls back to a default header list when none are requested", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, setHeaders, next } = mockExchange("OPTIONS", {
        origin: "http://localhost:5173",
      });

      middleware(req, res, next);

      expect(setHeaders["Access-Control-Allow-Headers"]).toContain("mcp-session-id");
      expect(setHeaders["Access-Control-Allow-Headers"]).toContain("content-type");
    });

    it("answers OPTIONS with 204 but no CORS headers for a disallowed origin", () => {
      const middleware = createCorsMiddleware(["http://localhost:5173"]);
      const { req, res, next, setHeaders } = mockExchange("OPTIONS", {
        origin: "http://evil.example",
      });

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(setHeaders["Access-Control-Allow-Origin"]).toBeUndefined();
      expect(setHeaders["Access-Control-Allow-Methods"]).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
