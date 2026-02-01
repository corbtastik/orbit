import type { ActionMap } from "./base.js";

const P = "/api/atlas/v2";

export const monitoringActions: ActionMap = {
  download_logs:                 { method: "GET", path: `${P}/groups/{groupId}/clusters/{hostName}/logs/{logName}.gz` },
  list_fts_metrics:              { method: "GET", path: `${P}/groups/{groupId}/hosts/{processId}/fts/metrics` },
  list_fts_index_measurements:   { method: "GET", path: `${P}/groups/{groupId}/hosts/{processId}/fts/metrics/indexes/{databaseName}/{collectionName}/measurements` },
  get_fts_index_measurements:    { method: "GET", path: `${P}/groups/{groupId}/hosts/{processId}/fts/metrics/indexes/{databaseName}/{collectionName}/{indexName}/measurements` },
  list_fts_measurements:         { method: "GET", path: `${P}/groups/{groupId}/hosts/{processId}/fts/metrics/measurements` },
  list_processes:                { method: "GET", path: `${P}/groups/{groupId}/processes` },
  get_process:                   { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}` },
  list_databases:                { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/databases` },
  get_database:                  { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/databases/{databaseName}` },
  get_database_measurements:     { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/databases/{databaseName}/measurements` },
  list_disks:                    { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/disks` },
  get_disk:                      { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/disks/{partitionName}` },
  get_disk_measurements:         { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/disks/{partitionName}/measurements` },
  get_process_measurements:      { method: "GET", path: `${P}/groups/{groupId}/processes/{processId}/measurements` },
};

export const alertConfigActions: ActionMap = {
  list_matcher_fields: { method: "GET",    path: `${P}/alertConfigs/matchers/fieldNames` },
  list:                { method: "GET",    path: `${P}/groups/{groupId}/alertConfigs` },
  get:                 { method: "GET",    path: `${P}/groups/{groupId}/alertConfigs/{alertConfigId}` },
  get_alerts:          { method: "GET",    path: `${P}/groups/{groupId}/alertConfigs/{alertConfigId}/alerts` },
  get_alert_configs:   { method: "GET",    path: `${P}/groups/{groupId}/alerts/{alertId}/alertConfigs` },
  create:              { method: "POST",   path: `${P}/groups/{groupId}/alertConfigs`, hasBody: true },
  update:              { method: "PUT",    path: `${P}/groups/{groupId}/alertConfigs/{alertConfigId}`, hasBody: true },
  toggle:              { method: "PATCH",  path: `${P}/groups/{groupId}/alertConfigs/{alertConfigId}`, hasBody: true },
  delete:              { method: "DELETE", path: `${P}/groups/{groupId}/alertConfigs/{alertConfigId}` },
};

export const alertActions: ActionMap = {
  list:            { method: "GET",   path: `${P}/groups/{groupId}/alerts` },
  get:             { method: "GET",   path: `${P}/groups/{groupId}/alerts/{alertId}` },
  acknowledge:     { method: "PATCH", path: `${P}/groups/{groupId}/alerts/{alertId}`, hasBody: true },
};

export const performanceAdvisorActions: ActionMap = {
  list_drop_index_suggestions:      { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/performanceAdvisor/dropIndexSuggestions` },
  get_schema_advice:                { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/performanceAdvisor/schemaAdvice` },
  list_suggested_indexes:           { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/performanceAdvisor/suggestedIndexes` },
  get_managed_slow_ms:              { method: "GET",    path: `${P}/groups/{groupId}/managedSlowMs` },
  list_namespaces:                  { method: "GET",    path: `${P}/groups/{groupId}/processes/{processId}/performanceAdvisor/namespaces` },
  list_slow_queries:                { method: "GET",    path: `${P}/groups/{groupId}/processes/{processId}/performanceAdvisor/slowQueryLogs` },
  list_process_suggested_indexes:   { method: "GET",    path: `${P}/groups/{groupId}/processes/{processId}/performanceAdvisor/suggestedIndexes` },
  get_auto_indexing:                { method: "GET",    path: `${P}/groups/{groupId}/serverless/{clusterName}/performanceAdvisor/autoIndexing` },
  enable_managed_slow_ms:           { method: "POST",   path: `${P}/groups/{groupId}/managedSlowMs/enable` },
  set_auto_indexing:                { method: "POST",   path: `${P}/groups/{groupId}/serverless/{clusterName}/performanceAdvisor/autoIndexing` },
  disable_managed_slow_ms:          { method: "DELETE", path: `${P}/groups/{groupId}/managedSlowMs/disable` },
};

export const eventActions: ActionMap = {
  list_types:       { method: "GET", path: `${P}/eventTypes` },
  list_in_project:  { method: "GET", path: `${P}/groups/{groupId}/events` },
  get_in_project:   { method: "GET", path: `${P}/groups/{groupId}/events/{eventId}` },
  list_in_org:      { method: "GET", path: `${P}/orgs/{orgId}/events` },
  get_in_org:       { method: "GET", path: `${P}/orgs/{orgId}/events/{eventId}` },
};

export const collectionMetricActions: ActionMap = {
  list_pinned:                { method: "GET",   path: `${P}/groups/{groupId}/clusters/{clusterName}/collStats/pinned` },
  get_namespaces:             { method: "GET",   path: `${P}/groups/{groupId}/clusters/{clusterName}/{clusterView}/collStats/namespaces` },
  list_measurements:          { method: "GET",   path: `${P}/groups/{groupId}/clusters/{clusterName}/{clusterView}/{databaseName}/{collectionName}/collStats/measurements` },
  list_metrics:               { method: "GET",   path: `${P}/groups/{groupId}/collStats/metrics` },
  get_process_namespaces:     { method: "GET",   path: `${P}/groups/{groupId}/processes/{processId}/collStats/namespaces` },
  list_process_measurements:  { method: "GET",   path: `${P}/groups/{groupId}/processes/{processId}/{databaseName}/{collectionName}/collStats/measurements` },
  pin_namespaces:             { method: "PUT",   path: `${P}/groups/{groupId}/clusters/{clusterName}/collStats/pinned`, hasBody: true },
  update_pinned:              { method: "PATCH", path: `${P}/groups/{groupId}/clusters/{clusterName}/collStats/pinned`, hasBody: true },
  unpin_namespaces:           { method: "PATCH", path: `${P}/groups/{groupId}/clusters/{clusterName}/collStats/unpin`, hasBody: true },
};

export const integrationActions: ActionMap = {
  list:                       { method: "GET",    path: `${P}/groups/{groupId}/integrations` },
  get:                        { method: "GET",    path: `${P}/groups/{groupId}/integrations/{integrationType}` },
  create:                     { method: "POST",   path: `${P}/groups/{groupId}/integrations/{integrationType}`, hasBody: true },
  update:                     { method: "PUT",    path: `${P}/groups/{groupId}/integrations/{integrationType}`, hasBody: true },
  delete:                     { method: "DELETE", path: `${P}/groups/{groupId}/integrations/{integrationType}` },
  // Access tracking
  get_access_history_cluster: { method: "GET",    path: `${P}/groups/{groupId}/dbAccessHistory/clusters/{clusterName}` },
  get_access_history_process: { method: "GET",    path: `${P}/groups/{groupId}/dbAccessHistory/processes/{hostname}` },
  // Query shape insights
  list_query_shape_summaries: { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/queryShapeInsights/summaries` },
  get_query_shape_details:    { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/queryShapeInsights/{queryShapeHash}/details` },
  list_query_shapes:          { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/queryShapes` },
  get_query_shape:            { method: "GET",    path: `${P}/groups/{groupId}/clusters/{clusterName}/queryShapes/{queryShapeHash}` },
  update_query_shape:         { method: "PATCH",  path: `${P}/groups/{groupId}/clusters/{clusterName}/queryShapes/{queryShapeHash}`, hasBody: true },
};
