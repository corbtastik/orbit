import type { ActionMap } from "../base.js";

const P = "/api/v1";

/**
 * Schema discovery and management endpoints for Relational Migrator.
 */
export const rmSchemaActions: ActionMap = {
  // Schema retrieval
  get:                 { method: "GET",    path: `${P}/schema/{schemaId}` },

  // Schema discovery
  discover_jdbc:       { method: "POST",   path: `${P}/schema/jdbc`, hasBody: true },
  parse_ddl:           { method: "POST",   path: `${P}/schema/ddl`, hasBody: true },
};
