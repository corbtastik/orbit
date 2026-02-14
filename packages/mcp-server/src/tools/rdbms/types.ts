/**
 * Core types for RDBMS migration tools.
 *
 * Defines tool interfaces, migration patterns, and mapping configurations
 * used throughout the RDBMS migration system.
 */

import type { RdbmsConnectionManager } from "./connection.js";
import type { ConnectionManager } from "../database/connection.js";

// Re-export driver types for convenience
export type { RdbmsType } from "./drivers/index.js";

/**
 * RDBMS tool operation types for access control.
 *
 * - "connection" — connect/disconnect operations (always allowed)
 * - "read"       — schema introspection, analysis (always allowed)
 * - "write"      — migration execution (blocked in read-only mode)
 */
export type RdbmsOperationType = "connection" | "read" | "write";

/**
 * Tool definition for RDBMS migration tools.
 *
 * Similar to DatabaseToolDef but receives both connection managers:
 * - rdbms: Source relational database connection
 * - mongo: Target MongoDB connection (for migration operations)
 */
export interface RdbmsToolDef {
  /** Tool name (e.g., "connect-rdbms", "introspect-schema"). */
  name: string;

  /** Human-readable description for the LLM. */
  description: string;

  /** Access control classification. */
  operationType: RdbmsOperationType;

  /** JSON Schema for tool parameters. */
  inputSchema: object;

  /**
   * Execute the tool.
   *
   * @param rdbms RDBMS connection manager (source databases).
   * @param mongo MongoDB connection manager (target database).
   * @param args Tool arguments from the LLM.
   * @returns Result object to be serialized as JSON.
   */
  execute: (
    rdbms: RdbmsConnectionManager,
    mongo: ConnectionManager,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}

/**
 * Migration patterns for transforming relational tables to MongoDB documents.
 *
 * - "direct"       — 1:1 mapping, table → collection, row → document
 * - "embed-one"    — Embed a single related row as a nested document
 * - "embed-many"   — Embed multiple related rows as an array of documents
 * - "reference"    — Store only the foreign key reference
 * - "extended-ref" — Store reference plus commonly accessed fields
 * - "subset"       — Embed frequently accessed fields, reference the rest
 * - "bucket"       — Group multiple rows into time-windowed documents
 */
export type MigrationPattern =
  | "direct"
  | "embed-one"
  | "embed-many"
  | "reference"
  | "extended-ref"
  | "subset"
  | "bucket";

/**
 * BSON types for MongoDB documents.
 */
export type BsonType =
  | "string"
  | "int"
  | "long"
  | "double"
  | "decimal"
  | "bool"
  | "date"
  | "objectId"
  | "array"
  | "object"
  | "binData"
  | "null";

/**
 * Column-level transformation configuration.
 */
export interface ColumnMapping {
  /** Source column name in the RDBMS table. */
  source: string;

  /** Target field name in the MongoDB document. */
  target: string;

  /** Target BSON type. If not specified, inferred from source type. */
  targetType?: BsonType;

  /**
   * Optional transformation to apply.
   *
   * Built-in transforms:
   * - "lowercase" — Convert string to lowercase
   * - "uppercase" — Convert string to uppercase
   * - "trim"      — Trim whitespace
   * - "date"      — Parse as date
   * - "objectId"  — Convert to ObjectId (if valid 24-char hex)
   */
  transform?: string;

  /** Exclude this column from the mapping. */
  exclude?: boolean;
}

/**
 * Configuration for embedding related documents.
 */
export interface EmbedConfig {
  /** Source table containing the child rows. */
  sourceTable: string;

  /** Foreign key column in the child table. */
  foreignKey: string;

  /** Target field name for the embedded document(s). */
  targetField: string;

  /** Embed as single document (one) or array (many). */
  cardinality: "one" | "many";

  /** Column mappings for the embedded document. If not specified, all columns. */
  columns?: ColumnMapping[];

  /** Maximum number of documents to embed (for "many"). Prevents unbounded growth. */
  maxItems?: number;

  /** Sort order for embedded array. */
  orderBy?: { column: string; direction: "asc" | "desc" }[];
}

/**
 * Configuration for document references.
 */
export interface ReferenceConfig {
  /** Source table being referenced. */
  sourceTable: string;

  /** Foreign key column in the current table. */
  foreignKey: string;

  /** Target field name for the reference. */
  targetField: string;

  /**
   * Additional fields to copy from the referenced table (extended reference pattern).
   * These fields are denormalized into the document for faster reads.
   */
  copyFields?: string[];
}

/**
 * Complete table-to-collection mapping configuration.
 */
export interface TableMapping {
  /** Unique identifier for this mapping. */
  id: string;

  /** Source RDBMS table name. */
  sourceTable: string;

  /** Source schema (if applicable). */
  sourceSchema?: string;

  /** Target MongoDB collection name. */
  targetCollection: string;

  /** Target MongoDB database name. */
  targetDatabase: string;

  /** Primary migration pattern for this table. */
  pattern: MigrationPattern;

  /** Column mappings. If not specified, all columns are mapped with inferred names/types. */
  columns?: ColumnMapping[];

  /** Embedded document configurations. */
  embeds?: EmbedConfig[];

  /** Reference configurations. */
  references?: ReferenceConfig[];

  /** Filter rows during migration (SQL WHERE clause without WHERE). */
  filter?: string;

  /** Whether this mapping has been validated. */
  validated?: boolean;

  /** Validation issues (if any). */
  validationIssues?: string[];
}

/**
 * Relationship analysis result.
 */
export interface RelationshipAnalysis {
  /** Source table. */
  table: string;

  /** Tables this table references (outgoing FKs). */
  referencesTo: {
    table: string;
    foreignKey: string;
    cardinality: "one" | "many";
  }[];

  /** Tables that reference this table (incoming FKs). */
  referencedBy: {
    table: string;
    foreignKey: string;
    cardinality: "one" | "many";
    averageCount?: number;
  }[];

  /** Whether this appears to be a junction table (N:N relationship). */
  isJunctionTable: boolean;

  /** Whether this table has self-referencing relationships. */
  hasSelfReference: boolean;
}

/**
 * Pattern recommendation from the analyzer.
 */
export interface PatternRecommendation {
  /** Recommended pattern. */
  pattern: MigrationPattern;

  /** Confidence score (0-1). */
  confidence: number;

  /** Human-readable reasoning. */
  reasoning: string;

  /** Pros of this pattern for this table. */
  pros: string[];

  /** Cons of this pattern for this table. */
  cons: string[];
}
