/**
 * RDBMS Driver factory and exports.
 *
 * Provides a unified factory function to create database-specific drivers.
 */

import type { RdbmsDriver } from "./types.js";
import { PostgresDriver } from "./postgres.js";

export type {
  RdbmsDriver,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./types.js";

export { PostgresDriver, PG_TYPE_MAP, mapPostgresTypeToBson } from "./postgres.js";

/**
 * Supported RDBMS types.
 */
export type RdbmsType = "postgres" | "oracle" | "sqlite" | "mysql" | "mssql";

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
    case "oracle":
      throw new Error(
        "Oracle driver not yet implemented. Coming in Phase 4.",
      );
    case "sqlite":
      throw new Error(
        "SQLite driver not yet implemented. Coming in Phase 3.",
      );
    case "mysql":
      throw new Error(
        "MySQL driver not yet implemented. Planned for future phase.",
      );
    case "mssql":
      throw new Error(
        "SQL Server driver not yet implemented. Planned for future phase.",
      );
    default:
      throw new Error(`Unknown RDBMS type: ${type}`);
  }
}
