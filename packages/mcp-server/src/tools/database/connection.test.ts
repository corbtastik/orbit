/**
 * Tests for ConnectionManager.
 *
 * Uses mocked MongoClient to verify connect/disconnect/switch lifecycle,
 * getDb/getCollection accessors, connection status, and credential masking.
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
  // Connection lifecycle
  // -------------------------------------------------------------------------

  describe("connect/disconnect", () => {
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

  // -------------------------------------------------------------------------
  // Accessors
  // -------------------------------------------------------------------------

  describe("getClient / getDb / getCollection", () => {
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

  // -------------------------------------------------------------------------
  // Connection info (credential masking)
  // -------------------------------------------------------------------------

  describe("getConnectionInfo", () => {
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
});
