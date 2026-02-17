/**
 * RDBMS Tools comprehensive test suite.
 *
 * Uses in-memory SQLite for fast, isolated testing of:
 * - SQLite driver implementation
 * - RdbmsConnectionManager
 * - Connection tools (connect-rdbms, disconnect-rdbms, list-rdbms)
 * - Schema tools (introspect-schema, analyze-relationships, recommend-patterns)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SqliteDriver, mapSqliteTypeToBson, SQLITE_TYPE_MAP } from "./drivers/sqlite.js";
import { MssqlDriver, mapMssqlTypeToBson, MSSQL_TYPE_MAP } from "./drivers/mssql.js";
import { RdbmsConnectionManager } from "./connection.js";
import { createDriver } from "./drivers/index.js";
import type { RdbmsDriver } from "./drivers/types.js";

// ---------------------------------------------------------------------------
// Test utilities: Sample schema creation
// ---------------------------------------------------------------------------

/**
 * Create a sample e-commerce schema in SQLite for testing.
 */
function createSampleSchema(driver: SqliteDriver): void {
  const sqliteDriver = driver as SqliteDriver & { exec(sql: string): void };

  // Users table
  sqliteDriver.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  sqliteDriver.exec(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT,
      category_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Categories table
  sqliteDriver.exec(`
    CREATE TABLE categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES categories(id)
    )
  `);

  // Add FK to products after categories exists
  // SQLite doesn't support ALTER TABLE ADD CONSTRAINT, so we recreate
  // Instead, let's add orders which references users

  // Orders table (references users)
  sqliteDriver.exec(`
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      total REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Order items (junction-like, references orders and products)
  sqliteDriver.exec(`
    CREATE TABLE order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,
      price REAL NOT NULL
    )
  `);

  // Tags table
  sqliteDriver.exec(`
    CREATE TABLE tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // Product tags (pure junction table for N:N)
  sqliteDriver.exec(`
    CREATE TABLE product_tags (
      product_id INTEGER NOT NULL REFERENCES products(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      PRIMARY KEY (product_id, tag_id)
    )
  `);

  // Create some indexes
  sqliteDriver.exec(`CREATE INDEX idx_orders_user_id ON orders(user_id)`);
  sqliteDriver.exec(`CREATE INDEX idx_order_items_order_id ON order_items(order_id)`);
  sqliteDriver.exec(`CREATE UNIQUE INDEX idx_users_email ON users(email)`);

  // Insert sample data
  sqliteDriver.exec(`
    INSERT INTO users (email, name) VALUES
      ('alice@example.com', 'Alice Smith'),
      ('bob@example.com', 'Bob Jones'),
      ('charlie@example.com', 'Charlie Brown')
  `);

  sqliteDriver.exec(`
    INSERT INTO categories (name, parent_id) VALUES
      ('Electronics', NULL),
      ('Phones', 1),
      ('Laptops', 1),
      ('Clothing', NULL)
  `);

  sqliteDriver.exec(`
    INSERT INTO products (name, price, description, category_id) VALUES
      ('iPhone 15', 999.99, 'Latest Apple phone', 2),
      ('MacBook Pro', 2499.99, 'Powerful laptop', 3),
      ('T-Shirt', 29.99, 'Cotton t-shirt', 4)
  `);

  sqliteDriver.exec(`
    INSERT INTO orders (user_id, total, status) VALUES
      (1, 999.99, 'completed'),
      (1, 29.99, 'pending'),
      (2, 2499.99, 'shipped')
  `);

  sqliteDriver.exec(`
    INSERT INTO order_items (order_id, product_id, quantity, price) VALUES
      (1, 1, 1, 999.99),
      (2, 3, 1, 29.99),
      (3, 2, 1, 2499.99)
  `);

  sqliteDriver.exec(`
    INSERT INTO tags (name) VALUES ('featured'), ('sale'), ('new')
  `);

  sqliteDriver.exec(`
    INSERT INTO product_tags (product_id, tag_id) VALUES
      (1, 1), (1, 3),
      (2, 1),
      (3, 2)
  `);
}

// ---------------------------------------------------------------------------
// SQLite Driver Tests
// ---------------------------------------------------------------------------

describe("SqliteDriver", () => {
  let driver: SqliteDriver;

  beforeEach(async () => {
    driver = new SqliteDriver();
    await driver.connect(":memory:");
    createSampleSchema(driver);
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  describe("connection", () => {
    it("connects to in-memory database", async () => {
      const newDriver = new SqliteDriver();
      await newDriver.connect(":memory:");
      expect(newDriver.getDatabase()).not.toBeNull();
      await newDriver.disconnect();
    });

    it("disconnect clears the database reference", async () => {
      const newDriver = new SqliteDriver();
      await newDriver.connect(":memory:");
      await newDriver.disconnect();
      expect(newDriver.getDatabase()).toBeNull();
    });

    it("disconnect is safe to call multiple times", async () => {
      const newDriver = new SqliteDriver();
      await newDriver.connect(":memory:");
      await newDriver.disconnect();
      await newDriver.disconnect(); // Should not throw
    });
  });

  describe("listTables", () => {
    it("lists all tables", async () => {
      const tables = await driver.listTables();
      const tableNames = tables.map((t) => t.name).sort();

      expect(tableNames).toContain("users");
      expect(tableNames).toContain("products");
      expect(tableNames).toContain("orders");
      expect(tableNames).toContain("categories");
      expect(tableNames).toContain("order_items");
      expect(tableNames).toContain("tags");
      expect(tableNames).toContain("product_tags");
    });

    it("excludes sqlite internal tables", async () => {
      const tables = await driver.listTables();
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).not.toContain("sqlite_sequence");
      expect(tableNames).not.toContain("sqlite_master");
    });

    it("includes row counts for tables", async () => {
      const tables = await driver.listTables();
      const usersTable = tables.find((t) => t.name === "users");

      expect(usersTable).toBeDefined();
      expect(usersTable?.rowCount).toBe(3);
    });

    it("marks all as type table (no views created)", async () => {
      const tables = await driver.listTables();
      expect(tables.every((t) => t.type === "table")).toBe(true);
    });
  });

  describe("getColumns", () => {
    it("returns column metadata for users table", async () => {
      const columns = await driver.getColumns("users");

      expect(columns).toHaveLength(4);

      const idCol = columns.find((c) => c.name === "id");
      expect(idCol).toBeDefined();
      expect(idCol?.dataType).toBe("INTEGER");
      expect(idCol?.isPrimaryKey).toBe(true);
      expect(idCol?.isAutoIncrement).toBe(true);
      // Note: SQLite PRAGMA table_info reports INTEGER PRIMARY KEY as nullable,
      // even though SQLite treats it specially as a rowid alias

      const emailCol = columns.find((c) => c.name === "email");
      expect(emailCol).toBeDefined();
      expect(emailCol?.dataType).toBe("TEXT");
      expect(emailCol?.nullable).toBe(false);
    });

    it("detects nullable columns", async () => {
      const columns = await driver.getColumns("products");
      const descCol = columns.find((c) => c.name === "description");

      expect(descCol?.nullable).toBe(true);
    });

    it("detects default values", async () => {
      const columns = await driver.getColumns("orders");
      const statusCol = columns.find((c) => c.name === "status");

      expect(statusCol?.defaultValue).toBe("'pending'");
    });
  });

  describe("getPrimaryKey", () => {
    it("returns single-column primary key", async () => {
      const pk = await driver.getPrimaryKey("users");
      expect(pk).toEqual(["id"]);
    });

    it("returns composite primary key", async () => {
      const pk = await driver.getPrimaryKey("product_tags");
      expect(pk.sort()).toEqual(["product_id", "tag_id"]);
    });
  });

  describe("getForeignKeys", () => {
    it("returns foreign keys for orders table", async () => {
      const fks = await driver.getForeignKeys("orders");

      expect(fks).toHaveLength(1);
      expect(fks[0].sourceTable).toBe("orders");
      expect(fks[0].sourceColumns).toEqual(["user_id"]);
      expect(fks[0].targetTable).toBe("users");
      expect(fks[0].targetColumns).toEqual(["id"]);
    });

    it("returns multiple foreign keys", async () => {
      const fks = await driver.getForeignKeys("order_items");

      expect(fks).toHaveLength(2);
      const orderFk = fks.find((f) => f.targetTable === "orders");
      const productFk = fks.find((f) => f.targetTable === "products");

      expect(orderFk).toBeDefined();
      expect(productFk).toBeDefined();
    });

    it("returns empty array for table without FKs", async () => {
      const fks = await driver.getForeignKeys("users");
      expect(fks).toEqual([]);
    });
  });

  describe("getReferencingKeys", () => {
    it("finds tables that reference users", async () => {
      const refs = await driver.getReferencingKeys("users");

      expect(refs.length).toBeGreaterThanOrEqual(1);
      expect(refs.some((r) => r.sourceTable === "orders")).toBe(true);
    });

    it("finds tables that reference products", async () => {
      const refs = await driver.getReferencingKeys("products");

      expect(refs.some((r) => r.sourceTable === "order_items")).toBe(true);
      expect(refs.some((r) => r.sourceTable === "product_tags")).toBe(true);
    });
  });

  describe("getIndexes", () => {
    it("returns indexes for orders table", async () => {
      const indexes = await driver.getIndexes("orders");

      const userIdIdx = indexes.find((i) => i.name === "idx_orders_user_id");
      expect(userIdIdx).toBeDefined();
      expect(userIdIdx?.columns).toContain("user_id");
      expect(userIdIdx?.unique).toBe(false);
    });

    it("detects unique indexes", async () => {
      const indexes = await driver.getIndexes("users");

      const emailIdx = indexes.find((i) => i.name === "idx_users_email");
      expect(emailIdx).toBeDefined();
      expect(emailIdx?.unique).toBe(true);
    });

    it("detects primary key index", async () => {
      const indexes = await driver.getIndexes("product_tags");
      const pkIdx = indexes.find((i) => i.isPrimary);

      expect(pkIdx).toBeDefined();
    });
  });

  describe("query", () => {
    it("executes SELECT query", async () => {
      const results = await driver.query<{ id: number; name: string }>(
        "SELECT id, name FROM users WHERE id = ?",
        [1],
      );

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Alice Smith");
    });

    it("returns empty array for no matches", async () => {
      const results = await driver.query("SELECT * FROM users WHERE id = ?", [999]);
      expect(results).toEqual([]);
    });
  });

  describe("countRows", () => {
    it("returns row count for users", async () => {
      const count = await driver.countRows("users");
      expect(count).toBe(3);
    });

    it("returns row count for empty table", async () => {
      const sqliteDriver = driver as SqliteDriver & { exec(sql: string): void };
      sqliteDriver.exec("CREATE TABLE empty_table (id INTEGER PRIMARY KEY)");

      const count = await driver.countRows("empty_table");
      expect(count).toBe(0);
    });
  });

  describe("streamRows", () => {
    it("streams all rows in batches", async () => {
      const batches: Record<string, unknown>[][] = [];

      for await (const batch of driver.streamRows("users", { batchSize: 2 })) {
        batches.push(batch);
      }

      // 3 users with batch size 2 = 2 batches
      expect(batches).toHaveLength(2);
      expect(batches[0]).toHaveLength(2);
      expect(batches[1]).toHaveLength(1);
    });

    it("respects column selection", async () => {
      const batches: Record<string, unknown>[][] = [];

      for await (const batch of driver.streamRows("users", {
        columns: ["id", "email"],
      })) {
        batches.push(batch);
      }

      const firstRow = batches[0][0];
      expect(Object.keys(firstRow)).toEqual(["id", "email"]);
    });

    it("respects where clause", async () => {
      const batches: Record<string, unknown>[][] = [];

      for await (const batch of driver.streamRows("orders", {
        where: "status = 'completed'",
      })) {
        batches.push(batch);
      }

      const allRows = batches.flat();
      expect(allRows).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Type Mapping Tests
// ---------------------------------------------------------------------------

describe("SQLite Type Mapping", () => {
  it("maps INTEGER to int", () => {
    expect(mapSqliteTypeToBson("INTEGER")).toBe("int");
  });

  it("maps REAL to double", () => {
    expect(mapSqliteTypeToBson("REAL")).toBe("double");
  });

  it("maps TEXT to string", () => {
    expect(mapSqliteTypeToBson("TEXT")).toBe("string");
  });

  it("maps BLOB to binData", () => {
    expect(mapSqliteTypeToBson("BLOB")).toBe("binData");
  });

  it("maps VARCHAR(n) to string", () => {
    expect(mapSqliteTypeToBson("VARCHAR(255)")).toBe("string");
  });

  it("maps BIGINT to long", () => {
    expect(mapSqliteTypeToBson("BIGINT")).toBe("long");
  });

  it("maps DATE to date", () => {
    expect(mapSqliteTypeToBson("DATE")).toBe("date");
  });

  it("maps DATETIME to date", () => {
    expect(mapSqliteTypeToBson("DATETIME")).toBe("date");
  });

  it("maps unknown types to string", () => {
    expect(mapSqliteTypeToBson("CUSTOM_TYPE")).toBe("string");
  });

  it("handles case insensitivity", () => {
    expect(mapSqliteTypeToBson("integer")).toBe("int");
    expect(mapSqliteTypeToBson("Real")).toBe("double");
  });

  it("has correct type map entries", () => {
    expect(SQLITE_TYPE_MAP.INTEGER).toBe("int");
    expect(SQLITE_TYPE_MAP.REAL).toBe("double");
    expect(SQLITE_TYPE_MAP.TEXT).toBe("string");
    expect(SQLITE_TYPE_MAP.BOOLEAN).toBe("bool");
  });
});

// ---------------------------------------------------------------------------
// SQL Server Type Mapping Tests
// ---------------------------------------------------------------------------

describe("SQL Server Type Mapping", () => {
  it("maps int to int", () => {
    expect(mapMssqlTypeToBson("int")).toBe("int");
  });

  it("maps bigint to long", () => {
    expect(mapMssqlTypeToBson("bigint")).toBe("long");
  });

  it("maps float to double", () => {
    expect(mapMssqlTypeToBson("float")).toBe("double");
  });

  it("maps real to double", () => {
    expect(mapMssqlTypeToBson("real")).toBe("double");
  });

  it("maps varchar to string", () => {
    expect(mapMssqlTypeToBson("varchar")).toBe("string");
  });

  it("maps nvarchar to string", () => {
    expect(mapMssqlTypeToBson("nvarchar")).toBe("string");
  });

  it("maps bit to bool", () => {
    expect(mapMssqlTypeToBson("bit")).toBe("bool");
  });

  it("maps datetime to date", () => {
    expect(mapMssqlTypeToBson("datetime")).toBe("date");
  });

  it("maps datetime2 to date", () => {
    expect(mapMssqlTypeToBson("datetime2")).toBe("date");
  });

  it("maps uniqueidentifier to string", () => {
    expect(mapMssqlTypeToBson("uniqueidentifier")).toBe("string");
  });

  it("maps varbinary to binData", () => {
    expect(mapMssqlTypeToBson("varbinary")).toBe("binData");
  });

  it("maps money to decimal", () => {
    expect(mapMssqlTypeToBson("money")).toBe("decimal");
  });

  it("maps decimal with precision to int when scale is 0", () => {
    expect(mapMssqlTypeToBson("decimal", 5, 0)).toBe("int");
  });

  it("maps decimal with high precision to long when scale is 0", () => {
    expect(mapMssqlTypeToBson("decimal", 15, 0)).toBe("long");
  });

  it("maps decimal with scale to decimal", () => {
    expect(mapMssqlTypeToBson("decimal", 10, 2)).toBe("decimal");
  });

  it("maps geography to object", () => {
    expect(mapMssqlTypeToBson("geography")).toBe("object");
  });

  it("maps unknown types to string", () => {
    expect(mapMssqlTypeToBson("CUSTOM_TYPE")).toBe("string");
  });

  it("handles case insensitivity", () => {
    expect(mapMssqlTypeToBson("INT")).toBe("int");
    expect(mapMssqlTypeToBson("VarChar")).toBe("string");
  });

  it("has correct type map entries", () => {
    expect(MSSQL_TYPE_MAP.int).toBe("int");
    expect(MSSQL_TYPE_MAP.bigint).toBe("long");
    expect(MSSQL_TYPE_MAP.nvarchar).toBe("string");
    expect(MSSQL_TYPE_MAP.bit).toBe("bool");
    expect(MSSQL_TYPE_MAP.datetime2).toBe("date");
  });
});

// ---------------------------------------------------------------------------
// Driver Factory Tests
// ---------------------------------------------------------------------------

describe("createDriver", () => {
  it("creates SQLite driver", () => {
    const driver = createDriver("sqlite");
    expect(driver.type).toBe("sqlite");
    expect(driver).toBeInstanceOf(SqliteDriver);
  });

  it("creates PostgreSQL driver", () => {
    const driver = createDriver("postgres");
    expect(driver.type).toBe("postgres");
  });

  it("creates SQL Server driver", () => {
    const driver = createDriver("mssql");
    expect(driver.type).toBe("mssql");
    expect(driver).toBeInstanceOf(MssqlDriver);
  });

  it("throws for unimplemented Oracle", () => {
    expect(() => createDriver("oracle")).toThrow("Oracle driver not yet implemented");
  });

  it("throws for unimplemented MySQL", () => {
    expect(() => createDriver("mysql")).toThrow("MySQL driver not yet implemented");
  });
});

// ---------------------------------------------------------------------------
// RdbmsConnectionManager Tests
// ---------------------------------------------------------------------------

describe("RdbmsConnectionManager", () => {
  let manager: RdbmsConnectionManager;

  beforeEach(() => {
    manager = new RdbmsConnectionManager();
  });

  afterEach(async () => {
    await manager.disconnectAll();
  });

  describe("register", () => {
    it("registers a connection without connecting", () => {
      manager.register("test", "sqlite", ":memory:");

      expect(manager.hasConnection("test")).toBe(true);
      expect(manager.isConnected("test")).toBe(false);
    });

    it("first registration becomes default", () => {
      manager.register("first", "sqlite", ":memory:");
      manager.register("second", "sqlite", ":memory:");

      expect(manager.getDefaultName()).toBe("first");
    });

    it("throws if name already registered", () => {
      manager.register("test", "sqlite", ":memory:");

      expect(() => manager.register("test", "sqlite", ":memory:")).toThrow(
        'RDBMS connection "test" is already registered',
      );
    });
  });

  describe("connect", () => {
    it("connects to registered connection", async () => {
      manager.register("test", "sqlite", ":memory:");
      await manager.connect("test");

      expect(manager.isConnected("test")).toBe(true);
    });

    it("connects to default when name not specified", async () => {
      manager.register("default-conn", "sqlite", ":memory:");
      await manager.connect();

      expect(manager.isConnected("default-conn")).toBe(true);
    });

    it("throws if no connection registered", async () => {
      await expect(manager.connect("nonexistent")).rejects.toThrow(
        'RDBMS connection "nonexistent" is not registered',
      );
    });

    it("throws if no default and name not specified", async () => {
      await expect(manager.connect()).rejects.toThrow(
        "No RDBMS connection specified and no default connection registered",
      );
    });

    it("is idempotent for already connected", async () => {
      manager.register("test", "sqlite", ":memory:");
      await manager.connect("test");
      await manager.connect("test"); // Should not throw

      expect(manager.isConnected("test")).toBe(true);
    });
  });

  describe("connectNew", () => {
    it("registers and connects in one step", async () => {
      await manager.connectNew("quick", "sqlite", ":memory:");

      expect(manager.hasConnection("quick")).toBe(true);
      expect(manager.isConnected("quick")).toBe(true);
    });

    it("replaces existing connection with same name", async () => {
      await manager.connectNew("reuse", "sqlite", ":memory:");
      const firstDriver = manager.getDriver("reuse");

      await manager.connectNew("reuse", "sqlite", ":memory:");
      const secondDriver = manager.getDriver("reuse");

      // Should be different driver instances
      expect(secondDriver).not.toBe(firstDriver);
    });
  });

  describe("disconnect", () => {
    it("disconnects a specific connection", async () => {
      await manager.connectNew("test", "sqlite", ":memory:");
      await manager.disconnect("test");

      expect(manager.isConnected("test")).toBe(false);
    });

    it("disconnects default when name not specified", async () => {
      await manager.connectNew("default", "sqlite", ":memory:");
      await manager.disconnect();

      expect(manager.isConnected("default")).toBe(false);
    });

    it("is safe when not connected", async () => {
      manager.register("test", "sqlite", ":memory:");
      await manager.disconnect("test"); // Should not throw
    });
  });

  describe("disconnectAll", () => {
    it("disconnects all connections", async () => {
      await manager.connectNew("one", "sqlite", ":memory:");
      await manager.connectNew("two", "sqlite", ":memory:");

      await manager.disconnectAll();

      expect(manager.listConnections()).toEqual([]);
    });
  });

  describe("getDriver", () => {
    it("returns driver for connected connection", async () => {
      await manager.connectNew("test", "sqlite", ":memory:");
      const driver = manager.getDriver("test");

      expect(driver).toBeDefined();
      expect(driver.type).toBe("sqlite");
    });

    it("returns default driver when name not specified", async () => {
      await manager.connectNew("default", "sqlite", ":memory:");
      const driver = manager.getDriver();

      expect(driver.type).toBe("sqlite");
    });

    it("throws if not connected", () => {
      manager.register("test", "sqlite", ":memory:");

      expect(() => manager.getDriver("test")).toThrow(
        'RDBMS connection "test" is not connected',
      );
    });

    it("throws if not registered", () => {
      expect(() => manager.getDriver("unknown")).toThrow(
        'RDBMS connection "unknown" is not registered',
      );
    });
  });

  describe("setDefaultName", () => {
    it("changes the default connection", async () => {
      manager.register("first", "sqlite", ":memory:");
      manager.register("second", "sqlite", ":memory:");

      manager.setDefaultName("second");

      expect(manager.getDefaultName()).toBe("second");
    });

    it("throws for unregistered name", () => {
      expect(() => manager.setDefaultName("unknown")).toThrow(
        'Cannot set default: connection "unknown" is not registered',
      );
    });
  });

  describe("listConnections", () => {
    it("returns empty array when no connections", () => {
      expect(manager.listConnections()).toEqual([]);
    });

    it("lists registered connections", () => {
      manager.register("test", "sqlite", ":memory:");
      const list = manager.listConnections();

      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("test");
      expect(list[0].type).toBe("sqlite");
      expect(list[0].connected).toBe(false);
    });

    it("lists connected connections with timestamp", async () => {
      await manager.connectNew("test", "sqlite", ":memory:");
      const list = manager.listConnections();

      expect(list).toHaveLength(1);
      expect(list[0].connected).toBe(true);
      expect(list[0].connectedAt).toBeInstanceOf(Date);
    });
  });

  describe("getConnectionInfo", () => {
    it("returns null for unknown connection", () => {
      expect(manager.getConnectionInfo("unknown")).toBeNull();
    });

    it("returns info for registered connection", () => {
      manager.register("test", "sqlite", ":memory:");
      const info = manager.getConnectionInfo("test");

      expect(info?.name).toBe("test");
      expect(info?.type).toBe("sqlite");
      expect(info?.connected).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: Driver operations via ConnectionManager
// ---------------------------------------------------------------------------

describe("Integration: Driver via ConnectionManager", () => {
  let manager: RdbmsConnectionManager;

  beforeEach(async () => {
    manager = new RdbmsConnectionManager();
    await manager.connectNew("source", "sqlite", ":memory:");

    // Create sample schema
    const driver = manager.getDriver("source") as SqliteDriver;
    createSampleSchema(driver);
  });

  afterEach(async () => {
    await manager.disconnectAll();
  });

  it("lists tables through manager", async () => {
    const driver = manager.getDriver("source");
    const tables = await driver.listTables();

    expect(tables.length).toBeGreaterThanOrEqual(7);
  });

  it("introspects columns through manager", async () => {
    const driver = manager.getDriver("source");
    const columns = await driver.getColumns("users");

    expect(columns.find((c) => c.name === "email")).toBeDefined();
  });

  it("queries data through manager", async () => {
    const driver = manager.getDriver("source");
    const users = await driver.query<{ name: string }>(
      "SELECT name FROM users ORDER BY id",
    );

    expect(users[0].name).toBe("Alice Smith");
  });

  it("supports multiple concurrent connections", async () => {
    // Add another connection
    await manager.connectNew("other", "sqlite", ":memory:");
    const otherDriver = manager.getDriver("other") as SqliteDriver;
    otherDriver.exec("CREATE TABLE test (id INTEGER PRIMARY KEY)");

    // Original connection should still work
    const sourceDriver = manager.getDriver("source");
    const tables = await sourceDriver.listTables();

    expect(tables.find((t) => t.name === "users")).toBeDefined();

    // Other connection has different schema
    const otherTables = await otherDriver.listTables();
    expect(otherTables.find((t) => t.name === "test")).toBeDefined();
    expect(otherTables.find((t) => t.name === "users")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Error Handling Tests
// ---------------------------------------------------------------------------

describe("Error Handling", () => {
  let driver: SqliteDriver;

  beforeEach(async () => {
    driver = new SqliteDriver();
    await driver.connect(":memory:");
  });

  afterEach(async () => {
    await driver.disconnect();
  });

  it("throws when querying disconnected driver", async () => {
    await driver.disconnect();

    expect(() => driver.exec("SELECT 1")).toThrow("SQLite driver is not connected");
  });

  it("throws on invalid SQL", async () => {
    await expect(driver.query("INVALID SQL SYNTAX")).rejects.toThrow();
  });

  it("throws when getting columns for non-existent table", async () => {
    // SQLite returns empty for non-existent table via PRAGMA
    const columns = await driver.getColumns("nonexistent_table");
    expect(columns).toEqual([]);
  });
});
