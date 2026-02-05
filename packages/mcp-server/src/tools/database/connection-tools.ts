/**
 * Connection tools — manage the MongoDB driver connection lifecycle.
 *
 * These tools allow the LLM to connect, switch, and inspect MongoDB
 * connections at runtime. Unlike other database tools, connection tools
 * have operationType "connection" so they're always allowed (even in
 * read-only mode) and don't require an existing connection.
 */

import type { DatabaseToolDef } from "./types.js";

/**
 * connect — establish a connection to a MongoDB instance.
 *
 * Accepts a connection string (mongodb:// or mongodb+srv://).
 * If already connected, the existing connection is closed first.
 */
const connectTool: DatabaseToolDef = {
  name: "connect",
  description:
    "Connect to a MongoDB instance using a connection string. " +
    "If already connected, the current connection is closed first. " +
    "Supports mongodb:// and mongodb+srv:// URIs.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {
      connectionString: {
        type: "string",
        description:
          "MongoDB connection string (mongodb:// or mongodb+srv://). " +
          "Example: mongodb://localhost:27017 or mongodb+srv://user:pass@cluster.mongodb.net",
      },
    },
    required: ["connectionString"],
  },
  execute: async (conn, args) => {
    const connectionString = args.connectionString as string;
    await conn.connect(connectionString);
    return {
      ok: true,
      message: "Connected to MongoDB.",
      connection: conn.getConnectionInfo(),
    };
  },
};

/**
 * switch-connection — close the current connection and connect to a new one.
 *
 * Functionally identical to connect (ConnectionManager.connect() already
 * disconnects first), but the distinct name signals intent to the LLM:
 * "I want to change where I'm pointing."
 */
const switchConnectionTool: DatabaseToolDef = {
  name: "switch-connection",
  description:
    "Close the current MongoDB connection and connect to a different instance. " +
    "Use this when you need to switch between databases (e.g., from staging to production).",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {
      connectionString: {
        type: "string",
        description:
          "MongoDB connection string for the new instance " +
          "(mongodb:// or mongodb+srv://).",
      },
    },
    required: ["connectionString"],
  },
  execute: async (conn, args) => {
    const connectionString = args.connectionString as string;
    await conn.connect(connectionString);
    return {
      ok: true,
      message: "Switched MongoDB connection.",
      connection: conn.getConnectionInfo(),
    };
  },
};

export const CONNECTION_TOOLS: DatabaseToolDef[] = [
  connectTool,
  switchConnectionTool,
];
