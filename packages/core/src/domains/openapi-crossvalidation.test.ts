import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import type { ActionMap } from "./base.js";
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
} from "./index.js";

// ---------------------------------------------------------------------------
// All 41 ActionMap objects with their names
// ---------------------------------------------------------------------------
const ALL_ACTION_MAPS: { name: string; map: ActionMap }[] = [
  { name: "clusterActions", map: clusterActions },
  { name: "flexClusterActions", map: flexClusterActions },
  { name: "serverlessInstanceActions", map: serverlessInstanceActions },
  { name: "globalClusterActions", map: globalClusterActions },
  { name: "clusterOutageActions", map: clusterOutageActions },
  { name: "organizationActions", map: organizationActions },
  { name: "projectActions", map: projectActions },
  { name: "teamActions", map: teamActions },
  { name: "apiKeyActions", map: apiKeyActions },
  { name: "serviceAccountActions", map: serviceAccountActions },
  { name: "cloudUserActions", map: cloudUserActions },
  { name: "databaseUserActions", map: databaseUserActions },
  { name: "customRoleActions", map: customRoleActions },
  { name: "ipAccessListActions", map: ipAccessListActions },
  { name: "networkPeeringActions", map: networkPeeringActions },
  { name: "privateEndpointActions", map: privateEndpointActions },
  { name: "authenticationActions", map: authenticationActions },
  { name: "cloudProviderAccessActions", map: cloudProviderAccessActions },
  { name: "encryptionActions", map: encryptionActions },
  { name: "monitoringActions", map: monitoringActions },
  { name: "alertConfigActions", map: alertConfigActions },
  { name: "alertActions", map: alertActions },
  { name: "performanceAdvisorActions", map: performanceAdvisorActions },
  { name: "eventActions", map: eventActions },
  { name: "collectionMetricActions", map: collectionMetricActions },
  { name: "integrationActions", map: integrationActions },
  { name: "cloudBackupActions", map: cloudBackupActions },
  { name: "sharedTierBackupActions", map: sharedTierBackupActions },
  { name: "legacyBackupActions", map: legacyBackupActions },
  { name: "atlasSearchActions", map: atlasSearchActions },
  { name: "dataFederationActions", map: dataFederationActions },
  { name: "dataLakePipelineActions", map: dataLakePipelineActions },
  { name: "onlineArchiveActions", map: onlineArchiveActions },
  { name: "streamActions", map: streamActions },
  { name: "billingActions", map: billingActions },
  { name: "maintenanceActions", map: maintenanceActions },
  { name: "logExportActions", map: logExportActions },
  { name: "resourcePolicyActions", map: resourcePolicyActions },
  { name: "auditingActions", map: auditingActions },
  { name: "liveMigrationActions", map: liveMigrationActions },
  { name: "platformActions", map: platformActions },
];

// ---------------------------------------------------------------------------
// Load and parse OpenAPI spec
// ---------------------------------------------------------------------------
interface SpecOp {
  method: string;
  path: string;
  has_request_body: boolean;
  operationId: string;
}

function loadSpecOperations(): Map<string, SpecOp> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const specPath = resolve(
    __dirname,
    "../../../../docs/atlas-admin-api-v2-openapi-source.yaml",
  );
  const raw = readFileSync(specPath, "utf-8");
  const spec = parse(raw);
  const ops = new Map<string, SpecOp>();
  const methods = ["get", "post", "put", "patch", "delete"];

  for (const [pathUrl, pathItem] of Object.entries(
    spec.paths as Record<string, Record<string, unknown>>,
  )) {
    for (const method of methods) {
      const op = pathItem[method] as
        | { operationId?: string; requestBody?: unknown }
        | undefined;
      if (!op) continue;
      const key = `${method.toUpperCase()} ${pathUrl}`;
      ops.set(key, {
        method: method.toUpperCase(),
        path: pathUrl,
        has_request_body: !!op.requestBody,
        operationId: op.operationId ?? `${method}_${pathUrl}`,
      });
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Build ActionMap operation set
// ---------------------------------------------------------------------------
interface ActionMapOp {
  method: string;
  path: string;
  hasBody: boolean;
  mapName: string;
  actionName: string;
}

function buildActionMapOps(): Map<string, ActionMapOp> {
  const ops = new Map<string, ActionMapOp>();
  for (const { name: mapName, map } of ALL_ACTION_MAPS) {
    for (const [actionName, spec] of Object.entries(map)) {
      const key = `${spec.method} ${spec.path}`;
      ops.set(key, {
        method: spec.method,
        path: spec.path,
        hasBody: spec.hasBody ?? false,
        mapName,
        actionName,
      });
    }
  }
  return ops;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const specOps = loadSpecOperations();
const actionMapOps = buildActionMapOps();

describe("OpenAPI <-> ActionMap cross-validation", () => {
  it("includes all 41 ActionMap objects in validation", () => {
    expect(ALL_ACTION_MAPS).toHaveLength(41);
  });

  it("loads the OpenAPI spec with 473 operations", () => {
    expect(specOps.size).toBe(473);
  });

  it("ActionMaps contain 473 total actions", () => {
    expect(actionMapOps.size).toBe(473);
  });

  it("every OpenAPI operation is covered by an ActionMap entry", () => {
    const missing: string[] = [];
    for (const key of specOps.keys()) {
      if (!actionMapOps.has(key)) {
        const op = specOps.get(key)!;
        missing.push(`${key} (${op.operationId})`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("every ActionMap entry exists in the OpenAPI spec (no orphans)", () => {
    const orphans: string[] = [];
    for (const key of actionMapOps.keys()) {
      if (!specOps.has(key)) {
        const op = actionMapOps.get(key)!;
        orphans.push(`${key} (${op.mapName}.${op.actionName})`);
      }
    }
    expect(orphans).toEqual([]);
  });

  it("hasBody matches has_request_body for every operation", () => {
    const mismatches: string[] = [];
    for (const [key, actionEntry] of actionMapOps) {
      const specEntry = specOps.get(key);
      if (!specEntry) continue; // caught by coverage test above
      if (specEntry.has_request_body !== actionEntry.hasBody) {
        mismatches.push(
          `${key}: spec=${specEntry.has_request_body}, actionMap=${actionEntry.hasBody} (${actionEntry.mapName}.${actionEntry.actionName})`,
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
});
