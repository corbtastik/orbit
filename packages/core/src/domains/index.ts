// Dispatch infrastructure
export { dispatch, resolvePath } from "./base.js";
export type { ActionMap, OperationSpec, DomainParams } from "./base.js";

// Domain action maps
export {
  clusterActions,
  flexClusterActions,
  serverlessInstanceActions,
  globalClusterActions,
  clusterOutageActions,
} from "./clusters.js";

export {
  organizationActions,
  projectActions,
  teamActions,
  apiKeyActions,
  serviceAccountActions,
  cloudUserActions,
} from "./organizations.js";

export {
  databaseUserActions,
  customRoleActions,
  ipAccessListActions,
  networkPeeringActions,
  privateEndpointActions,
  authenticationActions,
  cloudProviderAccessActions,
  encryptionActions,
} from "./security.js";

export {
  monitoringActions,
  alertConfigActions,
  alertActions,
  performanceAdvisorActions,
  eventActions,
  collectionMetricActions,
  integrationActions,
} from "./monitoring.js";

export {
  cloudBackupActions,
  sharedTierBackupActions,
  legacyBackupActions,
} from "./backups.js";

export {
  atlasSearchActions,
  dataFederationActions,
  dataLakePipelineActions,
  onlineArchiveActions,
  streamActions,
} from "./services.js";

export { billingActions } from "./billing.js";

export {
  maintenanceActions,
  logExportActions,
  resourcePolicyActions,
} from "./network.js";

export { auditingActions } from "./compliance.js";

export { liveMigrationActions } from "./migration.js";

export { platformActions } from "./platform.js";

// Relational Migrator domain action maps
export {
  rmSystemActions,
  rmProjectActions,
  rmConnectionActions,
  rmSchemaActions,
  rmJobActions,
  rmAnalysisActions,
} from "./relational-migrator/index.js";
