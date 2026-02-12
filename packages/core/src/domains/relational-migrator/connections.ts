import type { ActionMap } from "../base.js";

const P = "/api/v1";

/**
 * Connection management endpoints for Relational Migrator.
 */
export const rmConnectionActions: ActionMap = {
  // JDBC Connections
  list_jdbc:           { method: "GET",    path: `${P}/connections/jdbc` },
  get_jdbc:            { method: "GET",    path: `${P}/connections/jdbc/{jdbcId}` },
  create_jdbc:         { method: "POST",   path: `${P}/connections/jdbc`, hasBody: true },
  update_jdbc:         { method: "PUT",    path: `${P}/connections/jdbc/{jdbcId}`, hasBody: true },
  delete_jdbc:         { method: "DELETE", path: `${P}/connections/jdbc/{jdbcId}` },

  // MongoDB Connections
  list_mongodb:        { method: "GET",    path: `${P}/connections/mongodb` },
  get_mongodb:         { method: "GET",    path: `${P}/connections/mongodb/{mongodbId}` },
  create_mongodb:      { method: "POST",   path: `${P}/connections/mongodb`, hasBody: true },
  update_mongodb:      { method: "PUT",    path: `${P}/connections/mongodb/{mongodbId}`, hasBody: true },
  delete_mongodb:      { method: "DELETE", path: `${P}/connections/mongodb/{mongodbId}` },

  // Connection testing
  test_jdbc:           { method: "POST",   path: `${P}/connectivity/jdbc`, hasBody: true },
  test_mongodb:        { method: "POST",   path: `${P}/connectivity/mongodb`, hasBody: true },

  // Driver info
  get_drivers:         { method: "GET",    path: `${P}/connections/driver` },
};
