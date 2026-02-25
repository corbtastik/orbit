import type { AtlasClient } from "@orbit/core";
import type { ConnectionManager } from "./tools/index.js";

/**
 * Defines an MCP resource backed by an Atlas API call or MongoDB connection.
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
    client: AtlasClient | undefined,
    conn: ConnectionManager | undefined,
    vars: Record<string, string>,
  ) => Promise<unknown>;
}

const P = "/api/atlas/v2";

/**
 * Helper to require a defined Atlas client for resources.
 * Throws if no Atlas profile is configured.
 */
function requireClient(client: AtlasClient | undefined): AtlasClient {
  if (!client) {
    throw new Error("Atlas profile not configured. Configure at least one Atlas profile to access this resource.");
  }
  return client;
}

/**
 * All MCP resources — Atlas API resources and MongoDB database resources.
 *
 * Atlas resources (atlas://) use the AtlasClient for HTTP calls.
 * MongoDB resources (mongodb://) use the ConnectionManager for driver calls.
 */
export const RESOURCE_REGISTRY: ResourceDef[] = [
  // =========================================================================
  // Atlas API Resources (15)
  // =========================================================================

  // Organizations
  {
    uri: "atlas://orgs",
    name: "organizations",
    description: "List all accessible Atlas organizations",
    mimeType: "application/json",
    isTemplate: false,
    read: (c) => requireClient(c).get(`${P}/orgs`),
  },
  {
    uri: "atlas://orgs/{orgId}",
    name: "organization",
    description: "Organization details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) => requireClient(c).get(`${P}/orgs/${enc(v.orgId)}`),
  },
  {
    uri: "atlas://orgs/{orgId}/projects",
    name: "org_projects",
    description: "Projects in one organization",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) => requireClient(c).get(`${P}/orgs/${enc(v.orgId)}/groups`),
  },

  // Projects
  {
    uri: "atlas://projects",
    name: "projects",
    description: "List all accessible Atlas projects",
    mimeType: "application/json",
    isTemplate: false,
    read: (c) => requireClient(c).get(`${P}/groups`),
  },
  {
    uri: "atlas://projects/{groupId}",
    name: "project",
    description: "Project details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) => requireClient(c).get(`${P}/groups/${enc(v.groupId)}`),
  },
  {
    uri: "atlas://projects/{groupId}/clusters",
    name: "clusters",
    description: "Clusters in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) => requireClient(c).get(`${P}/groups/${enc(v.groupId)}/clusters`),
  },
  {
    uri: "atlas://projects/{groupId}/clusters/{clusterName}",
    name: "cluster",
    description: "Cluster details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(
        `${P}/groups/${enc(v.groupId)}/clusters/${enc(v.clusterName)}`,
      ),
  },
  {
    uri: "atlas://projects/{groupId}/users",
    name: "database_users",
    description: "Database users in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/databaseUsers`),
  },
  {
    uri: "atlas://projects/{groupId}/access-list",
    name: "ip_access_list",
    description: "IP access list entries",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/accessList`),
  },
  {
    uri: "atlas://projects/{groupId}/alerts",
    name: "alerts",
    description: "Active alerts in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/alerts`),
  },
  {
    uri: "atlas://projects/{groupId}/alert-configs",
    name: "alert_configs",
    description: "Alert configurations",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/alertConfigs`),
  },
  {
    uri: "atlas://projects/{groupId}/backups/{clusterName}",
    name: "backup_snapshots",
    description: "Backup snapshots for one cluster",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(
        `${P}/groups/${enc(v.groupId)}/clusters/${enc(v.clusterName)}/backup/snapshots`,
      ),
  },
  {
    uri: "atlas://projects/{groupId}/events",
    name: "events",
    description: "Recent project events",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/events`),
  },
  {
    uri: "atlas://projects/{groupId}/processes",
    name: "processes",
    description: "MongoDB processes in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/processes`),
  },
  {
    uri: "atlas://projects/{groupId}/integrations",
    name: "integrations",
    description: "Third-party integrations",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, v) =>
      requireClient(c).get(`${P}/groups/${enc(v.groupId)}/integrations`),
  },

  // =========================================================================
  // MongoDB Database Resources (5)
  // =========================================================================

  {
    uri: "mongodb://databases",
    name: "mongodb_databases",
    description: "List all databases on the connected MongoDB instance",
    mimeType: "application/json",
    isTemplate: false,
    read: (_c, conn) => {
      requireConnection(conn);
      return conn!.getClient().db().admin().listDatabases();
    },
  },
  {
    uri: "mongodb://databases/{database}/collections",
    name: "mongodb_collections",
    description: "List all collections in a MongoDB database",
    mimeType: "application/json",
    isTemplate: true,
    read: (_c, conn, v) => {
      requireConnection(conn);
      return conn!.getDb(v.database).listCollections().toArray();
    },
  },
  {
    uri: "mongodb://databases/{database}/collections/{collection}/schema",
    name: "mongodb_collection_schema",
    description: "Sample documents from a collection to infer schema",
    mimeType: "application/json",
    isTemplate: true,
    read: async (_c, conn, v) => {
      requireConnection(conn);
      const coll = conn!.getCollection(v.database, v.collection);
      return coll.aggregate([{ $sample: { size: 5 } }]).toArray();
    },
  },
  {
    uri: "mongodb://databases/{database}/collections/{collection}/indexes",
    name: "mongodb_collection_indexes",
    description: "List indexes on a MongoDB collection",
    mimeType: "application/json",
    isTemplate: true,
    read: (_c, conn, v) => {
      requireConnection(conn);
      return conn!.getCollection(v.database, v.collection).indexes();
    },
  },
  {
    uri: "mongodb://databases/{database}/stats",
    name: "mongodb_db_stats",
    description: "Database-level statistics (document count, storage size, etc.)",
    mimeType: "application/json",
    isTemplate: true,
    read: (_c, conn, v) => {
      requireConnection(conn);
      return conn!.getDb(v.database).command({ dbStats: 1 });
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enc(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Throw a clear error if no MongoDB connection is active.
 */
function requireConnection(conn: ConnectionManager | undefined): void {
  if (!conn?.isConnected()) {
    throw new Error(
      "Not connected to MongoDB. Use the connect tool first.",
    );
  }
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
