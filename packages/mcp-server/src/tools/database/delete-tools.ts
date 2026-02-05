/**
 * Delete tools — remove documents, collections, databases, and indexes.
 *
 * All delete tools have operationType "write" and are blocked when the
 * server is running in read-only mode. These are destructive operations
 * — the LLM should confirm intent before calling drop-* tools.
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
// delete-many
// ---------------------------------------------------------------------------

const deleteManyTool: DatabaseToolDef = {
  name: "delete-many",
  description:
    "Delete all documents in a collection that match a filter. " +
    "If no filter is provided, deletes ALL documents (use with caution).",
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
          'Query filter to select documents to delete. ' +
          'Example: { "status": "expired" }. ' +
          "Warning: an empty filter {} deletes ALL documents.",
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const filter = (args.filter as Record<string, unknown>) ?? {};

    const result = await coll.deleteMany(filter);

    return {
      ok: true,
      deletedCount: result.deletedCount,
    };
  },
};

// ---------------------------------------------------------------------------
// drop-collection
// ---------------------------------------------------------------------------

const dropCollectionTool: DatabaseToolDef = {
  name: "drop-collection",
  description:
    "Drop (delete) an entire collection and all its documents. " +
    "This is irreversible.",
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
        description: "Collection name to drop.",
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const db = connectionName
      ? conn.getNamedDb(connectionName, args.database as string)
      : conn.getDb(args.database as string);
    const dropped = await db.dropCollection(args.collection as string);

    return {
      ok: dropped,
      database: args.database,
      collection: args.collection,
      message: dropped
        ? `Collection "${args.collection}" dropped.`
        : `Collection "${args.collection}" not found.`,
    };
  },
};

// ---------------------------------------------------------------------------
// drop-database
// ---------------------------------------------------------------------------

const dropDatabaseTool: DatabaseToolDef = {
  name: "drop-database",
  description:
    "Drop (delete) an entire database and all its collections. " +
    "This is irreversible — use with extreme caution.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      database: {
        type: "string",
        description: "Database name to drop.",
      },
    },
    required: ["database"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const db = connectionName
      ? conn.getNamedDb(connectionName, args.database as string)
      : conn.getDb(args.database as string);
    const result = await db.dropDatabase();

    return {
      ok: result,
      database: args.database,
      message: `Database "${args.database}" dropped.`,
    };
  },
};

// ---------------------------------------------------------------------------
// drop-index
// ---------------------------------------------------------------------------

const dropIndexTool: DatabaseToolDef = {
  name: "drop-index",
  description:
    "Drop a specific index from a collection by index name. " +
    'Use collection-indexes to list existing indexes and find index names. ' +
    'Note: the "_id_" index cannot be dropped.',
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
      indexName: {
        type: "string",
        description:
          'Name of the index to drop (e.g., "email_1" or "name_1_age_-1"). ' +
          "Use collection-indexes tool to find index names.",
      },
    },
    required: ["database", "collection", "indexName"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);

    await coll.dropIndex(args.indexName as string);

    return {
      ok: true,
      database: args.database,
      collection: args.collection,
      indexName: args.indexName,
      message: `Index "${args.indexName}" dropped.`,
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const DELETE_TOOLS: DatabaseToolDef[] = [
  deleteManyTool,
  dropCollectionTool,
  dropDatabaseTool,
  dropIndexTool,
];
