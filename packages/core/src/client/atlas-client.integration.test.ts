import { describe, it, expect } from "vitest";
import { AtlasClient } from "./atlas-client.js";

const hasCredentials =
  !!process.env.ATLAS_PUBLIC_KEY && !!process.env.ATLAS_PRIVATE_KEY;

describe.skipIf(!hasCredentials)("AtlasClient integration", () => {
  const client = hasCredentials
    ? new AtlasClient({
        publicKey: process.env.ATLAS_PUBLIC_KEY!,
        privateKey: process.env.ATLAS_PRIVATE_KEY!,
      })
    : (null as unknown as AtlasClient);

  it("returns system status from GET /api/atlas/v2", async () => {
    const result = await client.get<{ apiVersion: string }>("/api/atlas/v2");
    expect(result).toBeDefined();
    expect(result.apiVersion).toBeDefined();
  });

  it("lists organizations", async () => {
    const result = await client.get<{ results: unknown[] }>("/api/atlas/v2/orgs");
    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });

  it("lists projects", async () => {
    const result = await client.get<{ results: unknown[] }>("/api/atlas/v2/groups");
    expect(result).toBeDefined();
    expect(Array.isArray(result.results)).toBe(true);
  });
});
