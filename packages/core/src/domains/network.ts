import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const maintenanceActions: ActionMap = {
  get_window:          { method: "GET",    path: `${P}/groups/{groupId}/maintenanceWindow` },
  toggle_auto_defer:   { method: "POST",   path: `${P}/groups/{groupId}/maintenanceWindow/autoDefer` },
  defer:               { method: "POST",   path: `${P}/groups/{groupId}/maintenanceWindow/defer` },
  update_window:       { method: "PATCH",  path: `${P}/groups/{groupId}/maintenanceWindow`, hasBody: true },
  reset_window:        { method: "DELETE", path: `${P}/groups/{groupId}/maintenanceWindow` },
  get_custom_dns:      { method: "GET",    path: `${P}/groups/{groupId}/awsCustomDNS` },
  toggle_custom_dns:   { method: "PATCH",  path: `${P}/groups/{groupId}/awsCustomDNS`, hasBody: true },
};

export const logExportActions: ActionMap = {
  list:           { method: "GET",    path: `${P}/groups/{groupId}/logIntegrations` },
  get:            { method: "GET",    path: `${P}/groups/{groupId}/logIntegrations/{id}` },
  get_legacy:     { method: "GET",    path: `${P}/groups/{groupId}/pushBasedLogExport` },
  create:         { method: "POST",   path: `${P}/groups/{groupId}/logIntegrations`, hasBody: true },
  create_legacy:  { method: "POST",   path: `${P}/groups/{groupId}/pushBasedLogExport`, hasBody: true },
  update:         { method: "PUT",    path: `${P}/groups/{groupId}/logIntegrations/{id}`, hasBody: true },
  update_legacy:  { method: "PATCH",  path: `${P}/groups/{groupId}/pushBasedLogExport`, hasBody: true },
  delete:         { method: "DELETE", path: `${P}/groups/{groupId}/logIntegrations/{id}` },
  delete_legacy:  { method: "DELETE", path: `${P}/groups/{groupId}/pushBasedLogExport` },
};

export const resourcePolicyActions: ActionMap = {
  get_non_compliant: { method: "GET",    path: `${P}/orgs/{orgId}/nonCompliantResources` },
  list:              { method: "GET",    path: `${P}/orgs/{orgId}/resourcePolicies` },
  get:               { method: "GET",    path: `${P}/orgs/{orgId}/resourcePolicies/{resourcePolicyId}` },
  create:            { method: "POST",   path: `${P}/orgs/{orgId}/resourcePolicies`, hasBody: true },
  validate:          { method: "POST",   path: `${P}/orgs/{orgId}/resourcePolicies:validate`, hasBody: true },
  update:            { method: "PATCH",  path: `${P}/orgs/{orgId}/resourcePolicies/{resourcePolicyId}`, hasBody: true },
  delete:            { method: "DELETE", path: `${P}/orgs/{orgId}/resourcePolicies/{resourcePolicyId}` },
};
