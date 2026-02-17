/**
 * SQLite Driver implementation.
 *
 * Uses better-sqlite3 for synchronous, high-performance SQLite access.
 * Primarily used for testing but also supports SQLite migrations.
 */

import Database from "better-sqlite3";
import type {
  RdbmsDriver,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./types.js";

/**
 * SQLite driver implementing the RdbmsDriver interface.
 */
export class SqliteDriver implements RdbmsDriver {
  readonly type = "sqlite";
  private db: Database.Database | null = null;

  /**
   * Connect to a SQLite database.
   *
   * @param connectionString Path to database file, or ":memory:" for in-memory.
   */
  async connect(connectionString: string): Promise<void> {
    this.db = new Database(connectionString);
    // Enable foreign keys (off by default in SQLite)
    this.db.pragma("foreign_keys = ON");
  }

  /**
   * Disconnect and close the database.
   */
  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * List all tables and views in the database.
   * SQLite doesn't have schemas, so the schema parameter is ignored.
   */
  async listTables(_schema?: string): Promise<TableInfo[]> {
    this.ensureConnected();

    const sql = `
      SELECT name, type
      FROM sqlite_master
      WHERE type IN ('table', 'view')
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `;

    const rows = this.db!.prepare(sql).all() as { name: string; type: string }[];

    // Get row counts for tables
    const tables: TableInfo[] = [];
    for (const row of rows) {
      let rowCount: number | undefined;
      if (row.type === "table") {
        try {
          const countResult = this.db!
            .prepare(`SELECT COUNT(*) as count FROM "${row.name}"`)
            .get() as { count: number };
          rowCount = countResult.count;
        } catch {
          // Table might not exist or be corrupted
        }
      }

      tables.push({
        name: row.name,
        type: row.type === "table" ? "table" : "view",
        rowCount,
      });
    }

    return tables;
  }

  /**
   * Get column metadata for a table.
   */
  async getColumns(table: string, _schema?: string): Promise<ColumnInfo[]> {
    this.ensureConnected();

    // Get column info from PRAGMA
    const columns = this.db!.pragma(`table_info("${table}")`) as Array<{
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: string | null;
      pk: number;
    }>;

    // Check for autoincrement (only INTEGER PRIMARY KEY can be autoincrement)
    const createSql = this.db!
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`,
      )
      .get(table) as { sql: string } | undefined;

    const hasAutoincrement =
      createSql?.sql?.toUpperCase().includes("AUTOINCREMENT") ?? false;

    return columns.map((col) => {
      const isIntegerPk =
        col.pk === 1 && col.type.toUpperCase() === "INTEGER";

      return {
        name: col.name,
        dataType: col.type || "TEXT", // SQLite allows empty type
        nullable: col.notnull === 0,
        defaultValue: col.dflt_value ?? undefined,
        isPrimaryKey: col.pk > 0,
        isAutoIncrement: isIntegerPk && hasAutoincrement,
        // SQLite doesn't have precision/scale in the same way
        maxLength: undefined,
        precision: undefined,
        scale: undefined,
      };
    });
  }

  /**
   * Get primary key columns for a table.
   */
  async getPrimaryKey(table: string, _schema?: string): Promise<string[]> {
    this.ensureConnected();

    const columns = this.db!.pragma(`table_info("${table}")`) as Array<{
      name: string;
      pk: number;
    }>;

    return columns
      .filter((col) => col.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((col) => col.name);
  }

  /**
   * Get foreign keys defined on this table (outgoing references).
   */
  async getForeignKeys(table: string, _schema?: string): Promise<ForeignKeyInfo[]> {
    this.ensureConnected();

    const fks = this.db!.pragma(`foreign_key_list("${table}")`) as Array<{
      id: number;
      seq: number;
      table: string;
      from: string;
      to: string;
    }>;

    // Group by FK id (for composite keys)
    const fkMap = new Map<number, ForeignKeyInfo>();

    for (const fk of fks) {
      const existing = fkMap.get(fk.id);
      if (existing) {
        existing.sourceColumns.push(fk.from);
        existing.targetColumns.push(fk.to);
      } else {
        fkMap.set(fk.id, {
          constraintName: `fk_${table}_${fk.id}`,
          sourceTable: table,
          sourceColumns: [fk.from],
          targetTable: fk.table,
          targetColumns: [fk.to],
        });
      }
    }

    return Array.from(fkMap.values());
  }

  /**
   * Get foreign keys pointing to this table (incoming references).
   */
  async getReferencingKeys(table: string, _schema?: string): Promise<ForeignKeyInfo[]> {
    this.ensureConnected();

    // Get all tables
    const tables = this.db!
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      )
      .all() as { name: string }[];

    const referencingKeys: ForeignKeyInfo[] = [];

    for (const { name: sourceTable } of tables) {
      const fks = this.db!.pragma(`foreign_key_list("${sourceTable}")`) as Array<{
        id: number;
        seq: number;
        table: string;
        from: string;
        to: string;
      }>;

      // Filter FKs that point to our table
      const relevantFks = fks.filter(
        (fk) => fk.table.toLowerCase() === table.toLowerCase(),
      );

      // Group by FK id
      const fkMap = new Map<number, ForeignKeyInfo>();
      for (const fk of relevantFks) {
        const existing = fkMap.get(fk.id);
        if (existing) {
          existing.sourceColumns.push(fk.from);
          existing.targetColumns.push(fk.to);
        } else {
          fkMap.set(fk.id, {
            constraintName: `fk_${sourceTable}_${fk.id}`,
            sourceTable,
            sourceColumns: [fk.from],
            targetTable: table,
            targetColumns: [fk.to],
          });
        }
      }

      referencingKeys.push(...fkMap.values());
    }

    return referencingKeys;
  }

  /**
   * Get indexes for a table.
   */
  async getIndexes(table: string, _schema?: string): Promise<IndexInfo[]> {
    this.ensureConnected();

    // Get index list
    const indexes = this.db!.pragma(`index_list("${table}")`) as Array<{
      seq: number;
      name: string;
      unique: number;
      origin: string; // 'c' = CREATE INDEX, 'u' = UNIQUE constraint, 'pk' = PRIMARY KEY
    }>;

    const result: IndexInfo[] = [];

    for (const idx of indexes) {
      // Get columns in this index
      const indexInfo = this.db!.pragma(`index_info("${idx.name}")`) as Array<{
        seqno: number;
        cid: number;
        name: string;
      }>;

      result.push({
        name: idx.name,
        columns: indexInfo.map((col) => col.name),
        unique: idx.unique === 1,
        isPrimary: idx.origin === "pk",
        type: "btree", // SQLite only supports btree
      });
    }

    return result;
  }

  /**
   * Execute a SQL query and return all rows.
   */
  async query<T = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    this.ensureConnected();

    const stmt = this.db!.prepare(sql);
    return stmt.all(...params) as T[];
  }

  /**
   * Stream rows from a table in batches.
   */
  async *streamRows(
    table: string,
    options: StreamRowsOptions = {},
  ): AsyncIterable<Record<string, unknown>[]> {
    this.ensureConnected();

    const {
      where,
      batchSize = 1000,
      columns,
      orderBy,
    } = options;

    const selectColumns = columns?.length ? columns.join(", ") : "*";
    const orderClause = orderBy?.length
      ? `ORDER BY ${orderBy.join(", ")}`
      : "ORDER BY rowid"; // SQLite rowid for default ordering

    let offset = 0;

    while (true) {
      const sql = `
        SELECT ${selectColumns}
        FROM "${table}"
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
        break;
      }

      offset += batchSize;
    }
  }

  /**
   * Get the total row count for a table.
   */
  async countRows(table: string, _schema?: string): Promise<number> {
    this.ensureConnected();

    const result = this.db!
      .prepare(`SELECT COUNT(*) as count FROM "${table}"`)
      .get() as { count: number };

    return result.count;
  }

  /**
   * Ensure the database is connected.
   */
  private ensureConnected(): void {
    if (!this.db) {
      throw new Error("SQLite driver is not connected.");
    }
  }

  /**
   * Execute raw SQL (for setup/testing).
   */
  exec(sql: string): void {
    this.ensureConnected();
    this.db!.exec(sql);
  }

  /**
   * Get the underlying database instance (for testing).
   */
  getDatabase(): Database.Database | null {
    return this.db;
  }
}

/**
 * SQLite type to BSON type mapping.
 */
export const SQLITE_TYPE_MAP: Record<string, string> = {
  INTEGER: "int",
  REAL: "double",
  TEXT: "string",
  BLOB: "binData",
  NUMERIC: "decimal",
  BOOLEAN: "bool",
  DATE: "date",
  DATETIME: "date",
  TIMESTAMP: "date",
};

/**
 * Map a SQLite data type to a BSON type.
 */
export function mapSqliteTypeToBson(sqliteType: string): string {
  const normalized = sqliteType.toUpperCase().trim();

  // Direct mapping
  if (SQLITE_TYPE_MAP[normalized]) {
    return SQLITE_TYPE_MAP[normalized];
  }

  // Handle VARCHAR(n), CHAR(n), etc.
  if (normalized.startsWith("VARCHAR") || normalized.startsWith("CHAR")) {
    return "string";
  }

  // Handle INT, BIGINT, SMALLINT, etc.
  if (normalized.includes("INT")) {
    return normalized.includes("BIG") ? "long" : "int";
  }

  // Handle DECIMAL, NUMERIC with precision
  if (normalized.startsWith("DECIMAL") || normalized.startsWith("NUMERIC")) {
    return "decimal";
  }

  // Handle DOUBLE, FLOAT
  if (normalized.includes("DOUBLE") || normalized.includes("FLOAT")) {
    return "double";
  }

  // Default to string
  return "string";
}
