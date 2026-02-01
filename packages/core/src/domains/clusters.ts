import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const clusterActions: ActionMap = {
  list:                  { method: "GET",    path: `${P}/groups/{groupId}/clusters` },
  list_all:              { method: "GET",    path: `${P}/clusters` },
  get:                   { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}` },
  get_status:            { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/status` },
  get_process_args:      { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/processArgs` },
  get_autoscaling_config:{ method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/autoScalingConfiguration` },
  list_provider_regions: { method: "GET",    path: `${P}/groups/{groupId}/clusters/provider/regions` },
  get_sample_dataset:    { method: "GET",    path: `${P}/groups/{groupId}/sampleDatasetLoad/{sampleDatasetId}` },
  create:                { method: "POST",   path: `${P}/groups/{groupId}/clusters`, hasBody: true },
  upgrade_shared:        { method: "POST",   path: `${P}/groups/{groupId}/clusters/tenantUpgrade`, hasBody: true },
  upgrade_to_serverless: { method: "POST",   path: `${P}/groups/{groupId}/clusters/tenantUpgradeToServerless`, hasBody: true },
  test_failover:         { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}/restartPrimaries` },
  grant_mongodb_access:  { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}:grantMongoDBEmployeeAccess`, hasBody: true },
  revoke_mongodb_access: { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}:revokeMongoDBEmployeeAccess` },
  pin_fcv:               { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}:pinFeatureCompatibilityVersion`, hasBody: true },
  unpin_fcv:             { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}:unpinFeatureCompatibilityVersion` },
  load_sample_data:      { method: "POST",   path: `${P}/groups/{groupId}/sampleDatasetLoad/{name}` },
  create_rolling_index:  { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}/index`, hasBody: true },
  update:                { method: "PATCH",  path: `${P}/groups/{groupId}/clusters/{clusterName}`, hasBody: true },
  update_process_args:   { method: "PATCH",  path: `${P}/groups/{groupId}/clusters/{clusterName}/processArgs`, hasBody: true },
  delete:                { method: "DELETE", path: `${P}/groups/{groupId}/clusters/{clusterName}` },
};

export const flexClusterActions: ActionMap = {
  list:    { method: "GET",    path: `${P}/groups/{groupId}/flexClusters` },
  get:     { method: "GET",    path: `${P}/groups/{groupId}/flexClusters/{name}` },
  create:  { method: "POST",   path: `${P}/groups/{groupId}/flexClusters`, hasBody: true },
  upgrade: { method: "POST",   path: `${P}/groups/{groupId}/flexClusters:tenantUpgrade`, hasBody: true },
  update:  { method: "PATCH",  path: `${P}/groups/{groupId}/flexClusters/{name}`, hasBody: true },
  delete:  { method: "DELETE", path: `${P}/groups/{groupId}/flexClusters/{name}` },
};

export const serverlessInstanceActions: ActionMap = {
  list:   { method: "GET",    path: `${P}/groups/{groupId}/serverless` },
  get:    { method: "GET",    path: `${P}/groups/{groupId}/serverless/{name}` },
  create: { method: "POST",   path: `${P}/groups/{groupId}/serverless`, hasBody: true },
  update: { method: "PATCH",  path: `${P}/groups/{groupId}/serverless/{name}`, hasBody: true },
  delete: { method: "DELETE", path: `${P}/groups/{groupId}/serverless/{name}` },
};

export const globalClusterActions: ActionMap = {
  get:                        { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/globalWrites` },
  create_zone_mapping:        { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}/globalWrites/customZoneMapping`, hasBody: true },
  create_managed_namespace:   { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}/globalWrites/managedNamespaces`, hasBody: true },
  delete_zone_mapping:        { method: "DELETE", path: `${P}/groups/{groupId}/clusters/{clusterName}/globalWrites/customZoneMapping` },
  delete_managed_namespaces:  { method: "DELETE", path: `${P}/groups/{groupId}/clusters/{clusterName}/globalWrites/managedNamespaces` },
};

export const clusterOutageActions: ActionMap = {
  get:   { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/outageSimulation` },
  start: { method: "POST",   path: `${P}/groups/{groupId}/clusters/{clusterName}/outageSimulation`, hasBody: true },
  end:   { method: "DELETE", path: `${P}/groups/{groupId}/clusters/{clusterName}/outageSimulation` },
};
