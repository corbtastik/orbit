/**
 * ConnectionManager — wraps the MongoDB Node.js driver lifecycle.
 *
 * Created once in the MCP server entry point and passed to createServer().
 * Supports connect/disconnect/switch via tool calls or an initial env var
 * (MONGODB_CONNECTION_STRING). All database tools receive this instance to
 * access the underlying MongoClient, Db, and Collection objects.
 */

import { MongoClient, type Db, type Collection } from "mongodb";

export class ConnectionManager {
  private client: MongoClient | null = null;
  private connectionString: string | null = null;

  /**
   * Connect to a MongoDB instance.
   *
   * If already connected, the existing connection is closed first.
   * The connection string is stored so it can be reported (without secrets)
   * in status responses.
   */
  async connect(connectionString: string): Promise<void> {
    // Close any existing connection before switching
    if (this.client) {
      await this.disconnect();
    }

    this.client = new MongoClient(connectionString);
    await this.client.connect();
    this.connectionString = connectionString;
  }

  /**
   * Disconnect from the current MongoDB instance.
   *
   * Safe to call even if not connected — it's a no-op.
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connectionString = null;
    }
  }

  /**
   * Get the active MongoClient.
   *
   * @throws Error if not connected — callers should check isConnected() first
   *         or let the server dispatch handle the "not connected" error.
   */
  getClient(): MongoClient {
    if (!this.client) {
      throw new Error(
        "Not connected to MongoDB. Use the connect tool first.",
      );
    }
    return this.client;
  }

  /**
   * Get a database reference by name.
   */
  getDb(name: string): Db {
    return this.getClient().db(name);
  }

  /**
   * Get a collection reference by database and collection name.
   */
  getCollection(dbName: string, collectionName: string): Collection {
    return this.getDb(dbName).collection(collectionName);
  }

  /**
   * Check whether a MongoDB connection is active.
   */
  isConnected(): boolean {
    return this.client !== null;
  }

  /**
   * Return a sanitized version of the connection string for status display.
   * Masks credentials if present.
   */
  getConnectionInfo(): string | null {
    if (!this.connectionString) return null;

    try {
      const url = new URL(this.connectionString);
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
