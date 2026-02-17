/**
 * Migration engine types.
 *
 * Defines types for migration execution, progress tracking, and results.
 */

/**
 * Options for migration execution.
 */
export interface MigrationOptions {
  /** Batch size for reading from source and inserting to target. Default: 1000 */
  batchSize?: number;

  /** Error handling strategy. Default: "log" */
  onError?: "abort" | "skip" | "log";

  /** Maximum errors before aborting (when onError = "log"). Default: 100 */
  maxErrors?: number;

  /** Drop target collection before migrating. Default: false */
  dropExisting?: boolean;

  /** Create indexes after migration. Default: false */
  createIndexes?: boolean;
}

/**
 * Progress tracking for a migration.
 */
export interface MigrationProgress {
  /** Mapping being migrated. */
  mappingId: string;

  /** Total source rows to process. */
  total: number;

  /** Rows processed so far. */
  processed: number;

  /** Documents successfully inserted. */
  succeeded: number;

  /** Rows that failed transformation or insert. */
  failed: number;

  /** Error details for failed rows. */
  errors: MigrationError[];

  /** Start timestamp. */
  startedAt: Date;

  /** Current phase. */
  phase: "preparing" | "migrating" | "verifying" | "complete" | "failed";

  /** Percentage complete (0-100). */
  percentComplete: number;
}

/**
 * Error during migration.
 */
export interface MigrationError {
  /** Source row that caused the error (first few fields). */
  rowSample: Record<string, unknown>;

  /** Error message. */
  message: string;

  /** Phase where error occurred. */
  phase: "transform" | "embed" | "insert";
}

/**
 * Result of migrating a single collection.
 */
export interface MigrationResult {
  /** Whether migration completed without fatal errors. */
  ok: boolean;

  /** Mapping ID that was migrated. */
  mappingId: string;

  /** Source table name. */
  sourceTable: string;

  /** Target collection name. */
  targetCollection: string;

  /** Number of source rows processed. */
  sourceRows: number;

  /** Number of documents inserted. */
  documentsInserted: number;

  /** Number of rows that failed. */
  failedRows: number;

  /** Error details (if any). */
  errors: MigrationError[];

  /** Duration in milliseconds. */
  durationMs: number;

  /** Whether collection was dropped before migration. */
  droppedExisting: boolean;
}

/**
 * Result of batch migration (multiple mappings).
 */
export interface BatchMigrationResult {
  /** Whether all migrations completed without fatal errors. */
  ok: boolean;

  /** Mappings migrated in order. */
  migratedInOrder: string[];

  /** Individual migration results. */
  results: MigrationResult[];

  /** Total documents inserted across all mappings. */
  totalDocuments: number;

  /** Total rows that failed across all mappings. */
  totalFailed: number;

  /** Total duration in milliseconds. */
  totalDurationMs: number;
}

/**
 * Estimation result for a migration.
 */
export interface MigrationEstimate {
  /** Mapping ID. */
  mappingId: string;

  /** Source table name. */
  sourceTable: string;

  /** Number of source rows. */
  rowCount: number;

  /** Estimated number of documents (may differ due to embeds/filters). */
  estimatedDocuments: number;

  /** Embed estimates. */
  embeds: EmbedEstimate[];

  /** Estimated total size in bytes. */
  estimatedSizeBytes: number;

  /** Human-readable size. */
  estimatedSize: string;
}

/**
 * Estimate for embedded documents.
 */
export interface EmbedEstimate {
  /** Source table for embedded documents. */
  sourceTable: string;

  /** Total rows in the embed source table. */
  totalRows: number;

  /** Average rows per parent document. */
  avgPerParent: number;
}

/**
 * Verification result.
 */
export interface VerificationResult {
  /** Whether counts match. */
  ok: boolean;

  /** Mapping ID. */
  mappingId: string;

  /** Source row count. */
  sourceCount: number;

  /** Target document count. */
  targetCount: number;

  /** Whether counts match (considering filters/embeds). */
  countsMatch: boolean;

  /** Difference (target - source). */
  difference: number;

  /** Sample comparisons (if requested). */
  sampleComparisons?: SampleComparison[];
}

/**
 * Comparison of a sample document.
 */
export interface SampleComparison {
  /** Source row ID. */
  sourceId: unknown;

  /** Whether document was found in target. */
  found: boolean;

  /** Whether all mapped fields match. */
  fieldsMatch: boolean;

  /** Mismatched fields (if any). */
  mismatches?: string[];
}
