/**
 * Tests for SessionManager.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SessionManager, MaxSessionsExceededError } from "./session-manager.js";

describe("SessionManager", () => {
  let manager: SessionManager;

  afterEach(async () => {
    // Clean up any remaining sessions
    if (manager) {
      await manager.destroyAll();
    }
  });

  describe("getOrCreate", () => {
    beforeEach(() => {
      manager = new SessionManager();
    });

    it("creates a new session", () => {
      const session = manager.getOrCreate("session-1");

      expect(session.sessionId).toBe("session-1");
      expect(session.connectionManager).toBeDefined();
      expect(session.rdbmsConnectionManager).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(session.lastActivity).toBeInstanceOf(Date);
      expect(manager.size).toBe(1);
    });

    it("returns existing session", () => {
      const session1 = manager.getOrCreate("session-1");
      const session2 = manager.getOrCreate("session-1");

      expect(session1).toBe(session2);
      expect(manager.size).toBe(1);
    });

    it("updates lastActivity on existing session", async () => {
      const session1 = manager.getOrCreate("session-1");
      const initialActivity = session1.lastActivity;

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session2 = manager.getOrCreate("session-1");
      expect(session2.lastActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });

    it("creates multiple distinct sessions", () => {
      const session1 = manager.getOrCreate("session-1");
      const session2 = manager.getOrCreate("session-2");

      expect(session1).not.toBe(session2);
      expect(session1.connectionManager).not.toBe(session2.connectionManager);
      expect(manager.size).toBe(2);
    });
  });

  describe("maxSessions limit", () => {
    it("enforces max sessions limit", () => {
      manager = new SessionManager({ maxSessions: 3 });

      manager.getOrCreate("session-1");
      manager.getOrCreate("session-2");
      manager.getOrCreate("session-3");

      expect(() => manager.getOrCreate("session-4")).toThrow(MaxSessionsExceededError);
      expect(manager.size).toBe(3);
    });

    it("allows existing session when at limit", () => {
      manager = new SessionManager({ maxSessions: 2 });

      manager.getOrCreate("session-1");
      manager.getOrCreate("session-2");

      // Should not throw for existing session
      const session = manager.getOrCreate("session-1");
      expect(session.sessionId).toBe("session-1");
    });

    it("allows new session after destroying one at limit", async () => {
      manager = new SessionManager({ maxSessions: 2 });

      manager.getOrCreate("session-1");
      manager.getOrCreate("session-2");

      await manager.destroy("session-1");

      // Should not throw now
      const session = manager.getOrCreate("session-3");
      expect(session.sessionId).toBe("session-3");
      expect(manager.size).toBe(2);
    });

    it("uses default max sessions of 1000", () => {
      manager = new SessionManager();

      // Create 100 sessions (testing default allows many)
      for (let i = 0; i < 100; i++) {
        manager.getOrCreate(`session-${i}`);
      }

      expect(manager.size).toBe(100);
    });
  });

  describe("MaxSessionsExceededError", () => {
    it("has correct name and message", () => {
      const error = new MaxSessionsExceededError(100);

      expect(error.name).toBe("MaxSessionsExceededError");
      expect(error.message).toBe("Maximum sessions (100) exceeded. Try again later.");
    });
  });

  describe("get / has", () => {
    beforeEach(() => {
      manager = new SessionManager();
    });

    it("get returns session if exists", () => {
      manager.getOrCreate("session-1");

      const session = manager.get("session-1");
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("session-1");
    });

    it("get returns undefined if not exists", () => {
      expect(manager.get("nonexistent")).toBeUndefined();
    });

    it("has returns true if exists", () => {
      manager.getOrCreate("session-1");
      expect(manager.has("session-1")).toBe(true);
    });

    it("has returns false if not exists", () => {
      expect(manager.has("nonexistent")).toBe(false);
    });
  });

  describe("destroy", () => {
    beforeEach(() => {
      manager = new SessionManager();
    });

    it("destroys a session", async () => {
      manager.getOrCreate("session-1");
      expect(manager.has("session-1")).toBe(true);

      await manager.destroy("session-1");
      expect(manager.has("session-1")).toBe(false);
      expect(manager.size).toBe(0);
    });

    it("is safe to call on non-existent session", async () => {
      await expect(manager.destroy("nonexistent")).resolves.toBeUndefined();
    });
  });

  describe("destroyAll", () => {
    beforeEach(() => {
      manager = new SessionManager();
    });

    it("destroys all sessions", async () => {
      manager.getOrCreate("session-1");
      manager.getOrCreate("session-2");
      manager.getOrCreate("session-3");

      expect(manager.size).toBe(3);

      await manager.destroyAll();

      expect(manager.size).toBe(0);
    });

    it("stops cleanup timer", async () => {
      manager.getOrCreate("session-1");

      await manager.destroyAll();

      // Should not throw after destroyAll
      expect(manager.size).toBe(0);
    });
  });

  describe("idle cleanup", () => {
    it("cleans up idle sessions", async () => {
      // Use very short timeouts for testing
      manager = new SessionManager({
        idleTimeoutMs: 50,
        cleanupIntervalMs: 25,
      });

      manager.getOrCreate("session-1");
      expect(manager.size).toBe(1);

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(manager.size).toBe(0);
    });

    it("does not clean up active sessions", async () => {
      manager = new SessionManager({
        idleTimeoutMs: 100,
        cleanupIntervalMs: 25,
      });

      manager.getOrCreate("session-1");

      // Keep session active
      await new Promise((resolve) => setTimeout(resolve, 50));
      manager.getOrCreate("session-1"); // Update lastActivity

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Session should still exist because we refreshed it
      expect(manager.size).toBe(1);
    });
  });
});
