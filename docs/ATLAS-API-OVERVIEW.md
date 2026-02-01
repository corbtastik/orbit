# MongoDB Atlas Admin API v2 — Overview

Auto-generated from the MongoDB Atlas Administration API OpenAPI 3.0 specification.

- **Spec version:** 2.0
- **Generated:** 2026-01-31
- **Source SHA:** `1f6e58a6e86ac43e73836fcb78191467b0263351`

## Summary

| Metric | Count |
|--------|------:|
| Endpoint paths | 295 |
| Total operations | 473 |
| Domains (PLAN.md) | 11 |
| Tags (mapped) | 52 |
| Tags (unmapped) | 0 |

## Authentication

The Atlas Admin API supports two authentication mechanisms:

1. **HTTP Digest Authentication** — provide a programmatic API public key and private key as username/password.
2. **OAuth 2.0 Service Accounts** — use service account credentials to obtain a bearer token.

All requests must include the `Accept` header with a versioned media type:
```
Accept: application/vnd.atlas.2025-03-12+json
```

## Pagination

List endpoints use cursor-based pagination with `pageNum`, `itemsPerPage`, and `includeCount` query parameters. Responses include a `links` array with `rel: next` / `rel: previous` for navigation.

## Rate Limiting

The Atlas Admin API enforces rate limits of **100 requests per minute per project**. Exceeding this returns HTTP `429 Too Many Requests`. Implement exponential backoff for retries.

---

## Domains

### Cluster & Deployment Management

**5 tag(s), 39 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Clusters | 20 | `listClusterDetails`, `listGroupClusters`, `listGroupClusterProviderRegions`, `getGroupCluster`, ... |
| Flex Clusters | 6 | `listGroupFlexClusters`, `getGroupFlexCluster`, `createGroupFlexCluster`, `tenantGroupFlexClusterUpgrade`, ... |
| Serverless Instances | 5 | `listGroupServerlessInstances`, `getGroupServerlessInstance`, `createGroupServerlessInstance`, `updateGroupServerlessInstance`, ... |
| Cluster Outage Simulation | 3 | `getGroupClusterOutageSimulation`, `startGroupClusterOutageSimulation`, `endGroupClusterOutageSimulation` |
| Global Clusters | 5 | `getGroupClusterGlobalWrites`, `createGroupClusterGlobalWriteCustomZoneMapping`, `createGroupClusterGlobalWriteManagedNamespace`, `deleteGroupClusterGlobalWriteCustomZoneMapping`, ... |

### Organization & Project Administration

**6 tag(s), 106 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Organizations | 15 | `listOrgs`, `getOrg`, `getOrgGroups`, `listOrgInvites`, ... |
| Projects | 23 | `listGroups`, `getGroupByName`, `getGroup`, `listGroupInvites`, ... |
| Teams | 13 | `listGroupTeams`, `getGroupTeam`, `listOrgTeams`, `getOrgTeamByName`, ... |
| Programmatic API Keys | 14 | `listGroupApiKeys`, `listOrgApiKeys`, `getOrgApiKey`, `listOrgApiKeyAccessListEntries`, ... |
| Service Accounts | 22 | `listGroupServiceAccounts`, `getGroupServiceAccount`, `listGroupServiceAccountAccessList`, `listOrgServiceAccounts`, ... |
| MongoDB Cloud Users | 19 | `listGroupUsers`, `getGroupUser`, `listOrgTeamUsers`, `listOrgUsers`, ... |

### Security & Access Control

**11 tag(s), 79 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Database Users | 5 | `listGroupDatabaseUsers`, `getGroupDatabaseUser`, `createGroupDatabaseUser`, `updateGroupDatabaseUser`, ... |
| Custom Database Roles | 5 | `listGroupCustomDbRoleRoles`, `getGroupCustomDbRoleRole`, `createGroupCustomDbRoleRole`, `updateGroupCustomDbRoleRole`, ... |
| Project IP Access List | 5 | `listGroupAccessListEntries`, `getGroupAccessListEntry`, `getGroupAccessListStatus`, `createGroupAccessListEntry`, ... |
| Network Peering | 13 | `listGroupContainers`, `listGroupContainerAll`, `getGroupContainer`, `listGroupPeers`, ... |
| Private Endpoint Services | 9 | `getGroupPrivateEndpointRegionalMode`, `listGroupPrivateEndpointEndpointService`, `getGroupPrivateEndpointEndpointService`, `getGroupPrivateEndpointEndpointServiceEndpoint`, ... |
| Serverless Private Endpoints | 5 | `listGroupPrivateEndpointServerlessInstanceEndpoint`, `getGroupPrivateEndpointServerlessInstanceEndpoint`, `createGroupPrivateEndpointServerlessInstanceEndpoint`, `updateGroupPrivateEndpointServerlessInstanceEndpoint`, ... |
| X.509 Authentication | 3 | `listGroupDatabaseUserCerts`, `createGroupDatabaseUserCert`, `disableGroupUserSecurityCustomerX509` |
| LDAP Configuration | 5 | `getGroupUserSecurity`, `getGroupUserSecurityLdapVerify`, `verifyGroupUserSecurityLdap`, `updateGroupUserSecurity`, ... |
| Federated Authentication | 18 | `listFederationSettingConnectedOrgConfigs`, `getFederationSettingConnectedOrgConfig`, `listFederationSettingConnectedOrgConfigRoleMappings`, `getFederationSettingConnectedOrgConfigRoleMapping`, ... |
| Cloud Provider Access | 5 | `listGroupCloudProviderAccess`, `getGroupCloudProviderAccess`, `createGroupCloudProviderAccess`, `authorizeGroupCloudProviderAccessRole`, ... |
| Encryption at Rest using Customer Key Management | 6 | `getGroupEncryptionAtRest`, `listGroupEncryptionAtRestPrivateEndpoints`, `getGroupEncryptionAtRestPrivateEndpoint`, `createGroupEncryptionAtRestPrivateEndpoint`, ... |

### Monitoring & Alerting

**9 tag(s), 63 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Monitoring and Logs | 14 | `downloadGroupClusterLog`, `listGroupHostFtsMetrics`, `listGroupHostFtsMetricIndexMeasurements`, `getGroupHostFtsMetricIndexMeasurements`, ... |
| Alert Configurations | 8 | `listAlertConfigMatcherFieldNames`, `listGroupAlertConfigs`, `getGroupAlertConfig`, `getGroupAlertAlertConfigs`, ... |
| Alerts | 4 | `getGroupAlertConfigAlerts`, `listGroupAlerts`, `getGroupAlert`, `acknowledgeGroupAlert` |
| Performance Advisor | 11 | `listGroupClusterPerformanceAdvisorDropIndexSuggestions`, `listGroupClusterPerformanceAdvisorSchemaAdvice`, `listGroupClusterPerformanceAdvisorSuggestedIndexes`, `getGroupManagedSlowMs`, ... |
| Events | 5 | `listEventTypes`, `listGroupEvents`, `getGroupEvent`, `listOrgEvents`, ... |
| Collection Level Metrics | 9 | `listGroupClusterCollStatPinnedNamespaces`, `getGroupClusterCollStatNamespaces`, `listGroupClusterCollStatMeasurements`, `listGroupCollStatMetrics`, ... |
| Access Tracking | 2 | `getGroupDbAccessHistoryCluster`, `getGroupDbAccessHistoryProcess` |
| Third-Party Integrations | 5 | `listGroupIntegrations`, `getGroupIntegration`, `createGroupIntegration`, `updateGroupIntegration`, ... |
| Query Shape Insights | 5 | `listGroupClusterQueryShapeInsightSummaries`, `getGroupClusterQueryShapeInsightDetails`, `listGroupClusterQueryShapes`, `getGroupClusterQueryShape`, ... |

### Backup & Disaster Recovery

**6 tag(s), 58 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Cloud Backups | 35 | `listGroupBackupExportBuckets`, `getGroupBackupExportBucket`, `listGroupBackupPrivateEndpoints`, `getGroupBackupPrivateEndpoint`, ... |
| Shared-Tier Snapshots | 3 | `listGroupClusterBackupTenantSnapshots`, `getGroupClusterBackupTenantSnapshot`, `downloadGroupClusterBackupTenant` |
| Shared-Tier Restore Jobs | 3 | `listGroupClusterBackupTenantRestores`, `getGroupClusterBackupTenantRestore`, `createGroupClusterBackupTenantRestore` |
| Flex Snapshots | 3 | `listGroupFlexClusterBackupSnapshots`, `getGroupFlexClusterBackupSnapshot`, `downloadGroupFlexClusterBackup` |
| Flex Restore Jobs | 3 | `listGroupFlexClusterBackupRestoreJobs`, `getGroupFlexClusterBackupRestoreJob`, `createGroupFlexClusterBackupRestoreJob` |
| Legacy Backup | 11 | `listGroupClusterBackupCheckpoints`, `getGroupClusterBackupCheckpoint`, `listGroupClusterRestoreJobs`, `getGroupClusterRestoreJob`, ... |

### Atlas Services & Features

**6 tag(s), 82 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Atlas Search | 18 | `listGroupClusterFtsIndex`, `getGroupClusterFtsIndex`, `getGroupClusterSearchDeployment`, `listGroupClusterSearchIndexes`, ... |
| Data Federation | 14 | `listGroupDataFederation`, `getGroupDataFederation`, `listGroupDataFederationLimits`, `getGroupDataFederationLimit`, ... |
| Data Lake Pipelines | 13 | `listGroupPipelines`, `getGroupPipeline`, `getGroupPipelineAvailableSchedules`, `getGroupPipelineAvailableSnapshots`, ... |
| Online Archive | 6 | `listGroupClusterOnlineArchives`, `downloadGroupClusterOnlineArchiveQueryLogs`, `getGroupClusterOnlineArchive`, `createGroupClusterOnlineArchive`, ... |
| Streams | 30 | `listGroupStreamWorkspaces`, `getGroupStreamAccountDetails`, `listGroupStreamActiveVpcPeeringConnections`, `listGroupStreamPrivateLinkConnections`, ... |
| Rolling Index | 1 | `createGroupClusterIndexRollingIndex` |

### Cost Management & Billing

**1 tag(s), 9 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Invoices | 9 | `getOrgBillingCostExplorerUsage`, `listOrgInvoices`, `listOrgInvoicePending`, `getOrgInvoice`, ... |

### Network & Infrastructure

**4 tag(s), 23 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| AWS Clusters DNS | 2 | `getGroupAwsCustomDns`, `toggleGroupAwsCustomDns` |
| Maintenance Windows | 5 | `getGroupMaintenanceWindow`, `toggleGroupMaintenanceWindowAutoDefer`, `deferGroupMaintenanceWindow`, `updateGroupMaintenanceWindow`, ... |
| Push-Based Log Export | 9 | `listGroupLogIntegrations`, `getGroupLogIntegration`, `getGroupPushBasedLogExport`, `createGroupLogIntegration`, ... |
| Resource Policies | 7 | `getOrgNonCompliantResources`, `listOrgResourcePolicies`, `getOrgResourcePolicy`, `createOrgResourcePolicy`, ... |

### Compliance & Governance

**1 tag(s), 2 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Auditing | 2 | `getGroupAuditLog`, `updateGroupAuditLog` |

### Migration & Integration

**1 tag(s), 8 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Cloud Migration Service | 8 | `getGroupLiveMigrationValidateStatus`, `getGroupLiveMigration`, `listOrgLiveMigrationAvailableProjects`, `createGroupLiveMigration`, ... |

### Platform & Activity

**2 tag(s), 4 operation(s)**

| Tag | Ops | Key Operations |
|-----|----:|----------------|
| Root | 2 | `getSystemStatus`, `listControlPlaneIpAddresses` |
| Activity Feed | 2 | `getGroupActivityFeed`, `getOrgActivityFeed` |

---

## Full Catalog

See [`atlas-api-catalog.yaml`](atlas-api-catalog.yaml) for the complete structured endpoint catalog with all parameters, request body indicators, and response codes.
