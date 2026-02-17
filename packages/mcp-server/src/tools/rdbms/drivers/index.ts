/**
 * RDBMS Driver factory and exports.
 *
 * Provides a unified factory function to create database-specific drivers.
 */

import type { RdbmsDriver } from "./types.js";
import { PostgresDriver } from "./postgres.js";
import { SqliteDriver } from "./sqlite.js";
import { MssqlDriver } from "./mssql.js";

export type {
  RdbmsDriver,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./types.js";

export { PostgresDriver, PG_TYPE_MAP, mapPostgresTypeToBson } from "./postgres.js";
export { SqliteDriver, SQLITE_TYPE_MAP, mapSqliteTypeToBson } from "./sqlite.js";
export { MssqlDriver, MSSQL_TYPE_MAP, mapMssqlTypeToBson } from "./mssql.js";

/**
 * Supported RDBMS types.
 */
export type RdbmsType = "postgres" | "sqlite" | "mssql" | "oracle" | "mysql";

/**
 * Create a driver instance for the specified database type.
 *
 * @param type The RDBMS type.
 * @returns A new driver instance (not yet connected).
 * @throws Error if the driver type is not implemented.
 */
export function createDriver(type: RdbmsType): RdbmsDriver {
  switch (type) {
    case "postgres":
      return new PostgresDriver();
    case "sqlite":
      return new SqliteDriver();
    case "mssql":
      return new MssqlDriver();
    case "oracle":
      throw new Error(
        "Oracle driver not yet implemented. Planned for future phase.",
      );
    case "mysql":
      throw new Error(
        "MySQL driver not yet implemented. Planned for future phase.",
      );
    default:
      throw new Error(`Unknown RDBMS type: ${type}`);
  }
}
