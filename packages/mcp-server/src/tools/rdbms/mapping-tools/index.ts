/**
 * RDBMS Mapping tools — barrel export.
 *
 * Tools for creating, updating, and validating table-to-collection mappings.
 * Supports auto-generation from schema analysis or manual specification.
 */

import type { RdbmsToolDef } from "../types.js";

import { createMappingTool } from "./create.js";
import { updateMappingTool } from "./update.js";
import { previewDocumentTool } from "./preview.js";
import { validateMappingTool } from "./validate.js";
import { listMappingsTool, deleteMappingTool } from "./list-delete.js";

// Re-export individual tools for direct import
export {
  createMappingTool,
  updateMappingTool,
  previewDocumentTool,
  validateMappingTool,
  listMappingsTool,
  deleteMappingTool,
};

// Re-export helpers for use by other tools
export { transformRow, applyTransform, camelCase, getPrimaryKeyColumn } from "./helpers.js";

/**
 * All mapping tools.
 */
export const MAPPING_TOOLS: RdbmsToolDef[] = [
  createMappingTool,
  updateMappingTool,
  previewDocumentTool,
  validateMappingTool,
  listMappingsTool,
  deleteMappingTool,
];
