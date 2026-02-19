/**
 * RDBMS shared utilities.
 *
 * Common patterns used across RDBMS tool modules.
 */

import { MappingStore } from "./mapping-store.js";
import type { RdbmsConnectionManager } from "./connection.js";

/**
 * Extended connection manager with mapping store.
 *
 * We attach the mapping store to the connection manager for session isolation.
 * Each session (HTTP or stdio) gets its own connection manager, and therefore
 * its own mapping store.
 */
export interface RdbmsConnectionManagerWithStore extends RdbmsConnectionManager {
  _mappingStore?: MappingStore;
}

/**
 * Get or create the mapping store from the connection manager.
 *
 * The mapping store is lazily created on first access and attached to the
 * connection manager for the duration of the session.
 *
 * @param rdbms The RDBMS connection manager.
 * @returns The mapping store for this session.
 */
export function getMappingStore(rdbms: RdbmsConnectionManager): MappingStore {
  const manager = rdbms as RdbmsConnectionManagerWithStore;

  if (!manager._mappingStore) {
    manager._mappingStore = new MappingStore();
  }

  return manager._mappingStore;
}
