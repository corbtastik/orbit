import type { ActionMap } from "@orbit/core";
import {
  clusterActions,
  flexClusterActions,
  serverlessInstanceActions,
  globalClusterActions,
  clusterOutageActions,
  organizationActions,
  projectActions,
  teamActions,
  apiKeyActions,
  serviceAccountActions,
  cloudUserActions,
  databaseUserActions,
  customRoleActions,
  ipAccessListActions,
  networkPeeringActions,
  privateEndpointActions,
  authenticationActions,
  cloudProviderAccessActions,
  encryptionActions,
  monitoringActions,
  alertConfigActions,
  alertActions,
  performanceAdvisorActions,
  eventActions,
  collectionMetricActions,
  integrationActions,
  cloudBackupActions,
  sharedTierBackupActions,
  legacyBackupActions,
  atlasSearchActions,
  dataFederationActions,
  dataLakePipelineActions,
  onlineArchiveActions,
  streamActions,
  billingActions,
  maintenanceActions,
  logExportActions,
  resourcePolicyActions,
  auditingActions,
  liveMigrationActions,
  platformActions,
} from "@orbit/core";

export interface ToolDef {
  name: string;
  description: string;
  actions: ActionMap;
}

export const TOOL_REGISTRY: ToolDef[] = [
  // Domain 1: Cluster & Deployment Management
  {
    name: "manage_clusters",
    description: "Manage dedicated MongoDB Atlas clusters — create, update, scale, delete, test failover, configure auto-scaling, and more.",
    actions: clusterActions,
  },
  {
    name: "manage_flex_clusters",
    description: "Manage Flex clusters (lightweight, low-cost MongoDB deployments).",
    actions: flexClusterActions,
  },
  {
    name: "manage_serverless_instances",
    description: "Manage serverless MongoDB instances.",
    actions: serverlessInstanceActions,
  },
  {
    name: "manage_global_clusters",
    description: "Manage global cluster zone mappings and managed namespaces.",
    actions: globalClusterActions,
  },
  {
    name: "simulate_cluster_outage",
    description: "Simulate and end regional outages for disaster recovery testing.",
    actions: clusterOutageActions,
  },

  // Domain 2: Organization & Project Administration
  {
    name: "manage_organizations",
    description: "Manage Atlas organizations — list, create, update, invite users, configure settings.",
    actions: organizationActions,
  },
  {
    name: "manage_projects",
    description: "Manage Atlas projects (groups) — create, update, configure settings, manage limits and invitations.",
    actions: projectActions,
  },
  {
    name: "manage_teams",
    description: "Manage teams at the organization and project level — create, rename, add/remove users.",
    actions: teamActions,
  },
  {
    name: "manage_api_keys",
    description: "Manage programmatic API keys and their access lists at the organization and project level.",
    actions: apiKeyActions,
  },
  {
    name: "manage_service_accounts",
    description: "Manage service accounts for OAuth 2.0 programmatic access.",
    actions: serviceAccountActions,
  },
  {
    name: "manage_cloud_users",
    description: "Manage MongoDB Cloud user accounts, roles, and team membership.",
    actions: cloudUserActions,
  },

  // Domain 3: Security & Access Control
  {
    name: "manage_database_users",
    description: "Manage database users for Atlas clusters — create, update, delete users with specific roles and authentication.",
    actions: databaseUserActions,
  },
  {
    name: "manage_custom_roles",
    description: "Manage custom database roles with fine-grained privileges.",
    actions: customRoleActions,
  },
  {
    name: "manage_ip_access_list",
    description: "Manage project IP access list entries (IP allowlist for cluster connections).",
    actions: ipAccessListActions,
  },
  {
    name: "manage_network_peering",
    description: "Manage VPC peering connections and network containers across AWS, Azure, and GCP.",
    actions: networkPeeringActions,
  },
  {
    name: "manage_private_endpoints",
    description: "Manage private endpoint services and endpoints (AWS PrivateLink, Azure Private Link, GCP PSC) including serverless.",
    actions: privateEndpointActions,
  },
  {
    name: "manage_authentication",
    description: "Manage X.509 certificates, LDAP configuration, and federated authentication (SAML, OIDC).",
    actions: authenticationActions,
  },
  {
    name: "manage_cloud_provider_access",
    description: "Manage cloud provider access roles (AWS IAM, Azure Service Principal, GCP Service Account).",
    actions: cloudProviderAccessActions,
  },
  {
    name: "manage_encryption",
    description: "Manage encryption at rest using customer key management (AWS KMS, Azure Key Vault, GCP KMS).",
    actions: encryptionActions,
  },

  // Domain 4: Monitoring & Alerting
  {
    name: "get_monitoring_data",
    description: "Retrieve monitoring metrics, process data, disk usage, database measurements, and logs.",
    actions: monitoringActions,
  },
  {
    name: "manage_alert_configs",
    description: "Manage alert configurations — create, update, enable/disable, and delete alert rules.",
    actions: alertConfigActions,
  },
  {
    name: "manage_alerts",
    description: "View and acknowledge active alerts.",
    actions: alertActions,
  },
  {
    name: "get_performance_advisor",
    description: "Retrieve Performance Advisor recommendations, slow query logs, and index suggestions.",
    actions: performanceAdvisorActions,
  },
  {
    name: "get_events",
    description: "Retrieve project and organization events and event types.",
    actions: eventActions,
  },
  {
    name: "manage_collection_metrics",
    description: "Manage collection-level metrics and pinned namespaces for monitoring.",
    actions: collectionMetricActions,
  },
  {
    name: "manage_integrations",
    description: "Manage third-party monitoring integrations (Datadog, PagerDuty, etc.), access tracking, and query shape insights.",
    actions: integrationActions,
  },

  // Domain 5: Backup & Disaster Recovery
  {
    name: "manage_cloud_backups",
    description: "Manage cloud backup snapshots, restore jobs, schedules, compliance policies, and export to cloud storage.",
    actions: cloudBackupActions,
  },
  {
    name: "manage_shared_tier_backups",
    description: "Manage backups for shared-tier (M2/M5) and Flex clusters — snapshots, downloads, and restore jobs.",
    actions: sharedTierBackupActions,
  },
  {
    name: "manage_legacy_backups",
    description: "Manage legacy backup checkpoints, snapshots, and restore jobs.",
    actions: legacyBackupActions,
  },

  // Domain 6: Atlas Services & Features
  {
    name: "manage_atlas_search",
    description: "Manage Atlas Search and Vector Search indexes, search deployments, and search nodes.",
    actions: atlasSearchActions,
  },
  {
    name: "manage_data_federation",
    description: "Manage Data Federation virtual databases, query limits, and private endpoints.",
    actions: dataFederationActions,
  },
  {
    name: "manage_data_lake_pipelines",
    description: "Manage Data Lake pipeline ingestion, scheduled runs, and triggers.",
    actions: dataLakePipelineActions,
  },
  {
    name: "manage_online_archive",
    description: "Manage Online Archive rules for automatic data tiering to cheaper storage.",
    actions: onlineArchiveActions,
  },
  {
    name: "manage_streams",
    description: "Manage Atlas Stream Processing workspaces, connections, processors, and VPC peering.",
    actions: streamActions,
  },

  // Domain 7: Cost Management & Billing
  {
    name: "manage_billing",
    description: "Retrieve invoices, cost explorer data, line items, and SKU information.",
    actions: billingActions,
  },

  // Domain 8: Network & Infrastructure
  {
    name: "manage_maintenance",
    description: "Manage maintenance windows, auto-defer settings, and AWS custom DNS.",
    actions: maintenanceActions,
  },
  {
    name: "manage_log_export",
    description: "Manage push-based log export configurations to cloud storage.",
    actions: logExportActions,
  },
  {
    name: "manage_resource_policies",
    description: "Manage organization-level resource policies and compliance checks.",
    actions: resourcePolicyActions,
  },

  // Domain 9: Compliance & Governance
  {
    name: "manage_auditing",
    description: "View and update project auditing configuration.",
    actions: auditingActions,
  },

  // Domain 10: Migration & Integration
  {
    name: "manage_live_migration",
    description: "Manage live migrations to Atlas — validate, create, monitor, and cut over.",
    actions: liveMigrationActions,
  },

  // Domain 11: Platform & Activity
  {
    name: "get_platform_info",
    description: "Return Atlas system status, control plane IP addresses, and activity feeds.",
    actions: platformActions,
  },
];
