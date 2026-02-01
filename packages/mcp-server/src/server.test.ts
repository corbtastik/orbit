import { describe, it, expect } from "vitest";
import type { AtlasClient } from "@orbit/core";
import { createServer } from "./server.js";

describe("createServer", () => {
  it("returns a Server instance", () => {
    const mockClient = {} as AtlasClient;
    const server = createServer(mockClient);
    expect(server).toBeDefined();
    expect(typeof server).toBe("object");
  });
});
