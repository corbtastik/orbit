/**
 * Update tools — modify existing documents and collections.
 *
 * All update tools have operationType "write" and are blocked when the
 * server is running in read-only mode.
 *
 * Multi-connection support: All tools accept an optional `connection`
 * parameter to specify which named connection to use. If not specified,
 * uses the default connection.
 */

import type { DatabaseToolDef } from "./types.js";

/** Connection parameter schema shared by all tools. */
const connectionProperty = {
  connection: {
    type: "string",
    description:
      "Named connection to use. Use list-connections to see available connections. " +
      "If not specified, uses the default connection.",
  },
};

// ---------------------------------------------------------------------------
// update-many
// ---------------------------------------------------------------------------

const updateManyTool: DatabaseToolDef = {
  name: "update-many",
  description:
    "Update all documents in a collection that match a filter. " +
    "Uses MongoDB update operators ($set, $unset, $inc, $push, etc.).",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      database: {
        type: "string",
        description: "Database name.",
      },
      collection: {
        type: "string",
        description: "Collection name.",
      },
      filter: {
        type: "object",
        description:
          'Query filter to select documents to update. Example: { "status": "pending" }',
      },
      update: {
        type: "object",
        description:
          'Update operations using MongoDB update operators. ' +
          'Example: { "$set": { "status": "processed" }, "$inc": { "retryCount": 1 } }',
      },
      upsert: {
        type: "boolean",
        description:
          "If true, insert a new document when no documents match the filter (default: false).",
      },
    },
    required: ["database", "collection", "filter", "update"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const filter = args.filter as Record<string, unknown>;
    const update = args.update as Record<string, unknown>;
    const upsert = (args.upsert as boolean) ?? false;

    const result = await coll.updateMany(filter, update, { upsert });

    return {
      ok: true,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount,
      upsertedId: result.upsertedId,
    };
  },
};

// ---------------------------------------------------------------------------
// rename-collection
// ---------------------------------------------------------------------------

const renameCollectionTool: DatabaseToolDef = {
  name: "rename-collection",
  description:
    "Rename a collection within the same database. " +
    "Optionally drop the target collection if it already exists.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      database: {
        type: "string",
        description: "Database name.",
      },
      collection: {
        type: "string",
        description: "Current collection name.",
      },
      newName: {
        type: "string",
        description: "New collection name.",
      },
      dropTarget: {
        type: "boolean",
        description:
          "If true, drop the target collection before renaming (default: false).",
      },
    },
    required: ["database", "collection", "newName"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const db = connectionName
      ? conn.getNamedDb(connectionName, args.database as string)
      : conn.getDb(args.database as string);
    const dropTarget = (args.dropTarget as boolean) ?? false;

    await db.renameCollection(
      args.collection as string,
      args.newName as string,
      { dropTarget },
    );

    return {
      ok: true,
      database: args.database,
      from: args.collection,
      to: args.newName,
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const UPDATE_TOOLS: DatabaseToolDef[] = [
  updateManyTool,
  renameCollectionTool,
];
