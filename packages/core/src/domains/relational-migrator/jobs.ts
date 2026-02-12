import type { ActionMap } from "../base.js";

const P = "/api/v1";

/**
 * Migration job management endpoints for Relational Migrator.
 */
export const rmJobActions: ActionMap = {
  // CRUD operations
  list:                { method: "GET",    path: `${P}/jobs` },
  get:                 { method: "GET",    path: `${P}/jobs/{jobId}` },
  create:              { method: "POST",   path: `${P}/jobs`, hasBody: true },

  // Job control
  stop:                { method: "POST",   path: `${P}/jobs/{jobId}/stop` },
  pause:               { method: "POST",   path: `${P}/jobs/{jobId}/pause` },
  resume:              { method: "POST",   path: `${P}/jobs/{jobId}/resume` },
  retry:               { method: "POST",   path: `${P}/jobs/{jobId}/retry` },
  signal:              { method: "POST",   path: `${P}/jobs/{jobId}/signal`, hasBody: true },

  // Logs
  get_logs:            { method: "GET",    path: `${P}/jobs/{jobId}/logs` },
  download_logs:       { method: "GET",    path: `${P}/jobs/{jobId}/logs/download` },

  // Verification
  get_verification:    { method: "GET",    path: `${P}/verification/{jobId}` },
  stop_verification:   { method: "POST",   path: `${P}/verification/{jobId}/stop` },
};
