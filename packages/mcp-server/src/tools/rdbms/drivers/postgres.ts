/**
 * PostgreSQL Driver implementation.
 *
 * Uses the `pg` library to connect to PostgreSQL databases and
 * extract schema metadata via information_schema and pg_catalog.
 */

import pg from "pg";
import type {
  RdbmsDriver,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./types.js";

/**
 * Default PostgreSQL connection pool settings.
 * These limits prevent connection exhaustion in multi-session scenarios.
 */
const DEFAULT_POOL_OPTIONS: pg.PoolConfig = {
  max: 5,                    // Max connections per pool
  min: 0,                    // Don't maintain idle connections
  idleTimeoutMillis: 30000,  // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Connection timeout 10s
};

/**
 * PostgreSQL driver implementing the RdbmsDriver interface.
 */
export class PostgresDriver implements RdbmsDriver {
  readonly type = "postgres";
  private pool: pg.Pool | null = null;

  /**
   * Connect to PostgreSQL using a connection string.
   *
   * @param connectionString PostgreSQL connection string (postgresql://user:pass@host:port/db)
   */
  async connect(connectionString: string): Promise<void> {
    this.pool = new pg.Pool({
      connectionString,
      ...DEFAULT_POOL_OPTIONS,
    });

    // Test the connection
    const client = await this.pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
  }

  /**
   * Disconnect and release all pool connections.
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  /**
   * List all tables and views in the specified schema.
   */
  async listTables(schema = "public"): Promise<TableInfo[]> {
    const sql = `
      SELECT
        t.table_name AS name,
        t.table_type AS type,
        s.n_live_tup AS row_count
      FROM information_schema.tables t
      LEFT JOIN pg_stat_user_tables s
        ON s.schemaname = t.table_schema
        AND s.relname = t.table_name
      WHERE t.table_schema = $1
        AND t.table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY t.table_name
    `;

    const rows = await this.query<{
      name: string;
      type: string;
      row_count: string | null;
    }>(sql, [schema]);

    return rows.map((row) => ({
      name: row.name,
      schema,
      type: row.type === "BASE TABLE" ? "table" : "view",
      rowCount: row.row_count ? parseInt(row.row_count, 10) : undefined,
    }));
  }

  /**
   * Get column metadata for a table.
   */
  async getColumns(table: string, schema = "public"): Promise<ColumnInfo[]> {
    const sql = `
      SELECT
        c.column_name AS name,
        c.data_type AS data_type,
        c.udt_name AS udt_name,
        c.is_nullable = 'YES' AS nullable,
        c.column_default AS default_value,
        c.character_maximum_length AS max_length,
        c.numeric_precision AS precision,
        c.numeric_scale AS scale,
        COALESCE(pk.is_pk, false) AS is_primary_key,
        c.column_default LIKE 'nextval%' AS is_auto_increment
      FROM information_schema.columns c
      LEFT JOIN (
        SELECT kcu.column_name, true AS is_pk
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = $1
          AND tc.table_name = $2
          AND tc.constraint_type = 'PRIMARY KEY'
      ) pk ON pk.column_name = c.column_name
      WHERE c.table_schema = $1
        AND c.table_name = $2
      ORDER BY c.ordinal_position
    `;

    const rows = await this.query<{
      name: string;
      data_type: string;
      udt_name: string;
      nullable: boolean;
      default_value: string | null;
      max_length: number | null;
      precision: number | null;
      scale: number | null;
      is_primary_key: boolean;
      is_auto_increment: boolean;
    }>(sql, [schema, table]);

    return rows.map((row) => ({
      name: row.name,
      dataType: this.normalizeDataType(row.data_type, row.udt_name),
      nullable: row.nullable,
      defaultValue: row.default_value ?? undefined,
      isPrimaryKey: row.is_primary_key,
      isAutoIncrement: row.is_auto_increment,
      maxLength: row.max_length ?? undefined,
      precision: row.precision ?? undefined,
      scale: row.scale ?? undefined,
    }));
  }

  /**
   * Get primary key columns for a table.
   */
  async getPrimaryKey(table: string, schema = "public"): Promise<string[]> {
    const sql = `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1
        AND tc.table_name = $2
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `;

    const rows = await this.query<{ column_name: string }>(sql, [schema, table]);
    return rows.map((row) => row.column_name);
  }

  /**
   * Get foreign keys defined on this table (outgoing references).
   */
  async getForeignKeys(table: string, schema = "public"): Promise<ForeignKeyInfo[]> {
    const sql = `
      SELECT
        tc.constraint_name,
        kcu.column_name AS source_column,
        ccu.table_schema AS target_schema,
        ccu.table_name AS target_table,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1
        AND tc.table_name = $2
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;

    const rows = await this.query<{
      constraint_name: string;
      source_column: string;
      target_schema: string;
      target_table: string;
      target_column: string;
    }>(sql, [schema, table]);

    // Group by constraint name (for composite FKs)
    const fkMap = new Map<string, ForeignKeyInfo>();

    for (const row of rows) {
      const existing = fkMap.get(row.constraint_name);
      if (existing) {
        existing.sourceColumns.push(row.source_column);
        existing.targetColumns.push(row.target_column);
      } else {
        fkMap.set(row.constraint_name, {
          constraintName: row.constraint_name,
          sourceTable: table,
          sourceColumns: [row.source_column],
          targetTable: row.target_table,
          targetColumns: [row.target_column],
          sourceSchema: schema,
          targetSchema: row.target_schema,
        });
      }
    }

    return Array.from(fkMap.values());
  }

  /**
   * Get foreign keys pointing to this table (incoming references).
   */
  async getReferencingKeys(table: string, schema = "public"): Promise<ForeignKeyInfo[]> {
    const sql = `
      SELECT
        tc.constraint_name,
        tc.table_schema AS source_schema,
        tc.table_name AS source_table,
        kcu.column_name AS source_column,
        ccu.column_name AS target_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND ccu.table_schema = $1
        AND ccu.table_name = $2
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `;

    const rows = await this.query<{
      constraint_name: string;
      source_schema: string;
      source_table: string;
      source_column: string;
      target_column: string;
    }>(sql, [schema, table]);

    // Group by constraint name
    const fkMap = new Map<string, ForeignKeyInfo>();

    for (const row of rows) {
      const existing = fkMap.get(row.constraint_name);
      if (existing) {
        existing.sourceColumns.push(row.source_column);
        existing.targetColumns.push(row.target_column);
      } else {
        fkMap.set(row.constraint_name, {
          constraintName: row.constraint_name,
          sourceTable: row.source_table,
          sourceColumns: [row.source_column],
          targetTable: table,
          targetColumns: [row.target_column],
          sourceSchema: row.source_schema,
          targetSchema: schema,
        });
      }
    }

    return Array.from(fkMap.values());
  }

  /**
   * Get indexes for a table.
   */
  async getIndexes(table: string, schema = "public"): Promise<IndexInfo[]> {
    const sql = `
      SELECT
        i.relname AS index_name,
        a.attname AS column_name,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        am.amname AS index_type,
        array_position(ix.indkey, a.attnum) AS column_position
      FROM pg_class t
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN pg_namespace n ON t.relnamespace = n.oid
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
      WHERE n.nspname = $1
        AND t.relname = $2
      ORDER BY i.relname, array_position(ix.indkey, a.attnum)
    `;

    const rows = await this.query<{
      index_name: string;
      column_name: string;
      is_unique: boolean;
      is_primary: boolean;
      index_type: string;
      column_position: number;
    }>(sql, [schema, table]);

    // Group by index name
    const indexMap = new Map<string, IndexInfo>();

    for (const row of rows) {
      const existing = indexMap.get(row.index_name);
      if (existing) {
        existing.columns.push(row.column_name);
      } else {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [row.column_name],
          unique: row.is_unique,
          type: row.index_type,
          isPrimary: row.is_primary,
        });
      }
    }

    return Array.from(indexMap.values());
  }

  /**
   * Execute a SQL query and return all rows.
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    if (!this.pool) {
      throw new Error("PostgreSQL driver is not connected.");
    }

    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  /**
   * Stream rows from a table in batches.
   */
  async *streamRows(
    table: string,
    options: StreamRowsOptions = {},
  ): AsyncIterable<Record<string, unknown>[]> {
    const {
      where,
      batchSize = 1000,
      schema = "public",
      columns,
      orderBy,
    } = options;

    const selectColumns = columns?.length ? columns.join(", ") : "*";
    const fullTable = `"${schema}"."${table}"`;
    const orderClause = orderBy?.length
      ? `ORDER BY ${orderBy.join(", ")}`
      : "ORDER BY 1"; // Order by first column if not specified

    let offset = 0;

    while (true) {
      const sql = `
        SELECT ${selectColumns}
        FROM ${fullTable}
        ${where ? `WHERE ${where}` : ""}
        ${orderClause}
        LIMIT ${batchSize} OFFSET ${offset}
      `;

      const rows = await this.query(sql);

      if (rows.length === 0) {
        break;
      }

      yield rows;

      if (rows.length < batchSize) {
        break; // Last batch
      }

      offset += batchSize;
    }
  }

  /**
   * Get the total row count for a table.
   */
  async countRows(table: string, schema = "public"): Promise<number> {
    const sql = `SELECT COUNT(*) AS count FROM "${schema}"."${table}"`;
    const rows = await this.query<{ count: string }>(sql);
    return parseInt(rows[0].count, 10);
  }

  /**
   * Normalize PostgreSQL data types to a consistent format.
   */
  private normalizeDataType(dataType: string, udtName: string): string {
    // Use udt_name for user-defined types and arrays
    if (dataType === "ARRAY") {
      return `${udtName.replace(/^_/, "")}[]`;
    }
    if (dataType === "USER-DEFINED") {
      return udtName;
    }
    return dataType;
  }
}

/**
 * PostgreSQL type to BSON type mapping.
 */
export const PG_TYPE_MAP: Record<string, string> = {
  // Integers
  smallint: "int",
  integer: "int",
  bigint: "long",
  serial: "int",
  bigserial: "long",
  smallserial: "int",

  // Floating point
  real: "double",
  "double precision": "double",
  numeric: "decimal",
  decimal: "decimal",
  money: "decimal",

  // Boolean
  boolean: "bool",

  // Strings
  "character varying": "string",
  varchar: "string",
  character: "string",
  char: "string",
  text: "string",
  name: "string",

  // Binary
  bytea: "binData",

  // Date/Time
  timestamp: "date",
  "timestamp without time zone": "date",
  "timestamp with time zone": "date",
  date: "date",
  time: "string",
  "time without time zone": "string",
  "time with time zone": "string",
  interval: "string",

  // JSON
  json: "object",
  jsonb: "object",

  // UUID
  uuid: "string",

  // Network
  inet: "string",
  cidr: "string",
  macaddr: "string",
  macaddr8: "string",

  // Geometric (store as strings or objects)
  point: "string",
  line: "string",
  lseg: "string",
  box: "string",
  path: "string",
  polygon: "string",
  circle: "string",

  // Other
  xml: "string",
  tsvector: "string",
  tsquery: "string",
  bit: "string",
  "bit varying": "string",
  varbit: "string",
};

/**
 * Map a PostgreSQL data type to a BSON type.
 */
export function mapPostgresTypeToBson(
  pgType: string,
  precision?: number,
  scale?: number,
): string {
  // Handle arrays
  if (pgType.endsWith("[]")) {
    return "array";
  }

  // Normalize type name
  const normalized = pgType.toLowerCase();

  // Check direct mapping
  if (PG_TYPE_MAP[normalized]) {
    return PG_TYPE_MAP[normalized];
  }

  // Special handling for numeric with precision
  if (normalized === "numeric" || normalized === "decimal") {
    if (scale === 0 && precision !== undefined) {
      if (precision <= 9) return "int";
      if (precision <= 18) return "long";
    }
    return "decimal";
  }

  // Default to string for unknown types
  return "string";
}
