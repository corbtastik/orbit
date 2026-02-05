/**
 * Tests for ConnectionManager.
 *
 * Uses mocked MongoClient to verify:
 * - Single-connection (backward compat) API
 * - Multi-connection API: register, connectNamed, disconnectNamed
 * - Connection listing and status tracking
 * - Credential masking
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConnectionManager } from "./connection.js";

// ---------------------------------------------------------------------------
// Mock the mongodb module
// ---------------------------------------------------------------------------

const mockClose = vi.fn().mockResolvedValue(undefined);
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDb = vi.fn();

vi.mock("mongodb", () => ({
  MongoClient: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
    db: mockDb,
  })),
}));

describe("ConnectionManager", () => {
  let conn: ConnectionManager;

  beforeEach(() => {
    conn = new ConnectionManager();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Backward compatibility: Single connection API
  // -------------------------------------------------------------------------

  describe("backward compat: connect/disconnect", () => {
    it("starts in disconnected state", () => {
      expect(conn.isConnected()).toBe(false);
      expect(conn.getConnectionInfo()).toBeNull();
    });

    it("connect() sets connected state", async () => {
      await conn.connect("mongodb://localhost:27017");
      expect(conn.isConnected()).toBe(true);
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    it("disconnect() returns to disconnected state", async () => {
      await conn.connect("mongodb://localhost:27017");
      await conn.disconnect();
      expect(conn.isConnected()).toBe(false);
      expect(mockClose).toHaveBeenCalledOnce();
    });

    it("disconnect() is a no-op when not connected", async () => {
      await conn.disconnect();
      expect(mockClose).not.toHaveBeenCalled();
    });

    it("connect() closes existing connection first (switch)", async () => {
      await conn.connect("mongodb://host1:27017");
      await conn.connect("mongodb://host2:27017");
      // First connection should have been closed
      expect(mockClose).toHaveBeenCalledOnce();
      // New connection should be active
      expect(conn.isConnected()).toBe(true);
    });
  });

  describe("backward compat: getClient / getDb / getCollection", () => {
    it("getClient() throws when not connected", () => {
      expect(() => conn.getClient()).toThrow("Not connected to MongoDB");
    });

    it("getClient() returns client when connected", async () => {
      await conn.connect("mongodb://localhost:27017");
      const client = conn.getClient();
      expect(client).toBeDefined();
    });

    it("getDb() returns a db reference", async () => {
      const mockDbInstance = { collection: vi.fn() };
      mockDb.mockReturnValue(mockDbInstance);

      await conn.connect("mongodb://localhost:27017");
      const db = conn.getDb("testdb");
      expect(mockDb).toHaveBeenCalledWith("testdb");
      expect(db).toBe(mockDbInstance);
    });

    it("getCollection() returns a collection reference", async () => {
      const mockCollection = {};
      const mockDbInstance = { collection: vi.fn().mockReturnValue(mockCollection) };
      mockDb.mockReturnValue(mockDbInstance);

      await conn.connect("mongodb://localhost:27017");
      const coll = conn.getCollection("testdb", "users");
      expect(mockDb).toHaveBeenCalledWith("testdb");
      expect(mockDbInstance.collection).toHaveBeenCalledWith("users");
      expect(coll).toBe(mockCollection);
    });
  });

  describe("backward compat: getConnectionInfo", () => {
    it("returns null when not connected", () => {
      expect(conn.getConnectionInfo()).toBeNull();
    });

    it("returns the connection string for passwordless URIs", async () => {
      await conn.connect("mongodb://localhost:27017");
      const info = conn.getConnectionInfo();
      expect(info).toContain("localhost");
    });

    it("masks password in connection string", async () => {
      await conn.connect("mongodb://user:secretpass@host:27017/db");
      const info = conn.getConnectionInfo();
      expect(info).not.toContain("secretpass");
      expect(info).toContain("****");
    });
  });

  // -------------------------------------------------------------------------
  // Multi-connection API
  // -------------------------------------------------------------------------

  describe("multi-connection: registerConnection", () => {
    it("registers a connection without connecting", () => {
      conn.registerConnection("local", "mongodb://localhost:27017");
      expect(conn.hasConnection("local")).toBe(true);
      expect(conn.isConnectedNamed("local")).toBe(false);
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it("skips registration if already connected", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      conn.registerConnection("local", "mongodb://different:27017");
      // Should still be using the original connection
      const connections = conn.listConnections();
      const localConn = connections.find((c) => c.name === "local");
      expect(localConn?.uri).toContain("localhost");
    });
  });

  describe("multi-connection: connectNamed", () => {
    it("connects to a registered connection", async () => {
      conn.registerConnection("staging", "mongodb://staging:27017");
      await conn.connectNamed("staging");
      expect(conn.isConnectedNamed("staging")).toBe(true);
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    it("connects with provided connection string", async () => {
      await conn.connectNamed("prod", "mongodb://prod:27017");
      expect(conn.isConnectedNamed("prod")).toBe(true);
    });

    it("throws if not registered and no connection string", async () => {
      await expect(conn.connectNamed("unknown")).rejects.toThrow(
        'Connection "unknown" is not registered',
      );
    });

    it("is a no-op if already connected", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      await conn.connectNamed("local", "mongodb://different:27017");
      // Should only have connected once
      expect(mockConnect).toHaveBeenCalledOnce();
    });

    it("removes from registered after connecting", async () => {
      conn.registerConnection("local", "mongodb://localhost:27017");
      const beforeConnect = conn.listConnections();
      expect(beforeConnect.find((c) => c.name === "local")?.status).toBe("registered");

      await conn.connectNamed("local");
      const afterConnect = conn.listConnections();
      expect(afterConnect.find((c) => c.name === "local")?.status).toBe("connected");
    });
  });

  describe("multi-connection: disconnectNamed", () => {
    it("disconnects a specific connection", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      await conn.connectNamed("staging", "mongodb://staging:27017");

      await conn.disconnectNamed("local");

      expect(conn.isConnectedNamed("local")).toBe(false);
      expect(conn.isConnectedNamed("staging")).toBe(true);
    });

    it("is a no-op for unknown connection", async () => {
      await conn.disconnectNamed("nonexistent");
      expect(mockClose).not.toHaveBeenCalled();
    });
  });

  describe("multi-connection: disconnectAll", () => {
    it("disconnects all connections", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      await conn.connectNamed("staging", "mongodb://staging:27017");

      await conn.disconnectAll();

      expect(conn.isConnectedNamed("local")).toBe(false);
      expect(conn.isConnectedNamed("staging")).toBe(false);
      expect(mockClose).toHaveBeenCalledTimes(2);
    });
  });

  describe("multi-connection: getNamedClient / getNamedDb / getNamedCollection", () => {
    it("getNamedClient() throws for non-connected connection", () => {
      conn.registerConnection("local", "mongodb://localhost:27017");
      expect(() => conn.getNamedClient("local")).toThrow(
        'Connection "local" is not connected',
      );
    });

    it("getNamedClient() returns client when connected", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      const client = conn.getNamedClient("local");
      expect(client).toBeDefined();
    });

    it("getNamedDb() returns db reference", async () => {
      const mockDbInstance = { collection: vi.fn() };
      mockDb.mockReturnValue(mockDbInstance);

      await conn.connectNamed("local", "mongodb://localhost:27017");
      const db = conn.getNamedDb("local", "mydb");
      expect(mockDb).toHaveBeenCalledWith("mydb");
      expect(db).toBe(mockDbInstance);
    });

    it("getNamedCollection() returns collection reference", async () => {
      const mockCollection = {};
      const mockDbInstance = { collection: vi.fn().mockReturnValue(mockCollection) };
      mockDb.mockReturnValue(mockDbInstance);

      await conn.connectNamed("local", "mongodb://localhost:27017");
      const coll = conn.getNamedCollection("local", "mydb", "users");
      expect(mockDbInstance.collection).toHaveBeenCalledWith("users");
      expect(coll).toBe(mockCollection);
    });
  });

  describe("multi-connection: listConnections", () => {
    it("returns empty array when no connections", () => {
      expect(conn.listConnections()).toEqual([]);
    });

    it("lists registered connections", () => {
      conn.registerConnection("local", "mongodb://localhost:27017");
      conn.registerConnection("staging", "mongodb://staging:27017");

      const list = conn.listConnections();
      expect(list).toHaveLength(2);
      expect(list.find((c) => c.name === "local")?.status).toBe("registered");
      expect(list.find((c) => c.name === "staging")?.status).toBe("registered");
    });

    it("lists connected connections", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");

      const list = conn.listConnections();
      expect(list).toHaveLength(1);
      expect(list[0].name).toBe("local");
      expect(list[0].status).toBe("connected");
    });

    it("lists both registered and connected", async () => {
      conn.registerConnection("staging", "mongodb://staging:27017");
      await conn.connectNamed("local", "mongodb://localhost:27017");

      const list = conn.listConnections();
      expect(list).toHaveLength(2);
      expect(list.find((c) => c.name === "local")?.status).toBe("connected");
      expect(list.find((c) => c.name === "staging")?.status).toBe("registered");
    });

    it("masks passwords in URI", async () => {
      conn.registerConnection("secure", "mongodb://user:secret@host:27017");
      const list = conn.listConnections();
      expect(list[0].uri).not.toContain("secret");
      expect(list[0].uri).toContain("****");
    });
  });

  describe("multi-connection: hasConnection / isConnectedNamed / hasAnyConnection", () => {
    it("hasConnection returns true for registered", () => {
      conn.registerConnection("local", "mongodb://localhost:27017");
      expect(conn.hasConnection("local")).toBe(true);
    });

    it("hasConnection returns true for connected", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      expect(conn.hasConnection("local")).toBe(true);
    });

    it("hasConnection returns false for unknown", () => {
      expect(conn.hasConnection("unknown")).toBe(false);
    });

    it("isConnectedNamed returns false for registered-only", () => {
      conn.registerConnection("local", "mongodb://localhost:27017");
      expect(conn.isConnectedNamed("local")).toBe(false);
    });

    it("isConnectedNamed returns true for connected", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      expect(conn.isConnectedNamed("local")).toBe(true);
    });

    it("hasAnyConnection returns false when empty", () => {
      expect(conn.hasAnyConnection()).toBe(false);
    });

    it("hasAnyConnection returns true when any connection exists", async () => {
      await conn.connectNamed("local", "mongodb://localhost:27017");
      expect(conn.hasAnyConnection()).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Integration: backward compat + multi-connection
  // -------------------------------------------------------------------------

  describe("integration: backward compat with multi-connection", () => {
    it("default connection shows in listConnections", async () => {
      await conn.connect("mongodb://localhost:27017");
      const list = conn.listConnections();
      expect(list.find((c) => c.name === "default")).toBeDefined();
    });

    it("can use both default and named connections", async () => {
      await conn.connect("mongodb://localhost:27017");
      await conn.connectNamed("staging", "mongodb://staging:27017");

      expect(conn.isConnected()).toBe(true);
      expect(conn.isConnectedNamed("staging")).toBe(true);
      expect(conn.listConnections()).toHaveLength(2);
    });

    it("disconnect() only disconnects default, not named", async () => {
      await conn.connect("mongodb://localhost:27017");
      await conn.connectNamed("staging", "mongodb://staging:27017");

      await conn.disconnect();

      expect(conn.isConnected()).toBe(false);
      expect(conn.isConnectedNamed("staging")).toBe(true);
    });

    it("disconnectAll() disconnects default and named", async () => {
      await conn.connect("mongodb://localhost:27017");
      await conn.connectNamed("staging", "mongodb://staging:27017");

      await conn.disconnectAll();

      expect(conn.isConnected()).toBe(false);
      expect(conn.isConnectedNamed("staging")).toBe(false);
    });
  });
});
