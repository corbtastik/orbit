/**
 * Tests for RDBMS Mapping tools and MappingStore.
 *
 * Uses in-memory SQLite for fast testing of mapping operations.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MappingStore } from "./mapping-store.js";
import { SqliteDriver } from "./drivers/sqlite.js";
import { RdbmsConnectionManager } from "./connection.js";
import { MAPPING_TOOLS } from "./mapping-tools/index.js";
import type { RdbmsToolDef, TableMapping, EmbedConfig, ReferenceConfig } from "./types.js";

// ---------------------------------------------------------------------------
// Test utilities
// ---------------------------------------------------------------------------

/**
 * Create sample e-commerce schema.
 */
function createSampleSchema(driver: SqliteDriver): void {
  driver.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    )
  `);

  driver.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending'
    )
  `);

  driver.exec(`
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL
    )
  `);

  // Insert sample data
  driver.exec(`INSERT INTO users (email, name) VALUES ('alice@example.com', 'Alice')`);
  driver.exec(`INSERT INTO orders (user_id, total, status) VALUES (1, 99.99, 'completed')`);
  driver.exec(`INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (1, 'Widget', 2, 49.99)`);
  driver.exec(`INSERT INTO order_items (order_id, product_name, quantity, price) VALUES (1, 'Gadget', 1, 0.01)`);
}

// ---------------------------------------------------------------------------
// MappingStore Tests
// ---------------------------------------------------------------------------

describe("MappingStore", () => {
  let store: MappingStore;

  beforeEach(() => {
    store = new MappingStore();
  });

  describe("create", () => {
    it("creates a mapping and returns ID", () => {
      const id = store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      expect(id).toBe("orders");
      expect(store.has("orders")).toBe(true);
    });

    it("throws if mapping already exists", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      expect(() =>
        store.create({
          sourceTable: "orders",
          targetCollection: "orders",
          targetDatabase: "ecommerce",
          pattern: "direct",
        })
      ).toThrow('Mapping for table "orders" already exists');
    });

    it("marks mapping as not validated initially", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      const mapping = store.get("orders");
      expect(mapping?.validated).toBe(false);
    });
  });

  describe("get / has / list", () => {
    beforeEach(() => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });
    });

    it("gets mapping by ID", () => {
      const mapping = store.get("orders");
      expect(mapping?.sourceTable).toBe("orders");
    });

    it("returns undefined for non-existent mapping", () => {
      expect(store.get("unknown")).toBeUndefined();
    });

    it("has returns true for existing mapping", () => {
      expect(store.has("orders")).toBe(true);
    });

    it("has returns false for non-existent mapping", () => {
      expect(store.has("unknown")).toBe(false);
    });

    it("list returns all mappings", () => {
      store.create({
        sourceTable: "users",
        targetCollection: "users",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      const mappings = store.list();
      expect(mappings).toHaveLength(2);
    });
  });

  describe("update", () => {
    beforeEach(() => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });
    });

    it("updates mapping properties", () => {
      store.update("orders", { pattern: "embed-many" });

      const mapping = store.get("orders");
      expect(mapping?.pattern).toBe("embed-many");
    });

    it("marks mapping as not validated after update", () => {
      store.setValidationResult("orders", true);
      expect(store.get("orders")?.validated).toBe(true);

      store.update("orders", { pattern: "embed-many" });
      expect(store.get("orders")?.validated).toBe(false);
    });

    it("throws for non-existent mapping", () => {
      expect(() => store.update("unknown", { pattern: "direct" })).toThrow(
        'Mapping "unknown" not found'
      );
    });
  });

  describe("addEmbed / removeEmbed", () => {
    beforeEach(() => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "embed-many",
      });
    });

    it("adds an embed configuration", () => {
      store.addEmbed("orders", {
        sourceTable: "order_items",
        foreignKey: "order_id",
        targetField: "items",
        cardinality: "many",
      });

      const mapping = store.get("orders");
      expect(mapping?.embeds).toHaveLength(1);
      expect(mapping?.embeds?.[0].sourceTable).toBe("order_items");
    });

    it("throws if embed already exists", () => {
      store.addEmbed("orders", {
        sourceTable: "order_items",
        foreignKey: "order_id",
        targetField: "items",
        cardinality: "many",
      });

      expect(() =>
        store.addEmbed("orders", {
          sourceTable: "order_items",
          foreignKey: "order_id",
          targetField: "items",
          cardinality: "many",
        })
      ).toThrow('Embed for table "order_items" already exists');
    });

    it("removes an embed configuration", () => {
      store.addEmbed("orders", {
        sourceTable: "order_items",
        foreignKey: "order_id",
        targetField: "items",
        cardinality: "many",
      });

      store.removeEmbed("orders", "order_items");

      const mapping = store.get("orders");
      expect(mapping?.embeds).toHaveLength(0);
    });

    it("throws when removing non-existent embed", () => {
      expect(() => store.removeEmbed("orders", "nonexistent")).toThrow(
        'No embed for table "nonexistent" found'
      );
    });
  });

  describe("addReference / removeReference", () => {
    beforeEach(() => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "reference",
      });
    });

    it("adds a reference configuration", () => {
      store.addReference("orders", {
        sourceTable: "users",
        foreignKey: "user_id",
        targetField: "customer",
      });

      const mapping = store.get("orders");
      expect(mapping?.references).toHaveLength(1);
      expect(mapping?.references?.[0].sourceTable).toBe("users");
    });

    it("removes a reference configuration", () => {
      store.addReference("orders", {
        sourceTable: "users",
        foreignKey: "user_id",
        targetField: "customer",
      });

      store.removeReference("orders", "users");

      const mapping = store.get("orders");
      expect(mapping?.references).toHaveLength(0);
    });
  });

  describe("setColumn / excludeColumn", () => {
    beforeEach(() => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });
    });

    it("adds a column mapping", () => {
      store.setColumn("orders", {
        source: "user_id",
        target: "customerId",
      });

      const mapping = store.get("orders");
      expect(mapping?.columns).toHaveLength(1);
      expect(mapping?.columns?.[0].target).toBe("customerId");
    });

    it("updates existing column mapping", () => {
      store.setColumn("orders", { source: "user_id", target: "userId" });
      store.setColumn("orders", { source: "user_id", target: "customerId" });

      const mapping = store.get("orders");
      expect(mapping?.columns).toHaveLength(1);
      expect(mapping?.columns?.[0].target).toBe("customerId");
    });

    it("excludes a column", () => {
      store.excludeColumn("orders", "internal_notes");

      const mapping = store.get("orders");
      const col = mapping?.columns?.find((c) => c.source === "internal_notes");
      expect(col?.exclude).toBe(true);
    });
  });

  describe("delete / clear", () => {
    it("deletes a mapping", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      const deleted = store.delete("orders");
      expect(deleted).toBe(true);
      expect(store.has("orders")).toBe(false);
    });

    it("returns false when deleting non-existent mapping", () => {
      expect(store.delete("unknown")).toBe(false);
    });

    it("clears all mappings", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });
      store.create({
        sourceTable: "users",
        targetCollection: "users",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      store.clear();
      expect(store.size).toBe(0);
    });
  });

  describe("export / import", () => {
    it("exports all mappings as JSON string", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      const exported = store.exportAll();
      expect(typeof exported).toBe("string");

      const parsed = JSON.parse(exported);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe("orders");
    });

    it("exports single mapping as JSON string", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      const exported = store.export("orders");
      expect(typeof exported).toBe("string");

      const parsed = JSON.parse(exported);
      expect(parsed.id).toBe("orders");
    });

    it("imports mappings from JSON string", () => {
      const mapping = {
        id: "orders",
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      };

      const imported = store.import(JSON.stringify(mapping));
      expect(imported).toEqual(["orders"]);
      expect(store.has("orders")).toBe(true);
    });

    it("imports array of mappings from JSON string", () => {
      const mappings = [
        {
          id: "orders",
          sourceTable: "orders",
          targetCollection: "orders",
          targetDatabase: "ecommerce",
          pattern: "direct",
        },
        {
          id: "items",
          sourceTable: "items",
          targetCollection: "items",
          targetDatabase: "ecommerce",
          pattern: "direct",
        },
      ];

      const imported = store.import(JSON.stringify(mappings));
      expect(imported).toHaveLength(2);
      expect(store.has("orders")).toBe(true);
      expect(store.has("items")).toBe(true);
    });

    it("importAll still works for objects", () => {
      const mappings: TableMapping[] = [
        {
          id: "orders",
          sourceTable: "orders",
          targetCollection: "orders",
          targetDatabase: "ecommerce",
          pattern: "direct",
        },
      ];

      store.importAll(mappings);
      expect(store.has("orders")).toBe(true);
    });

    it("exportAllObjects returns array of objects", () => {
      store.create({
        sourceTable: "orders",
        targetCollection: "orders",
        targetDatabase: "ecommerce",
        pattern: "direct",
      });

      const exported = store.exportAllObjects();
      expect(Array.isArray(exported)).toBe(true);
      expect(exported).toHaveLength(1);
      expect(exported[0].id).toBe("orders");
    });
  });
});

// ---------------------------------------------------------------------------
// Mapping Tools Integration Tests
// ---------------------------------------------------------------------------

describe("Mapping Tools Integration", () => {
  let manager: RdbmsConnectionManager;
  let driver: SqliteDriver;

  // Get tool by name
  const getTool = (name: string) => MAPPING_TOOLS.find((t: RdbmsToolDef) => t.name === name)!;

  beforeEach(async () => {
    manager = new RdbmsConnectionManager();
    await manager.connectNew("test", "sqlite", ":memory:");
    driver = manager.getDriver("test") as SqliteDriver;
    createSampleSchema(driver);
  });

  afterEach(async () => {
    await manager.disconnectAll();
  });

  describe("create-mapping", () => {
    it("creates a direct mapping", async () => {
      const tool = getTool("create-mapping");
      const result = (await tool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
        pattern: "direct",
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.mappingId).toBe("orders");
      expect(result.mapping.pattern).toBe("direct");
    });

    it("creates mapping with useRecommendations", async () => {
      const tool = getTool("create-mapping");
      const result = (await tool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
        useRecommendations: true,
      })) as any;

      expect(result.ok).toBe(true);
      // Should have embeds or references based on analysis
      expect(result.mapping).toBeDefined();
    });

    it("throws for non-existent table", async () => {
      const tool = getTool("create-mapping");

      await expect(
        tool.execute(manager, {} as any, {
          connection: "test",
          table: "nonexistent",
          database: "ecommerce",
        })
      ).rejects.toThrow('Table "nonexistent" not found');
    });
  });

  describe("update-mapping", () => {
    beforeEach(async () => {
      const tool = getTool("create-mapping");
      await tool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
        pattern: "direct",
      });
    });

    it("updates pattern", async () => {
      const tool = getTool("update-mapping");
      const result = (await tool.execute(manager, {} as any, {
        mapping: "orders",
        pattern: "embed-many",
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.mapping.pattern).toBe("embed-many");
    });

    it("adds an embed", async () => {
      const tool = getTool("update-mapping");
      const result = (await tool.execute(manager, {} as any, {
        mapping: "orders",
        addEmbed: {
          sourceTable: "order_items",
          foreignKey: "order_id",
          targetField: "items",
          cardinality: "many",
        },
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.mapping.embeds).toHaveLength(1);
    });
  });

  describe("preview-document", () => {
    beforeEach(async () => {
      const createTool = getTool("create-mapping");
      await createTool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
        pattern: "embed-many",
      });

      const updateTool = getTool("update-mapping");
      await updateTool.execute(manager, {} as any, {
        mapping: "orders",
        addEmbed: {
          sourceTable: "order_items",
          foreignKey: "order_id",
          targetField: "items",
          cardinality: "many",
        },
      });
    });

    it("previews documents with embedded data", async () => {
      const tool = getTool("preview-document");
      const result = (await tool.execute(manager, {} as any, {
        connection: "test",
        mapping: "orders",
        sampleSize: 1,
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].items).toBeDefined();
      expect(result.documents[0].items).toHaveLength(2);
    });

    it("includes source rows when requested", async () => {
      const tool = getTool("preview-document");
      const result = (await tool.execute(manager, {} as any, {
        connection: "test",
        mapping: "orders",
        sampleSize: 1,
        includeSource: true,
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.sourceRows).toBeDefined();
      expect(result.sourceRows.orders).toHaveLength(1);
    });
  });

  describe("validate-mapping", () => {
    beforeEach(async () => {
      const tool = getTool("create-mapping");
      await tool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
        pattern: "direct",
      });
    });

    it("validates a correct mapping", async () => {
      const tool = getTool("validate-mapping");
      const result = (await tool.execute(manager, {} as any, {
        connection: "test",
        mapping: "orders",
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns checks array", async () => {
      const tool = getTool("validate-mapping");
      const result = (await tool.execute(manager, {} as any, {
        connection: "test",
        mapping: "orders",
      })) as any;

      expect(result.checks).toBeDefined();
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks[0]).toHaveProperty("check");
      expect(result.checks[0]).toHaveProperty("passed");
    });
  });

  describe("list-mappings", () => {
    it("returns empty list when no mappings", async () => {
      const tool = getTool("list-mappings");
      const result = (await tool.execute(manager, {} as any, {})) as any;

      expect(result.ok).toBe(true);
      expect(result.mappings).toHaveLength(0);
    });

    it("lists all mappings", async () => {
      const createTool = getTool("create-mapping");
      await createTool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
      });
      await createTool.execute(manager, {} as any, {
        connection: "test",
        table: "users",
        database: "ecommerce",
      });

      const tool = getTool("list-mappings");
      const result = (await tool.execute(manager, {} as any, {})) as any;

      expect(result.ok).toBe(true);
      expect(result.count).toBe(2);
      expect(result.mappings).toHaveLength(2);
    });
  });

  describe("delete-mapping", () => {
    beforeEach(async () => {
      const tool = getTool("create-mapping");
      await tool.execute(manager, {} as any, {
        connection: "test",
        table: "orders",
        database: "ecommerce",
      });
    });

    it("deletes a mapping", async () => {
      const tool = getTool("delete-mapping");
      const result = (await tool.execute(manager, {} as any, {
        mapping: "orders",
      })) as any;

      expect(result.ok).toBe(true);
      expect(result.deleted).toBe("orders");

      // Verify it's gone
      const listTool = getTool("list-mappings");
      const listResult = (await listTool.execute(manager, {} as any, {})) as any;
      expect(listResult.mappings).toHaveLength(0);
    });

    it("throws for non-existent mapping", async () => {
      const tool = getTool("delete-mapping");

      await expect(
        tool.execute(manager, {} as any, { mapping: "nonexistent" })
      ).rejects.toThrow('Mapping "nonexistent" not found');
    });
  });
});
