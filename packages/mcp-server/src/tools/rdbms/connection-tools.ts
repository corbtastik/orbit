/**
 * RDBMS Connection tools.
 *
 * Tools for connecting to and managing relational database connections.
 */

import type { RdbmsToolDef } from "./types.js";
import type { RdbmsType } from "./drivers/index.js";

/**
 * connect-rdbms — Connect to a relational database.
 */
const connectRdbmsTool: RdbmsToolDef = {
  name: "connect-rdbms",
  description:
    "Connect to a relational database (PostgreSQL, Oracle, SQLite, MySQL, SQL Server). " +
    "Provide a connection name, database type, and connection string. " +
    "The connection can then be used with schema and migration tools.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Unique name for this connection (e.g., 'source', 'legacy', 'postgres-prod'). " +
          "Used to reference this connection in other tools.",
      },
      type: {
        type: "string",
        enum: ["postgres", "mssql", "sqlite", "oracle", "mysql"],
        description:
          "Database type. Currently supported: postgres, mssql (SQL Server), sqlite. " +
          "Coming soon: oracle, mysql.",
      },
      connectionString: {
        type: "string",
        description:
          "Database connection string. Examples:\n" +
          "- PostgreSQL: postgresql://user:pass@localhost:5432/mydb\n" +
          "- Oracle: oracle://user:pass@localhost:1521/ORCL\n" +
          "- SQLite: /path/to/database.db or :memory:\n" +
          "- MySQL: mysql://user:pass@localhost:3306/mydb\n" +
          "- SQL Server: mssql://user:pass@localhost:1433/mydb",
      },
      setDefault: {
        type: "boolean",
        description:
          "Set this connection as the default. Default connections don't require " +
          "specifying the connection name in subsequent tool calls.",
      },
    },
    required: ["name", "type", "connectionString"],
  },
  execute: async (rdbms, _mongo, args) => {
    const name = args.name as string;
    const type = args.type as RdbmsType;
    const connectionString = args.connectionString as string;
    const setDefault = args.setDefault as boolean | undefined;

    // Connect (registers and connects in one step)
    await rdbms.connectNew(name, type, connectionString);

    // Set as default if requested
    if (setDefault) {
      rdbms.setDefaultName(name);
    }

    return {
      ok: true,
      connection: name,
      type,
      isDefault: rdbms.getDefaultName() === name,
      message: `Connected to ${type} database as "${name}".`,
    };
  },
};

/**
 * disconnect-rdbms — Disconnect from a relational database.
 */
const disconnectRdbmsTool: RdbmsToolDef = {
  name: "disconnect-rdbms",
  description:
    "Disconnect from a relational database connection. " +
    "If no name is specified, disconnects the default connection.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description:
          "Connection name to disconnect. If not specified, disconnects the default.",
      },
      all: {
        type: "boolean",
        description: "Disconnect all connections.",
      },
    },
  },
  execute: async (rdbms, _mongo, args) => {
    const name = args.name as string | undefined;
    const all = args.all as boolean | undefined;

    if (all) {
      const connections = rdbms.listConnections();
      await rdbms.disconnectAll();
      return {
        ok: true,
        disconnected: connections.map((c) => c.name),
        message: `Disconnected from ${connections.length} connection(s).`,
      };
    }

    const targetName = name ?? rdbms.getDefaultName();
    if (!targetName) {
      return {
        ok: true,
        message: "No connections to disconnect.",
      };
    }

    const wasConnected = rdbms.isConnected(targetName);
    await rdbms.disconnect(targetName);

    return {
      ok: true,
      connection: targetName,
      wasConnected,
      message: wasConnected
        ? `Disconnected from "${targetName}".`
        : `Connection "${targetName}" was not connected.`,
    };
  },
};

/**
 * list-rdbms — List all RDBMS connections and their status.
 */
const listRdbmsTool: RdbmsToolDef = {
  name: "list-rdbms",
  description:
    "List all registered RDBMS connections and their status. " +
    "Shows which connections are active and which is the default.",
  operationType: "connection",
  inputSchema: {
    type: "object",
    properties: {},
  },
  execute: async (rdbms, _mongo, _args) => {
    const connections = rdbms.listConnections();
    const defaultName = rdbms.getDefaultName();

    if (connections.length === 0) {
      return {
        ok: true,
        connections: [],
        message:
          "No RDBMS connections registered. Use connect-rdbms to connect to a database.",
      };
    }

    return {
      ok: true,
      defaultConnection: defaultName,
      connections: connections.map((conn) => ({
        ...conn,
        isDefault: conn.name === defaultName,
      })),
    };
  },
};

/**
 * All connection tools.
 */
export const CONNECTION_TOOLS: RdbmsToolDef[] = [
  connectRdbmsTool,
  disconnectRdbmsTool,
  listRdbmsTool,
];
