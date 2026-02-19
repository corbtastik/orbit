/**
 * Metadata tools — inspect database structure, indexes, schemas, and stats.
 *
 * These are all read-only introspection operations. They help the LLM
 * understand the shape of a database before running queries or suggesting
 * optimizations.
 *
 * Multi-connection support: All tools accept an optional `connection`
 * parameter to specify which named connection to use. If not specified,
 * uses the default connection.
 */

import { connectionProperty, type DatabaseToolDef } from "./types.js";

// ---------------------------------------------------------------------------
// list-databases
// ---------------------------------------------------------------------------

const listDatabasesTool: DatabaseToolDef = {
  name: "list-databases",
  description:
    "List all databases on the connected MongoDB instance with their sizes.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
    },
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const client = connectionName
      ? conn.getNamedClient(connectionName)
      : conn.getClient();
    const admin = client.db().admin();
    return admin.listDatabases();
  },
};

// ---------------------------------------------------------------------------
// list-collections
// ---------------------------------------------------------------------------

const listCollectionsTool: DatabaseToolDef = {
  name: "list-collections",
  description:
    "List all collections in a database with their types and options.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      database: {
        type: "string",
        description: "Database name.",
      },
    },
    required: ["database"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const db = connectionName
      ? conn.getNamedDb(connectionName, args.database as string)
      : conn.getDb(args.database as string);
    return db.listCollections().toArray();
  },
};

// ---------------------------------------------------------------------------
// collection-indexes
// ---------------------------------------------------------------------------

const collectionIndexesTool: DatabaseToolDef = {
  name: "collection-indexes",
  description:
    "List all indexes on a collection, including index keys, options, and sizes.",
  operationType: "read",
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
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    return coll.indexes();
  },
};

// ---------------------------------------------------------------------------
// collection-schema
// ---------------------------------------------------------------------------

const collectionSchemaTool: DatabaseToolDef = {
  name: "collection-schema",
  description:
    "Infer the schema of a collection by sampling documents. " +
    "Returns a sample of documents so the LLM can understand field names, " +
    "types, and nesting structure.",
  operationType: "read",
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
      sampleSize: {
        type: "number",
        description: "Number of documents to sample (default: 5, max: 20).",
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const sampleSize = Math.min(
      Math.max((args.sampleSize as number) || 5, 1),
      20,
    );

    // Use $sample to get random documents for schema inference
    const sample = await coll
      .aggregate([{ $sample: { size: sampleSize } }])
      .toArray();

    return {
      database: args.database,
      collection: args.collection,
      sampleSize: sample.length,
      documents: sample,
    };
  },
};

// ---------------------------------------------------------------------------
// collection-storage-size
// ---------------------------------------------------------------------------

const collectionStorageSizeTool: DatabaseToolDef = {
  name: "collection-storage-size",
  description:
    "Get storage statistics for a collection including document count, " +
    "average document size, total storage size, and index sizes.",
  operationType: "read",
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
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);

    // Use $collStats to get storage info
    const stats = await coll
      .aggregate([
        { $collStats: { storageStats: {} } },
      ])
      .toArray();

    return stats[0] ?? { error: "No stats available for this collection." };
  },
};

// ---------------------------------------------------------------------------
// db-stats
// ---------------------------------------------------------------------------

const dbStatsTool: DatabaseToolDef = {
  name: "db-stats",
  description:
    "Get database-level statistics including collection count, document count, " +
    "storage size, and index size.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      database: {
        type: "string",
        description: "Database name.",
      },
    },
    required: ["database"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const db = connectionName
      ? conn.getNamedDb(connectionName, args.database as string)
      : conn.getDb(args.database as string);
    return db.command({ dbStats: 1 });
  },
};

// ---------------------------------------------------------------------------
// mongodb-logs
// ---------------------------------------------------------------------------

const mongodbLogsTool: DatabaseToolDef = {
  name: "mongodb-logs",
  description:
    "Retrieve recent MongoDB server log entries. " +
    "Useful for diagnosing connection issues, slow queries, and errors.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      type: {
        type: "string",
        description:
          'Log type: "global" for all logs, "startupWarnings" for startup warnings (default: "global").',
        enum: ["global", "startupWarnings"],
      },
      limit: {
        type: "number",
        description:
          "Maximum number of log lines to return (default: 50, max: 500).",
      },
    },
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const client = connectionName
      ? conn.getNamedClient(connectionName)
      : conn.getClient();
    const logType = (args.type as string) || "global";
    const limit = Math.min(Math.max((args.limit as number) || 50, 1), 500);

    const admin = client.db("admin");
    const result = await admin.command({ getLog: logType });

    // Trim to requested limit (getLog returns all available lines)
    const lines: string[] = result.log ?? [];
    return {
      type: logType,
      totalAvailable: result.totalLinesWritten ?? lines.length,
      returned: Math.min(lines.length, limit),
      log: lines.slice(-limit),
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const METADATA_TOOLS: DatabaseToolDef[] = [
  listDatabasesTool,
  listCollectionsTool,
  collectionIndexesTool,
  collectionSchemaTool,
  collectionStorageSizeTool,
  dbStatsTool,
  mongodbLogsTool,
];
