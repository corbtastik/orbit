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

// Driver types (public API)
export type {
  RdbmsDriver,
  RdbmsType,
  TableInfo,
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  StreamRowsOptions,
} from "./drivers/index.js";

// Driver classes (public API - type maps are internal)
export { PostgresDriver, MssqlDriver, SqliteDriver } from "./drivers/index.js";

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

// Mapping store
export { MappingStore } from "./mapping-store.js";
export type { ValidationResult, ValidationCheck } from "./mapping-store.js";

// Migration engine
export { MigrationExecutor, DocumentTransformer } from "./migration/index.js";
export type {
  MigrationOptions,
  MigrationProgress,
  MigrationResult,
  MigrationError,
  MigrationEstimate,
  VerificationResult,
  BatchMigrationResult,
} from "./migration/index.js";

// Generators
export { IndexGenerator, ValidationGenerator } from "./generators/index.js";
export type {
  IndexRecommendation,
  IndexGenerationResult,
  JsonSchemaProperty,
  ValidationSchema,
  ValidationGenerationResult,
} from "./generators/index.js";

// Tool imports
import { CONNECTION_TOOLS } from "./connection-tools.js";
import { SCHEMA_TOOLS } from "./schema-tools.js";
import { MAPPING_TOOLS } from "./mapping-tools.js";
import { MIGRATION_TOOLS } from "./migration-tools.js";
import { UTILITY_TOOLS } from "./utility-tools.js";

import type { RdbmsToolDef } from "./types.js";

/**
 * All RDBMS migration tools.
 *
 * Tools are registered with the MCP server and exposed to LLM clients.
 */
export const RDBMS_TOOLS: RdbmsToolDef[] = [
  // Connection tools (3)
  ...CONNECTION_TOOLS,

  // Schema tools (3)
  ...SCHEMA_TOOLS,

  // Mapping tools (6)
  ...MAPPING_TOOLS,

  // Migration tools (4)
  ...MIGRATION_TOOLS,

  // Utility tools (4)
  ...UTILITY_TOOLS,
];
