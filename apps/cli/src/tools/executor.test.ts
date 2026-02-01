import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AtlasClient } from "@orbit/core";

// Mock @orbit/core dispatch before importing executor
vi.mock("@orbit/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@orbit/core")>();
  return {
    ...actual,
    dispatch: vi.fn(),
  };
});

import { dispatch } from "@orbit/core";
import { executeTool } from "./executor.js";

const mockDispatch = vi.mocked(dispatch);

const mockClient = {
  get: vi.fn(),
  request: vi.fn(),
} as unknown as AtlasClient;

describe("executeTool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error for unknown tool", async () => {
    const result = await executeTool(mockClient, "nonexistent_tool", {
      action: "list",
    });

    expect(result.success).toBe(false);
    expect(result.content).toContain("Unknown tool");
    expect(result.content).toContain("nonexistent_tool");
  });

  it("returns error when action is missing", async () => {
    const result = await executeTool(mockClient, "manage_clusters", {});

    expect(result.success).toBe(false);
    expect(result.content).toContain("Missing required parameter");
    expect(result.content).toContain("action");
  });

  it("dispatches successfully and returns JSON result", async () => {
    mockDispatch.mockResolvedValue({ clusters: [{ name: "prod-main" }] });

    const result = await executeTool(mockClient, "manage_clusters", {
      action: "list",
      params: { groupId: "abc123" },
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.content)).toEqual({
      clusters: [{ name: "prod-main" }],
    });
  });

  it("passes params, query, and body to dispatch", async () => {
    mockDispatch.mockResolvedValue({ ok: true });

    await executeTool(mockClient, "manage_clusters", {
      action: "create",
      params: { groupId: "g1" },
      query: { envelope: "true" },
      body: { name: "test-cluster" },
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      mockClient,
      expect.anything(), // ActionMap
      {
        action: "create",
        pathParams: { groupId: "g1" },
        query: { envelope: "true" },
        body: { name: "test-cluster" },
      },
    );
  });

  it("defaults params and query to empty objects", async () => {
    mockDispatch.mockResolvedValue({});

    await executeTool(mockClient, "manage_projects", {
      action: "list",
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      mockClient,
      expect.anything(),
      {
        action: "list",
        pathParams: {},
        query: {},
        body: undefined,
      },
    );
  });

  it("catches dispatch errors and returns failure", async () => {
    mockDispatch.mockRejectedValue(new Error("401 Unauthorized"));

    const result = await executeTool(mockClient, "manage_clusters", {
      action: "list",
      params: { groupId: "bad" },
    });

    expect(result.success).toBe(false);
    expect(result.content).toBe("401 Unauthorized");
  });

  it("handles non-Error exceptions", async () => {
    mockDispatch.mockRejectedValue("string error");

    const result = await executeTool(mockClient, "manage_clusters", {
      action: "list",
    });

    expect(result.success).toBe(false);
    expect(result.content).toBe("string error");
  });

  it("error message lists available tools", async () => {
    const result = await executeTool(mockClient, "no_such_tool", {
      action: "list",
    });

    expect(result.content).toContain("manage_clusters");
    expect(result.content).toContain("manage_projects");
  });
});
