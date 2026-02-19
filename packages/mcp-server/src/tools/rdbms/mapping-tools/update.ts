/**
 * update-mapping tool — Update an existing mapping.
 */

import type {
  RdbmsToolDef,
  ColumnMapping,
  EmbedConfig,
  ReferenceConfig,
  MigrationPattern,
} from "../types.js";
import { getMappingStore } from "../utils.js";

/**
 * update-mapping — Update an existing mapping.
 */
export const updateMappingTool: RdbmsToolDef = {
  name: "update-mapping",
  description:
    "Update an existing table-to-collection mapping. " +
    "Can modify pattern, add/remove embeds, add/remove references, " +
    "or adjust column mappings.",
  operationType: "read",
  inputSchema: {
    type: "object",
    properties: {
      mapping: {
        type: "string",
        description: "Mapping ID or table name.",
      },
      pattern: {
        type: "string",
        enum: ["direct", "embed-one", "embed-many", "reference", "extended-ref", "subset", "bucket"],
        description: "New migration pattern.",
      },
      collection: {
        type: "string",
        description: "New target collection name.",
      },
      database: {
        type: "string",
        description: "New target MongoDB database name.",
      },
      addEmbed: {
        type: "object",
        properties: {
          sourceTable: { type: "string" },
          foreignKey: { type: "string" },
          targetField: { type: "string" },
          cardinality: { type: "string", enum: ["one", "many"] },
          maxItems: { type: "number" },
        },
        description: "Add an embedded document configuration.",
      },
      removeEmbed: {
        type: "string",
        description: "Remove embed by source table name.",
      },
      addReference: {
        type: "object",
        properties: {
          sourceTable: { type: "string" },
          foreignKey: { type: "string" },
          targetField: { type: "string" },
          copyFields: { type: "array", items: { type: "string" } },
        },
        description: "Add a reference configuration.",
      },
      removeReference: {
        type: "string",
        description: "Remove reference by source table name.",
      },
      setColumn: {
        type: "object",
        properties: {
          source: { type: "string" },
          target: { type: "string" },
          targetType: { type: "string" },
          transform: { type: "string" },
          exclude: { type: "boolean" },
        },
        description: "Add or update a column mapping.",
      },
      excludeColumn: {
        type: "string",
        description: "Exclude a column from the mapping.",
      },
      filter: {
        type: "string",
        description: "SQL WHERE clause to filter rows.",
      },
    },
    required: ["mapping"],
  },
  execute: async (rdbms, _mongo, args) => {
    const mappingId = args.mapping as string;
    const store = getMappingStore(rdbms);

    const mapping = store.get(mappingId);
    if (!mapping) {
      throw new Error(`Mapping "${mappingId}" not found. Use list-mappings to see available mappings.`);
    }

    const updates: string[] = [];

    // Apply updates
    if (args.pattern) {
      store.update(mappingId, { pattern: args.pattern as MigrationPattern });
      updates.push(`pattern → ${args.pattern}`);
    }

    if (args.collection) {
      store.update(mappingId, { targetCollection: args.collection as string });
      updates.push(`collection → ${args.collection}`);
    }

    if (args.database) {
      store.update(mappingId, { targetDatabase: args.database as string });
      updates.push(`database → ${args.database}`);
    }

    if (args.filter !== undefined) {
      store.update(mappingId, { filter: args.filter as string || undefined });
      updates.push(`filter → ${args.filter || "(cleared)"}`);
    }

    if (args.addEmbed) {
      const embed = args.addEmbed as EmbedConfig;
      store.addEmbed(mappingId, embed);
      updates.push(`added embed: ${embed.sourceTable}`);
    }

    if (args.removeEmbed) {
      store.removeEmbed(mappingId, args.removeEmbed as string);
      updates.push(`removed embed: ${args.removeEmbed}`);
    }

    if (args.addReference) {
      const ref = args.addReference as ReferenceConfig;
      store.addReference(mappingId, ref);
      updates.push(`added reference: ${ref.sourceTable}`);
    }

    if (args.removeReference) {
      store.removeReference(mappingId, args.removeReference as string);
      updates.push(`removed reference: ${args.removeReference}`);
    }

    if (args.setColumn) {
      const col = args.setColumn as ColumnMapping;
      store.setColumn(mappingId, col);
      updates.push(`set column: ${col.source} → ${col.target}`);
    }

    if (args.excludeColumn) {
      store.excludeColumn(mappingId, args.excludeColumn as string);
      updates.push(`excluded column: ${args.excludeColumn}`);
    }

    return {
      ok: true,
      mappingId,
      updates,
      mapping: store.get(mappingId),
    };
  },
};
