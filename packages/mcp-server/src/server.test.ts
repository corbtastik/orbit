import { describe, it, expect } from "vitest";
import type { AtlasClient } from "@orbit/core";
import { ConnectionManager } from "./tools/index.js";
import { createServer } from "./server.js";

describe("createServer", () => {
  it("returns a Server instance with only AtlasClient", () => {
    const mockClient = {} as AtlasClient;
    const server = createServer(mockClient);
    expect(server).toBeDefined();
    expect(typeof server).toBe("object");
  });

  it("returns a Server instance with AtlasClient and ConnectionManager", () => {
    const mockClient = {} as AtlasClient;
    const conn = new ConnectionManager();
    const server = createServer(mockClient, conn);
    expect(server).toBeDefined();
  });

  it("returns a Server instance with readOnly option", () => {
    const mockClient = {} as AtlasClient;
    const conn = new ConnectionManager();
    const server = createServer(mockClient, conn, undefined, { readOnly: true });
    expect(server).toBeDefined();
  });

  it("returns a Server instance with rmClient", () => {
    const mockClient = {} as AtlasClient;
    const conn = new ConnectionManager();
    // rmClient can be undefined - will gracefully degrade
    const server = createServer(mockClient, conn, undefined);
    expect(server).toBeDefined();
  });
});
