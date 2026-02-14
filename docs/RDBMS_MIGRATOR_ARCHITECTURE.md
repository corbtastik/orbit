# RDBMS Migrator — Implementation Architecture

This document describes how to integrate the RDBMS migration tools into the existing OrbitAI MCP server following established patterns.

## Design Principles

1. **Mirror existing patterns** — Follow the `database/` tools structure
2. **Clean separation** — RDBMS tools in their own directory
3. **Dual connections** — Tools access both RDBMS (source) and MongoDB (target)
4. **Driver abstraction** — Single interface for PostgreSQL, MySQL, SQLite, etc.
5. **Testable** — Mock-friendly connection managers

---

## Directory Structure

```
packages/mcp-server/src/tools/
├── database/                    # Existing MongoDB tools
│   ├── connection.ts            # ConnectionManager
│   ├── types.ts                 # DatabaseToolDef
│   ├── read-tools.ts
│   ├── write-tools.ts
│   └── index.ts
│
├── rdbms/                       # NEW: RDBMS migration tools
│   ├── connection.ts            # RdbmsConnectionManager
│   ├── types.ts                 # RdbmsToolDef, MappingConfig, etc.
│   │
│   ├── drivers/                 # Database-specific drivers
│   │   ├── types.ts             # RdbmsDriver interface
│   │   ├── postgres.ts          # PostgreSQL implementation
│   │   ├── mysql.ts             # MySQL implementation
│   │   ├── sqlite.ts            # SQLite implementation
│   │   └── index.ts             # Driver factory
│   │
│   ├── introspection.ts         # Schema extraction logic
│   ├── patterns.ts              # Migration pattern definitions
│   ├── transform.ts             # Schema transformation logic
│   │
│   ├── connection-tools.ts      # connect-rdbms, disconnect-rdbms, list-rdbms
│   ├── schema-tools.ts          # introspect-schema, analyze-relationships
│   ├── mapping-tools.ts         # create-mapping, preview-document, validate
│   ├── migration-tools.ts       # migrate-collection, migrate-all, verify
│   ├── utility-tools.ts         # generate-indexes, export-mapping
│   │
│   ├── rdbms-tools.test.ts      # Tests
│   └── index.ts                 # RDBMS_TOOLS export
│
└── index.ts                     # Updated to export RDBMS_TOOLS
```

---

## Core Types

### `types.ts`

```typescript
import type { RdbmsConnectionManager } from "./connection.js";
import type { ConnectionManager } from "../database/connection.js";

/**
 * RDBMS tool operation types for access control.
 */
export type RdbmsOperationType =
  | "connection"   // connect/disconnect (always allowed)
  | "read"         // schema introspection (always allowed)
  | "write";       // migration execution (blocked in read-only)

/**
 * Tool definition for RDBMS migration tools.
 *
 * Tools receive both connection managers:
 * - rdbms: Source relational database
 * - mongo: Target MongoDB database
 */
export interface RdbmsToolDef {
  name: string;
  description: string;
  operationType: RdbmsOperationType;
  inputSchema: object;
  execute: (
    rdbms: RdbmsConnectionManager,
    mongo: ConnectionManager,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}

/**
 * Supported RDBMS types.
 */
export type RdbmsType = "postgres" | "mysql" | "sqlite" | "mssql";

/**
 * Migration pattern types.
 */
export type MigrationPattern =
  | "direct"            // 1:1 table → collection
  | "embed-one"         // Embed 1:1 related table
  | "embed-many"        // Embed 1:N related rows as array
  | "reference"         // Store reference ID only
  | "extended-ref"      // Reference + copy key fields
  | "subset"            // Embed hot fields, reference cold
  | "bucket";           // Group rows by time window

/**
 * Column mapping configuration.
 */
export interface ColumnMapping {
  source: string;           // Source column name
  target: string;           // Target field name
  transform?: string;       // Optional transformation: "lowercase", "date", etc.
}

/**
 * Table-to-collection mapping configuration.
 */
export interface TableMapping {
  sourceTable: string;
  targetCollection: string;
  pattern: MigrationPattern;
  columns: ColumnMapping[];
  embed?: EmbedConfig[];
  reference?: ReferenceConfig[];
}

/**
 * Configuration for embedded documents.
 */
export interface EmbedConfig {
  sourceTable: string;
  foreignKey: string;
  targetField: string;
  pattern: "one" | "many";
  columns?: ColumnMapping[];
}

/**
 * Configuration for document references.
 */
export interface ReferenceConfig {
  sourceTable: string;
  foreignKey: string;
  targetField: string;
  copyFields?: string[];    // For extended reference pattern
}
```

---

## RdbmsConnectionManager

### `connection.ts`

```typescript
import { createDriver, type RdbmsDriver } from "./drivers/index.js";
import type { RdbmsType } from "./types.js";

/**
 * Connection info for a registered RDBMS.
 */
interface RdbmsConnectionInfo {
  name: string;
  type: RdbmsType;
  connectionString: string;
  driver: RdbmsDriver | null;
  connected: boolean;
}

/**
 * Manages multiple RDBMS connections.
 *
 * Mirrors the MongoDB ConnectionManager pattern for consistency.
 * Supports named connections for multi-source migrations.
 */
export class RdbmsConnectionManager {
  private connections = new Map<string, RdbmsConnectionInfo>();
  private defaultName: string | null = null;

  /**
   * Register a connection (does not connect immediately).
   */
  register(name: string, type: RdbmsType, connectionString: string): void {
    this.connections.set(name, {
      name,
      type,
      connectionString,
      driver: null,
      connected: false,
    });
    if (!this.defaultName) {
      this.defaultName = name;
    }
  }

  /**
   * Connect to a registered RDBMS.
   */
  async connect(name: string): Promise<void> {
    const info = this.connections.get(name);
    if (!info) {
      throw new Error(`RDBMS connection "${name}" not registered.`);
    }
    if (info.connected) {
      return; // Already connected
    }
    info.driver = createDriver(info.type);
    await info.driver.connect(info.connectionString);
    info.connected = true;
  }

  /**
   * Get driver for a named connection.
   */
  getDriver(name?: string): RdbmsDriver {
    const targetName = name ?? this.defaultName;
    if (!targetName) {
      throw new Error("No RDBMS connection available.");
    }
    const info = this.connections.get(targetName);
    if (!info?.driver || !info.connected) {
      throw new Error(`RDBMS "${targetName}" is not connected.`);
    }
    return info.driver;
  }

  /**
   * List all registered connections.
   */
  listConnections(): Array<{ name: string; type: RdbmsType; connected: boolean }> {
    return Array.from(this.connections.values()).map((c) => ({
      name: c.name,
      type: c.type,
      connected: c.connected,
    }));
  }

  /**
   * Disconnect all connections.
   */
  async disconnectAll(): Promise<void> {
    for (const info of this.connections.values()) {
      if (info.driver && info.connected) {
        await info.driver.disconnect();
        info.connected = false;
      }
    }
  }
}
```

---

## Driver Interface

### `drivers/types.ts`

```typescript
/**
 * Abstract interface for RDBMS drivers.
 *
 * Each driver (Postgres, MySQL, SQLite) implements this interface,
 * providing a consistent API for schema introspection and data access.
 */
export interface RdbmsDriver {
  /** Driver type identifier. */
  readonly type: string;

  /** Connect to the database. */
  connect(connectionString: string): Promise<void>;

  /** Disconnect from the database. */
  disconnect(): Promise<void>;

  /** List all tables in the database (or schema). */
  listTables(schema?: string): Promise<TableInfo[]>;

  /** Get column information for a table. */
  getColumns(table: string, schema?: string): Promise<ColumnInfo[]>;

  /** Get primary key columns for a table. */
  getPrimaryKey(table: string, schema?: string): Promise<string[]>;

  /** Get foreign key relationships for a table. */
  getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]>;

  /** Get all foreign keys pointing TO a table (reverse lookup). */
  getReferencingKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]>;

  /** Get indexes for a table. */
  getIndexes(table: string, schema?: string): Promise<IndexInfo[]>;

  /** Execute a query and return rows. */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /** Stream rows from a table with optional filter. */
  streamRows(
    table: string,
    options?: { where?: string; batchSize?: number; schema?: string },
  ): AsyncIterable<Record<string, unknown>[]>;

  /** Get row count for a table. */
  countRows(table: string, schema?: string): Promise<number>;
}

export interface TableInfo {
  name: string;
  schema?: string;
  type: "table" | "view";
  rowCount?: number;
}

export interface ColumnInfo {
  name: string;
  dataType: string;         // Native SQL type
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey: boolean;
  isAutoIncrement: boolean;
}

export interface ForeignKeyInfo {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
}
```

### `drivers/postgres.ts`

```typescript
import pg from "pg";
import type { RdbmsDriver, TableInfo, ColumnInfo, ForeignKeyInfo, IndexInfo } from "./types.js";

export class PostgresDriver implements RdbmsDriver {
  readonly type = "postgres";
  private pool: pg.Pool | null = null;

  async connect(connectionString: string): Promise<void> {
    this.pool = new pg.Pool({ connectionString });
    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
  }

  async listTables(schema = "public"): Promise<TableInfo[]> {
    const sql = `
      SELECT table_name as name, table_type as type
      FROM information_schema.tables
      WHERE table_schema = $1
      ORDER BY table_name
    `;
    const rows = await this.query<{ name: string; type: string }>(sql, [schema]);
    return rows.map((r) => ({
      name: r.name,
      schema,
      type: r.type === "BASE TABLE" ? "table" : "view",
    }));
  }

  async getColumns(table: string, schema = "public"): Promise<ColumnInfo[]> {
    const sql = `
      SELECT
        c.column_name as name,
        c.data_type as "dataType",
        c.is_nullable = 'YES' as nullable,
        c.column_default as "defaultValue",
        COALESCE(pk.is_pk, false) as "isPrimaryKey",
        c.column_default LIKE 'nextval%' as "isAutoIncrement"
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name, true as is_pk
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_schema = $1
          AND tc.table_name = $2
          AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.column_name = c.column_name
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position
    `;
    return this.query<ColumnInfo>(sql, [schema, table]);
  }

  async getForeignKeys(table: string, schema = "public"): Promise<ForeignKeyInfo[]> {
    const sql = `
      SELECT
        tc.constraint_name as "constraintName",
        kcu.table_name as "sourceTable",
        kcu.column_name as "sourceColumn",
        ccu.table_name as "targetTable",
        ccu.column_name as "targetColumn"
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND kcu.table_name = $2
    `;
    return this.query<ForeignKeyInfo>(sql, [schema, table]);
  }

  // ... remaining methods

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (!this.pool) throw new Error("Not connected");
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async *streamRows(
    table: string,
    options: { where?: string; batchSize?: number; schema?: string } = {},
  ): AsyncIterable<Record<string, unknown>[]> {
    const { where, batchSize = 1000, schema = "public" } = options;
    const fullTable = `"${schema}"."${table}"`;
    let offset = 0;

    while (true) {
      const sql = `
        SELECT * FROM ${fullTable}
        ${where ? `WHERE ${where}` : ""}
        ORDER BY 1
        LIMIT ${batchSize} OFFSET ${offset}
      `;
      const rows = await this.query(sql);
      if (rows.length === 0) break;
      yield rows;
      offset += batchSize;
    }
  }
}
```

---

## Server Integration

### Update `tools/index.ts`

```typescript
// Existing exports
export { TOOL_REGISTRY } from "./registry.js";
export { buildToolSchema } from "./schema.js";
export { DATABASE_TOOLS, ConnectionManager } from "./database/index.js";
export type { DatabaseToolDef, DatabaseOperationType } from "./database/index.js";

// NEW: RDBMS exports
export { RDBMS_TOOLS, RdbmsConnectionManager } from "./rdbms/index.js";
export type { RdbmsToolDef, RdbmsOperationType } from "./rdbms/index.js";
```

### Update `server.ts`

```typescript
import {
  TOOL_REGISTRY,
  buildToolSchema,
  DATABASE_TOOLS,
  RDBMS_TOOLS,           // NEW
  RdbmsConnectionManager, // NEW
} from "./tools/index.js";

export function createServer(
  client: AtlasClient,
  conn?: ConnectionManager,
  rdbmsConn?: RdbmsConnectionManager,  // NEW
  options: ServerOptions = {},
): Server {
  // ... existing setup ...

  registerTools(server, client, conn, rdbmsConn, readOnly);
  // ...
}

function registerTools(
  server: Server,
  client: AtlasClient,
  conn: ConnectionManager | undefined,
  rdbmsConn: RdbmsConnectionManager | undefined,  // NEW
  readOnly: boolean,
): void {
  // ... existing tool index setup ...

  // --- RDBMS tool index ---
  const rdbmsToolIndex = new Map<string, RdbmsToolDef>();
  for (const def of RDBMS_TOOLS) {
    rdbmsToolIndex.set(def.name, def);
  }

  // tools/list — include RDBMS tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      // Atlas tools
      ...TOOL_REGISTRY.map((def) => /* ... */),
      // MongoDB tools
      ...DATABASE_TOOLS.map((def) => /* ... */),
      // RDBMS tools (NEW)
      ...RDBMS_TOOLS.map((def) => ({
        name: def.name,
        description: def.description,
        inputSchema: def.inputSchema,
      })),
    ],
  }));

  // tools/call — check RDBMS tools
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    // Check RDBMS tools first
    const rdbmsTool = rdbmsToolIndex.get(name);
    if (rdbmsTool) {
      return handleRdbmsTool(rdbmsTool, rdbmsConn, conn, args, readOnly);
    }

    // Check database tools
    const dbTool = dbToolIndex.get(name);
    if (dbTool) {
      return handleDatabaseTool(dbTool, conn, args, readOnly);
    }

    // Fall through to Atlas tools
    // ...
  });
}

async function handleRdbmsTool(
  tool: RdbmsToolDef,
  rdbmsConn: RdbmsConnectionManager | undefined,
  mongoConn: ConnectionManager | undefined,
  args: Record<string, unknown>,
  readOnly: boolean,
) {
  if (tool.operationType === "write" && readOnly) {
    return errorResult("Write operations are disabled in read-only mode.");
  }

  if (!rdbmsConn) {
    return errorResult("RDBMS support is not configured.");
  }

  // Migration tools also need MongoDB connection
  if (tool.operationType === "write" && !mongoConn?.isConnected()) {
    return errorResult("MongoDB connection required for migration. Use connect first.");
  }

  try {
    const result = await tool.execute(rdbmsConn, mongoConn!, args);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    return errorResult(err instanceof Error ? err.message : String(err));
  }
}
```

---

## Example Tool Implementation

### `schema-tools.ts`

```typescript
import type { RdbmsToolDef } from "./types.js";

const introspectSchemaTool: RdbmsToolDef = {
  name: "introspect-schema",
  description:
    "Extract schema from a relational database: tables, columns, types, " +
    "primary keys, foreign keys, and indexes. Returns a complete picture " +
    "of the source schema for migration planning.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name. Use list-rdbms to see available.",
      },
      schema: {
        type: "string",
        description: 'Database schema to introspect (default: "public" for Postgres).',
      },
      tables: {
        type: "array",
        items: { type: "string" },
        description: "Specific tables to introspect. If omitted, introspects all.",
      },
    },
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const schema = (args.schema as string) ?? "public";
    const filterTables = args.tables as string[] | undefined;

    const driver = rdbms.getDriver(connName);
    const allTables = await driver.listTables(schema);

    const tables = filterTables
      ? allTables.filter((t) => filterTables.includes(t.name))
      : allTables;

    const result = await Promise.all(
      tables.map(async (table) => ({
        name: table.name,
        type: table.type,
        columns: await driver.getColumns(table.name, schema),
        primaryKey: await driver.getPrimaryKey(table.name, schema),
        foreignKeys: await driver.getForeignKeys(table.name, schema),
        indexes: await driver.getIndexes(table.name, schema),
        rowCount: await driver.countRows(table.name, schema),
      })),
    );

    return {
      schema,
      tableCount: result.length,
      tables: result,
    };
  },
};

export const SCHEMA_TOOLS: RdbmsToolDef[] = [
  introspectSchemaTool,
  // analyzeRelationshipsTool,
  // recommendPatternsTool,
];
```

---

## Configuration

### Environment Variables

| Variable | Description |
|----------|-------------|
| `RDBMS_CONN_<NAME>` | Connection string for named RDBMS (e.g., `RDBMS_CONN_POSTGRES`) |
| `RDBMS_TYPE_<NAME>` | Driver type: `postgres`, `mysql`, `sqlite`, `mssql` |

### Config File

```json
{
  "rdbms": {
    "connections": {
      "source": {
        "type": "postgres",
        "connectionString": "postgresql://user:pass@localhost:5432/mydb"
      },
      "legacy": {
        "type": "mysql",
        "connectionString": "mysql://user:pass@localhost:3306/legacy"
      }
    }
  }
}
```

---

## Dependencies

Add to `packages/mcp-server/package.json`:

```json
{
  "dependencies": {
    "pg": "^8.11.0",
    "mysql2": "^3.6.0",
    "better-sqlite3": "^9.4.0"
  },
  "devDependencies": {
    "@types/pg": "^8.10.0",
    "@types/better-sqlite3": "^7.6.0"
  }
}
```

---

## Testing Strategy

1. **Unit tests** — Mock drivers, test introspection parsing
2. **Integration tests** — Use SQLite in-memory for fast schema tests
3. **Docker tests** — PostgreSQL/MySQL containers for full integration

```typescript
// Example: SQLite in-memory test
import Database from "better-sqlite3";

describe("introspect-schema", () => {
  it("extracts table structure", async () => {
    const db = new Database(":memory:");
    db.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE
      );
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total REAL
      );
    `);

    const driver = new SqliteDriver();
    await driver.connectFromDb(db);

    const tables = await driver.listTables();
    expect(tables).toHaveLength(2);

    const userCols = await driver.getColumns("users");
    expect(userCols.find((c) => c.name === "id")?.isPrimaryKey).toBe(true);

    const orderFks = await driver.getForeignKeys("orders");
    expect(orderFks[0].targetTable).toBe("users");
  });
});
```

---

## Summary

This architecture:

1. **Mirrors existing patterns** — Same structure as `database/` tools
2. **Dual connection support** — Tools access both RDBMS and MongoDB
3. **Driver abstraction** — Clean interface for multiple databases
4. **Clean integration** — Minimal changes to `server.ts`
5. **Testable** — SQLite for fast unit tests, Docker for integration
6. **Extensible** — Easy to add new drivers, patterns, tools
