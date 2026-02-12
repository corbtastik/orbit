import type { ActionMap } from "../base.js";

const P = "/api/v1";

/**
 * Project management endpoints for Relational Migrator.
 */
export const rmProjectActions: ActionMap = {
  // CRUD operations
  list:                { method: "GET",    path: `${P}/project` },
  get:                 { method: "GET",    path: `${P}/project/{projectId}` },
  create:              { method: "POST",   path: `${P}/project`, hasBody: true },
  update:              { method: "PUT",    path: `${P}/project/{projectId}`, hasBody: true },
  delete:              { method: "DELETE", path: `${P}/project/{projectId}` },

  // Collections
  get_collections:     { method: "GET",    path: `${P}/project/{projectId}/collections` },

  // Export/Import
  export:              { method: "GET",    path: `${P}/project/{projectId}/export` },
  export_json:         { method: "GET",    path: `${P}/project/{projectId}/export/json` },
  export_json_download:{ method: "GET",    path: `${P}/project/{projectId}/export/json/download` },
  import:              { method: "POST",   path: `${P}/project/import`, hasBody: true },

  // Schema recommendations
  get_recommendation:  { method: "POST",   path: `${P}/project/recommendation`, hasBody: true },

  // Job readiness
  get_job_readiness:   { method: "GET",    path: `${P}/project/{projectId}/job/readiness` },
  get_job_preview:     { method: "GET",    path: `${P}/project/{projectId}/job/preview` },
  get_job_script:      { method: "GET",    path: `${P}/project/{projectId}/job/script` },

  // Diagnostics
  get_diagnostic:      { method: "GET",    path: `${P}/project/{projectId}/diagnostic` },
};
