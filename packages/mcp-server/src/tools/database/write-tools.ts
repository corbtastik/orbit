/**
 * Write tools — create collections, insert documents, and build indexes.
 *
 * All write tools have operationType "write" and are blocked when the
 * server is running in read-only mode (ORBIT_READ_ONLY=true).
 */

import type { IndexSpecification, CreateIndexesOptions } from "mongodb";
import type { DatabaseToolDef } from "./types.js";

/** Maximum number of documents that can be inserted in a single call. */
const MAX_INSERT_BATCH = 1000;

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
    const coll = conn.getCollection(
      args.database as string,
      args.collection as string,
    );
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
    const coll = conn.getCollection(
      args.database as string,
      args.collection as string,
    );
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
    const db = conn.getDb(args.database as string);
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
// Export
// ---------------------------------------------------------------------------

export const WRITE_TOOLS: DatabaseToolDef[] = [
  insertManyTool,
  createIndexTool,
  createCollectionTool,
];
