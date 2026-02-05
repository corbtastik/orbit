import type { ActionMap } from "@orbit/core";

/**
 * Build the JSON Schema inputSchema for an MCP tool from its ActionMap.
 *
 * Every tool has:
 *  - action (required enum of available action names)
 *  - params (optional object for path parameters like groupId, clusterName)
 *  - query  (optional object for query parameters)
 *  - body   (optional object for request body)
 */
export function buildToolSchema(actions: ActionMap) {
  const actionNames = Object.keys(actions);

  return {
    type: "object" as const,
    properties: {
      action: {
        type: "string" as const,
        enum: actionNames,
        description: `The operation to perform. One of: ${actionNames.join(", ")}`,
      },
      params: {
        type: "object" as const,
        description:
          "Path parameters (e.g. groupId, orgId, clusterName). Keys must match the {placeholder} names in the API path.",
        additionalProperties: { type: "string" as const },
      },
      query: {
        type: "object" as const,
        description:
          "Query parameters (e.g. pageNum, itemsPerPage, envelope, pretty).",
        additionalProperties: true,
      },
      body: {
        type: "object" as const,
        description: "Request body for create/update operations (POST, PUT, PATCH). Must be a JSON object, not a string.",
      },
    },
    required: ["action"] as string[],
  };
}
