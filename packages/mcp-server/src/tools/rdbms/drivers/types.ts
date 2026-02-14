/**
 * RDBMS Driver interface and supporting types.
 *
 * Each database driver (PostgreSQL, Oracle, SQLite) implements this interface,
 * providing a consistent API for schema introspection and data access.
 */

/**
 * Table metadata from the database catalog.
 */
export interface TableInfo {
  /** Table name. */
  name: string;
  /** Schema/owner name (e.g., "public" in PostgreSQL, username in Oracle). */
  schema?: string;
  /** Table or view. */
  type: "table" | "view";
  /** Approximate row count (if available). */
  rowCount?: number;
}

/**
 * Column metadata from the database catalog.
 */
export interface ColumnInfo {
  /** Column name. */
  name: string;
  /** Native SQL data type (e.g., "varchar", "integer", "NUMBER"). */
  dataType: string;
  /** Whether the column allows NULL values. */
  nullable: boolean;
  /** Default value expression (if any). */
  defaultValue?: string;
  /** Whether this column is part of the primary key. */
  isPrimaryKey: boolean;
  /** Whether this column auto-increments (SERIAL, IDENTITY, etc.). */
  isAutoIncrement: boolean;
  /** Character maximum length (for string types). */
  maxLength?: number;
  /** Numeric precision (for decimal types). */
  precision?: number;
  /** Numeric scale (for decimal types). */
  scale?: number;
}

/**
 * Foreign key relationship metadata.
 */
export interface ForeignKeyInfo {
  /** Constraint name. */
  constraintName: string;
  /** Source table containing the foreign key. */
  sourceTable: string;
  /** Source column(s) in the foreign key. */
  sourceColumns: string[];
  /** Target (referenced) table. */
  targetTable: string;
  /** Target (referenced) column(s). */
  targetColumns: string[];
  /** Source schema (if applicable). */
  sourceSchema?: string;
  /** Target schema (if applicable). */
  targetSchema?: string;
}

/**
 * Index metadata.
 */
export interface IndexInfo {
  /** Index name. */
  name: string;
  /** Columns included in the index (in order). */
  columns: string[];
  /** Whether the index enforces uniqueness. */
  unique: boolean;
  /** Index type (btree, hash, gin, etc.). */
  type?: string;
  /** Whether this is the primary key index. */
  isPrimary?: boolean;
}

/**
 * Options for streaming rows from a table.
 */
export interface StreamRowsOptions {
  /** SQL WHERE clause (without the WHERE keyword). */
  where?: string;
  /** Number of rows per batch. Default: 1000. */
  batchSize?: number;
  /** Schema name. */
  schema?: string;
  /** Columns to select. Default: all (*). */
  columns?: string[];
  /** ORDER BY columns. Default: primary key or first column. */
  orderBy?: string[];
}

/**
 * Abstract interface for RDBMS drivers.
 *
 * Implementations must handle database-specific SQL dialects and
 * metadata catalog queries while exposing a uniform API.
 */
export interface RdbmsDriver {
  /** Driver type identifier (postgres, oracle, sqlite, etc.). */
  readonly type: string;

  /**
   * Connect to the database.
   * @param connectionString Database connection string or DSN.
   */
  connect(connectionString: string): Promise<void>;

  /**
   * Disconnect from the database and release resources.
   */
  disconnect(): Promise<void>;

  /**
   * List all tables (and optionally views) in the database or schema.
   * @param schema Schema name. Defaults vary by driver (e.g., "public" for PostgreSQL).
   */
  listTables(schema?: string): Promise<TableInfo[]>;

  /**
   * Get column metadata for a table.
   * @param table Table name.
   * @param schema Schema name.
   */
  getColumns(table: string, schema?: string): Promise<ColumnInfo[]>;

  /**
   * Get primary key column(s) for a table.
   * @param table Table name.
   * @param schema Schema name.
   * @returns Array of column names in key order.
   */
  getPrimaryKey(table: string, schema?: string): Promise<string[]>;

  /**
   * Get foreign keys defined ON this table (outgoing references).
   * @param table Table name.
   * @param schema Schema name.
   */
  getForeignKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]>;

  /**
   * Get foreign keys pointing TO this table (incoming references).
   * @param table Table name.
   * @param schema Schema name.
   */
  getReferencingKeys(table: string, schema?: string): Promise<ForeignKeyInfo[]>;

  /**
   * Get indexes for a table.
   * @param table Table name.
   * @param schema Schema name.
   */
  getIndexes(table: string, schema?: string): Promise<IndexInfo[]>;

  /**
   * Execute a SQL query and return all rows.
   * @param sql SQL query with parameter placeholders.
   * @param params Parameter values.
   */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;

  /**
   * Stream rows from a table in batches.
   *
   * Yields arrays of rows, each array containing up to `batchSize` rows.
   * Use this for large tables to avoid loading everything into memory.
   *
   * @param table Table name.
   * @param options Streaming options.
   */
  streamRows(
    table: string,
    options?: StreamRowsOptions,
  ): AsyncIterable<Record<string, unknown>[]>;

  /**
   * Get the total row count for a table.
   * @param table Table name.
   * @param schema Schema name.
   */
  countRows(table: string, schema?: string): Promise<number>;
}
