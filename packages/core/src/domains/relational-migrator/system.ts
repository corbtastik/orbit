import type { ActionMap } from "../base.js";

const P = "/api/v1";

/**
 * System and health endpoints for Relational Migrator.
 */
export const rmSystemActions: ActionMap = {
  // System info
  get_info:            { method: "GET", path: `${P}/info` },
  get_news:            { method: "GET", path: `${P}/news` },

  // Health
  get_health:          { method: "GET", path: "/actuator/health" },
  get_actuator:        { method: "GET", path: "/actuator" },

  // Connectivity
  get_environment:     { method: "GET", path: `${P}/connectivity/environment` },
};
