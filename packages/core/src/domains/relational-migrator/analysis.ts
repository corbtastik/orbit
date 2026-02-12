import type { ActionMap } from "../base.js";

const P = "/api/v1";

/**
 * Pre-migration analysis endpoints for Relational Migrator.
 */
export const rmAnalysisActions: ActionMap = {
  // Reports
  get_report:          { method: "GET",    path: `${P}/analysis/{projectId}/report` },
  get_report_rules:    { method: "GET",    path: `${P}/analysis/{projectId}/report/rule` },

  // Tasks
  get_task:            { method: "GET",    path: `${P}/analysis/{projectId}/task` },
  cancel_task:         { method: "POST",   path: `${P}/analysis/{projectId}/task/cancel` },
};
