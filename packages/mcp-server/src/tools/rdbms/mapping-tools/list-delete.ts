/**
 * list-mappings and delete-mapping tools.
 */

import type { RdbmsToolDef } from "../types.js";
import { getMappingStore } from "../utils.js";

/**
 * list-mappings — List all defined mappings.
 */
export const listMappingsTool: RdbmsToolDef = {
  name: "list-mappings",
  description: "List all table-to-collection mappings defined in this session.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async (rdbms, _mongo, _args) => {
    const store = getMappingStore(rdbms);
    const mappings = store.list();

    if (mappings.length === 0) {
      return {
        ok: true,
        mappings: [],
        message: "No mappings defined. Use create-mapping to define a table-to-collection mapping.",
      };
    }

    return {
      ok: true,
      count: mappings.length,
      mappings: mappings.map(m => ({
        id: m.id,
        sourceTable: m.sourceTable,
        sourceSchema: m.sourceSchema,
        targetCollection: m.targetCollection,
        targetDatabase: m.targetDatabase,
        pattern: m.pattern,
        embedCount: m.embeds?.length ?? 0,
        referenceCount: m.references?.length ?? 0,
        validated: m.validated,
        hasIssues: (m.validationIssues?.length ?? 0) > 0,
      })),
    };
  },
};

/**
 * delete-mapping — Delete a mapping.
 */
export const deleteMappingTool: RdbmsToolDef = {
  name: "delete-mapping",
  description: "Delete a table-to-collection mapping.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      mapping: {
        type: "string",
        description: "Mapping ID or table name to delete.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const mappingId = args.mapping as string;
    const store = getMappingStore(rdbms);

    if (!store.has(mappingId)) {
      throw new Error(`Mapping "${mappingId}" not found.`);
    }

    store.delete(mappingId);

    return {
      ok: true,
      deleted: mappingId,
      message: `Mapping "${mappingId}" deleted.`,
    };
  },
};
