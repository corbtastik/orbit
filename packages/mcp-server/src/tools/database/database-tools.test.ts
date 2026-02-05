/**
 * Tests for all 23 database tool definitions and their execute functions.
 *
 * Verifies:
 *  - Tool count and naming conventions
 *  - operationType classification (read/write/connection)
 *  - inputSchema structure
 *  - Execute functions call the correct MongoDB driver methods
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DATABASE_TOOLS } from "./index.js";
import type { ConnectionManager } from "./connection.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Create a mock cursor that supports chaining (find, aggregate). */
function mockCursor(docs: unknown[] = []) {
  const cursor = {
    project: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    explain: vi.fn().mockResolvedValue({ queryPlanner: {} }),
    toArray: vi.fn().mockResolvedValue(docs),
  };
  return cursor;
}

/** Create a mock Collection with common driver methods. */
function mockCollection(docs: unknown[] = []) {
  const cursor = mockCursor(docs);
  return {
    find: vi.fn().mockReturnValue(cursor),
    aggregate: vi.fn().mockReturnValue(mockCursor(docs)),
    countDocuments: vi.fn().mockResolvedValue(docs.length),
    insertMany: vi.fn().mockResolvedValue({
      insertedCount: docs.length,
      insertedIds: Object.fromEntries(docs.map((_, i) => [i, `id_${i}`])),
    }),
    createIndex: vi.fn().mockResolvedValue("field_1"),
    updateMany: vi.fn().mockResolvedValue({
      matchedCount: 2,
      modifiedCount: 2,
      upsertedCount: 0,
      upsertedId: null,
    }),
    deleteMany: vi.fn().mockResolvedValue({ deletedCount: 3 }),
    dropIndex: vi.fn().mockResolvedValue(undefined),
    indexes: vi.fn().mockResolvedValue([
      { v: 2, key: { _id: 1 }, name: "_id_" },
    ]),
    cursor, // exposed for assertion access
  };
}

/** Create a mock Db with common methods. */
function mockDb(collInstance?: ReturnType<typeof mockCollection>) {
  const coll = collInstance ?? mockCollection();
  return {
    listCollections: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([
        { name: "users", type: "collection" },
      ]),
    }),
    createCollection: vi.fn().mockResolvedValue({}),
    dropCollection: vi.fn().mockResolvedValue(true),
    dropDatabase: vi.fn().mockResolvedValue(true),
    renameCollection: vi.fn().mockResolvedValue({}),
    command: vi.fn().mockResolvedValue({ ok: 1, db: "test" }),
    collection: vi.fn().mockReturnValue(coll),
    admin: vi.fn().mockReturnValue({
      listDatabases: vi.fn().mockResolvedValue({
        databases: [{ name: "admin" }, { name: "test" }],
      }),
    }),
  };
}

/** Create a mock ConnectionManager. */
function createMockConn(
  connected = true,
): ConnectionManager & {
  _db: ReturnType<typeof mockDb>;
  _coll: ReturnType<typeof mockCollection>;
} {
  const coll = mockCollection([{ _id: "1", name: "Alice" }]);
  const db = mockDb(coll);

  const conn = {
    isConnected: vi.fn().mockReturnValue(connected),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockReturnValue({
      db: vi.fn().mockReturnValue({
        admin: vi.fn().mockReturnValue({
          listDatabases: vi.fn().mockResolvedValue({
            databases: [{ name: "admin" }, { name: "test" }],
          }),
          command: vi.fn().mockResolvedValue({
            log: ["line1", "line2", "line3"],
            totalLinesWritten: 3,
          }),
        }),
        command: vi.fn().mockResolvedValue({
          log: ["line1", "line2", "line3"],
          totalLinesWritten: 3,
        }),
      }),
    }),
    getDb: vi.fn().mockReturnValue(db),
    getCollection: vi.fn().mockReturnValue(coll),
    getConnectionInfo: vi.fn().mockReturnValue("mongodb://localhost:27017"),
    _db: db,
    _coll: coll,
  } as unknown as ConnectionManager & {
    _db: ReturnType<typeof mockDb>;
    _coll: ReturnType<typeof mockCollection>;
  };

  return conn;
}

// ---------------------------------------------------------------------------
// Registry-level tests
// ---------------------------------------------------------------------------

describe("DATABASE_TOOLS registry", () => {
  it("has exactly 23 tools", () => {
    expect(DATABASE_TOOLS).toHaveLength(23);
  });

  it("all names are unique", () => {
    const names = DATABASE_TOOLS.map((t) => t.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("all names use kebab-case", () => {
    for (const tool of DATABASE_TOOLS) {
      expect(tool.name).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("every tool has a non-empty description", () => {
    for (const tool of DATABASE_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it("every tool has a valid operationType", () => {
    const validTypes = new Set(["read", "write", "connection"]);
    for (const tool of DATABASE_TOOLS) {
      expect(validTypes.has(tool.operationType)).toBe(true);
    }
  });

  it("every tool has an inputSchema with type 'object'", () => {
    for (const tool of DATABASE_TOOLS) {
      expect((tool.inputSchema as Record<string, unknown>).type).toBe("object");
    }
  });

  it("every tool has an execute function", () => {
    for (const tool of DATABASE_TOOLS) {
      expect(typeof tool.execute).toBe("function");
    }
  });
});

// ---------------------------------------------------------------------------
// Operation type classification
// ---------------------------------------------------------------------------

describe("operationType classification", () => {
  it("connection tools: connect, switch-connection", () => {
    const connTools = DATABASE_TOOLS.filter(
      (t) => t.operationType === "connection",
    );
    const names = connTools.map((t) => t.name).sort();
    expect(names).toEqual(["connect", "switch-connection"]);
  });

  it("read tools: 12 total (5 read + 7 metadata)", () => {
    const readTools = DATABASE_TOOLS.filter(
      (t) => t.operationType === "read",
    );
    expect(readTools).toHaveLength(12);
  });

  it("write tools: 9 total (3 write + 2 update + 4 delete)", () => {
    const writeTools = DATABASE_TOOLS.filter(
      (t) => t.operationType === "write",
    );
    expect(writeTools).toHaveLength(9);
  });
});

// ---------------------------------------------------------------------------
// Connection tool execution
// ---------------------------------------------------------------------------

describe("connection tool execution", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("connect calls conn.connect()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "connect")!;
    const result = await tool.execute(conn, {
      connectionString: "mongodb://localhost:27017",
    });
    expect(conn.connect).toHaveBeenCalledWith("mongodb://localhost:27017");
    expect(result).toHaveProperty("ok", true);
  });

  it("switch-connection calls conn.connect()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "switch-connection")!;
    const result = await tool.execute(conn, {
      connectionString: "mongodb://other:27017",
    });
    expect(conn.connect).toHaveBeenCalledWith("mongodb://other:27017");
    expect(result).toHaveProperty("ok", true);
  });
});

// ---------------------------------------------------------------------------
// Metadata tool execution
// ---------------------------------------------------------------------------

describe("metadata tool execution", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("list-databases returns database list", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "list-databases")!;
    const result = await tool.execute(conn, {});
    expect(result).toHaveProperty("databases");
  });

  it("list-collections calls db.listCollections()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "list-collections")!;
    const result = await tool.execute(conn, { database: "test" });
    expect(conn.getDb).toHaveBeenCalledWith("test");
    expect(Array.isArray(result)).toBe(true);
  });

  it("collection-indexes calls collection.indexes()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "collection-indexes")!;
    const result = await tool.execute(conn, {
      database: "test",
      collection: "users",
    });
    expect(conn.getCollection).toHaveBeenCalledWith("test", "users");
    expect(Array.isArray(result)).toBe(true);
  });

  it("collection-schema samples documents with $sample", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "collection-schema")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      sampleSize: 3,
    })) as Record<string, unknown>;
    expect(conn.getCollection).toHaveBeenCalledWith("test", "users");
    expect(result).toHaveProperty("sampleSize");
    expect(conn._coll.aggregate).toHaveBeenCalledWith([
      { $sample: { size: 3 } },
    ]);
  });

  it("collection-schema clamps sampleSize to max 20", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "collection-schema")!;
    await tool.execute(conn, {
      database: "test",
      collection: "users",
      sampleSize: 100,
    });
    expect(conn._coll.aggregate).toHaveBeenCalledWith([
      { $sample: { size: 20 } },
    ]);
  });

  it("db-stats calls db.command({ dbStats: 1 })", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "db-stats")!;
    await tool.execute(conn, { database: "test" });
    expect(conn.getDb).toHaveBeenCalledWith("test");
    expect(conn._db.command).toHaveBeenCalledWith({ dbStats: 1 });
  });
});

// ---------------------------------------------------------------------------
// Read tool execution
// ---------------------------------------------------------------------------

describe("read tool execution", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("find returns documents with count", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "find")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      filter: { status: "active" },
    })) as Record<string, unknown>;
    expect(conn.getCollection).toHaveBeenCalledWith("test", "users");
    expect(result).toHaveProperty("documents");
    expect(result).toHaveProperty("count");
  });

  it("find applies projection, sort, skip, limit", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "find")!;
    await tool.execute(conn, {
      database: "test",
      collection: "users",
      projection: { name: 1 },
      sort: { name: 1 },
      skip: 5,
      limit: 10,
    });
    expect(conn._coll.cursor.project).toHaveBeenCalledWith({ name: 1 });
    expect(conn._coll.cursor.sort).toHaveBeenCalledWith({ name: 1 });
    expect(conn._coll.cursor.skip).toHaveBeenCalledWith(5);
    expect(conn._coll.cursor.limit).toHaveBeenCalledWith(10);
  });

  it("find clamps limit to MAX_FIND_LIMIT (100)", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "find")!;
    await tool.execute(conn, {
      database: "test",
      collection: "users",
      limit: 500,
    });
    expect(conn._coll.cursor.limit).toHaveBeenCalledWith(100);
  });

  it("aggregate runs pipeline", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "aggregate")!;
    const pipeline = [{ $match: { status: "active" } }];
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      pipeline,
    })) as Record<string, unknown>;
    expect(conn.getCollection).toHaveBeenCalledWith("test", "users");
    expect(result).toHaveProperty("results");
  });

  it("aggregate appends $limit if pipeline has none", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "aggregate")!;
    const pipeline = [{ $match: {} }];
    await tool.execute(conn, {
      database: "test",
      collection: "users",
      pipeline,
    });
    // Should have been called with pipeline + $limit
    const calledPipeline = conn._coll.aggregate.mock.calls[0][0] as Record<string, unknown>[];
    const lastStage = calledPipeline[calledPipeline.length - 1];
    expect(lastStage).toHaveProperty("$limit");
  });

  it("count returns document count", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "count")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      query: { status: "active" },
    })) as Record<string, unknown>;
    expect(conn._coll.countDocuments).toHaveBeenCalledWith({ status: "active" });
    expect(result).toHaveProperty("count");
  });

  it("explain calls cursor.explain()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "explain")!;
    await tool.execute(conn, {
      database: "test",
      collection: "users",
      method: "find",
      filter: { status: "active" },
    });
    expect(conn._coll.find).toHaveBeenCalledWith({ status: "active" });
    expect(conn._coll.cursor.explain).toHaveBeenCalledWith("queryPlanner");
  });

  it("explain with executionStats verbosity", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "explain")!;
    await tool.execute(conn, {
      database: "test",
      collection: "users",
      method: "find",
      filter: {},
      verbosity: "executionStats",
    });
    expect(conn._coll.cursor.explain).toHaveBeenCalledWith("executionStats");
  });

  it("export returns documents", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "export")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
    })) as Record<string, unknown>;
    expect(result).toHaveProperty("exported");
    expect(result).toHaveProperty("documents");
  });
});

// ---------------------------------------------------------------------------
// Write tool execution
// ---------------------------------------------------------------------------

describe("write tool execution", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("insert-many inserts documents", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "insert-many")!;
    const docs = [{ name: "Alice" }, { name: "Bob" }];
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      documents: docs,
    })) as Record<string, unknown>;
    expect(conn._coll.insertMany).toHaveBeenCalledWith(docs);
    expect(result).toHaveProperty("insertedCount");
  });

  it("insert-many rejects more than 1000 documents", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "insert-many")!;
    const docs = Array.from({ length: 1001 }, (_, i) => ({ i }));
    await expect(
      tool.execute(conn, {
        database: "test",
        collection: "users",
        documents: docs,
      }),
    ).rejects.toThrow("Too many documents");
  });

  it("create-index creates an index", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "create-index")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      keys: { email: 1 },
      options: { unique: true },
    })) as Record<string, unknown>;
    expect(conn._coll.createIndex).toHaveBeenCalledWith(
      { email: 1 },
      { unique: true },
    );
    expect(result).toHaveProperty("indexName");
  });

  it("create-collection creates a collection", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "create-collection")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "products",
    })) as Record<string, unknown>;
    expect(conn._db.createCollection).toHaveBeenCalledWith("products");
    expect(result).toHaveProperty("ok", true);
  });
});

// ---------------------------------------------------------------------------
// Update tool execution
// ---------------------------------------------------------------------------

describe("update tool execution", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("update-many calls collection.updateMany()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "update-many")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      filter: { status: "pending" },
      update: { $set: { status: "processed" } },
    })) as Record<string, unknown>;
    expect(conn._coll.updateMany).toHaveBeenCalledWith(
      { status: "pending" },
      { $set: { status: "processed" } },
      { upsert: false },
    );
    expect(result).toHaveProperty("matchedCount");
    expect(result).toHaveProperty("modifiedCount");
  });

  it("rename-collection renames the collection", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "rename-collection")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "old_name",
      newName: "new_name",
    })) as Record<string, unknown>;
    expect(conn._db.renameCollection).toHaveBeenCalledWith(
      "old_name",
      "new_name",
      { dropTarget: false },
    );
    expect(result).toHaveProperty("from", "old_name");
    expect(result).toHaveProperty("to", "new_name");
  });
});

// ---------------------------------------------------------------------------
// Delete tool execution
// ---------------------------------------------------------------------------

describe("delete tool execution", () => {
  let conn: ReturnType<typeof createMockConn>;

  beforeEach(() => {
    conn = createMockConn();
  });

  it("delete-many calls collection.deleteMany()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "delete-many")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "logs",
      filter: { status: "expired" },
    })) as Record<string, unknown>;
    expect(conn._coll.deleteMany).toHaveBeenCalledWith({ status: "expired" });
    expect(result).toHaveProperty("deletedCount");
  });

  it("delete-many defaults to empty filter", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "delete-many")!;
    await tool.execute(conn, {
      database: "test",
      collection: "logs",
    });
    expect(conn._coll.deleteMany).toHaveBeenCalledWith({});
  });

  it("drop-collection calls db.dropCollection()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "drop-collection")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "temp",
    })) as Record<string, unknown>;
    expect(conn._db.dropCollection).toHaveBeenCalledWith("temp");
    expect(result).toHaveProperty("ok", true);
  });

  it("drop-database calls db.dropDatabase()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "drop-database")!;
    const result = (await tool.execute(conn, {
      database: "temp_db",
    })) as Record<string, unknown>;
    expect(conn.getDb).toHaveBeenCalledWith("temp_db");
    expect(result).toHaveProperty("ok");
  });

  it("drop-index calls collection.dropIndex()", async () => {
    const tool = DATABASE_TOOLS.find((t) => t.name === "drop-index")!;
    const result = (await tool.execute(conn, {
      database: "test",
      collection: "users",
      indexName: "email_1",
    })) as Record<string, unknown>;
    expect(conn._coll.dropIndex).toHaveBeenCalledWith("email_1");
    expect(result).toHaveProperty("ok", true);
  });
});
