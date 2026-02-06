/**
 * SessionManager — provides per-session ConnectionManager isolation for HTTP transport.
 *
 * Each MCP session (identified by session ID) gets its own ConnectionManager,
 * ensuring isolated MongoDB connections between clients. Sessions are automatically
 * cleaned up after idle timeout.
 */

import { ConnectionManager } from "../tools/index.js";

/** Context for a single session. */
export interface SessionContext {
  sessionId: string;
  connectionManager: ConnectionManager;
  createdAt: Date;
  lastActivity: Date;
}

/** Options for SessionManager. */
export interface SessionManagerOptions {
  /** Idle timeout in milliseconds. Default: 30 minutes. */
  idleTimeoutMs?: number;
  /** Cleanup interval in milliseconds. Default: 1 minute. */
  cleanupIntervalMs?: number;
}

/**
 * Manages per-session ConnectionManager instances with automatic cleanup.
 */
export class SessionManager {
  private sessions: Map<string, SessionContext> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private readonly idleTimeoutMs: number;
  private readonly cleanupIntervalMs: number;

  constructor(options: SessionManagerOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60 * 1000; // 30 min
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 1000; // 1 min

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get or create a session context for the given session ID.
   *
   * If the session exists, updates its lastActivity timestamp.
   * If not, creates a new session with a fresh ConnectionManager.
   */
  getOrCreate(sessionId: string): SessionContext {
    let session = this.sessions.get(sessionId);

    if (session) {
      // Update last activity
      session.lastActivity = new Date();
      return session;
    }

    // Create new session
    session = {
      sessionId,
      connectionManager: new ConnectionManager(),
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get a session by ID without creating or updating activity.
   */
  get(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Check if a session exists.
   */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /**
   * Destroy a specific session, closing all its MongoDB connections.
   */
  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await session.connectionManager.disconnectAll();
      this.sessions.delete(sessionId);
    }
  }

  /**
   * Destroy all sessions gracefully. Call on server shutdown.
   */
  async destroyAll(): Promise<void> {
    this.stopCleanup();

    const destroyPromises: Promise<void>[] = [];
    for (const session of this.sessions.values()) {
      destroyPromises.push(session.connectionManager.disconnectAll());
    }
    await Promise.all(destroyPromises);
    this.sessions.clear();
  }

  /**
   * Get the number of active sessions.
   */
  get size(): number {
    return this.sessions.size;
  }

  /**
   * Clean up idle sessions.
   */
  private async cleanupIdleSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      const idleTime = now - session.lastActivity.getTime();
      if (idleTime > this.idleTimeoutMs) {
        expiredSessions.push(sessionId);
      }
    }

    // Destroy expired sessions
    for (const sessionId of expiredSessions) {
      await this.destroy(sessionId);
    }
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions().catch((err) => {
        // Log but don't crash on cleanup errors
        console.error("[SessionManager] Cleanup error:", err);
      });
    }, this.cleanupIntervalMs);

    // Don't block process exit
    this.cleanupTimer.unref();
  }

  private stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
