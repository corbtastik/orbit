/**
 * Barrel export for all database tools.
 *
 * Combines all tool categories into a single DATABASE_TOOLS array
 * that the server uses to build its dbToolIndex.
 */

export { ConnectionManager } from "./connection.js";
export type { DatabaseToolDef, DatabaseOperationType } from "./types.js";

import { CONNECTION_TOOLS } from "./connection-tools.js";
import { METADATA_TOOLS } from "./metadata-tools.js";
import { READ_TOOLS } from "./read-tools.js";
import { WRITE_TOOLS } from "./write-tools.js";
import { UPDATE_TOOLS } from "./update-tools.js";
import { DELETE_TOOLS } from "./delete-tools.js";
import { FILE_TOOLS } from "./file-tools.js";
import type { DatabaseToolDef } from "./types.js";

/**
 * All database tools in a single array.
 *
 * Order: connection (2), metadata (7), read (5), write (4), update (2), delete (4), file (1)
 */
export const DATABASE_TOOLS: DatabaseToolDef[] = [
  ...CONNECTION_TOOLS,
  ...METADATA_TOOLS,
  ...READ_TOOLS,
  ...WRITE_TOOLS,
  ...UPDATE_TOOLS,
  ...DELETE_TOOLS,
  ...FILE_TOOLS,
];
