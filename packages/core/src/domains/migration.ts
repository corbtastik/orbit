import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const liveMigrationActions: ActionMap = {
  get_validation_status:    { method: "GET",    path: `${P}/groups/{groupId}/liveMigrations/validate/{validationId}` },
  get:                      { method: "GET",    path: `${P}/groups/{groupId}/liveMigrations/{liveMigrationId}` },
  list_available_projects:  { method: "GET",    path: `${P}/orgs/{orgId}/liveMigrations/availableProjects` },
  create:                   { method: "POST",   path: `${P}/groups/{groupId}/liveMigrations`, hasBody: true },
  validate:                 { method: "POST",   path: `${P}/groups/{groupId}/liveMigrations/validate`, hasBody: true },
  create_link_token:        { method: "POST",   path: `${P}/orgs/{orgId}/liveMigrations/linkTokens`, hasBody: true },
  cutover:                  { method: "PUT",    path: `${P}/groups/{groupId}/liveMigrations/{liveMigrationId}/cutover` },
  delete_link_tokens:       { method: "DELETE", path: `${P}/orgs/{orgId}/liveMigrations/linkTokens` },
};
