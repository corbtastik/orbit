/**
 * Read tools — query and analyze MongoDB data.
 *
 * All read tools have operationType "read" and are never blocked by
 * read-only mode. They cover the core query operations: find, aggregate,
 * count, explain, and export.
 *
 * Multi-connection support: All tools accept an optional `connection`
 * parameter to specify which named connection to use. If not specified,
 * uses the default connection.
 */

import { MAX_FIND_LIMIT, MAX_AGGREGATE_LIMIT } from "./constants.js";
import { connectionProperty, type DatabaseToolDef } from "./types.js";

// ---------------------------------------------------------------------------
// find
// ---------------------------------------------------------------------------

const findTool: DatabaseToolDef = {
  name: "find",
  description:
    "Query documents in a collection using filter, projection, sort, skip, and limit. " +
    `Returns up to ${MAX_FIND_LIMIT} documents per call.`,
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
      filter: {
        type: "object",
        description:
          'MongoDB query filter (default: {}). Example: { "status": "active", "age": { "$gt": 25 } }',
      },
      projection: {
        type: "object",
        description:
          'Fields to include/exclude. Example: { "name": 1, "email": 1, "_id": 0 }',
      },
      sort: {
        type: "object",
        description:
          'Sort order. Example: { "createdAt": -1 } for descending.',
      },
      limit: {
        type: "number",
        description: `Maximum documents to return (default: 20, max: ${MAX_FIND_LIMIT}).`,
      },
      skip: {
        type: "number",
        description: "Number of documents to skip (for pagination).",
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args.connection as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);

    const filter = (args.filter as Record<string, unknown>) ?? {};
    const projection = args.projection as Record<string, unknown> | undefined;
    const sort = args.sort as Record<string, 1 | -1> | undefined;
    const limit = Math.min(
      Math.max((args.limit as number) || 20, 1),
      MAX_FIND_LIMIT,
    );
    const skip = Math.max((args.skip as number) || 0, 0);

    let cursor = coll.find(filter);
    if (projection) cursor = cursor.project(projection);
    if (sort) cursor = cursor.sort(sort);
    cursor = cursor.skip(skip).limit(limit);

    const documents = await cursor.toArray();

    return {
      database: args.database,
      collection: args.collection,
      count: documents.length,
      documents,
    };
  },
};

// ---------------------------------------------------------------------------
// aggregate
// ---------------------------------------------------------------------------

const aggregateTool: DatabaseToolDef = {
  name: "aggregate",
  description:
    "Run a MongoDB aggregation pipeline on a collection. " +
    "Supports all aggregation stages ($match, $group, $sort, $project, " +
    "$lookup, $unwind, etc.).",
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
      pipeline: {
        type: "array",
        description:
          "Aggregation pipeline stages. " +
          'Example: [{ "$match": { "status": "active" } }, { "$group": { "_id": "$department", "count": { "$sum": 1 } } }]',
        items: { type: "object" },
      },
    },
    required: ["database", "collection", "pipeline"],
  },
  execute: async (conn, args) => {
    const connectionName = args.connection as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const pipeline = args.pipeline as Record<string, unknown>[];

    // Safety limit: append $limit if the pipeline doesn't already end with one
    const hasLimit = pipeline.some(
      (stage) => "$limit" in stage,
    );
    const safePipeline = hasLimit
      ? pipeline
      : [...pipeline, { $limit: MAX_AGGREGATE_LIMIT }];

    const results = await coll.aggregate(safePipeline).toArray();

    return {
      database: args.database,
      collection: args.collection,
      count: results.length,
      results,
    };
  },
};

// ---------------------------------------------------------------------------
// count
// ---------------------------------------------------------------------------

const countTool: DatabaseToolDef = {
  name: "count",
  description:
    "Count documents in a collection, optionally matching a query filter.",
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
      query: {
        type: "object",
        description:
          'Query filter for counting (default: {} counts all). Example: { "status": "active" }',
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args.connection as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const query = (args.query as Record<string, unknown>) ?? {};

    const count = await coll.countDocuments(query);

    return {
      database: args.database,
      collection: args.collection,
      count,
    };
  },
};

// ---------------------------------------------------------------------------
// explain
// ---------------------------------------------------------------------------

const explainTool: DatabaseToolDef = {
  name: "explain",
  description:
    "Explain a query execution plan to understand index usage and performance. " +
    "Supports explaining find, aggregate, and count operations.",
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
      method: {
        type: "string",
        description: "The operation to explain.",
        enum: ["find", "aggregate", "count"],
      },
      filter: {
        type: "object",
        description: "Query filter (for find and count methods).",
      },
      pipeline: {
        type: "array",
        description: "Aggregation pipeline (for aggregate method).",
        items: { type: "object" },
      },
      verbosity: {
        type: "string",
        description:
          'Explain verbosity: "queryPlanner" (default), "executionStats", or "allPlansExecution".',
        enum: ["queryPlanner", "executionStats", "allPlansExecution"],
      },
    },
    required: ["database", "collection", "method"],
  },
  execute: async (conn, args) => {
    const connectionName = args.connection as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const method = args.method as string;
    const verbosity = (args.verbosity as string) || "queryPlanner";

    switch (method) {
      case "find": {
        const filter = (args.filter as Record<string, unknown>) ?? {};
        return coll.find(filter).explain(verbosity);
      }
      case "aggregate": {
        const pipeline =
          (args.pipeline as Record<string, unknown>[]) ?? [];
        return coll.aggregate(pipeline).explain(verbosity);
      }
      case "count": {
        // Explain a count by using an aggregation with $match + $count
        const query = (args.filter as Record<string, unknown>) ?? {};
        const countPipeline = [
          { $match: query },
          { $count: "count" },
        ];
        return coll.aggregate(countPipeline).explain(verbosity);
      }
      default:
        throw new Error(
          `Unknown explain method: ${method}. Use "find", "aggregate", or "count".`,
        );
    }
  },
};

// ---------------------------------------------------------------------------
// export
// ---------------------------------------------------------------------------

const exportTool: DatabaseToolDef = {
  name: "export",
  description:
    "Export documents from a collection as a JSON array. " +
    "Supports filtering with a query or aggregation pipeline. " +
    "Returns the documents inline (for the LLM to process or save).",
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
      filter: {
        type: "object",
        description: "Query filter to select documents for export (default: {}).",
      },
      pipeline: {
        type: "array",
        description:
          "Aggregation pipeline to transform documents before export. " +
          "If provided, filter is ignored.",
        items: { type: "object" },
      },
      projection: {
        type: "object",
        description: "Fields to include/exclude (only used with filter, not pipeline).",
      },
      sort: {
        type: "object",
        description: "Sort order (only used with filter, not pipeline).",
      },
      limit: {
        type: "number",
        description:
          "Maximum documents to export (default: 100, max: 10000). " +
          "Use with caution for large exports.",
      },
    },
    required: ["database", "collection"],
  },
  execute: async (conn, args) => {
    const connectionName = args.connection as string | undefined;
    const coll = connectionName
      ? conn.getNamedCollection(connectionName, args.database as string, args.collection as string)
      : conn.getCollection(args.database as string, args.collection as string);
    const limit = Math.min(
      Math.max((args.limit as number) || 100, 1),
      10000,
    );

    let documents: unknown[];

    if (args.pipeline) {
      // Aggregation-based export
      const pipeline = args.pipeline as Record<string, unknown>[];
      const hasLimit = pipeline.some((stage) => "$limit" in stage);
      const safePipeline = hasLimit
        ? pipeline
        : [...pipeline, { $limit: limit }];
      documents = await coll.aggregate(safePipeline).toArray();
    } else {
      // Filter-based export
      const filter = (args.filter as Record<string, unknown>) ?? {};
      const projection = args.projection as
        | Record<string, unknown>
        | undefined;
      const sort = args.sort as Record<string, 1 | -1> | undefined;

      let cursor = coll.find(filter);
      if (projection) cursor = cursor.project(projection);
      if (sort) cursor = cursor.sort(sort);
      cursor = cursor.limit(limit);
      documents = await cursor.toArray();
    }

    return {
      database: args.database,
      collection: args.collection,
      exported: documents.length,
      documents,
    };
  },
};

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const READ_TOOLS: DatabaseToolDef[] = [
  findTool,
  aggregateTool,
  countTool,
  explainTool,
  exportTool,
];
