/**
 * Connection tools — manage MongoDB driver connections.
 *
 * These tools allow the LLM to connect, disconnect, and list MongoDB
 * connections at runtime. Unlike other database tools, connection tools
 * have operationType "connection" so they're always allowed (even in
 * read-only mode) and don't require an existing connection.
 *
 * Supports multiple named connections for cross-database workflows.
 */

import type { DatabaseToolDef } from "./types.js";

/**
 * list-connections — show all registered and connected MongoDB connections.
 */
const listConnectionsTool: DatabaseToolDef = {
  name: "list-connections",
  description:
    "List all available MongoDB connections with their status. " +
    "Shows both registered (available but not connected) and connected instances. " +
    "Use this to see what connections are available before running queries.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async (conn) => {
    const connections = conn.listConnections();
    return {
      connections,
      count: connections.length,
      hint:
        connections.length === 0
          ? "No connections available. Use the connect tool with a name and connectionString, " +
            "or set MONGODB_CONN_* environment variables."
          : undefined,
    };
  },
};

/**
 * connect — establish a connection to a MongoDB instance.
 *
 * Can connect to:
 * 1. A registered connection (from MONGODB_CONN_* env vars) by name
 * 2. A new connection by providing both name and connectionString
 */
const connectTool: DatabaseToolDef = {
  name: "connect",
  description:
    "Connect to a MongoDB instance. " +
    "Use a registered connection name (from MONGODB_CONN_* env vars) or " +
    "provide a new name with a connectionString. " +
    "Supports mongodb:// and mongodb+srv:// URIs.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Name of the connection. Use a registered name (from list-connections) " +
          'or create a new named connection. Defaults to "default" if not specified.',
      },
      connectionString: {
        type: "string",
        description:
          "MongoDB connection string (mongodb:// or mongodb+srv://). " +
          "Required when creating a new connection, optional when connecting to a registered one. " +
          "Example: mongodb://localhost:27017 or mongodb+srv://user:pass@cluster.mongodb.net",
      },
    },
  },
  execute: async (conn, args) => {
    const name = (args.name as string) || "default";
    const connectionString = args.connectionString as string | undefined;

    // Check if this is a registered connection that needs connecting
    if (!connectionString && !conn.hasConnection(name)) {
      return {
        ok: false,
        error: `Connection "${name}" is not registered. Provide a connectionString to create it, ` +
          "or use list-connections to see available connections.",
      };
    }

    await conn.connectNamed(name, connectionString);

    return {
      ok: true,
      message: `Connected to MongoDB as "${name}".`,
      connection: {
        name,
        status: "connected",
        uri: conn.listConnections().find((c) => c.name === name)?.uri,
      },
    };
  },
};

/**
 * disconnect — close a MongoDB connection.
 */
const disconnectTool: DatabaseToolDef = {
  name: "disconnect",
  description:
    "Disconnect from a MongoDB instance. " +
    'Specify a connection name, or omit to disconnect the "default" connection. ' +
    "Use disconnect-all to close all connections.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          'Name of the connection to disconnect. Defaults to "default" if not specified.',
      },
      all: {
        type: "boolean",
        description:
          "If true, disconnect all connections. Overrides the name parameter.",
      },
    },
  },
  execute: async (conn, args) => {
    const disconnectAll = args.all as boolean | undefined;

    if (disconnectAll) {
      const before = conn.listConnections().filter((c) => c.status === "connected");
      await conn.disconnectAll();
      return {
        ok: true,
        message: `Disconnected ${before.length} connection(s).`,
        disconnected: before.map((c) => c.name),
      };
    }

    const name = (args.name as string) || "default";

    if (!conn.isConnectedNamed(name)) {
      return {
        ok: false,
        error: `Connection "${name}" is not connected.`,
      };
    }

    await conn.disconnectNamed(name);

    return {
      ok: true,
      message: `Disconnected from "${name}".`,
    };
  },
};

export const CONNECTION_TOOLS: DatabaseToolDef[] = [
  listConnectionsTool,
  connectTool,
  disconnectTool,
];
