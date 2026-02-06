/**
 * Write tools — create collections, insert documents, and build indexes.
 *
 * All write tools have operationType "write" and are blocked when the
 * server is running in read-only mode (ORBIT_READ_ONLY=true).
 *
 * Multi-connection support: All tools accept an optional `connection`
 * parameter to specify which named connection to use. If not specified,
 * uses the default connection.
 */

import type { IndexSpecification, CreateIndexesOptions } from "mongodb";
import type { DatabaseToolDef } from "./types.js";

/** Maximum number of documents that can be inserted in a single call. */
const MAX_INSERT_BATCH = 1000;

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
// insert-many
// ---------------------------------------------------------------------------

const insertManyTool: DatabaseToolDef = {
  name: "insert-many",
  description:
    "Insert one or more documents into a collection. " +
    `Accepts up to ${MAX_INSERT_BATCH} documents per call. ` +
    "Returns the inserted document IDs.",
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
      documents: {
        type: "array",
        description:
          "Array of documents to insert. " +
          'Example: [{ "name": "Alice", "age": 30 }, { "name": "Bob", "age": 25 }]',
        items: { type: "object" },
      },
    },
    required: ["database", "collection", "documents"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const documents = args.documents as Record<string, unknown>[];

    if (documents.length > MAX_INSERT_BATCH) {
      throw new Error(
        `Too many documents: ${documents.length}. Maximum is ${MAX_INSERT_BATCH} per call.`,
      );
    }

    const result = await coll.insertMany(documents);

    return {
      ok: true,
      insertedCount: result.insertedCount,
      insertedIds: result.insertedIds,
    };
  },
};

// ---------------------------------------------------------------------------
// create-index
// ---------------------------------------------------------------------------

const createIndexTool: DatabaseToolDef = {
  name: "create-index",
  description:
    "Create an index on a collection. Supports single-field, compound, " +
    "text, geospatial, and other index types.",
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
      keys: {
        type: "object",
        description:
          "Index key specification. " +
          'Example: { "email": 1 } for ascending, { "name": 1, "age": -1 } for compound, ' +
          '{ "description": "text" } for text index.',
      },
      options: {
        type: "object",
        description:
          "Optional index options. " +
          'Example: { "unique": true, "name": "email_unique", "sparse": true }',
      },
    },
    required: ["database", "collection", "keys"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const keys = args.keys as IndexSpecification;
    const options = (args.options as CreateIndexesOptions) ?? {};

    const indexName = await coll.createIndex(keys, options);

    return {
      ok: true,
      indexName,
      database: args.database,
      collection: args.collection,
    };
  },
};

// ---------------------------------------------------------------------------
// create-collection
// ---------------------------------------------------------------------------

const createCollectionTool: DatabaseToolDef = {
  name: "create-collection",
  description:
    "Create a new collection in a database. " +
    "The collection is created explicitly (MongoDB normally creates collections " +
    "implicitly on first insert, but explicit creation is needed for capped " +
    "collections, validation rules, or time-series).",
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
        description: "Collection name to create.",
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const db = connectionName
      ? conn.getNamedDb(connectionName, args.database as string)
      : conn.getDb(args.database as string);
    await db.createCollection(args.collection as string);

    return {
      ok: true,
      database: args.database,
      collection: args.collection,
      message: `Collection "${args.collection}" created in database "${args.database}".`,
    };
  },
};

// ---------------------------------------------------------------------------
// aggregate-out
// ---------------------------------------------------------------------------

const aggregateOutTool: DatabaseToolDef = {
  name: "aggregate-out",
  description:
    "Run an aggregation pipeline that writes results to a collection using $out or $merge. " +
    "Use $out to replace a collection entirely, or $merge to upsert into an existing collection. " +
    "The pipeline MUST end with a $out or $merge stage.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      ...connectionProperty,
      database: {
        type: "string",
        description: "Source database name.",
      },
      collection: {
        type: "string",
        description: "Source collection name.",
      },
      pipeline: {
        type: "array",
        description:
          "Aggregation pipeline ending with $out or $merge. " +
          'Example with $out: [{ "$match": { "status": "active" } }, { "$out": "active_users" }]. ' +
          'Example with $merge: [{ "$group": { "_id": "$category", "count": { "$sum": 1 } } }, ' +
          '{ "$merge": { "into": "category_counts", "whenMatched": "replace" } }]',
        items: { type: "object" },
      },
    },
    required: ["database", "collection", "pipeline"],
  },
  execute: async (conn, args) => {
    const connectionName = args._connectionName as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const pipeline = args.pipeline as Record<string, unknown>[];

    if (pipeline.length === 0) {
      throw new Error("Pipeline cannot be empty.");
    }

    // Validate that pipeline ends with $out or $merge
    const lastStage = pipeline[pipeline.length - 1];
    const hasOut = "$out" in lastStage;
    const hasMerge = "$merge" in lastStage;

    if (!hasOut && !hasMerge) {
      throw new Error(
        "Pipeline must end with $out or $merge stage. " +
        "Use the regular 'aggregate' tool for read-only pipelines.",
      );
    }

    // Execute the pipeline - $out/$merge don't return documents
    await coll.aggregate(pipeline).toArray();

    // Determine target collection for response
    let targetCollection: string;
    let targetDatabase: string = args.database as string;

    if (hasOut) {
      const outSpec = lastStage["$out"];
      if (typeof outSpec === "string") {
        targetCollection = outSpec;
      } else if (typeof outSpec === "object" && outSpec !== null) {
        const spec = outSpec as { db?: string; coll: string };
        targetCollection = spec.coll;
        if (spec.db) targetDatabase = spec.db;
      } else {
        targetCollection = "unknown";
      }
    } else {
      const mergeSpec = lastStage["$merge"] as { into: string | { db?: string; coll: string } };
      if (typeof mergeSpec.into === "string") {
        targetCollection = mergeSpec.into;
      } else {
        targetCollection = mergeSpec.into.coll;
        if (mergeSpec.into.db) targetDatabase = mergeSpec.into.db;
      }
    }

    return {
      ok: true,
      operation: hasOut ? "$out" : "$merge",
      source: {
        database: args.database,
        collection: args.collection,
      },
      target: {
        database: targetDatabase,
        collection: targetCollection,
      },
      message: `Pipeline executed. Results written to ${targetDatabase}.${targetCollection}.`,
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const WRITE_TOOLS: DatabaseToolDef[] = [
  insertManyTool,
  createIndexTool,
  createCollectionTool,
  aggregateOutTool,
];
