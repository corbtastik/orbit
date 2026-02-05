/**
 * ConnectionManager — wraps the MongoDB Node.js driver lifecycle.
 *
 * Supports multiple named connections for cross-database workflows like
 * copying data between instances, comparing schemas, or aggregating
 * queries across databases.
 *
 * Connections can be registered (lazy) or connected eagerly:
 * - registerConnection(name, connString) — registers for later use
 * - connectNamed(name) — establishes the actual connection
 * - Auto-connect on first use when tools specify a connection name
 *
 * Backward compatibility: The original single-connection API (connect,
 * disconnect, getClient, getDb, getCollection) continues to work and
 * operates on a "default" connection.
 */

import { MongoClient, type Db, type Collection } from "mongodb";

/** Connection status for list-connections output. */
export type ConnectionStatus = "connected" | "registered";

/** Info about a single connection for listing. */
export interface ConnectionInfo {
  name: string;
  status: ConnectionStatus;
  uri: string; // Sanitized (password masked)
}

export class ConnectionManager {
  /** Active MongoClient instances by name. */
  private clients: Map<string, MongoClient> = new Map();

  /** Connection strings by name (for connected clients). */
  private connectionStrings: Map<string, string> = new Map();

  /** Registered but not yet connected — name → connection string. */
  private registeredConnections: Map<string, string> = new Map();

  /** Name of the default connection (for backward compat). */
  private static readonly DEFAULT_NAME = "default";

  // ---------------------------------------------------------------------------
  // Multi-connection API
  // ---------------------------------------------------------------------------

  /**
   * Register a named connection for lazy connect on first use.
   *
   * Does NOT establish a connection — use connectNamed() or wait for
   * auto-connect when a tool uses this connection name.
   */
  registerConnection(name: string, connectionString: string): void {
    // If already connected with this name, skip registration
    if (this.clients.has(name)) {
      return;
    }
    this.registeredConnections.set(name, connectionString);
  }

  /**
   * Connect to a named connection.
   *
   * If the name is registered (from env vars or registerConnection),
   * uses that connection string. Otherwise, a connectionString must
   * be provided to create a new connection.
   *
   * @param name - Connection name
   * @param connectionString - Optional connection string (required if not registered)
   */
  async connectNamed(name: string, connectionString?: string): Promise<void> {
    // Already connected? Nothing to do.
    if (this.clients.has(name)) {
      return;
    }

    // Determine the connection string
    let connStr = connectionString;
    if (!connStr) {
      connStr = this.registeredConnections.get(name);
    }
    if (!connStr) {
      throw new Error(
        `Connection "${name}" is not registered and no connection string provided.`,
      );
    }

    // Establish connection
    const client = new MongoClient(connStr);
    await client.connect();

    this.clients.set(name, client);
    this.connectionStrings.set(name, connStr);
    // Remove from registered since it's now connected
    this.registeredConnections.delete(name);
  }

  /**
   * Disconnect a specific named connection.
   */
  async disconnectNamed(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
      this.connectionStrings.delete(name);
    }
  }

  /**
   * Disconnect all active connections.
   */
  async disconnectAll(): Promise<void> {
    const closePromises: Promise<void>[] = [];
    for (const [name, client] of this.clients) {
      closePromises.push(
        client.close().then(() => {
          this.clients.delete(name);
          this.connectionStrings.delete(name);
        }),
      );
    }
    await Promise.all(closePromises);
  }

  /**
   * Get the MongoClient for a named connection.
   *
   * @throws Error if the connection doesn't exist or isn't connected.
   */
  getNamedClient(name: string): MongoClient {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(
        `Connection "${name}" is not connected. Use the connect tool first.`,
      );
    }
    return client;
  }

  /**
   * Get a database reference from a named connection.
   */
  getNamedDb(connectionName: string, dbName: string): Db {
    return this.getNamedClient(connectionName).db(dbName);
  }

  /**
   * Get a collection reference from a named connection.
   */
  getNamedCollection(
    connectionName: string,
    dbName: string,
    collectionName: string,
  ): Collection {
    return this.getNamedDb(connectionName, dbName).collection(collectionName);
  }

  /**
   * Check if a connection name exists (registered or connected).
   */
  hasConnection(name: string): boolean {
    return this.clients.has(name) || this.registeredConnections.has(name);
  }

  /**
   * Check if a named connection is actively connected.
   */
  isConnectedNamed(name: string): boolean {
    return this.clients.has(name);
  }

  /**
   * List all connections (registered and connected).
   */
  listConnections(): ConnectionInfo[] {
    const result: ConnectionInfo[] = [];

    // Add connected connections
    for (const [name, connStr] of this.connectionStrings) {
      result.push({
        name,
        status: "connected",
        uri: this.sanitizeUri(connStr),
      });
    }

    // Add registered but not connected
    for (const [name, connStr] of this.registeredConnections) {
      result.push({
        name,
        status: "registered",
        uri: this.sanitizeUri(connStr),
      });
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Backward compatibility API (single "default" connection)
  // ---------------------------------------------------------------------------

  /**
   * Connect to a MongoDB instance using the "default" connection.
   *
   * If already connected, the existing default connection is closed first.
   * This maintains backward compatibility with the original single-connection API.
   */
  async connect(connectionString: string): Promise<void> {
    // Close existing default connection if present
    if (this.clients.has(ConnectionManager.DEFAULT_NAME)) {
      await this.disconnectNamed(ConnectionManager.DEFAULT_NAME);
    }
    await this.connectNamed(ConnectionManager.DEFAULT_NAME, connectionString);
  }

  /**
   * Disconnect the default connection.
   *
   * Safe to call even if not connected — it's a no-op.
   */
  async disconnect(): Promise<void> {
    await this.disconnectNamed(ConnectionManager.DEFAULT_NAME);
  }

  /**
   * Get the default MongoClient.
   *
   * @throws Error if not connected — callers should check isConnected() first
   *         or let the server dispatch handle the "not connected" error.
   */
  getClient(): MongoClient {
    const client = this.clients.get(ConnectionManager.DEFAULT_NAME);
    if (!client) {
      throw new Error(
        "Not connected to MongoDB. Use the connect tool first.",
      );
    }
    return client;
  }

  /**
   * Get a database reference from the default connection.
   */
  getDb(name: string): Db {
    return this.getClient().db(name);
  }

  /**
   * Get a collection reference from the default connection.
   */
  getCollection(dbName: string, collectionName: string): Collection {
    return this.getDb(dbName).collection(collectionName);
  }

  /**
   * Check whether the default MongoDB connection is active.
   */
  isConnected(): boolean {
    return this.clients.has(ConnectionManager.DEFAULT_NAME);
  }

  /**
   * Return a sanitized version of the default connection string for status display.
   * Masks credentials if present.
   */
  getConnectionInfo(): string | null {
    const connStr = this.connectionStrings.get(ConnectionManager.DEFAULT_NAME);
    if (!connStr) return null;
    return this.sanitizeUri(connStr);
  }

  /**
   * Check if there are ANY active connections (not just default).
   * Used by server dispatch to decide if tools requiring a connection can run.
   */
  hasAnyConnection(): boolean {
    return this.clients.size > 0;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Mask password in a connection URI.
   */
  private sanitizeUri(connectionString: string): string {
    try {
      const url = new URL(connectionString);
      if (url.password) {
        url.password = "****";
      }
      return url.toString();
    } catch {
      // If the connection string isn't a valid URL (e.g., old-style format),
      // return a generic indicator rather than leaking credentials.
      return "mongodb://****";
    }
  }
}
