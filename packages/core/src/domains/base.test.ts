import { describe, it, expect, vi } from "vitest";
import type { AtlasClient } from "../client/index.js";
import type { ActionMap } from "./base.js";
import { resolvePath, dispatch } from "./base.js";

// ---------------------------------------------------------------------------
// resolvePath
// ---------------------------------------------------------------------------
describe("resolvePath", () => {
  it("substitutes path parameters into the template", () => {
    const result = resolvePath(
      "/api/atlas/v2/groups/{groupId}/clusters/{clusterName}",
      { groupId: "abc123", clusterName: "myCluster" },
    );
    expect(result).toBe("/api/atlas/v2/groups/abc123/clusters/myCluster");
  });

  it("URL-encodes special characters in parameter values", () => {
    const result = resolvePath("/api/{name}", {
      name: "hello world/foo",
    });
    expect(result).toBe("/api/hello%20world%2Ffoo");
  });

  it("throws when a required path parameter is missing", () => {
    expect(() =>
      resolvePath("/api/atlas/v2/groups/{groupId}/clusters/{clusterName}", {
        groupId: "abc123",
      }),
    ).toThrow("Missing required path parameter: clusterName");
  });

  it("returns the template unchanged when there are no placeholders", () => {
    const result = resolvePath("/api/atlas/v2/root", {});
    expect(result).toBe("/api/atlas/v2/root");
  });
});

// ---------------------------------------------------------------------------
// dispatch
// ---------------------------------------------------------------------------
describe("dispatch", () => {
  const mockClient = {
    get: vi.fn().mockResolvedValue({ results: [] }),
    request: vi.fn().mockResolvedValue({ data: { id: "123" } }),
  } as unknown as AtlasClient;

  const actions: ActionMap = {
    list: { method: "GET", path: "/api/atlas/v2/groups/{groupId}/clusters" },
    create: {
      method: "POST",
      path: "/api/atlas/v2/groups/{groupId}/clusters",
      hasBody: true,
    },
    update: {
      method: "PATCH",
      path: "/api/atlas/v2/groups/{groupId}/clusters/{clusterName}",
      hasBody: true,
    },
    delete: {
      method: "DELETE",
      path: "/api/atlas/v2/groups/{groupId}/clusters/{clusterName}",
    },
    replace: {
      method: "PUT",
      path: "/api/atlas/v2/groups/{groupId}/clusters/{clusterName}",
      hasBody: true,
    },
    deleteNoBody: {
      method: "DELETE",
      path: "/api/atlas/v2/groups/{groupId}/clusters/{clusterName}",
      hasBody: false,
    },
  };

  it("routes GET actions to client.get()", async () => {
    await dispatch(mockClient, actions, {
      action: "list",
      pathParams: { groupId: "g1" },
      query: { pageNum: 1 },
    });

    expect(mockClient.get).toHaveBeenCalledWith(
      "/api/atlas/v2/groups/g1/clusters",
      { pageNum: 1 },
    );
  });

  it("routes POST actions to client.request() with body", async () => {
    const body = { name: "newCluster" };
    await dispatch(mockClient, actions, {
      action: "create",
      pathParams: { groupId: "g1" },
      body,
    });

    expect(mockClient.request).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/atlas/v2/groups/g1/clusters",
      query: undefined,
      body,
    });
  });

  it("routes PATCH actions to client.request() with body", async () => {
    const body = { instanceSize: "M20" };
    await dispatch(mockClient, actions, {
      action: "update",
      pathParams: { groupId: "g1", clusterName: "myCluster" },
      body,
    });

    expect(mockClient.request).toHaveBeenCalledWith({
      method: "PATCH",
      path: "/api/atlas/v2/groups/g1/clusters/myCluster",
      query: undefined,
      body,
    });
  });

  it("routes PUT actions to client.request() with body", async () => {
    const body = { name: "replacedCluster" };
    await dispatch(mockClient, actions, {
      action: "replace",
      pathParams: { groupId: "g1", clusterName: "myCluster" },
      body,
    });

    expect(mockClient.request).toHaveBeenCalledWith({
      method: "PUT",
      path: "/api/atlas/v2/groups/g1/clusters/myCluster",
      query: undefined,
      body,
    });
  });

  it("routes DELETE actions to client.request() without body", async () => {
    await dispatch(mockClient, actions, {
      action: "delete",
      pathParams: { groupId: "g1", clusterName: "myCluster" },
    });

    expect(mockClient.request).toHaveBeenCalledWith({
      method: "DELETE",
      path: "/api/atlas/v2/groups/g1/clusters/myCluster",
      query: undefined,
      body: undefined,
    });
  });

  it("omits body when hasBody is false even if body is provided", async () => {
    await dispatch(mockClient, actions, {
      action: "deleteNoBody",
      pathParams: { groupId: "g1", clusterName: "myCluster" },
      body: { shouldBeIgnored: true },
    });

    expect(mockClient.request).toHaveBeenCalledWith({
      method: "DELETE",
      path: "/api/atlas/v2/groups/g1/clusters/myCluster",
      query: undefined,
      body: undefined,
    });
  });

  it("throws on unknown action with available actions listed", async () => {
    await expect(
      dispatch(mockClient, actions, { action: "unknown" }),
    ).rejects.toThrow("Unknown action 'unknown'. Available actions:");
  });
});
