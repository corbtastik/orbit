# OrbitAI — MCP Architecture Design

Phase 1.2 deliverable for the OrbitAI MongoDB Atlas MCP Server.

## Project Structure

OrbitAI is organized as an **npm workspaces monorepo** with a shared core SDK that both the MCP server and HTTP API consume. The CLI and Web UI are separate applications.

```
orbit/
├── packages/
│   ├── core/              # Shared: Atlas API client, auth, domain logic, types
│   │   ├── src/
│   │   │   ├── client/    # Atlas API HTTP client (Digest + OAuth 2.0)
│   │   │   ├── auth/      # Credential management, token refresh
│   │   │   ├── domains/   # Domain operations (clusters, users, backups, etc.)
│   │   │   ├── errors/    # Error types and handling
│   │   │   ├── types/     # TypeScript types for all API schemas
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── mcp-server/        # MCP protocol adapter — exposes core as tools/resources/prompts
│   │   ├── src/
│   │   │   ├── tools/     # Tool definitions (41 tools wrapping core domain ops)
│   │   │   ├── resources/ # MCP resource definitions
│   │   │   ├── prompts/   # MCP prompt templates
│   │   │   ├── server.ts  # MCP server init (stdio + SSE transports)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/               # HTTP API adapter — exposes core as REST endpoints (for Web UI)
│       ├── src/
│       │   ├── routes/    # Express/Fastify route handlers
│       │   ├── middleware/# Auth, rate limiting, CORS
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/
│   ├── cli/               # orbit-ai terminal shell
│   │   ├── src/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/               # Web UI (React)
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                  # Phase 1 artifacts (catalog, architecture, overview)
├── scripts/               # Build/generation scripts (parse-openapi.js, etc.)
├── package.json           # Workspace root (npm workspaces)
└── tsconfig.base.json     # Shared TypeScript config
```

**Key layering rule:** `packages/core` has zero knowledge of MCP, HTTP frameworks, or UI. It exports pure TypeScript functions and types. The MCP server and HTTP API are thin adapters that import from core.

```
apps/cli ──▶ packages/mcp-server ──▶ packages/core ──▶ Atlas Admin API
apps/web ──▶ packages/api ─────────▶ packages/core ──▶ Atlas Admin API
```

## Design Principles

1. **100% API coverage** — every Atlas Admin API v2 operation is reachable through an MCP tool.
2. **Hybrid granularity** — one tool per logical resource (e.g. `manage_clusters`), with an `action` parameter to select the specific operation. This keeps the tool count manageable for LLMs while preserving full coverage.
3. **Consistent interface** — every tool follows the same parameter pattern: required identifiers first (`groupId`, resource name/id), then `action`, then action-specific parameters.
4. **Read-safe by default** — list/get actions require no confirmation. Mutating actions (create, update, delete) are clearly labeled.

## Tool Organization Strategy

**Approach:** One MCP tool per API tag (resource type), with an `action` parameter that maps to specific API operations. Where a tag has very few operations (≤3) and is closely related to another tag, they are merged into a single tool.

This yields **40 tools** covering all **473 operations** across **52 API tags**.

---

## Tool Catalog

### Domain 1: Cluster & Deployment Management (5 tools, 39 operations)

#### `manage_clusters`
Manage dedicated MongoDB Atlas clusters in a project.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupClusters | Return all clusters in one project |
| `list_all` | GET | listClusterDetails | Return all authorized clusters across all projects |
| `get` | GET | getGroupCluster | Return one cluster from one project |
| `get_status` | GET | getGroupClusterStatus | Return status of one cluster |
| `get_process_args` | GET | getGroupClusterProcessArgs | Return advanced configuration options |
| `get_autoscaling_config` | GET | autoGroupClusterScalingConfiguration | Return auto-scaling configuration for one sharded cluster |
| `list_provider_regions` | GET | listGroupClusterProviderRegions | Return all cloud provider regions |
| `get_sample_dataset` | GET | getGroupSampleDatasetLoad | Check status of sample dataset load |
| `create` | POST | createGroupCluster | Create one cluster |
| `upgrade_shared` | POST | upgradeGroupClusterTenantUpgrade | Upgrade one shared-tier cluster |
| `upgrade_to_serverless` | POST | upgradeGroupClusterTenantUpgradeToServerless | Upgrade shared-tier to serverless |
| `test_failover` | POST | restartGroupClusterPrimaries | Test failover for one cluster |
| `grant_mongodb_access` | POST | grantGroupClusterMongoDbEmployeeAccess | Grant MongoDB employee access |
| `revoke_mongodb_access` | POST | revokeGroupClusterMongoDbEmployeeAccess | Revoke MongoDB employee access |
| `pin_fcv` | POST | pinGroupClusterFeatureCompatibilityVersion | Pin feature compatibility version |
| `unpin_fcv` | POST | unpinGroupClusterFeatureCompatibilityVersion | Unpin feature compatibility version |
| `load_sample_data` | POST | requestGroupSampleDatasetLoad | Load sample dataset |
| `update` | PATCH | updateGroupCluster | Modify one cluster |
| `update_process_args` | PATCH | updateGroupClusterProcessArgs | Update advanced configuration options |
| `create_rolling_index` | POST | createGroupClusterIndexRollingIndex | Create one rolling index |
| `delete` | DELETE | deleteGroupCluster | Delete one cluster |

**Required parameters:** `groupId`, `action`
**Conditional parameters:** `clusterName` (required for all actions except `list`, `list_all`, `list_provider_regions`)

#### `manage_flex_clusters`
Manage Flex clusters (lightweight, low-cost deployments).

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupFlexClusters | Return all Flex clusters in one project |
| `get` | GET | getGroupFlexCluster | Return one Flex cluster |
| `create` | POST | createGroupFlexCluster | Create one Flex cluster |
| `upgrade` | POST | tenantGroupFlexClusterUpgrade | Upgrade one Flex cluster |
| `update` | PATCH | updateGroupFlexCluster | Update one Flex cluster |
| `delete` | DELETE | deleteGroupFlexCluster | Delete one Flex cluster |

**Required parameters:** `groupId`, `action`

#### `manage_serverless_instances`
Manage serverless instances.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupServerlessInstances | Return all serverless instances |
| `get` | GET | getGroupServerlessInstance | Return one serverless instance |
| `create` | POST | createGroupServerlessInstance | Create one serverless instance |
| `update` | PATCH | updateGroupServerlessInstance | Update one serverless instance |
| `delete` | DELETE | deleteGroupServerlessInstance | Remove one serverless instance |

**Required parameters:** `groupId`, `action`

#### `manage_global_clusters`
Manage global cluster zone mappings and managed namespaces.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get` | GET | getGroupClusterGlobalWrites | Return global writes config |
| `create_zone_mapping` | POST | createGroupClusterGlobalWriteCustomZoneMapping | Add custom zone mapping |
| `create_managed_namespace` | POST | createGroupClusterGlobalWriteManagedNamespace | Create managed namespace |
| `delete_zone_mapping` | DELETE | deleteGroupClusterGlobalWriteCustomZoneMapping | Remove custom zone mapping |
| `delete_managed_namespaces` | DELETE | deleteGroupClusterGlobalWriteManagedNamespaces | Remove all managed namespaces |

**Required parameters:** `groupId`, `clusterName`, `action`

#### `simulate_cluster_outage`
Simulate and end regional outages for testing.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get` | GET | getGroupClusterOutageSimulation | Return outage simulation details |
| `start` | POST | startGroupClusterOutageSimulation | Start outage simulation |
| `end` | DELETE | endGroupClusterOutageSimulation | End outage simulation |

**Required parameters:** `groupId`, `clusterName`, `action`

---

### Domain 2: Organization & Project Administration (6 tools, 106 operations)

#### `manage_organizations`
Manage Atlas organizations and their settings.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listOrgs | Return all organizations |
| `get` | GET | getOrg | Return one organization |
| `get_projects` | GET | getOrgGroups | Return projects in one organization |
| `get_settings` | GET | getOrgSettings | Return organization settings |
| `list_invites` | GET | listOrgInvites | Return pending invitations |
| `get_invite` | GET | getOrgInvite | Return one invitation |
| `create` | POST | createOrg | Create one organization |
| `invite_user` | POST | createOrgInvite | Invite one user |
| `update` | PATCH | updateOrg | Update one organization |
| `update_settings` | PATCH | updateOrgSettings | Update organization settings |
| `update_invite` | PATCH | updateOrgInviteById | Update one invitation |
| `update_invites` | PATCH | updateOrgInvites | Update invitations |
| `update_user_roles` | PUT | updateOrgUserRoles | Update user roles |
| `delete` | DELETE | deleteOrg | Remove one organization |
| `delete_invite` | DELETE | deleteOrgInvite | Cancel one invitation |

**Required parameters:** `action`
**Conditional parameters:** `orgId` (required for all actions except `list`)

#### `manage_projects`
Manage Atlas projects (groups) and their settings.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroups | Return all projects |
| `get` | GET | getGroup | Return one project |
| `get_by_name` | GET | getGroupByName | Return one project by name |
| `get_ip_addresses` | GET | getGroupIpAddresses | Return IP addresses for one project |
| `get_settings` | GET | getGroupSettings | Return project settings |
| `list_limits` | GET | listGroupLimits | Return all project limits |
| `get_limit` | GET | getGroupLimit | Return one project limit |
| `get_mongodb_versions` | GET | getGroupMongoDbVersions | Return available MongoDB versions |
| `list_invites` | GET | listGroupInvites | Return pending invitations |
| `get_invite` | GET | getGroupInvite | Return one invitation |
| `create` | POST | createGroup | Create one project |
| `add_user` | POST | addGroupAccessUser | Add user to project |
| `invite_user` | POST | createGroupInvite | Invite user to project |
| `migrate` | POST | migrateGroup | Migrate project to different org |
| `update` | PATCH | updateGroup | Update one project |
| `update_settings` | PATCH | updateGroupSettings | Update project settings |
| `set_limit` | PATCH | setGroupLimit | Set one project limit |
| `update_invite` | PATCH | updateGroupInviteById | Update one invitation |
| `update_invites` | PATCH | updateGroupInvites | Update invitations |
| `update_user_roles` | PUT | updateGroupUserRoles | Update user roles |
| `delete` | DELETE | deleteGroup | Remove one project |
| `delete_invite` | DELETE | deleteGroupInvite | Cancel one invitation |
| `delete_limit` | DELETE | deleteGroupLimit | Remove one project limit |

**Required parameters:** `action`

#### `manage_teams`
Manage teams at the organization and project level.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_in_project` | GET | listGroupTeams | Return teams in one project |
| `get_in_project` | GET | getGroupTeam | Return one team in a project |
| `list_in_org` | GET | listOrgTeams | Return teams in one organization |
| `get_in_org` | GET | getOrgTeam | Return one team by ID |
| `get_by_name` | GET | getOrgTeamByName | Return one team by name |
| `add_to_project` | POST | addGroupTeams | Add teams to one project |
| `create` | POST | createOrgTeam | Create one team |
| `add_users` | POST | addOrgTeamUsers | Add users to one team |
| `update_in_project` | PATCH | updateGroupTeam | Update team roles in project |
| `rename` | PATCH | renameOrgTeam | Rename one team |
| `remove_from_project` | DELETE | removeGroupTeam | Remove team from project |
| `delete` | DELETE | deleteOrgTeam | Remove one team |
| `remove_user` | DELETE | removeOrgTeamUserFromTeam | Remove user from team |

**Required parameters:** `action`

#### `manage_api_keys`
Manage programmatic API keys at the organization and project level.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_in_project` | GET | listGroupApiKeys | Return API keys in one project |
| `list_in_org` | GET | listOrgApiKeys | Return API keys in one organization |
| `get` | GET | getOrgApiKey | Return one API key |
| `list_access_list` | GET | listOrgApiKeyAccessListEntries | Return access list for one API key |
| `get_access_list_entry` | GET | getOrgApiKeyAccessListEntry | Return one access list entry |
| `create_in_project` | POST | createGroupApiKey | Create API key in project |
| `assign_to_project` | POST | addGroupApiKey | Assign existing key to project |
| `create_in_org` | POST | createOrgApiKey | Create API key in organization |
| `add_access_list_entry` | POST | createOrgApiKeyAccessListEntry | Add access list entry |
| `update_in_project` | PATCH | updateGroupApiKeyRoles | Update API key roles in project |
| `update_in_org` | PATCH | updateOrgApiKey | Update one API key |
| `remove_from_project` | DELETE | removeGroupApiKey | Remove API key from project |
| `delete` | DELETE | deleteOrgApiKey | Remove one API key |
| `delete_access_list_entry` | DELETE | deleteOrgApiKeyAccessListEntry | Remove access list entry |

**Required parameters:** `action`

#### `manage_service_accounts`
Manage service accounts for programmatic access via OAuth 2.0.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_in_project` | GET | listGroupServiceAccounts | Return service accounts in project |
| `get_in_project` | GET | getGroupServiceAccount | Return one service account in project |
| `list_access_list_in_project` | GET | listGroupServiceAccountAccessList | Return access list |
| `list_in_org` | GET | listOrgServiceAccounts | Return service accounts in org |
| `get_in_org` | GET | getOrgServiceAccount | Return one service account in org |
| `list_access_list_in_org` | GET | listOrgServiceAccountAccessList | Return access list |
| `get_groups` | GET | getOrgServiceAccountGroups | Return groups for service account |
| `create_in_project` | POST | createGroupServiceAccount | Create in project |
| `add_access_list_in_project` | POST | createGroupServiceAccountAccessList | Add access list entry |
| `create_secret_in_project` | POST | createGroupServiceAccountSecret | Create secret |
| `invite_to_project` | POST | inviteGroupServiceAccount | Invite to project |
| `create_in_org` | POST | createOrgServiceAccount | Create in organization |
| `add_access_list_in_org` | POST | createOrgServiceAccountAccessList | Add access list entry |
| `create_secret_in_org` | POST | createOrgServiceAccountSecret | Create secret |
| `update_in_project` | PATCH | updateGroupServiceAccount | Update in project |
| `update_in_org` | PATCH | updateOrgServiceAccount | Update in organization |
| `delete_from_project` | DELETE | deleteGroupServiceAccount | Remove from project |
| `delete_access_list_in_project` | DELETE | deleteGroupServiceAccountAccessListEntry | Remove access list entry |
| `delete_secret_in_project` | DELETE | deleteGroupServiceAccountSecret | Remove secret |
| `delete_from_org` | DELETE | deleteOrgServiceAccount | Remove from organization |
| `delete_access_list_in_org` | DELETE | deleteOrgServiceAccountAccessListEntry | Remove access list entry |
| `delete_secret_in_org` | DELETE | deleteOrgServiceAccountSecret | Remove secret |

**Required parameters:** `action`

#### `manage_cloud_users`
Manage MongoDB Cloud user accounts and roles.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_in_project` | GET | listGroupUsers | Return users in one project |
| `get_in_project` | GET | getGroupUser | Return one user in project |
| `list_in_org` | GET | listOrgUsers | Return users in one organization |
| `get_in_org` | GET | getOrgUser | Return one user in organization |
| `list_in_team` | GET | listOrgTeamUsers | Return users in one team |
| `get_by_name` | GET | getUserByName | Return one user by username |
| `get` | GET | getUser | Return one user by ID |
| `add_to_project` | POST | addGroupUsers | Add users to project |
| `add_project_role` | POST | addGroupUserRole | Add project role to user |
| `remove_project_role` | POST | removeGroupUserRole | Remove project role from user |
| `add_to_team` | POST | addOrgTeamUser | Add user to team |
| `remove_from_team` | POST | removeOrgTeamUser | Remove user from team |
| `create_in_org` | POST | createOrgUser | Create user in organization |
| `add_org_role` | POST | addOrgUserRole | Add organization role |
| `remove_org_role` | POST | removeOrgUserRole | Remove organization role |
| `create` | POST | createUser | Create one user |
| `update_in_org` | PATCH | updateOrgUser | Update one user |
| `remove_from_project` | DELETE | removeGroupUser | Remove user from project |
| `remove_from_org` | DELETE | removeOrgUser | Remove user from organization |

**Required parameters:** `action`

---

### Domain 3: Security & Access Control (8 tools, 79 operations)

#### `manage_database_users`
Manage database users for Atlas clusters.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupDatabaseUsers | Return all database users |
| `get` | GET | getGroupDatabaseUser | Return one database user |
| `create` | POST | createGroupDatabaseUser | Create one database user |
| `update` | PATCH | updateGroupDatabaseUser | Update one database user |
| `delete` | DELETE | deleteGroupDatabaseUser | Remove one database user |

**Required parameters:** `groupId`, `action`

#### `manage_custom_roles`
Manage custom database roles.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupCustomDbRoleRoles | Return all custom roles |
| `get` | GET | getGroupCustomDbRoleRole | Return one custom role |
| `create` | POST | createGroupCustomDbRoleRole | Create one custom role |
| `update` | PATCH | updateGroupCustomDbRoleRole | Update one custom role |
| `delete` | DELETE | deleteGroupCustomDbRoleRole | Remove one custom role |

**Required parameters:** `groupId`, `action`

#### `manage_ip_access_list`
Manage project IP access list entries.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupAccessListEntries | Return all access list entries |
| `get` | GET | getGroupAccessListEntry | Return one entry |
| `get_status` | GET | getGroupAccessListStatus | Return entry status |
| `create` | POST | createGroupAccessListEntry | Add access list entries |
| `delete` | DELETE | deleteGroupAccessListEntry | Remove one entry |

**Required parameters:** `groupId`, `action`

#### `manage_network_peering`
Manage VPC peering connections and network containers.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_containers` | GET | listGroupContainers | Return containers for one provider |
| `list_containers_all` | GET | listGroupContainerAll | Return all containers |
| `get_container` | GET | getGroupContainer | Return one container |
| `list_peers` | GET | listGroupPeers | Return all peering connections |
| `get_peer` | GET | getGroupPeer | Return one peering connection |
| `verify_private_ip_mode` | GET | verifyGroupPrivateIpMode | Verify private IP mode |
| `create_container` | POST | createGroupContainer | Create one container |
| `create_peer` | POST | createGroupPeer | Create one peering connection |
| `update_container` | PATCH | updateGroupContainer | Update one container |
| `update_peer` | PATCH | updateGroupPeer | Update one peering connection |
| `disable_private_ip_mode` | PATCH | disableGroupPrivateIpModePeering | Disable private IP mode |
| `delete_container` | DELETE | deleteGroupContainer | Remove one container |
| `delete_peer` | DELETE | deleteGroupPeer | Remove one peering connection |

**Required parameters:** `groupId`, `action`

#### `manage_private_endpoints`
Manage private endpoint services and endpoints (AWS PrivateLink, Azure Private Link, GCP PSC).

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get_regional_mode` | GET | getGroupPrivateEndpointRegionalMode | Return regional mode setting |
| `list_services` | GET | listGroupPrivateEndpointEndpointService | Return all endpoint services |
| `get_service` | GET | getGroupPrivateEndpointEndpointService | Return one endpoint service |
| `get_endpoint` | GET | getGroupPrivateEndpointEndpointServiceEndpoint | Return one endpoint |
| `create_service` | POST | createGroupPrivateEndpointEndpointService | Create one endpoint service |
| `create_endpoint` | POST | createGroupPrivateEndpointEndpointServiceEndpoint | Create one endpoint |
| `toggle_regional_mode` | PATCH | toggleGroupPrivateEndpointRegionalMode | Toggle regional mode |
| `delete_service` | DELETE | deleteGroupPrivateEndpointEndpointService | Remove one endpoint service |
| `delete_endpoint` | DELETE | deleteGroupPrivateEndpointEndpointServiceEndpoint | Remove one endpoint |
| `list_serverless` | GET | listGroupPrivateEndpointServerlessInstanceEndpoint | Return serverless endpoints |
| `get_serverless` | GET | getGroupPrivateEndpointServerlessInstanceEndpoint | Return one serverless endpoint |
| `create_serverless` | POST | createGroupPrivateEndpointServerlessInstanceEndpoint | Create serverless endpoint |
| `update_serverless` | PATCH | updateGroupPrivateEndpointServerlessInstanceEndpoint | Update serverless endpoint |
| `delete_serverless` | DELETE | deleteGroupPrivateEndpointServerlessInstanceEndpoint | Remove serverless endpoint |

**Required parameters:** `groupId`, `action`

#### `manage_authentication`
Manage X.509 certificates, LDAP configuration, and federated authentication.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_x509_certs` | GET | listGroupDatabaseUserCerts | Return X.509 certificates for user |
| `create_x509_cert` | POST | createGroupDatabaseUserCert | Create X.509 certificate |
| `disable_custom_x509` | DELETE | disableGroupUserSecurityCustomerX509 | Disable customer X.509 |
| `get_ldap` | GET | getGroupUserSecurity | Return LDAP configuration |
| `get_ldap_verify_status` | GET | getGroupUserSecurityLdapVerify | Return LDAP verify status |
| `verify_ldap` | POST | verifyGroupUserSecurityLdap | Verify LDAP configuration |
| `update_ldap` | PATCH | updateGroupUserSecurity | Update LDAP configuration |
| `delete_ldap_mapping` | DELETE | deleteGroupUserSecurityLdapUserToDnMapping | Remove LDAP user mapping |
| `list_federation_orgs` | GET | listFederationSettingConnectedOrgConfigs | Return connected org configs |
| `get_federation_org` | GET | getFederationSettingConnectedOrgConfig | Return one connected org config |
| `list_role_mappings` | GET | listFederationSettingConnectedOrgConfigRoleMappings | Return role mappings |
| `get_role_mapping` | GET | getFederationSettingConnectedOrgConfigRoleMapping | Return one role mapping |
| `list_identity_providers` | GET | listFederationSettingIdentityProviders | Return identity providers |
| `get_identity_provider` | GET | getFederationSettingIdentityProvider | Return one identity provider |
| `get_identity_provider_metadata` | GET | getFederationSettingIdentityProviderMetadata | Return IdP metadata |
| `get_federation_settings` | GET | getOrgFederationSettings | Return org federation settings |
| `create_role_mapping` | POST | createFederationSettingConnectedOrgConfigRoleMapping | Create role mapping |
| `create_identity_provider` | POST | createFederationSettingIdentityProvider | Create identity provider |
| `update_role_mapping` | PUT | updateFederationSettingConnectedOrgConfigRoleMapping | Update role mapping |
| `update_federation_org` | PATCH | updateFederationSettingConnectedOrgConfig | Update connected org config |
| `update_identity_provider` | PATCH | updateFederationSettingIdentityProvider | Update identity provider |
| `delete_federation` | DELETE | deleteFederationSetting | Remove federation setting |
| `remove_federation_org` | DELETE | removeFederationSettingConnectedOrgConfig | Remove connected org |
| `delete_role_mapping` | DELETE | deleteFederationSettingConnectedOrgConfigRoleMapping | Remove role mapping |
| `delete_identity_provider` | DELETE | deleteFederationSettingIdentityProvider | Remove identity provider |
| `revoke_identity_provider_jwks` | DELETE | revokeFederationSettingIdentityProviderJwks | Revoke IdP JWKS |

**Required parameters:** `action`

#### `manage_cloud_provider_access`
Manage cloud provider access roles (AWS IAM, Azure Service Principal, GCP Service Account).

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupCloudProviderAccess | Return all cloud provider access roles |
| `get` | GET | getGroupCloudProviderAccess | Return one role |
| `create` | POST | createGroupCloudProviderAccess | Create one role |
| `authorize` | PATCH | authorizeGroupCloudProviderAccessRole | Authorize one role |
| `deauthorize` | DELETE | deauthorizeGroupCloudProviderAccessRole | Deauthorize one role |

**Required parameters:** `groupId`, `action`

#### `manage_encryption`
Manage encryption at rest using customer key management.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get` | GET | getGroupEncryptionAtRest | Return encryption at rest config |
| `list_private_endpoints` | GET | listGroupEncryptionAtRestPrivateEndpoints | Return private endpoints |
| `get_private_endpoint` | GET | getGroupEncryptionAtRestPrivateEndpoint | Return one private endpoint |
| `create_private_endpoint` | POST | createGroupEncryptionAtRestPrivateEndpoint | Create private endpoint |
| `update` | PATCH | updateGroupEncryptionAtRest | Update encryption config |
| `delete_private_endpoint` | DELETE | requestGroupEncryptionAtRestPrivateEndpointDeletion | Remove private endpoint |

**Required parameters:** `groupId`, `action`

---

### Domain 4: Monitoring & Alerting (7 tools, 63 operations)

#### `get_monitoring_data`
Retrieve monitoring metrics, process data, disk usage, and logs.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `download_logs` | GET | downloadGroupClusterLog | Download cluster logs |
| `list_fts_metrics` | GET | listGroupHostFtsMetrics | Return FTS metrics for one host |
| `list_fts_index_measurements` | GET | listGroupHostFtsMetricIndexMeasurements | Return FTS index measurements |
| `get_fts_index_measurements` | GET | getGroupHostFtsMetricIndexMeasurements | Return one FTS index measurement |
| `list_fts_measurements` | GET | listGroupHostFtsMetricMeasurements | Return FTS measurements |
| `list_processes` | GET | listGroupProcesses | Return all MongoDB processes |
| `get_process` | GET | getGroupProcess | Return one process |
| `list_databases` | GET | listGroupProcessDatabases | Return databases for one process |
| `get_database` | GET | getGroupProcessDatabase | Return one database |
| `get_database_measurements` | GET | getGroupProcessDatabaseMeasurements | Return database measurements |
| `list_disks` | GET | listGroupProcessDisks | Return disks for one process |
| `get_disk` | GET | getGroupProcessDisk | Return one disk partition |
| `get_disk_measurements` | GET | getGroupProcessDiskMeasurements | Return disk measurements |
| `get_process_measurements` | GET | getGroupProcessMeasurements | Return process measurements |

**Required parameters:** `groupId`, `action`

#### `manage_alert_configs`
Manage alert configurations.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_matcher_fields` | GET | listAlertConfigMatcherFieldNames | Return matcher field names |
| `list` | GET | listGroupAlertConfigs | Return all alert configurations |
| `get` | GET | getGroupAlertConfig | Return one alert configuration |
| `get_alerts` | GET | getGroupAlertAlertConfigs | Return alerts for one config |
| `create` | POST | createGroupAlertConfig | Create one alert configuration |
| `update` | PUT | updateGroupAlertConfig | Update one alert configuration |
| `toggle` | PATCH | toggleGroupAlertConfig | Enable or disable one config |
| `delete` | DELETE | deleteGroupAlertConfig | Remove one alert configuration |

**Required parameters:** `action`

#### `manage_alerts`
View and acknowledge alerts.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_for_config` | GET | getGroupAlertConfigAlerts | Return alerts for one config |
| `list` | GET | listGroupAlerts | Return all alerts in project |
| `get` | GET | getGroupAlert | Return one alert |
| `acknowledge` | PATCH | acknowledgeGroupAlert | Acknowledge or unacknowledge one alert |

**Required parameters:** `groupId`, `action`

#### `get_performance_advisor`
Retrieve Performance Advisor recommendations, slow queries, and index suggestions.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_drop_index_suggestions` | GET | listGroupClusterPerformanceAdvisorDropIndexSuggestions | Return drop index suggestions |
| `get_schema_advice` | GET | listGroupClusterPerformanceAdvisorSchemaAdvice | Return schema advice |
| `list_suggested_indexes` | GET | listGroupClusterPerformanceAdvisorSuggestedIndexes | Return suggested indexes |
| `get_managed_slow_ms` | GET | getGroupManagedSlowMs | Return managed slow ms threshold |
| `list_namespaces` | GET | listGroupProcessPerformanceAdvisorNamespaces | Return namespaces |
| `list_slow_queries` | GET | listGroupProcessPerformanceAdvisorSlowQueryLogs | Return slow query logs |
| `list_process_suggested_indexes` | GET | listGroupProcessPerformanceAdvisorSuggestedIndexes | Return suggested indexes for process |
| `get_auto_indexing` | GET | getGroupServerlessPerformanceAdvisorAutoIndexing | Return auto-indexing status |
| `enable_managed_slow_ms` | POST | enableGroupManagedSlowMs | Enable managed slow ms |
| `set_auto_indexing` | POST | setGroupServerlessPerformanceAdvisorAutoIndexing | Set auto-indexing |
| `disable_managed_slow_ms` | DELETE | disableGroupManagedSlowMs | Disable managed slow ms |

**Required parameters:** `groupId`, `action`

#### `get_events`
Retrieve project and organization events.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_types` | GET | listEventTypes | Return all event types |
| `list_in_project` | GET | listGroupEvents | Return events for one project |
| `get_in_project` | GET | getGroupEvent | Return one project event |
| `list_in_org` | GET | listOrgEvents | Return events for one organization |
| `get_in_org` | GET | getOrgEvent | Return one organization event |

**Required parameters:** `action`

#### `manage_collection_metrics`
Manage collection-level metrics and pinned namespaces.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_pinned` | GET | listGroupClusterCollStatPinnedNamespaces | Return pinned namespaces |
| `get_namespaces` | GET | getGroupClusterCollStatNamespaces | Return namespaces |
| `list_measurements` | GET | listGroupClusterCollStatMeasurements | Return measurements |
| `list_metrics` | GET | listGroupCollStatMetrics | Return available metrics |
| `get_process_namespaces` | GET | getGroupProcessCollStatNamespaces | Return process namespaces |
| `list_process_measurements` | GET | listGroupProcessCollStatMeasurements | Return process measurements |
| `pin_namespaces` | PUT | pinGroupClusterCollStatPinnedNamespaces | Pin namespaces |
| `update_pinned` | PATCH | updateGroupClusterCollStatPinnedNamespaces | Update pinned namespaces |
| `unpin_namespaces` | PATCH | unpinGroupClusterCollStatUnpinNamespaces | Unpin namespaces |

**Required parameters:** `groupId`, `action`

#### `manage_integrations`
Manage third-party monitoring integrations and query shape insights. Also includes access tracking.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupIntegrations | Return all integrations |
| `get` | GET | getGroupIntegration | Return one integration |
| `create` | POST | createGroupIntegration | Create one integration |
| `update` | PUT | updateGroupIntegration | Update one integration |
| `delete` | DELETE | deleteGroupIntegration | Remove one integration |
| `get_access_history_cluster` | GET | getGroupDbAccessHistoryCluster | Return access history by cluster |
| `get_access_history_process` | GET | getGroupDbAccessHistoryProcess | Return access history by process |
| `list_query_shape_summaries` | GET | listGroupClusterQueryShapeInsightSummaries | Return query shape summaries |
| `get_query_shape_details` | GET | getGroupClusterQueryShapeInsightDetails | Return query shape details |
| `list_query_shapes` | GET | listGroupClusterQueryShapes | Return query shapes |
| `get_query_shape` | GET | getGroupClusterQueryShape | Return one query shape |
| `update_query_shape` | PATCH | updateGroupClusterQueryShape | Update one query shape |

**Required parameters:** `groupId`, `action`

---

### Domain 5: Backup & Disaster Recovery (3 tools, 58 operations)

#### `manage_cloud_backups`
Manage cloud backup snapshots, restore jobs, schedules, compliance policies, and export.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_export_buckets` | GET | listGroupBackupExportBuckets | Return export buckets |
| `get_export_bucket` | GET | getGroupBackupExportBucket | Return one export bucket |
| `list_private_endpoints` | GET | listGroupBackupPrivateEndpoints | Return private endpoints |
| `get_private_endpoint` | GET | getGroupBackupPrivateEndpoint | Return one private endpoint |
| `get_compliance_policy` | GET | getGroupBackupCompliancePolicy | Return compliance policy |
| `list_exports` | GET | listGroupClusterBackupExports | Return export jobs |
| `get_export` | GET | getGroupClusterBackupExport | Return one export job |
| `list_restore_jobs` | GET | listGroupClusterBackupRestoreJobs | Return restore jobs |
| `get_restore_job` | GET | getGroupClusterBackupRestoreJob | Return one restore job |
| `get_schedule` | GET | getGroupClusterBackupSchedule | Return backup schedule |
| `list_snapshots` | GET | listGroupClusterBackupSnapshots | Return snapshots |
| `get_snapshot` | GET | getGroupClusterBackupSnapshot | Return one snapshot |
| `list_sharded_snapshots` | GET | listGroupClusterBackupSnapshotShardedClusters | Return sharded cluster snapshots |
| `get_sharded_snapshot` | GET | getGroupClusterBackupSnapshotShardedCluster | Return one sharded snapshot |
| `list_serverless_restore_jobs` | GET | listGroupServerlessBackupRestoreJobs | Return serverless restore jobs |
| `get_serverless_restore_job` | GET | getGroupServerlessBackupRestoreJob | Return one serverless restore job |
| `list_serverless_snapshots` | GET | listGroupServerlessBackupSnapshots | Return serverless snapshots |
| `get_serverless_snapshot` | GET | getGroupServerlessBackupSnapshot | Return one serverless snapshot |
| `create_export_bucket` | POST | createGroupBackupExportBucket | Create export bucket |
| `create_private_endpoint` | POST | createGroupBackupPrivateEndpoint | Create private endpoint |
| `create_export` | POST | createGroupClusterBackupExport | Create export job |
| `create_restore_job` | POST | createGroupClusterBackupRestoreJob | Create restore job |
| `take_snapshot` | POST | takeGroupClusterBackupSnapshots | Take on-demand snapshot |
| `create_serverless_restore` | POST | createGroupServerlessBackupRestoreJob | Create serverless restore |
| `update_compliance_policy` | PUT | updateGroupBackupCompliancePolicy | Update compliance policy |
| `update_export_bucket` | PATCH | updateGroupBackupExportBucket | Update export bucket |
| `update_schedule` | PATCH | updateGroupClusterBackupSchedule | Update backup schedule |
| `update_snapshot` | PATCH | updateGroupClusterBackupSnapshot | Update snapshot |
| `delete_export_bucket` | DELETE | deleteGroupBackupExportBucket | Remove export bucket |
| `delete_private_endpoint` | DELETE | deleteGroupBackupPrivateEndpoint | Remove private endpoint |
| `disable_compliance_policy` | DELETE | disableGroupBackupCompliancePolicy | Disable compliance policy |
| `cancel_restore_job` | DELETE | cancelGroupClusterBackupRestoreJob | Cancel restore job |
| `delete_schedule` | DELETE | deleteGroupClusterBackupSchedule | Remove backup schedule |
| `delete_sharded_snapshot` | DELETE | deleteGroupClusterBackupSnapshotShardedCluster | Remove sharded snapshot |
| `delete_snapshot` | DELETE | deleteGroupClusterBackupSnapshot | Remove snapshot |

**Required parameters:** `groupId`, `action`

#### `manage_shared_tier_backups`
Manage backups for shared-tier (M2/M5) and Flex clusters.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_shared_snapshots` | GET | listGroupClusterBackupTenantSnapshots | Return shared-tier snapshots |
| `get_shared_snapshot` | GET | getGroupClusterBackupTenantSnapshot | Return one shared-tier snapshot |
| `download_shared` | POST | downloadGroupClusterBackupTenant | Download shared-tier backup |
| `list_shared_restore_jobs` | GET | listGroupClusterBackupTenantRestores | Return shared-tier restore jobs |
| `get_shared_restore_job` | GET | getGroupClusterBackupTenantRestore | Return one restore job |
| `create_shared_restore` | POST | createGroupClusterBackupTenantRestore | Create shared-tier restore |
| `list_flex_snapshots` | GET | listGroupFlexClusterBackupSnapshots | Return Flex snapshots |
| `get_flex_snapshot` | GET | getGroupFlexClusterBackupSnapshot | Return one Flex snapshot |
| `download_flex` | POST | downloadGroupFlexClusterBackup | Download Flex backup |
| `list_flex_restore_jobs` | GET | listGroupFlexClusterBackupRestoreJobs | Return Flex restore jobs |
| `get_flex_restore_job` | GET | getGroupFlexClusterBackupRestoreJob | Return one Flex restore job |
| `create_flex_restore` | POST | createGroupFlexClusterBackupRestoreJob | Create Flex restore job |

**Required parameters:** `groupId`, `clusterName`, `action`

#### `manage_legacy_backups`
Manage legacy backup checkpoints, snapshots, and restore jobs.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_checkpoints` | GET | listGroupClusterBackupCheckpoints | Return checkpoints |
| `get_checkpoint` | GET | getGroupClusterBackupCheckpoint | Return one checkpoint |
| `list_restore_jobs` | GET | listGroupClusterRestoreJobs | Return restore jobs |
| `get_restore_job` | GET | getGroupClusterRestoreJob | Return one restore job |
| `get_schedule` | GET | getGroupClusterSnapshotSchedule | Return snapshot schedule |
| `list_snapshots` | GET | listGroupClusterSnapshots | Return snapshots |
| `get_snapshot` | GET | getGroupClusterSnapshot | Return one snapshot |
| `create_restore_job` | POST | createGroupClusterRestoreJob | Create restore job |
| `update_schedule` | PATCH | updateGroupClusterSnapshotSchedule | Update snapshot schedule |
| `update_snapshot` | PATCH | updateGroupClusterSnapshot | Update one snapshot |
| `delete_snapshot` | DELETE | deleteGroupClusterSnapshot | Remove one snapshot |

**Required parameters:** `groupId`, `clusterName`, `action`

---

### Domain 6: Atlas Services & Features (5 tools, 82 operations)

#### `manage_atlas_search`
Manage Atlas Search and Vector Search indexes and search nodes.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_indexes_legacy` | GET | listGroupClusterFtsIndex | Return all search indexes (legacy) |
| `get_index_legacy` | GET | getGroupClusterFtsIndex | Return one index (legacy) |
| `get_deployment` | GET | getGroupClusterSearchDeployment | Return search deployment |
| `list_indexes` | GET | listGroupClusterSearchIndexes | Return all search indexes |
| `list_by_type` | GET | listGroupClusterSearchIndex | Return indexes by type |
| `get_by_name` | GET | getGroupClusterSearchIndexByName | Return index by name |
| `get` | GET | getGroupClusterSearchIndex | Return one index by ID |
| `create_legacy` | POST | createGroupClusterFtsIndex | Create index (legacy) |
| `create_deployment` | POST | createGroupClusterSearchDeployment | Create search deployment |
| `create` | POST | createGroupClusterSearchIndex | Create one search index |
| `update_legacy` | PATCH | updateGroupClusterFtsIndex | Update index (legacy) |
| `update_deployment` | PATCH | updateGroupClusterSearchDeployment | Update search deployment |
| `update_by_name` | PATCH | updateGroupClusterSearchIndexByName | Update index by name |
| `update` | PATCH | updateGroupClusterSearchIndex | Update one index |
| `delete_legacy` | DELETE | deleteGroupClusterFtsIndex | Remove index (legacy) |
| `delete_deployment` | DELETE | deleteGroupClusterSearchDeployment | Remove search deployment |
| `delete_by_name` | DELETE | deleteGroupClusterSearchIndexByName | Remove index by name |
| `delete` | DELETE | deleteGroupClusterSearchIndex | Remove one index |

**Required parameters:** `groupId`, `clusterName`, `action`

#### `manage_data_federation`
Manage Data Federation virtual databases and query endpoints.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupDataFederation | Return all federated databases |
| `get` | GET | getGroupDataFederation | Return one federated database |
| `list_limits` | GET | listGroupDataFederationLimits | Return query limits |
| `get_limit` | GET | getGroupDataFederationLimit | Return one limit |
| `download_query_logs` | GET | downloadGroupDataFederationQueryLogs | Download query logs |
| `list_private_endpoints` | GET | listGroupPrivateNetworkSettingEndpointIds | Return private endpoints |
| `get_private_endpoint` | GET | getGroupPrivateNetworkSettingEndpointId | Return one private endpoint |
| `create` | POST | createGroupDataFederation | Create one federated database |
| `create_private_endpoint` | POST | createGroupPrivateNetworkSettingEndpointId | Create private endpoint |
| `update` | PATCH | updateGroupDataFederation | Update federated database |
| `set_limit` | PATCH | setGroupDataFederationLimit | Set one query limit |
| `delete` | DELETE | deleteGroupDataFederation | Remove federated database |
| `delete_limit` | DELETE | deleteGroupDataFederationLimit | Remove one limit |
| `delete_private_endpoint` | DELETE | deleteGroupPrivateNetworkSettingEndpointId | Remove private endpoint |

**Required parameters:** `groupId`, `action`

#### `manage_data_lake_pipelines`
Manage Data Lake pipeline ingestion and scheduled runs.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupPipelines | Return all pipelines |
| `get` | GET | getGroupPipeline | Return one pipeline |
| `get_schedules` | GET | getGroupPipelineAvailableSchedules | Return available schedules |
| `get_snapshots` | GET | getGroupPipelineAvailableSnapshots | Return available snapshots |
| `list_runs` | GET | listGroupPipelineRuns | Return pipeline runs |
| `get_run` | GET | getGroupPipelineRun | Return one run |
| `create` | POST | createGroupPipeline | Create one pipeline |
| `pause` | POST | pauseGroupPipeline | Pause one pipeline |
| `resume` | POST | resumeGroupPipeline | Resume one pipeline |
| `trigger` | POST | triggerGroupPipeline | Trigger one pipeline |
| `update` | PATCH | updateGroupPipeline | Update one pipeline |
| `delete` | DELETE | deleteGroupPipeline | Remove one pipeline |
| `delete_run` | DELETE | deleteGroupPipelineRun | Remove one run |

**Required parameters:** `groupId`, `action`

#### `manage_online_archive`
Manage Online Archive rules for automatic data tiering.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupClusterOnlineArchives | Return all online archives |
| `download_query_logs` | GET | downloadGroupClusterOnlineArchiveQueryLogs | Download query logs |
| `get` | GET | getGroupClusterOnlineArchive | Return one online archive |
| `create` | POST | createGroupClusterOnlineArchive | Create one online archive |
| `update` | PATCH | updateGroupClusterOnlineArchive | Update one online archive |
| `delete` | DELETE | deleteGroupClusterOnlineArchive | Remove one online archive |

**Required parameters:** `groupId`, `clusterName`, `action`

#### `manage_streams`
Manage Atlas Stream Processing workspaces, connections, and processors.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list_workspaces` | GET | listGroupStreamWorkspaces | Return all workspaces |
| `get_account` | GET | getGroupStreamAccountDetails | Return account details |
| `list_active_vpc_peering` | GET | listGroupStreamActiveVpcPeeringConnections | Return active VPC peering |
| `list_privatelink` | GET | listGroupStreamPrivateLinkConnections | Return PrivateLink connections |
| `get_privatelink` | GET | getGroupStreamPrivateLinkConnection | Return one PrivateLink connection |
| `list_vpc_peering` | GET | listGroupStreamVpcPeeringConnections | Return VPC peering connections |
| `get_workspace` | GET | getGroupStreamWorkspace | Return one workspace |
| `download_audit_logs` | GET | downloadGroupStreamAuditLogs | Download audit logs |
| `list_connections` | GET | listGroupStreamConnections | Return connections |
| `get_connection` | GET | getGroupStreamConnection | Return one connection |
| `get_processor` | GET | getGroupStreamProcessor | Return one processor |
| `list_processors` | GET | getGroupStreamProcessors | Return all processors |
| `create_workspace` | POST | createGroupStreamWorkspace | Create one workspace |
| `create_privatelink` | POST | createGroupStreamPrivateLinkConnection | Create PrivateLink connection |
| `accept_vpc_peering` | POST | acceptGroupStreamVpcPeeringConnection | Accept VPC peering |
| `reject_vpc_peering` | POST | rejectGroupStreamVpcPeeringConnection | Reject VPC peering |
| `create_connection` | POST | createGroupStreamConnection | Create one connection |
| `create_processor` | POST | createGroupStreamProcessor | Create one processor |
| `start_processor` | POST | startGroupStreamProcessor | Start one processor |
| `start_processor_with` | POST | startGroupStreamProcessorWith | Start processor with options |
| `stop_processor` | POST | stopGroupStreamProcessor | Stop one processor |
| `sample_connections` | POST | withGroupStreamSampleConnections | Sample connections |
| `update_workspace` | PATCH | updateGroupStreamWorkspace | Update one workspace |
| `update_connection` | PATCH | updateGroupStreamConnection | Update one connection |
| `update_processor` | PATCH | updateGroupStreamProcessor | Update one processor |
| `delete_privatelink` | DELETE | deleteGroupStreamPrivateLinkConnection | Remove PrivateLink connection |
| `delete_vpc_peering` | DELETE | deleteGroupStreamVpcPeeringConnection | Remove VPC peering |
| `delete_workspace` | DELETE | deleteGroupStreamWorkspace | Remove one workspace |
| `delete_connection` | DELETE | deleteGroupStreamConnection | Remove one connection |
| `delete_processor` | DELETE | deleteGroupStreamProcessor | Remove one processor |

**Required parameters:** `groupId`, `action`

---

### Domain 7: Cost Management & Billing (1 tool, 9 operations)

#### `manage_billing`
Retrieve invoices, cost explorer data, and SKU information.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get_cost_explorer` | GET | getOrgBillingCostExplorerUsage | Return cost explorer usage |
| `list_invoices` | GET | listOrgInvoices | Return all invoices |
| `list_pending` | GET | listOrgInvoicePending | Return pending invoices |
| `get_invoice` | GET | getOrgInvoice | Return one invoice |
| `get_invoice_csv` | GET | getOrgInvoiceCsv | Download invoice as CSV |
| `search_line_items` | GET | searchOrgInvoiceLineItems | Search invoice line items |
| `list_skus` | GET | listSkus | Return all SKUs |
| `get_sku` | GET | getSku | Return one SKU |
| `create_cost_explorer_query` | POST | createOrgBillingCostExplorerUsageProcess | Create cost explorer query |

**Required parameters:** `orgId`, `action`

---

### Domain 8: Network & Infrastructure (3 tools, 23 operations)

#### `manage_maintenance`
Manage maintenance windows and AWS custom DNS.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get_window` | GET | getGroupMaintenanceWindow | Return maintenance window |
| `toggle_auto_defer` | POST | toggleGroupMaintenanceWindowAutoDefer | Toggle auto-defer |
| `defer` | POST | deferGroupMaintenanceWindow | Defer maintenance |
| `update_window` | PATCH | updateGroupMaintenanceWindow | Update maintenance window |
| `reset_window` | DELETE | resetGroupMaintenanceWindow | Reset maintenance window |
| `get_custom_dns` | GET | getGroupAwsCustomDns | Return AWS custom DNS |
| `toggle_custom_dns` | PATCH | toggleGroupAwsCustomDns | Toggle AWS custom DNS |

**Required parameters:** `groupId`, `action`

#### `manage_log_export`
Manage push-based log export configurations.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `list` | GET | listGroupLogIntegrations | Return all log integrations |
| `get` | GET | getGroupLogIntegration | Return one log integration |
| `get_legacy` | GET | getGroupPushBasedLogExport | Return push-based export config |
| `create` | POST | createGroupLogIntegration | Create log integration |
| `create_legacy` | POST | createGroupPushBasedLogExport | Create push-based export |
| `update` | PUT | updateGroupLogIntegration | Update log integration |
| `update_legacy` | PATCH | updateGroupPushBasedLogExport | Update push-based export |
| `delete` | DELETE | deleteGroupLogIntegration | Remove log integration |
| `delete_legacy` | DELETE | deleteGroupPushBasedLogExport | Remove push-based export |

**Required parameters:** `groupId`, `action`

#### `manage_resource_policies`
Manage organization-level resource policies and compliance.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get_non_compliant` | GET | getOrgNonCompliantResources | Return non-compliant resources |
| `list` | GET | listOrgResourcePolicies | Return all resource policies |
| `get` | GET | getOrgResourcePolicy | Return one resource policy |
| `create` | POST | createOrgResourcePolicy | Create one policy |
| `validate` | POST | validateOrgResourcePolicies | Validate policies |
| `update` | PATCH | updateOrgResourcePolicy | Update one policy |
| `delete` | DELETE | deleteOrgResourcePolicy | Remove one policy |

**Required parameters:** `orgId`, `action`

---

### Domain 9: Compliance & Governance (1 tool, 2 operations)

#### `manage_auditing`
Manage project auditing configuration.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get` | GET | getGroupAuditLog | Return auditing configuration |
| `update` | PATCH | updateGroupAuditLog | Update auditing configuration |

**Required parameters:** `groupId`, `action`

---

### Domain 10: Migration & Integration (1 tool, 8 operations)

#### `manage_live_migration`
Manage live migrations to Atlas.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get_validation_status` | GET | getGroupLiveMigrationValidateStatus | Return validation status |
| `get` | GET | getGroupLiveMigration | Return one live migration |
| `list_available_projects` | GET | listOrgLiveMigrationAvailableProjects | Return available target projects |
| `create` | POST | createGroupLiveMigration | Create one live migration |
| `validate` | POST | validateGroupLiveMigrations | Validate migration |
| `create_link_token` | POST | createOrgLiveMigrationLinkToken | Create link token |
| `cutover` | PUT | cutoverGroupLiveMigration | Cut over migration |
| `delete_link_tokens` | DELETE | deleteOrgLiveMigrationLinkTokens | Remove link tokens |

**Required parameters:** `action`

---

### Domain 11: Platform & Activity (1 tool, 4 operations)

#### `get_platform_info`
Return system status, control plane IPs, and activity feeds.

| Action | Method | API Operation | Description |
|--------|--------|---------------|-------------|
| `get_status` | GET | getSystemStatus | Return system status |
| `list_control_plane_ips` | GET | listControlPlaneIpAddresses | Return control plane IPs |
| `get_project_activity` | GET | getGroupActivityFeed | Return project activity feed |
| `get_org_activity` | GET | getOrgActivityFeed | Return organization activity feed |

**Required parameters:** `action`

---

## Tool Summary

| # | Tool Name | Domain | Actions | API Operations |
|---|-----------|--------|---------|----------------|
| 1 | `manage_clusters` | Cluster | 21 | 21 |
| 2 | `manage_flex_clusters` | Cluster | 6 | 6 |
| 3 | `manage_serverless_instances` | Cluster | 5 | 5 |
| 4 | `manage_global_clusters` | Cluster | 5 | 5 |
| 5 | `simulate_cluster_outage` | Cluster | 3 | 3 |
| 6 | `manage_organizations` | Org/Project | 15 | 15 |
| 7 | `manage_projects` | Org/Project | 23 | 23 |
| 8 | `manage_teams` | Org/Project | 13 | 13 |
| 9 | `manage_api_keys` | Org/Project | 14 | 14 |
| 10 | `manage_service_accounts` | Org/Project | 22 | 22 |
| 11 | `manage_cloud_users` | Org/Project | 19 | 19 |
| 12 | `manage_database_users` | Security | 5 | 5 |
| 13 | `manage_custom_roles` | Security | 5 | 5 |
| 14 | `manage_ip_access_list` | Security | 5 | 5 |
| 15 | `manage_network_peering` | Security | 13 | 13 |
| 16 | `manage_private_endpoints` | Security | 14 | 14 |
| 17 | `manage_authentication` | Security | 26 | 26 |
| 18 | `manage_cloud_provider_access` | Security | 5 | 5 |
| 19 | `manage_encryption` | Security | 6 | 6 |
| 20 | `get_monitoring_data` | Monitoring | 14 | 14 |
| 21 | `manage_alert_configs` | Monitoring | 8 | 8 |
| 22 | `manage_alerts` | Monitoring | 4 | 4 |
| 23 | `get_performance_advisor` | Monitoring | 11 | 11 |
| 24 | `get_events` | Monitoring | 5 | 5 |
| 25 | `manage_collection_metrics` | Monitoring | 9 | 9 |
| 26 | `manage_integrations` | Monitoring | 12 | 12 |
| 27 | `manage_cloud_backups` | Backup | 35 | 35 |
| 28 | `manage_shared_tier_backups` | Backup | 12 | 12 |
| 29 | `manage_legacy_backups` | Backup | 11 | 11 |
| 30 | `manage_atlas_search` | Services | 18 | 18 |
| 31 | `manage_data_federation` | Services | 14 | 14 |
| 32 | `manage_data_lake_pipelines` | Services | 13 | 13 |
| 33 | `manage_online_archive` | Services | 6 | 6 |
| 34 | `manage_streams` | Services | 30 | 30 |
| 35 | `manage_billing` | Billing | 9 | 9 |
| 36 | `manage_maintenance` | Network | 7 | 7 |
| 37 | `manage_log_export` | Network | 9 | 9 |
| 38 | `manage_resource_policies` | Network | 7 | 7 |
| 39 | `manage_auditing` | Compliance | 2 | 2 |
| 40 | `manage_live_migration` | Migration | 8 | 8 |
| 41 | `get_platform_info` | Platform | 4 | 4 |

**Totals: 41 tools, 474 actions, 473 API operations (100% coverage)**

*Note: `manage_clusters` has 21 actions covering 20 Clusters tag operations + 1 Rolling Index tag operation.*

---

## MCP Resources

Resources provide read-only contextual data that LLMs can request for grounding. They complement tools by providing structured snapshots without requiring action parameters.

| Resource URI | Description | Backed By |
|-------------|-------------|-----------|
| `atlas://orgs` | List all accessible organizations | listOrgs |
| `atlas://orgs/{orgId}` | Organization details | getOrg |
| `atlas://orgs/{orgId}/projects` | Projects in one organization | getOrgGroups |
| `atlas://projects` | List all accessible projects | listGroups |
| `atlas://projects/{groupId}` | Project details | getGroup |
| `atlas://projects/{groupId}/clusters` | Clusters in one project | listGroupClusters |
| `atlas://projects/{groupId}/clusters/{name}` | Cluster details | getGroupCluster |
| `atlas://projects/{groupId}/users` | Database users in one project | listGroupDatabaseUsers |
| `atlas://projects/{groupId}/access-list` | IP access list entries | listGroupAccessListEntries |
| `atlas://projects/{groupId}/alerts` | Active alerts | listGroupAlerts |
| `atlas://projects/{groupId}/alert-configs` | Alert configurations | listGroupAlertConfigs |
| `atlas://projects/{groupId}/backups/{cluster}` | Backup snapshots for one cluster | listGroupClusterBackupSnapshots |
| `atlas://projects/{groupId}/events` | Recent project events | listGroupEvents |
| `atlas://projects/{groupId}/processes` | MongoDB processes | listGroupProcesses |
| `atlas://projects/{groupId}/integrations` | Third-party integrations | listGroupIntegrations |

### Resource Templates

Resources with path parameters use MCP resource templates, allowing LLMs to request specific resources by filling in identifiers discovered from parent resources or tool results.

---

## MCP Prompts

Prompts provide guided multi-step workflows. Each prompt collects arguments and produces a structured message that an LLM can use to orchestrate tool calls.

### `cluster_builder`
Design a new Atlas cluster with recommended configuration.

**Arguments:**
| Name | Required | Description |
|------|----------|-------------|
| `workload_type` | yes | Type of workload (transactional, analytical, mixed, development) |
| `cloud_provider` | yes | AWS, Azure, or GCP |
| `region` | yes | Target region |
| `environment` | no | production, staging, development |
| `budget_monthly_usd` | no | Monthly budget constraint |
| `high_availability` | no | Required HA level (standard, multi-region, global) |

### `cost_analyzer`
Analyze Atlas spending and provide optimization recommendations.

**Arguments:**
| Name | Required | Description |
|------|----------|-------------|
| `orgId` | yes | Organization ID |
| `time_period` | no | Analysis period (last-30d, last-90d, last-year) |
| `breakdown` | no | Breakdown type (project, cluster, service) |

### `security_reviewer`
Review security posture for a project or cluster.

**Arguments:**
| Name | Required | Description |
|------|----------|-------------|
| `groupId` | yes | Project ID |
| `clusterName` | no | Specific cluster to review |
| `checks` | no | Specific checks (auth, network, encryption, auditing, all) |

### `performance_optimizer`
Analyze cluster performance and suggest improvements.

**Arguments:**
| Name | Required | Description |
|------|----------|-------------|
| `groupId` | yes | Project ID |
| `clusterName` | yes | Cluster name |
| `issues` | no | Specific issues (slow-queries, high-cpu, high-connections, all) |

### `disaster_recovery_planner`
Review backup configuration and plan disaster recovery.

**Arguments:**
| Name | Required | Description |
|------|----------|-------------|
| `groupId` | yes | Project ID |
| `clusterName` | yes | Cluster name |
| `rto_minutes` | no | Recovery time objective in minutes |
| `rpo_minutes` | no | Recovery point objective in minutes |

---

## Authentication Flow

```
Client Request
    │
    ▼
┌─────────────────┐
│  MCP Server      │
│  (OrbitAI)       │
│                  │
│  ┌────────────┐  │     ┌──────────────────┐
│  │ Auth       │──┼────▶│ Atlas Admin API   │
│  │ Manager    │  │     │ cloud.mongodb.com │
│  └────────────┘  │     └──────────────────┘
│                  │
│  Auth methods:   │
│  1. API Key Pair │  ──▶  HTTP Digest Auth
│  2. OAuth 2.0    │  ──▶  Bearer Token
└─────────────────┘
```

**Configuration precedence:**
1. Environment variables (`ATLAS_PUBLIC_KEY`, `ATLAS_PRIVATE_KEY`, `ATLAS_ORG_ID`, `ATLAS_PROJECT_ID`)
2. MCP server configuration (passed via `init`)
3. Configuration file (`~/.orbitai/config.yaml`)

**All requests include:**
- `Accept: application/vnd.atlas.2025-03-12+json` (versioned media type)
- `Content-Type: application/vnd.atlas.2025-03-12+json` (for request bodies)
- `User-Agent: OrbitAI/1.0`

---

## Error Handling

Every tool returns a consistent error structure:

```json
{
  "error": {
    "code": "CLUSTER_NOT_FOUND",
    "message": "Cluster 'prod-cluster' not found in project '507f1f77bcf86cd799439011'",
    "atlas_error_code": 404,
    "detail": "CLUSTER_NOT_FOUND",
    "suggestion": "Use manage_clusters with action 'list' to see available clusters"
  }
}
```

**Error categories:**
| HTTP Status | Error Code | Handling |
|-------------|-----------|----------|
| 400 | `INVALID_REQUEST` | Return validation error with field details |
| 401 | `UNAUTHORIZED` | Prompt user to check API credentials |
| 403 | `FORBIDDEN` | Indicate required role/permission |
| 404 | `NOT_FOUND` | Suggest discovery action (list) |
| 409 | `CONFLICT` | Describe conflicting state |
| 429 | `RATE_LIMITED` | Auto-retry with exponential backoff |
| 500 | `SERVER_ERROR` | Return Atlas error detail, suggest retry |

---

## Rate Limiting Strategy

- **Atlas limit:** 100 requests/minute/project
- **Client-side throttle:** Token bucket at 80 req/min (80% of limit) with burst of 10
- **Retry policy:** Exponential backoff starting at 1s, max 3 retries, max wait 30s
- **429 handling:** Respect `Retry-After` header when present
- **Visibility:** Rate limit status available via `get_platform_info` action `get_status`
