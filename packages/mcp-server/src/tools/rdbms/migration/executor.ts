/**
 * MigrationExecutor — executes migrations from RDBMS to MongoDB.
 *
 * Handles streaming, batching, progress tracking, and error handling.
 */

import type { Collection, Db } from "mongodb";
import type { RdbmsDriver } from "../drivers/types.js";
import type { TableMapping } from "../types.js";
import type {
  MigrationOptions,
  MigrationProgress,
  MigrationResult,
  MigrationEstimate,
  EmbedEstimate,
  VerificationResult,
  BatchMigrationResult,
} from "./types.js";
import { DocumentTransformer } from "./transformer.js";
import { validateSqlFilter } from "../mapping-tools/helpers.js";

/**
 * Default migration options.
 */
const DEFAULT_OPTIONS: Required<MigrationOptions> = {
  batchSize: 1000,
  onError: "log",
  maxErrors: 100,
  dropExisting: false,
  createIndexes: false,
};

/**
 * Executes migrations from RDBMS to MongoDB.
 */
export class MigrationExecutor {
  private transformer: DocumentTransformer;

  constructor() {
    this.transformer = new DocumentTransformer();
  }

  /**
   * Estimate the scope of a migration.
   */
  async estimate(
    mapping: TableMapping,
    driver: RdbmsDriver,
  ): Promise<MigrationEstimate> {
    const schema = mapping.sourceSchema;
    const table = mapping.sourceTable;

    // Get source row count
    const rowCount = await driver.countRows(table, schema);

    // Estimate embeds
    const embeds: EmbedEstimate[] = [];

    if (mapping.embeds) {
      for (const embed of mapping.embeds) {
        const embedCount = await driver.countRows(embed.sourceTable, schema);
        const avgPerParent = rowCount > 0 ? embedCount / rowCount : 0;

        embeds.push({
          sourceTable: embed.sourceTable,
          totalRows: embedCount,
          avgPerParent: Math.round(avgPerParent * 10) / 10,
        });
      }
    }

    // Estimate document count (same as row count for most patterns)
    let estimatedDocuments = rowCount;

    // For junction tables that get embedded elsewhere, they produce 0 documents
    if (mapping.pattern === "embed-many" && mapping.embeds?.length === 0) {
      // This table is being embedded into another - check if it's a junction table
      const columns = await driver.getColumns(table, schema);
      const foreignKeys = await driver.getForeignKeys(table, schema);

      if (foreignKeys.length === 2 && columns.length <= 4) {
        // Likely a junction table - its rows become embedded arrays
        estimatedDocuments = 0;
      }
    }

    // Estimate size (rough: 500 bytes per row + 200 per embed)
    const baseSize = rowCount * 500;
    const embedSize = embeds.reduce((sum, e) => sum + e.totalRows * 200, 0);
    const estimatedSizeBytes = baseSize + embedSize;

    return {
      mappingId: mapping.id,
      sourceTable: table,
      rowCount,
      estimatedDocuments,
      embeds,
      estimatedSizeBytes,
      estimatedSize: this.formatBytes(estimatedSizeBytes),
    };
  }

  /**
   * Execute migration for a single mapping.
   */
  async migrate(
    mapping: TableMapping,
    driver: RdbmsDriver,
    db: Db,
    options: MigrationOptions = {},
  ): Promise<MigrationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const startTime = Date.now();

    const schema = mapping.sourceSchema;
    const table = mapping.sourceTable;
    const collectionName = mapping.targetCollection;

    // Initialize progress
    const progress: MigrationProgress = {
      mappingId: mapping.id,
      total: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
      startedAt: new Date(),
      phase: "preparing",
      percentComplete: 0,
    };

    // Get total count for progress tracking
    progress.total = await driver.countRows(table, schema);
    progress.phase = "migrating";

    // Handle collection preparation
    const collection = db.collection(collectionName);
    let droppedExisting = false;

    if (opts.dropExisting) {
      try {
        await collection.drop();
        droppedExisting = true;
      } catch {
        // Collection may not exist - that's fine
      }
    }

    // Validate filter for SQL injection (defense in depth)
    const safeFilter = validateSqlFilter(mapping.filter);

    // Stream rows and migrate
    const streamOptions = {
      schema,
      batchSize: opts.batchSize,
      where: safeFilter,
    };

    try {
      for await (const batch of driver.streamRows(table, streamOptions)) {
        await this.processBatch(
          batch,
          mapping,
          driver,
          schema,
          collection,
          progress,
          opts,
        );

        // Check max errors
        if (opts.onError === "log" && progress.errors.length > opts.maxErrors) {
          throw new Error(
            `Maximum errors (${opts.maxErrors}) exceeded. ` +
            `Processed ${progress.processed}/${progress.total} rows.`
          );
        }
      }

      progress.phase = "complete";
    } catch (err) {
      progress.phase = "failed";

      if (opts.onError === "abort") {
        throw err;
      }

      // Log the fatal error
      progress.errors.push({
        rowSample: {},
        message: err instanceof Error ? err.message : String(err),
        phase: "insert",
      });
    }

    const durationMs = Date.now() - startTime;

    return {
      ok: progress.phase === "complete",
      mappingId: mapping.id,
      sourceTable: table,
      targetCollection: collectionName,
      sourceRows: progress.total,
      documentsInserted: progress.succeeded,
      failedRows: progress.failed,
      errors: progress.errors,
      durationMs,
      droppedExisting,
    };
  }

  /**
   * Process a batch of rows.
   */
  private async processBatch(
    rows: Record<string, unknown>[],
    mapping: TableMapping,
    driver: RdbmsDriver,
    schema: string | undefined,
    collection: Collection,
    progress: MigrationProgress,
    opts: Required<MigrationOptions>,
  ): Promise<void> {
    // Transform rows to documents
    const docs: Record<string, unknown>[] = [];

    for (const row of rows) {
      try {
        const doc = this.transformer.transformRow(row, mapping);
        docs.push(doc);
      } catch (err) {
        progress.failed++;
        progress.processed++;

        if (opts.onError === "abort") {
          throw err;
        }

        if (opts.onError === "log") {
          progress.errors.push({
            rowSample: this.sampleRow(row),
            message: err instanceof Error ? err.message : String(err),
            phase: "transform",
          });
        }
      }
    }

    // Resolve embeds and references
    if (docs.length > 0) {
      try {
        await this.transformer.applyEmbedsAndReferences(
          rows.slice(0, docs.length),
          docs,
          mapping,
          driver,
          schema,
        );
      } catch (err) {
        // Embed resolution failed for the batch
        if (opts.onError === "abort") {
          throw err;
        }

        if (opts.onError === "log") {
          progress.errors.push({
            rowSample: {},
            message: `Embed resolution failed: ${err instanceof Error ? err.message : String(err)}`,
            phase: "embed",
          });
        }
      }
    }

    // Insert documents
    if (docs.length > 0) {
      try {
        const result = await collection.insertMany(docs, { ordered: false });
        progress.succeeded += result.insertedCount;
      } catch (err: unknown) {
        // Handle partial insert failures
        const bulkError = err as { insertedCount?: number; writeErrors?: unknown[] };

        if (bulkError.insertedCount !== undefined) {
          progress.succeeded += bulkError.insertedCount;
          progress.failed += docs.length - bulkError.insertedCount;

          if (opts.onError === "log") {
            progress.errors.push({
              rowSample: {},
              message: `Partial insert: ${bulkError.insertedCount}/${docs.length} succeeded`,
              phase: "insert",
            });
          }
        } else {
          progress.failed += docs.length;

          if (opts.onError === "abort") {
            throw err;
          }

          if (opts.onError === "log") {
            progress.errors.push({
              rowSample: {},
              message: err instanceof Error ? err.message : String(err),
              phase: "insert",
            });
          }
        }
      }
    }

    // Update progress
    progress.processed += rows.length;
    progress.percentComplete = Math.round(
      (progress.processed / progress.total) * 100
    );
  }

  /**
   * Migrate multiple mappings in dependency order.
   */
  async migrateAll(
    mappings: TableMapping[],
    driver: RdbmsDriver,
    db: Db,
    options: MigrationOptions = {},
  ): Promise<BatchMigrationResult> {
    const startTime = Date.now();

    // Order mappings by dependencies (referenced tables first)
    const ordered = this.orderByDependencies(mappings);
    const results: MigrationResult[] = [];

    for (const mapping of ordered) {
      const result = await this.migrate(mapping, driver, db, options);
      results.push(result);

      // Stop if a migration failed and onError is "abort"
      if (!result.ok && options.onError === "abort") {
        break;
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const totalDocuments = results.reduce((sum, r) => sum + r.documentsInserted, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failedRows, 0);
    const allOk = results.every((r) => r.ok);

    return {
      ok: allOk,
      migratedInOrder: ordered.map((m) => m.id),
      results,
      totalDocuments,
      totalFailed,
      totalDurationMs,
    };
  }

  /**
   * Verify a migration by comparing counts.
   */
  async verify(
    mapping: TableMapping,
    driver: RdbmsDriver,
    db: Db,
    sampleSize = 0,
  ): Promise<VerificationResult> {
    const schema = mapping.sourceSchema;
    const table = mapping.sourceTable;
    const collectionName = mapping.targetCollection;

    // Get counts
    const sourceCount = await driver.countRows(table, schema);
    const collection = db.collection(collectionName);
    const targetCount = await collection.countDocuments();

    // Account for filters
    let expectedCount = sourceCount;
    if (mapping.filter) {
      // Validate filter for SQL injection (defense in depth)
      const safeFilter = validateSqlFilter(mapping.filter);

      const filteredSql = driver.type === "sqlite"
        ? `SELECT COUNT(*) as count FROM "${table}" WHERE ${safeFilter}`
        : `SELECT COUNT(*) as count FROM "${schema ?? "public"}"."${table}" WHERE ${safeFilter}`;

      const result = await driver.query<{ count: number }>(filteredSql);
      expectedCount = result[0]?.count ?? sourceCount;
    }

    const countsMatch = targetCount === expectedCount;
    const difference = targetCount - expectedCount;

    const result: VerificationResult = {
      ok: countsMatch,
      mappingId: mapping.id,
      sourceCount: expectedCount,
      targetCount,
      countsMatch,
      difference,
    };

    // Sample comparison if requested
    if (sampleSize > 0 && countsMatch) {
      result.sampleComparisons = await this.compareSamples(
        mapping,
        driver,
        collection,
        sampleSize,
      );
    }

    return result;
  }

  /**
   * Compare sample documents between source and target.
   */
  private async compareSamples(
    mapping: TableMapping,
    driver: RdbmsDriver,
    collection: Collection,
    sampleSize: number,
  ): Promise<VerificationResult["sampleComparisons"]> {
    const schema = mapping.sourceSchema;
    const table = mapping.sourceTable;

    // Get sample source rows
    const sampleSql = driver.type === "sqlite"
      ? `SELECT * FROM "${table}" LIMIT ${sampleSize}`
      : `SELECT * FROM "${schema ?? "public"}"."${table}" LIMIT ${sampleSize}`;

    const sourceRows = await driver.query(sampleSql);
    const comparisons: VerificationResult["sampleComparisons"] = [];

    for (const row of sourceRows) {
      const sourceId = row.id ?? row.ID ?? row._id ?? Object.values(row)[0];

      // Find corresponding document using generic filter (RDBMS IDs may be string/number)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const doc = await collection.findOne({ _id: sourceId } as any) ??
                  await collection.findOne({ id: sourceId } as Record<string, unknown>);

      if (!doc) {
        comparisons.push({
          sourceId,
          found: false,
          fieldsMatch: false,
        });
        continue;
      }

      // Compare fields
      const mismatches: string[] = [];

      for (const colMapping of mapping.columns ?? []) {
        if (colMapping.exclude) continue;

        const sourceValue = row[colMapping.source];
        const targetKey = colMapping.target ?? this.camelCase(colMapping.source);
        const targetValue = doc[targetKey];

        if (!this.valuesEqual(sourceValue, targetValue)) {
          mismatches.push(targetKey);
        }
      }

      comparisons.push({
        sourceId,
        found: true,
        fieldsMatch: mismatches.length === 0,
        mismatches: mismatches.length > 0 ? mismatches : undefined,
      });
    }

    return comparisons;
  }

  /**
   * Order mappings by dependencies (topological sort).
   */
  private orderByDependencies(mappings: TableMapping[]): TableMapping[] {
    // Build dependency graph
    const deps = new Map<string, Set<string>>();
    const mappingMap = new Map<string, TableMapping>();

    for (const m of mappings) {
      mappingMap.set(m.sourceTable, m);
      deps.set(m.sourceTable, new Set());

      // Add dependencies from references
      if (m.references) {
        for (const ref of m.references) {
          deps.get(m.sourceTable)!.add(ref.sourceTable);
        }
      }
    }

    // Topological sort (Kahn's algorithm)
    const result: TableMapping[] = [];
    const noIncoming = new Set<string>();

    // Find nodes with no dependencies
    for (const [table, tableDeps] of deps) {
      // Only consider dependencies that are in our mapping set
      const relevantDeps = new Set([...tableDeps].filter((d) => mappingMap.has(d)));
      deps.set(table, relevantDeps);

      if (relevantDeps.size === 0) {
        noIncoming.add(table);
      }
    }

    while (noIncoming.size > 0) {
      const table = noIncoming.values().next().value as string;
      noIncoming.delete(table);

      const mapping = mappingMap.get(table);
      if (mapping) {
        result.push(mapping);
      }

      // Remove this node from all dependency lists
      for (const [t, tableDeps] of deps) {
        if (tableDeps.has(table)) {
          tableDeps.delete(table);
          if (tableDeps.size === 0 && !result.some((m) => m.sourceTable === t)) {
            noIncoming.add(t);
          }
        }
      }
    }

    // Add any remaining mappings (circular dependencies - just add them)
    for (const m of mappings) {
      if (!result.includes(m)) {
        result.push(m);
      }
    }

    return result;
  }

  /**
   * Compare two values for equality.
   */
  private valuesEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null && b == null) return true;

    // Handle date comparison
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() === b.getTime();
    }

    // Handle numeric comparison (SQL might return string)
    if (typeof a === "number" || typeof b === "number") {
      return Number(a) === Number(b);
    }

    return String(a) === String(b);
  }

  /**
   * Get a sample of a row for error reporting.
   */
  private sampleRow(row: Record<string, unknown>): Record<string, unknown> {
    const entries = Object.entries(row).slice(0, 5);
    const sample: Record<string, unknown> = {};

    for (const [key, value] of entries) {
      sample[key] = typeof value === "string" && value.length > 50
        ? value.slice(0, 50) + "..."
        : value;
    }

    return sample;
  }

  /**
   * Convert snake_case to camelCase.
   */
  private camelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  /**
   * Format bytes as human-readable string.
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}
