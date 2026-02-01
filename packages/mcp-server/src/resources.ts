import type { AtlasClient } from "@orbit/core";

/**
 * Defines an MCP resource backed by an Atlas API call.
 */
export interface ResourceDef {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  /** Whether this is a template (has {placeholders}). */
  isTemplate: boolean;
  /** Fetch the resource data. Variables are extracted from the URI. */
  read: (
    client: AtlasClient,
    vars: Record<string, string>,
  ) => Promise<unknown>;
}

const P = "/api/atlas/v2";

/**
 * All 15 MCP resources from the architecture design.
 */
export const RESOURCE_REGISTRY: ResourceDef[] = [
  // Organizations
  {
    uri: "atlas://orgs",
    name: "organizations",
    description: "List all accessible Atlas organizations",
    mimeType: "application/json",
    isTemplate: false,
    read: (c) => c.get(`${P}/orgs`),
  },
  {
    uri: "atlas://orgs/{orgId}",
    name: "organization",
    description: "Organization details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) => c.get(`${P}/orgs/${enc(v.orgId)}`),
  },
  {
    uri: "atlas://orgs/{orgId}/projects",
    name: "org_projects",
    description: "Projects in one organization",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) => c.get(`${P}/orgs/${enc(v.orgId)}/groups`),
  },

  // Projects
  {
    uri: "atlas://projects",
    name: "projects",
    description: "List all accessible Atlas projects",
    mimeType: "application/json",
    isTemplate: false,
    read: (c) => c.get(`${P}/groups`),
  },
  {
    uri: "atlas://projects/{groupId}",
    name: "project",
    description: "Project details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) => c.get(`${P}/groups/${enc(v.groupId)}`),
  },
  {
    uri: "atlas://projects/{groupId}/clusters",
    name: "clusters",
    description: "Clusters in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) => c.get(`${P}/groups/${enc(v.groupId)}/clusters`),
  },
  {
    uri: "atlas://projects/{groupId}/clusters/{clusterName}",
    name: "cluster",
    description: "Cluster details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(
        `${P}/groups/${enc(v.groupId)}/clusters/${enc(v.clusterName)}`,
      ),
  },
  {
    uri: "atlas://projects/{groupId}/users",
    name: "database_users",
    description: "Database users in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/databaseUsers`),
  },
  {
    uri: "atlas://projects/{groupId}/access-list",
    name: "ip_access_list",
    description: "IP access list entries",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/accessList`),
  },
  {
    uri: "atlas://projects/{groupId}/alerts",
    name: "alerts",
    description: "Active alerts in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/alerts`),
  },
  {
    uri: "atlas://projects/{groupId}/alert-configs",
    name: "alert_configs",
    description: "Alert configurations",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/alertConfigs`),
  },
  {
    uri: "atlas://projects/{groupId}/backups/{clusterName}",
    name: "backup_snapshots",
    description: "Backup snapshots for one cluster",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(
        `${P}/groups/${enc(v.groupId)}/clusters/${enc(v.clusterName)}/backup/snapshots`,
      ),
  },
  {
    uri: "atlas://projects/{groupId}/events",
    name: "events",
    description: "Recent project events",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/events`),
  },
  {
    uri: "atlas://projects/{groupId}/processes",
    name: "processes",
    description: "MongoDB processes in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/processes`),
  },
  {
    uri: "atlas://projects/{groupId}/integrations",
    name: "integrations",
    description: "Third-party integrations",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/integrations`),
  },
];

function enc(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Extract template variables from a URI like "atlas://orgs/{orgId}".
 */
export function extractVariables(
  template: string,
  uri: string,
): Record<string, string> | null {
  // Build a regex from the template
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = escaped.replace(/\\{(\w+)\\}/g, "(?<$1>[^/]+)");
  const match = uri.match(new RegExp(`^${pattern}$`));
  return match?.groups ?? null;
}
