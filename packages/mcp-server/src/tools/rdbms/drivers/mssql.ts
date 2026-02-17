/**
 * SQL Server Driver implementation.
 *
 * Uses the `mssql` library to connect to SQL Server databases and
 * extract schema metadata via sys.* catalog views.
 */

import sql from "mssql";
import type {
  RdbmsDriver,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./types.js";

/**
 * SQL Server driver implementing the RdbmsDriver interface.
 */
export class MssqlDriver implements RdbmsDriver {
  readonly type = "mssql";
  private pool: sql.ConnectionPool | null = null;

  /**
   * Connect to SQL Server using a connection string.
   *
   * @param connectionString SQL Server connection string
   *   Format: mssql://user:password@host:port/database
   *   Or: Server=host;Database=db;User Id=user;Password=pass;Encrypt=true
   */
  async connect(connectionString: string): Promise<void> {
    // Parse connection string - mssql package accepts various formats
    const config = this.parseConnectionString(connectionString);

    this.pool = new sql.ConnectionPool(config);
    await this.pool.connect();

    // Test the connection
    await this.pool.request().query("SELECT 1 AS test");
  }

  /**
   * Parse connection string into mssql config object.
   */
  private parseConnectionString(connectionString: string): sql.config {
    // Handle URL-style connection string: mssql://user:pass@host:port/database
    if (connectionString.startsWith("mssql://") || connectionString.startsWith("sqlserver://")) {
      const url = new URL(connectionString.replace("mssql://", "http://").replace("sqlserver://", "http://"));

      return {
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        server: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 1433,
        database: url.pathname.slice(1), // Remove leading /
        options: {
          encrypt: true,
          trustServerCertificate: true, // For local dev; set false in production
        },
      };
    }

    // Handle ADO.NET style connection string
    // Server=host;Database=db;User Id=user;Password=pass;...
    const parts = connectionString.split(";");
    let server = "localhost";
    let database = "";
    let user = "";
    let password = "";
    let port = 1433;
    let encrypt = true;
    let trustServerCertificate = true;

    for (const part of parts) {
      const [key, ...valueParts] = part.split("=");
      const value = valueParts.join("="); // Handle = in password
      const normalizedKey = key?.trim().toLowerCase();

      switch (normalizedKey) {
        case "server":
        case "data source":
          server = value;
          break;
        case "database":
        case "initial catalog":
          database = value;
          break;
        case "user id":
        case "uid":
        case "user":
          user = value;
          break;
        case "password":
        case "pwd":
          password = value;
          break;
        case "port":
          port = parseInt(value, 10);
          break;
        case "encrypt":
          encrypt = value.toLowerCase() === "true";
          break;
        case "trustservercertificate":
          trustServerCertificate = value.toLowerCase() === "true";
          break;
      }
    }

    return {
      server,
      database,
      user,
      password,
      port,
      options: {
        encrypt,
        trustServerCertificate,
      },
    };
  }

  /**
   * Disconnect and close the connection pool.
   */
  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  /**
   * List all tables and views in the specified schema.
   */
  async listTables(schema = "dbo"): Promise<TableInfo[]> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .query<{
        name: string;
        type: string;
        row_count: number;
      }>(`
        SELECT
          t.name,
          'table' AS type,
          p.rows AS row_count
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0, 1)
        WHERE s.name = @schema

        UNION ALL

        SELECT
          v.name,
          'view' AS type,
          0 AS row_count
        FROM sys.views v
        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
        WHERE s.name = @schema

        ORDER BY name
      `);

    return result.recordset.map((row) => ({
      name: row.name,
      schema,
      type: row.type as "table" | "view",
      rowCount: row.type === "table" ? row.row_count : undefined,
    }));
  }

  /**
   * Get column metadata for a table.
   */
  async getColumns(table: string, schema = "dbo"): Promise<ColumnInfo[]> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query<{
        name: string;
        data_type: string;
        max_length: number;
        precision: number;
        scale: number;
        is_nullable: boolean;
        default_value: string | null;
        is_primary_key: boolean;
        is_identity: boolean;
      }>(`
        SELECT
          c.name,
          t.name AS data_type,
          c.max_length,
          c.precision,
          c.scale,
          c.is_nullable,
          dc.definition AS default_value,
          ISNULL(pk.is_primary_key, 0) AS is_primary_key,
          c.is_identity
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        INNER JOIN sys.tables tbl ON c.object_id = tbl.object_id
        INNER JOIN sys.schemas s ON tbl.schema_id = s.schema_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        LEFT JOIN (
          SELECT ic.column_id, ic.object_id, 1 AS is_primary_key
          FROM sys.index_columns ic
          INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          WHERE i.is_primary_key = 1
        ) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
        WHERE s.name = @schema
          AND tbl.name = @table
        ORDER BY c.column_id
      `);

    return result.recordset.map((row) => ({
      name: row.name,
      dataType: row.data_type,
      nullable: row.is_nullable,
      defaultValue: row.default_value ?? undefined,
      isPrimaryKey: row.is_primary_key,
      isAutoIncrement: row.is_identity,
      maxLength: this.normalizeMaxLength(row.data_type, row.max_length),
      precision: row.precision > 0 ? row.precision : undefined,
      scale: row.scale > 0 ? row.scale : undefined,
    }));
  }

  /**
   * Normalize max_length for SQL Server types.
   * SQL Server stores nvarchar/nchar length as bytes (2 per char).
   */
  private normalizeMaxLength(dataType: string, maxLength: number): number | undefined {
    if (maxLength === -1) {
      return undefined; // MAX length
    }
    if (["nvarchar", "nchar"].includes(dataType.toLowerCase())) {
      return maxLength / 2; // Unicode types store 2 bytes per char
    }
    if (["varchar", "char", "varbinary", "binary"].includes(dataType.toLowerCase())) {
      return maxLength;
    }
    return undefined;
  }

  /**
   * Get primary key columns for a table.
   */
  async getPrimaryKey(table: string, schema = "dbo"): Promise<string[]> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query<{ column_name: string }>(`
        SELECT c.name AS column_name
        FROM sys.index_columns ic
        INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE i.is_primary_key = 1
          AND s.name = @schema
          AND t.name = @table
        ORDER BY ic.key_ordinal
      `);

    return result.recordset.map((row) => row.column_name);
  }

  /**
   * Get foreign keys defined on this table (outgoing references).
   */
  async getForeignKeys(table: string, schema = "dbo"): Promise<ForeignKeyInfo[]> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query<{
        constraint_name: string;
        source_column: string;
        target_schema: string;
        target_table: string;
        target_column: string;
      }>(`
        SELECT
          fk.name AS constraint_name,
          c1.name AS source_column,
          s2.name AS target_schema,
          t2.name AS target_table,
          c2.name AS target_column
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.tables t1 ON fk.parent_object_id = t1.object_id
        INNER JOIN sys.schemas s1 ON t1.schema_id = s1.schema_id
        INNER JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
        INNER JOIN sys.tables t2 ON fk.referenced_object_id = t2.object_id
        INNER JOIN sys.schemas s2 ON t2.schema_id = s2.schema_id
        INNER JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
        WHERE s1.name = @schema
          AND t1.name = @table
        ORDER BY fk.name, fkc.constraint_column_id
      `);

    // Group by constraint name (for composite FKs)
    const fkMap = new Map<string, ForeignKeyInfo>();

    for (const row of result.recordset) {
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
  async getReferencingKeys(table: string, schema = "dbo"): Promise<ForeignKeyInfo[]> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query<{
        constraint_name: string;
        source_schema: string;
        source_table: string;
        source_column: string;
        target_column: string;
      }>(`
        SELECT
          fk.name AS constraint_name,
          s1.name AS source_schema,
          t1.name AS source_table,
          c1.name AS source_column,
          c2.name AS target_column
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.tables t1 ON fk.parent_object_id = t1.object_id
        INNER JOIN sys.schemas s1 ON t1.schema_id = s1.schema_id
        INNER JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
        INNER JOIN sys.tables t2 ON fk.referenced_object_id = t2.object_id
        INNER JOIN sys.schemas s2 ON t2.schema_id = s2.schema_id
        INNER JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
        WHERE s2.name = @schema
          AND t2.name = @table
        ORDER BY fk.name, fkc.constraint_column_id
      `);

    // Group by constraint name
    const fkMap = new Map<string, ForeignKeyInfo>();

    for (const row of result.recordset) {
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
  async getIndexes(table: string, schema = "dbo"): Promise<IndexInfo[]> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query<{
        index_name: string;
        column_name: string;
        is_unique: boolean;
        is_primary_key: boolean;
        type_desc: string;
      }>(`
        SELECT
          i.name AS index_name,
          c.name AS column_name,
          i.is_unique,
          i.is_primary_key,
          i.type_desc
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = @schema
          AND t.name = @table
          AND i.name IS NOT NULL
        ORDER BY i.name, ic.key_ordinal
      `);

    // Group by index name
    const indexMap = new Map<string, IndexInfo>();

    for (const row of result.recordset) {
      const existing = indexMap.get(row.index_name);
      if (existing) {
        existing.columns.push(row.column_name);
      } else {
        indexMap.set(row.index_name, {
          name: row.index_name,
          columns: [row.column_name],
          unique: row.is_unique,
          type: this.normalizeIndexType(row.type_desc),
          isPrimary: row.is_primary_key,
        });
      }
    }

    return Array.from(indexMap.values());
  }

  /**
   * Normalize SQL Server index type to a common format.
   */
  private normalizeIndexType(typeDesc: string): string {
    switch (typeDesc.toUpperCase()) {
      case "CLUSTERED":
        return "clustered";
      case "NONCLUSTERED":
        return "btree";
      case "HEAP":
        return "heap";
      case "CLUSTERED COLUMNSTORE":
      case "NONCLUSTERED COLUMNSTORE":
        return "columnstore";
      default:
        return typeDesc.toLowerCase();
    }
  }

  /**
   * Execute a SQL query and return all rows.
   */
  async query<T = Record<string, unknown>>(
    sqlQuery: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    this.ensureConnected();

    const request = this.pool!.request();

    // Bind positional parameters as @p0, @p1, etc.
    params.forEach((param, index) => {
      request.input(`p${index}`, param);
    });

    // Replace $1, $2 style placeholders with @p0, @p1 for compatibility
    const normalizedSql = sqlQuery.replace(/\$(\d+)/g, (_, num) => `@p${parseInt(num, 10) - 1}`);

    const result = await request.query<T>(normalizedSql);
    return result.recordset;
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
      schema = "dbo",
      columns,
      orderBy,
    } = options;

    const selectColumns = columns?.length ? columns.map(c => `[${c}]`).join(", ") : "*";
    const fullTable = `[${schema}].[${table}]`;

    // SQL Server requires ORDER BY for OFFSET/FETCH
    const orderClause = orderBy?.length
      ? `ORDER BY ${orderBy.map(c => `[${c}]`).join(", ")}`
      : "ORDER BY (SELECT NULL)"; // Arbitrary order if none specified

    let offset = 0;

    while (true) {
      const sqlQuery = `
        SELECT ${selectColumns}
        FROM ${fullTable}
        ${where ? `WHERE ${where}` : ""}
        ${orderClause}
        OFFSET ${offset} ROWS
        FETCH NEXT ${batchSize} ROWS ONLY
      `;

      const rows = await this.query(sqlQuery);

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
  async countRows(table: string, schema = "dbo"): Promise<number> {
    this.ensureConnected();

    const result = await this.pool!.request()
      .input("schema", sql.NVarChar, schema)
      .input("table", sql.NVarChar, table)
      .query<{ count: number }>(`
        SELECT SUM(p.rows) AS count
        FROM sys.partitions p
        INNER JOIN sys.tables t ON p.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE s.name = @schema
          AND t.name = @table
          AND p.index_id IN (0, 1)
      `);

    return result.recordset[0]?.count ?? 0;
  }

  /**
   * Ensure the database is connected.
   */
  private ensureConnected(): void {
    if (!this.pool || !this.pool.connected) {
      throw new Error("SQL Server driver is not connected.");
    }
  }
}

/**
 * SQL Server type to BSON type mapping.
 */
export const MSSQL_TYPE_MAP: Record<string, string> = {
  // Integers
  tinyint: "int",
  smallint: "int",
  int: "int",
  bigint: "long",

  // Floating point
  real: "double",
  float: "double",
  decimal: "decimal",
  numeric: "decimal",
  money: "decimal",
  smallmoney: "decimal",

  // Boolean
  bit: "bool",

  // Strings
  char: "string",
  varchar: "string",
  text: "string",
  nchar: "string",
  nvarchar: "string",
  ntext: "string",

  // Binary
  binary: "binData",
  varbinary: "binData",
  image: "binData",

  // Date/Time
  date: "date",
  time: "string",
  datetime: "date",
  datetime2: "date",
  smalldatetime: "date",
  datetimeoffset: "date",

  // Unique identifier
  uniqueidentifier: "string",

  // XML
  xml: "string",

  // Spatial (store as strings or GeoJSON)
  geometry: "object",
  geography: "object",

  // Other
  sql_variant: "string",
  hierarchyid: "string",
  timestamp: "binData", // rowversion
  rowversion: "binData",
};

/**
 * Map a SQL Server data type to a BSON type.
 */
export function mapMssqlTypeToBson(
  mssqlType: string,
  precision?: number,
  scale?: number,
): string {
  // Normalize type name
  const normalized = mssqlType.toLowerCase();

  // Special handling for decimal/numeric with precision (check before direct map)
  if (normalized === "decimal" || normalized === "numeric") {
    if (scale === 0 && precision !== undefined) {
      if (precision <= 9) return "int";
      if (precision <= 18) return "long";
    }
    return "decimal";
  }

  // Check direct mapping
  if (MSSQL_TYPE_MAP[normalized]) {
    return MSSQL_TYPE_MAP[normalized];
  }

  // Default to string for unknown types
  return "string";
}
