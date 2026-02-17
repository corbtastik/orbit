/**
 * RDBMS Utility tools.
 *
 * Tools for generating indexes, validation schemas, and exporting/importing mappings.
 */

import type { RdbmsToolDef } from "./types.js";
import type { RdbmsConnectionManager } from "./connection.js";
import { MappingStore } from "./mapping-store.js";
import { IndexGenerator } from "./generators/index-generator.js";
import { ValidationGenerator } from "./generators/validation-generator.js";
import type { ConnectionManager } from "../database/connection.js";

/**
 * Extended connection manager with mapping store.
 */
interface RdbmsConnectionManagerWithStore extends RdbmsConnectionManager {
  _mappingStore?: MappingStore;
}

/**
 * Get the mapping store from the connection manager.
 */
function getMappingStore(rdbms: RdbmsConnectionManager): MappingStore {
  const manager = rdbms as RdbmsConnectionManagerWithStore;
  if (!manager._mappingStore) {
    manager._mappingStore = new MappingStore();
  }
  return manager._mappingStore;
}

/**
 * generate-indexes — Generate MongoDB index recommendations from RDBMS indexes.
 */
const generateIndexesTool: RdbmsToolDef = {
  name: "generate-indexes",
  description:
    "Generate MongoDB index recommendations from RDBMS indexes. " +
    "Translates source table indexes to MongoDB equivalents, accounting for " +
    "field name mappings and excluded columns. Can optionally apply indexes directly.",
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
        description: "Mapping ID or table name.",
      },
      apply: {
        type: "boolean",
        description:
          "Apply indexes to MongoDB collection immediately. Default: false (preview only).",
      },
      mongoConnection: {
        type: "string",
        description: "MongoDB connection name (required if apply=true).",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, mongo, args) => {
    const connName = args.connection as string | undefined;
    const mappingId = args.mapping as string;
    const apply = args.apply as boolean | undefined;
    const mongoConnName = args.mongoConnection as string | undefined;

    const driver = rdbms.getDriver(connName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(
        `Mapping "${mappingId}" not found. Use create-mapping first.`
      );
    }

    // Get source indexes
    const indexes = await driver.getIndexes(
      mapping.sourceTable,
      mapping.sourceSchema
    );

    // Generate recommendations
    const generator = new IndexGenerator();
    const result = generator.generate(mapping, indexes);

    // Apply if requested
    if (apply) {
      const db = getMongoDb(mongo, mongoConnName, mapping.targetDatabase);
      const applyResult = await generator.apply(db, result.recommendations);

      return {
        ok: applyResult.errors.length === 0,
        ...result,
        applied: true,
        indexesCreated: applyResult.created,
        applyErrors: applyResult.errors.length > 0 ? applyResult.errors : undefined,
      };
    }

    return {
      ok: true,
      ...result,
      applied: false,
    };
  },
};

/**
 * generate-validation — Generate MongoDB JSON Schema validation from RDBMS constraints.
 */
const generateValidationTool: RdbmsToolDef = {
  name: "generate-validation",
  description:
    "Generate MongoDB JSON Schema validation from RDBMS column constraints. " +
    "Translates NOT NULL, type constraints, and size limits to MongoDB validators. " +
    "Can optionally apply validation to the collection.",
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
        description: "Mapping ID or table name.",
      },
      apply: {
        type: "boolean",
        description:
          "Apply validation to MongoDB collection immediately. Default: false (preview only).",
      },
      mongoConnection: {
        type: "string",
        description: "MongoDB connection name (required if apply=true).",
      },
      validationAction: {
        type: "string",
        enum: ["error", "warn"],
        description:
          "Validation action: 'error' rejects invalid documents, 'warn' logs but allows. " +
          "Default: 'error'.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, mongo, args) => {
    const connName = args.connection as string | undefined;
    const mappingId = args.mapping as string;
    const apply = args.apply as boolean | undefined;
    const mongoConnName = args.mongoConnection as string | undefined;
    const validationAction = (args.validationAction as "error" | "warn") ?? "error";

    const driver = rdbms.getDriver(connName);
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(
        `Mapping "${mappingId}" not found. Use create-mapping first.`
      );
    }

    // Get source columns
    const columns = await driver.getColumns(
      mapping.sourceTable,
      mapping.sourceSchema
    );

    // Generate validation schema
    const generator = new ValidationGenerator();
    const result = generator.generate(mapping, columns);

    // Apply if requested
    if (apply) {
      const db = getMongoDb(mongo, mongoConnName, mapping.targetDatabase);

      try {
        await generator.apply(db, result.collection, result.schema, validationAction);

        return {
          ok: true,
          ...result,
          applied: true,
          validationAction,
        };
      } catch (err) {
        return {
          ok: false,
          ...result,
          applied: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      ok: true,
      ...result,
      applied: false,
    };
  },
};

/**
 * export-mapping — Export mappings to JSON.
 */
const exportMappingTool: RdbmsToolDef = {
  name: "export-mapping",
  description:
    "Export mapping configurations to JSON format. Can export a single mapping " +
    "or all mappings. Use this to save mappings for version control, sharing, " +
    "or reuse across environments.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      mapping: {
        type: "string",
        description:
          "Mapping ID or table name to export. If not specified, exports all mappings.",
      },
    },
  },
  execute: async (rdbms, _mongo, args) => {
    const mappingId = args.mapping as string | undefined;
    const store = getMappingStore(rdbms);

    if (mappingId) {
      // Export single mapping
      const json = store.export(mappingId);

      return {
        ok: true,
        mapping: mappingId,
        count: 1,
        json,
      };
    }

    // Export all mappings
    const json = store.exportAll();
    const count = store.size;

    return {
      ok: true,
      count,
      json,
    };
  },
};

/**
 * import-mapping — Import mappings from JSON.
 */
const importMappingTool: RdbmsToolDef = {
  name: "import-mapping",
  description:
    "Import mapping configurations from JSON format. Can import a single mapping " +
    "or multiple mappings. Use this to load previously exported mappings or " +
    "share mappings between environments.",
  operationType: "write",
  inputSchema: {
    type: "object",
    properties: {
      json: {
        type: "string",
        description:
          "JSON string containing mapping(s). Can be a single mapping object or " +
          "an array of mappings.",
      },
      overwrite: {
        type: "boolean",
        description:
          "Overwrite existing mappings with the same ID. Default: false.",
      },
    },
    required: ["json"],
  },
  execute: async (rdbms, _mongo, args) => {
    const json = args.json as string;
    const overwrite = args.overwrite as boolean | undefined;

    const store = getMappingStore(rdbms);

    try {
      const imported = store.import(json, overwrite ?? false);

      return {
        ok: true,
        imported,
        count: imported.length,
        message: `Imported ${imported.length} mapping(s): ${imported.join(", ")}`,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
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
 * All utility tools.
 */
export const UTILITY_TOOLS: RdbmsToolDef[] = [
  generateIndexesTool,
  generateValidationTool,
  exportMappingTool,
  importMappingTool,
];
