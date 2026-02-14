/**
 * RDBMS Connection Manager.
 *
 * Manages multiple named RDBMS connections, mirroring the pattern
 * used by MongoDB's ConnectionManager for consistency.
 *
 * Connections can be registered (configured) and then connected on-demand.
 * This supports workflows where multiple source databases are configured
 * upfront and connected as needed during migration.
 */

import { createDriver, type RdbmsDriver, type RdbmsType } from "./drivers/index.js";

/**
 * Internal connection state.
 */
interface RdbmsConnectionInfo {
  /** Connection name (identifier). */
  name: string;
  /** Database type. */
  type: RdbmsType;
  /** Connection string or DSN. */
  connectionString: string;
  /** Driver instance (null if not connected). */
  driver: RdbmsDriver | null;
  /** Whether currently connected. */
  connected: boolean;
  /** Connection timestamp. */
  connectedAt?: Date;
}

/**
 * Connection status for external reporting.
 */
export interface RdbmsConnectionStatus {
  /** Connection name. */
  name: string;
  /** Database type. */
  type: RdbmsType;
  /** Whether currently connected. */
  connected: boolean;
  /** When the connection was established. */
  connectedAt?: Date;
}

/**
 * Manages multiple RDBMS connections.
 *
 * Usage:
 * ```typescript
 * const manager = new RdbmsConnectionManager();
 *
 * // Register connections (from config or environment)
 * manager.register("source", "postgres", "postgresql://...");
 * manager.register("legacy", "oracle", "oracle://...");
 *
 * // Connect when needed
 * await manager.connect("source");
 *
 * // Use the driver
 * const driver = manager.getDriver("source");
 * const tables = await driver.listTables();
 *
 * // Cleanup
 * await manager.disconnectAll();
 * ```
 */
export class RdbmsConnectionManager {
  private connections = new Map<string, RdbmsConnectionInfo>();
  private defaultName: string | null = null;

  /**
   * Register a connection without connecting.
   *
   * The first registered connection becomes the default.
   *
   * @param name Unique connection name.
   * @param type RDBMS type (postgres, oracle, sqlite, etc.).
   * @param connectionString Database connection string.
   * @throws Error if a connection with this name is already registered.
   */
  register(name: string, type: RdbmsType, connectionString: string): void {
    if (this.connections.has(name)) {
      throw new Error(
        `RDBMS connection "${name}" is already registered. ` +
        `Use a different name or disconnect first.`,
      );
    }

    this.connections.set(name, {
      name,
      type,
      connectionString,
      driver: null,
      connected: false,
    });

    // First registration becomes default
    if (this.defaultName === null) {
      this.defaultName = name;
    }
  }

  /**
   * Connect to a registered RDBMS.
   *
   * @param name Connection name. If not specified, uses the default.
   * @throws Error if the connection is not registered or already connected.
   */
  async connect(name?: string): Promise<void> {
    const targetName = name ?? this.defaultName;
    if (!targetName) {
      throw new Error(
        "No RDBMS connection specified and no default connection registered.",
      );
    }

    const info = this.connections.get(targetName);
    if (!info) {
      throw new Error(
        `RDBMS connection "${targetName}" is not registered. ` +
        `Use register() first or check the connection name.`,
      );
    }

    if (info.connected) {
      // Already connected — no-op
      return;
    }

    // Create driver and connect
    const driver = createDriver(info.type);
    await driver.connect(info.connectionString);

    info.driver = driver;
    info.connected = true;
    info.connectedAt = new Date();
  }

  /**
   * Connect with inline registration (for one-off connections).
   *
   * @param name Connection name.
   * @param type RDBMS type.
   * @param connectionString Database connection string.
   */
  async connectNew(
    name: string,
    type: RdbmsType,
    connectionString: string,
  ): Promise<void> {
    // Disconnect existing if same name
    if (this.connections.has(name)) {
      await this.disconnect(name);
      this.connections.delete(name);
    }

    this.register(name, type, connectionString);
    await this.connect(name);
  }

  /**
   * Disconnect from an RDBMS.
   *
   * @param name Connection name. If not specified, disconnects the default.
   */
  async disconnect(name?: string): Promise<void> {
    const targetName = name ?? this.defaultName;
    if (!targetName) {
      return; // Nothing to disconnect
    }

    const info = this.connections.get(targetName);
    if (!info || !info.connected || !info.driver) {
      return; // Not connected
    }

    await info.driver.disconnect();
    info.driver = null;
    info.connected = false;
    info.connectedAt = undefined;
  }

  /**
   * Disconnect all connections and clear registrations.
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises: Promise<void>[] = [];

    for (const info of this.connections.values()) {
      if (info.connected && info.driver) {
        disconnectPromises.push(
          info.driver.disconnect().catch((err) => {
            // Log but don't throw — we want to disconnect all
            console.error(`Error disconnecting "${info.name}":`, err);
          }),
        );
      }
    }

    await Promise.all(disconnectPromises);
    this.connections.clear();
    this.defaultName = null;
  }

  /**
   * Get the driver for a connection.
   *
   * @param name Connection name. If not specified, uses the default.
   * @throws Error if not connected.
   */
  getDriver(name?: string): RdbmsDriver {
    const targetName = name ?? this.defaultName;
    if (!targetName) {
      throw new Error(
        "No RDBMS connection specified and no default connection available.",
      );
    }

    const info = this.connections.get(targetName);
    if (!info) {
      throw new Error(`RDBMS connection "${targetName}" is not registered.`);
    }

    if (!info.connected || !info.driver) {
      throw new Error(
        `RDBMS connection "${targetName}" is not connected. ` +
        `Use connect-rdbms first.`,
      );
    }

    return info.driver;
  }

  /**
   * Check if a connection is registered.
   */
  hasConnection(name: string): boolean {
    return this.connections.has(name);
  }

  /**
   * Check if a connection is currently connected.
   */
  isConnected(name?: string): boolean {
    const targetName = name ?? this.defaultName;
    if (!targetName) {
      return false;
    }
    const info = this.connections.get(targetName);
    return info?.connected ?? false;
  }

  /**
   * Get the default connection name.
   */
  getDefaultName(): string | null {
    return this.defaultName;
  }

  /**
   * Set the default connection name.
   *
   * @param name Must be a registered connection name.
   */
  setDefaultName(name: string): void {
    if (!this.connections.has(name)) {
      throw new Error(
        `Cannot set default: connection "${name}" is not registered.`,
      );
    }
    this.defaultName = name;
  }

  /**
   * List all registered connections with their status.
   */
  listConnections(): RdbmsConnectionStatus[] {
    return Array.from(this.connections.values()).map((info) => ({
      name: info.name,
      type: info.type,
      connected: info.connected,
      connectedAt: info.connectedAt,
    }));
  }

  /**
   * Get connection info (for debugging/display).
   */
  getConnectionInfo(name: string): RdbmsConnectionStatus | null {
    const info = this.connections.get(name);
    if (!info) {
      return null;
    }
    return {
      name: info.name,
      type: info.type,
      connected: info.connected,
      connectedAt: info.connectedAt,
    };
  }
}
