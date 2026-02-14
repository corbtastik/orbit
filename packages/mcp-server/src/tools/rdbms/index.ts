/**
 * RDBMS Migration Tools — barrel export.
 *
 * Provides tools for migrating data from relational databases (PostgreSQL,
 * Oracle, SQLite, etc.) to MongoDB, following schema design best practices.
 *
 * Tools are organized into categories:
 * - Connection: connect-rdbms, disconnect-rdbms, list-rdbms
 * - Schema: introspect-schema, analyze-relationships, recommend-patterns
 * - Mapping: create-mapping, preview-document, validate-mapping
 * - Migration: estimate-migration, migrate-collection, migrate-all, verify-migration
 * - Utility: generate-indexes, generate-validation, export-mapping, import-mapping
 */

// Connection manager
export { RdbmsConnectionManager } from "./connection.js";
export type { RdbmsConnectionStatus } from "./connection.js";

// Driver types
export type {
  RdbmsDriver,
  RdbmsType,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./drivers/index.js";

// Driver exports
export { PostgresDriver, PG_TYPE_MAP, mapPostgresTypeToBson } from "./drivers/index.js";

// Core types
export type {
  RdbmsOperationType,
  RdbmsToolDef,
  MigrationPattern,
  BsonType,
  ColumnMapping,
  EmbedConfig,
  ReferenceConfig,
  TableMapping,
  RelationshipAnalysis,
  PatternRecommendation,
} from "./types.js";

// Tool imports
import { CONNECTION_TOOLS } from "./connection-tools.js";
import { SCHEMA_TOOLS } from "./schema-tools.js";
// import { MAPPING_TOOLS } from "./mapping-tools.js";
// import { MIGRATION_TOOLS } from "./migration-tools.js";
// import { UTILITY_TOOLS } from "./utility-tools.js";

import type { RdbmsToolDef } from "./types.js";

/**
 * All RDBMS migration tools.
 *
 * Tools are registered with the MCP server and exposed to LLM clients.
 */
export const RDBMS_TOOLS: RdbmsToolDef[] = [
  // Phase 2: Connection tools (3)
  ...CONNECTION_TOOLS,

  // Phase 2: Schema tools (3)
  ...SCHEMA_TOOLS,

  // Phase 5: Mapping tools
  // ...MAPPING_TOOLS,

  // Phase 6: Migration tools
  // ...MIGRATION_TOOLS,

  // Phase 6: Utility tools
  // ...UTILITY_TOOLS,
];
