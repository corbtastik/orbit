import { describe, it, expect } from "vitest";
import type { AtlasClientManager } from "@orbit/core";
import { ConnectionManager, RdbmsConnectionManager } from "./tools/index.js";
import { createServer } from "./server.js";

// Create a mock AtlasClientManager for testing
function createMockAtlasManager(): AtlasClientManager {
  return {
    getClient: () => ({} as never),
    hasProfile: () => true,
    getDefaultProfileName: () => "default",
    listProfiles: () => ["default"],
    hasAnyProfile: () => true,
  } as unknown as AtlasClientManager;
}

describe("createServer", () => {
  it("returns a Server instance with only AtlasClientManager", () => {
    const mockManager = createMockAtlasManager();
    const server = createServer(mockManager);
    expect(server).toBeDefined();
    expect(typeof server).toBe("object");
  });

  it("returns a Server instance with AtlasClientManager and ConnectionManager", () => {
    const mockManager = createMockAtlasManager();
    const conn = new ConnectionManager();
    const server = createServer(mockManager, conn);
    expect(server).toBeDefined();
  });

  it("returns a Server instance with all connection managers", () => {
    const mockManager = createMockAtlasManager();
    const conn = new ConnectionManager();
    const rdbmsConn = new RdbmsConnectionManager();
    const server = createServer(mockManager, conn, rdbmsConn);
    expect(server).toBeDefined();
  });

  it("returns a Server instance with readOnly option", () => {
    const mockManager = createMockAtlasManager();
    const conn = new ConnectionManager();
    const rdbmsConn = new RdbmsConnectionManager();
    const server = createServer(mockManager, conn, rdbmsConn, { readOnly: true });
    expect(server).toBeDefined();
  });
});
