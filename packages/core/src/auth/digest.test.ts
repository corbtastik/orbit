import { describe, it, expect } from "vitest";
import { parseDigestChallenge, computeDigestAuth } from "./digest.js";

describe("parseDigestChallenge", () => {
  it("parses quoted values from a Digest challenge header", () => {
    const header =
      'Digest realm="MMS Public API", nonce="abc123", qop="auth", algorithm="MD5"';
    const result = parseDigestChallenge(header);
    expect(result.realm).toBe("MMS Public API");
    expect(result.nonce).toBe("abc123");
    expect(result.qop).toBe("auth");
    expect(result.algorithm).toBe("MD5");
  });

  it("parses unquoted values", () => {
    const header = "Digest realm=TestRealm, nonce=xyz, qop=auth";
    const result = parseDigestChallenge(header);
    expect(result.realm).toBe("TestRealm");
    expect(result.nonce).toBe("xyz");
  });

  it("defaults qop to auth when not present", () => {
    const header = 'Digest realm="test", nonce="n1"';
    const result = parseDigestChallenge(header);
    expect(result.qop).toBe("auth");
  });

  it("captures opaque when present", () => {
    const header =
      'Digest realm="r", nonce="n", qop="auth", opaque="opq123"';
    const result = parseDigestChallenge(header);
    expect(result.opaque).toBe("opq123");
  });
});

describe("computeDigestAuth", () => {
  const challenge = {
    realm: "MMS Public API",
    nonce: "test-nonce",
    qop: "auth" as const,
    algorithm: "MD5",
  };

  it("returns a Digest authorization header string", () => {
    const header = computeDigestAuth(
      "user",
      "pass",
      "GET",
      "/api/atlas/v2",
      challenge,
    );
    expect(header).toMatch(/^Digest username="user"/);
    expect(header).toContain('realm="MMS Public API"');
    expect(header).toContain('nonce="test-nonce"');
    expect(header).toContain('uri="/api/atlas/v2"');
    expect(header).toContain("algorithm=MD5");
    expect(header).toContain("qop=auth");
    expect(header).toMatch(/nc=[0-9a-f]{8}/);
    expect(header).toMatch(/cnonce="[0-9a-f]+"/);
    expect(header).toMatch(/response="[0-9a-f]{32}"/);
  });

  it("includes opaque when present in challenge", () => {
    const withOpaque = { ...challenge, opaque: "opq456" };
    const header = computeDigestAuth(
      "user",
      "pass",
      "POST",
      "/api/test",
      withOpaque,
    );
    expect(header).toContain('opaque="opq456"');
  });

  it("increments nonce count on each call", () => {
    const h1 = computeDigestAuth("u", "p", "GET", "/a", challenge);
    const h2 = computeDigestAuth("u", "p", "GET", "/a", challenge);
    const nc1 = h1.match(/nc=([0-9a-f]{8})/)![1];
    const nc2 = h2.match(/nc=([0-9a-f]{8})/)![1];
    expect(parseInt(nc2, 16)).toBeGreaterThan(parseInt(nc1, 16));
  });
});
