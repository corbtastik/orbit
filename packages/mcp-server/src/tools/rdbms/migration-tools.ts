/**
 * RDBMS Migration tools.
 *
 * Tools for estimating, executing, and verifying migrations.
 */

import type { RdbmsToolDef } from "./types.js";
import type { ConnectionManager } from "../database/connection.js";
import { MigrationExecutor } from "./migration/index.js";
import type { MigrationOptions } from "./migration/index.js";
import { getMappingStore } from "./utils.js";

/**
 * estimate-migration — Estimate the scope of a migration.
 */
const estimateMigrationTool: RdbmsToolDef = {
  name: "estimate-migration",
  description:
    "Estimate the scope of a migration: row counts, document counts, " +
    "embedded document counts, and approximate data size. " +
    "Use this before migrating to understand the workload.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      connection: {
        type: "string",
        description: "RDBMS connection name.",
      },
      mapping: {
        type: "string",
        description: "Mapping ID or table name to estimate.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const connName = args.connection as string | undefined;
    const mappingId = args.mapping as string;

    const driver = rdbms.getDriver(connName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(
        `Mapping "${mappingId}" not found. Use create-mapping first.`
      );
    }

    const executor = new MigrationExecutor();
    const estimate = await executor.estimate(mapping, driver);

    return {
      ok: true,
      ...estimate,
    };
  },
};

/**
 * migrate-collection — Execute migration for a single mapping.
 */
const migrateCollectionTool: RdbmsToolDef = {
  name: "migrate-collection",
  description:
    "Execute migration for a single table-to-collection mapping. " +
    "Streams data from the source RDBMS table, transforms according to " +
    "the mapping configuration, and inserts into the target MongoDB collection.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      rdbmsConnection: {
        type: "string",
        description: "RDBMS connection name for source database.",
      },
      mongoConnection: {
        type: "string",
        description: "MongoDB connection name for target database.",
      },
      mapping: {
        type: "string",
        description: "Mapping ID or table name to migrate.",
      },
      batchSize: {
        type: "number",
        description: "Number of rows to process per batch. Default: 1000.",
      },
      onError: {
        type: "string",
        enum: ["abort", "skip", "log"],
        description:
          "Error handling: 'abort' stops on first error, 'skip' ignores errors, " +
          "'log' continues but records errors. Default: 'log'.",
      },
      maxErrors: {
        type: "number",
        description:
          "Maximum errors before aborting (when onError='log'). Default: 100.",
      },
      dropExisting: {
        type: "boolean",
        description: "Drop target collection before migrating. Default: false.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, mongo, args) => {
    const rdbmsConnName = args.rdbmsConnection as string | undefined;
    const mongoConnName = args.mongoConnection as string | undefined;
    const mappingId = args.mapping as string;

    const driver = rdbms.getDriver(rdbmsConnName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping "${mappingId}" not found.`);
    }

    // Get MongoDB database
    const db = getMongoDb(mongo, mongoConnName, mapping.targetDatabase);

    const options: MigrationOptions = {
      batchSize: args.batchSize as number | undefined,
      onError: args.onError as "abort" | "skip" | "log" | undefined,
      maxErrors: args.maxErrors as number | undefined,
      dropExisting: args.dropExisting as boolean | undefined,
    };

    const executor = new MigrationExecutor();
    const result = await executor.migrate(mapping, driver, db, options);

    return {
      ...result,
      message: result.ok
        ? `Migration complete: ${result.documentsInserted} documents inserted.`
        : `Migration completed with errors: ${result.documentsInserted} inserted, ${result.failedRows} failed.`,
    };
  },
};

/**
 * migrate-all — Migrate multiple mappings in dependency order.
 */
const migrateAllTool: RdbmsToolDef = {
  name: "migrate-all",
  description:
    "Migrate multiple mappings in dependency order. Tables that are " +
    "referenced by other tables are migrated first. If no mappings are " +
    "specified, migrates all defined mappings.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      rdbmsConnection: {
        type: "string",
        description: "RDBMS connection name for source database.",
      },
      mongoConnection: {
        type: "string",
        description: "MongoDB connection name for target database.",
      },
      mappings: {
        type: "array",
        items: { type: "string" },
        description:
          "List of mapping IDs to migrate. If not specified, migrates all mappings.",
      },
      batchSize: {
        type: "number",
        description: "Number of rows to process per batch. Default: 1000.",
      },
      onError: {
        type: "string",
        enum: ["abort", "skip", "log"],
        description: "Error handling strategy. Default: 'log'.",
      },
      maxErrors: {
        type: "number",
        description: "Maximum errors per collection. Default: 100.",
      },
      dropExisting: {
        type: "boolean",
        description: "Drop target collections before migrating. Default: false.",
      },
    },
  },
  execute: async (rdbms, mongo, args) => {
    const rdbmsConnName = args.rdbmsConnection as string | undefined;
    const mongoConnName = args.mongoConnection as string | undefined;
    const mappingIds = args.mappings as string[] | undefined;

    const driver = rdbms.getDriver(rdbmsConnName);
    const store = getMappingStore(rdbms);

    // Get mappings to migrate
    let mappings = store.list();

    if (mappingIds && mappingIds.length > 0) {
      mappings = mappingIds.map((id) => {
        const mapping = store.get(id);
        if (!mapping) {
          throw new Error(`Mapping "${id}" not found.`);
        }
        return mapping;
      });
    }

    if (mappings.length === 0) {
      return {
        ok: true,
        message: "No mappings to migrate. Use create-mapping first.",
        migratedInOrder: [],
        results: [],
        totalDocuments: 0,
        totalFailed: 0,
        totalDurationMs: 0,
      };
    }

    // All mappings should use the same target database (use first mapping's database)
    const targetDatabase = mappings[0].targetDatabase;
    const db = getMongoDb(mongo, mongoConnName, targetDatabase);

    const options: MigrationOptions = {
      batchSize: args.batchSize as number | undefined,
      onError: args.onError as "abort" | "skip" | "log" | undefined,
      maxErrors: args.maxErrors as number | undefined,
      dropExisting: args.dropExisting as boolean | undefined,
    };

    const executor = new MigrationExecutor();
    const result = await executor.migrateAll(mappings, driver, db, options);

    return {
      ...result,
      message: result.ok
        ? `Migration complete: ${result.totalDocuments} documents inserted across ${result.results.length} collections.`
        : `Migration completed with errors: ${result.totalDocuments} inserted, ${result.totalFailed} failed.`,
    };
  },
};

/**
 * verify-migration — Verify a migration by comparing counts.
 */
const verifyMigrationTool: RdbmsToolDef = {
  name: "verify-migration",
  description:
    "Verify a migration by comparing source row counts with target " +
    "document counts. Optionally compares sample documents field by field.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      rdbmsConnection: {
        type: "string",
        description: "RDBMS connection name for source database.",
      },
      mongoConnection: {
        type: "string",
        description: "MongoDB connection name for target database.",
      },
      mapping: {
        type: "string",
        description: "Mapping ID or table name to verify.",
      },
      sampleSize: {
        type: "number",
        description:
          "Number of documents to compare field by field. Default: 0 (count only).",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, mongo, args) => {
    const rdbmsConnName = args.rdbmsConnection as string | undefined;
    const mongoConnName = args.mongoConnection as string | undefined;
    const mappingId = args.mapping as string;
    const sampleSize = (args.sampleSize as number) ?? 0;

    const driver = rdbms.getDriver(rdbmsConnName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping "${mappingId}" not found.`);
    }

    const db = getMongoDb(mongo, mongoConnName, mapping.targetDatabase);

    const executor = new MigrationExecutor();
    const result = await executor.verify(mapping, driver, db, sampleSize);

    return {
      ...result,
      message: result.countsMatch
        ? `Verification passed: ${result.sourceCount} source rows = ${result.targetCount} target documents.`
        : `Verification failed: ${result.sourceCount} source rows ≠ ${result.targetCount} target documents (diff: ${result.difference}).`,
    };
  },
};

/**
 * Get MongoDB database from connection manager.
 */
function getMongoDb(
  mongo: ConnectionManager,
  connectionName: string | undefined,
  database: string,
) {
  if (connectionName) {
    if (!mongo.isConnectedNamed(connectionName)) {
      throw new Error(
        `MongoDB connection "${connectionName}" is not connected.`
      );
    }
    return mongo.getNamedDb(connectionName, database);
  }

  if (!mongo.isConnected()) {
    throw new Error(
      "Not connected to MongoDB. Use the connect tool first, " +
      "or specify a mongoConnection parameter."
    );
  }

  return mongo.getDb(database);
}

/**
 * All migration tools.
 */
export const MIGRATION_TOOLS: RdbmsToolDef[] = [
  estimateMigrationTool,
  migrateCollectionTool,
  migrateAllTool,
  verifyMigrationTool,
];
