/**
 * SessionManager — provides per-session connection isolation for HTTP transport.
 *
 * Each MCP session (identified by session ID) gets its own ConnectionManager
 * and RdbmsConnectionManager, ensuring isolated database connections between
 * clients. Sessions are automatically cleaned up after idle timeout.
 */

import { ConnectionManager, RdbmsConnectionManager } from "../tools/index.js";

/** Context for a single session. */
export interface SessionContext {
  sessionId: string;
  /** MongoDB connection manager. */
  connectionManager: ConnectionManager;
  /** RDBMS connection manager (for migration tools). */
  rdbmsConnectionManager: RdbmsConnectionManager;
  createdAt: Date;
  lastActivity: Date;
}

/** Options for SessionManager. */
export interface SessionManagerOptions {
  /** Idle timeout in milliseconds. Default: 30 minutes. */
  idleTimeoutMs?: number;
  /** Cleanup interval in milliseconds. Default: 1 minute. */
  cleanupIntervalMs?: number;
  /** Maximum number of concurrent sessions. Default: 1000. */
  maxSessions?: number;
  /**
   * Named MongoDB connection strings (from MONGODB_CONN_* env vars and the
   * config file) to register into every new session.
   *
   * Sessions get their own ConnectionManager for isolation, which means they
   * start empty unless seeded here — without this, list-connections reports
   * nothing over HTTP even though stdio mode sees the same connections fine.
   */
  mongoConnections?: Record<string, string>;
}

/**
 * Error thrown when the maximum session limit is reached.
 */
export class MaxSessionsExceededError extends Error {
  constructor(maxSessions: number) {
    super(`Maximum sessions (${maxSessions}) exceeded. Try again later.`);
    this.name = "MaxSessionsExceededError";
  }
}

/**
 * Manages per-session ConnectionManager instances with automatic cleanup.
 */
export class SessionManager {
  private sessions: Map<string, SessionContext> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  private readonly idleTimeoutMs: number;
  private readonly cleanupIntervalMs: number;
  private readonly maxSessions: number;
  private readonly mongoConnections: Record<string, string>;

  constructor(options: SessionManagerOptions = {}) {
    this.idleTimeoutMs = options.idleTimeoutMs ?? 30 * 60 * 1000; // 30 min
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60 * 1000; // 1 min
    this.maxSessions = options.maxSessions ?? 1000; // 1000 sessions
    this.mongoConnections = options.mongoConnections ?? {};

    // Start periodic cleanup
    this.startCleanup();
  }

  /**
   * Get or create a session context for the given session ID.
   *
   * If the session exists, updates its lastActivity timestamp.
   * If not, creates a new session with fresh connection managers.
   *
   * @throws MaxSessionsExceededError if the session limit is reached
   */
  getOrCreate(sessionId: string): SessionContext {
    let session = this.sessions.get(sessionId);

    if (session) {
      // Update last activity
      session.lastActivity = new Date();
      return session;
    }

    // Check session limit before creating new session
    if (this.sessions.size >= this.maxSessions) {
      throw new MaxSessionsExceededError(this.maxSessions);
    }

    // Create new session with both connection managers
    const connectionManager = new ConnectionManager();

    // Seed the session with the configured named connections. Registration is
    // lazy — the driver only dials on first use — so this stays synchronous.
    for (const [connName, connString] of Object.entries(this.mongoConnections)) {
      connectionManager.registerConnection(connName, connString);
    }

    session = {
      sessionId,
      connectionManager,
      rdbmsConnectionManager: new RdbmsConnectionManager(),
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
   * Destroy a specific session, closing all its database connections.
   */
  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      await Promise.all([
        session.connectionManager.disconnectAll(),
        session.rdbmsConnectionManager.disconnectAll(),
      ]);
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
      destroyPromises.push(session.rdbmsConnectionManager.disconnectAll());
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

    // Destroy expired sessions with per-session error handling
    for (const sessionId of expiredSessions) {
      try {
        await this.destroy(sessionId);
      } catch (err) {
        // Log but continue cleaning up other sessions
        console.error(`[SessionManager] Failed to destroy session ${sessionId}:`, err);
      }
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
