import type { AtlasClient, RelationalMigratorClient } from "@orbit/core";
import type { ConnectionManager } from "./tools/index.js";

/**
 * Defines an MCP resource backed by an Atlas API call, MongoDB connection,
 * or Relational Migrator API.
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
    conn: ConnectionManager | undefined,
    rmClient: RelationalMigratorClient | undefined,
    vars: Record<string, string>,
  ) => Promise<unknown>;
}

const P = "/api/atlas/v2";

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
    read: (c) => c.get(`${P}/orgs`),
  },
  {
    uri: "atlas://orgs/{orgId}",
    name: "organization",
    description: "Organization details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) => c.get(`${P}/orgs/${enc(v.orgId)}`),
  },
  {
    uri: "atlas://orgs/{orgId}/projects",
    name: "org_projects",
    description: "Projects in one organization",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) => c.get(`${P}/orgs/${enc(v.orgId)}/groups`),
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
    read: (c, _conn, _rm, v) => c.get(`${P}/groups/${enc(v.groupId)}`),
  },
  {
    uri: "atlas://projects/{groupId}/clusters",
    name: "clusters",
    description: "Clusters in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) => c.get(`${P}/groups/${enc(v.groupId)}/clusters`),
  },
  {
    uri: "atlas://projects/{groupId}/clusters/{clusterName}",
    name: "cluster",
    description: "Cluster details",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
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
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/databaseUsers`),
  },
  {
    uri: "atlas://projects/{groupId}/access-list",
    name: "ip_access_list",
    description: "IP access list entries",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/accessList`),
  },
  {
    uri: "atlas://projects/{groupId}/alerts",
    name: "alerts",
    description: "Active alerts in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/alerts`),
  },
  {
    uri: "atlas://projects/{groupId}/alert-configs",
    name: "alert_configs",
    description: "Alert configurations",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/alertConfigs`),
  },
  {
    uri: "atlas://projects/{groupId}/backups/{clusterName}",
    name: "backup_snapshots",
    description: "Backup snapshots for one cluster",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
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
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/events`),
  },
  {
    uri: "atlas://projects/{groupId}/processes",
    name: "processes",
    description: "MongoDB processes in one project",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/processes`),
  },
  {
    uri: "atlas://projects/{groupId}/integrations",
    name: "integrations",
    description: "Third-party integrations",
    mimeType: "application/json",
    isTemplate: true,
    read: (c, _conn, _rm, v) =>
      c.get(`${P}/groups/${enc(v.groupId)}/integrations`),
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
    read: (_c, conn, _rm, v) => {
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
    read: async (_c, conn, _rm, v) => {
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
    read: (_c, conn, _rm, v) => {
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
    read: (_c, conn, _rm, v) => {
      requireConnection(conn);
      return conn!.getDb(v.database).command({ dbStats: 1 });
    },
  },

  // =========================================================================
  // Relational Migrator Resources (6)
  // =========================================================================

  {
    uri: "rm://system",
    name: "rm_system_info",
    description: "Relational Migrator system information (version, health, drivers)",
    mimeType: "application/json",
    isTemplate: false,
    read: (_c, _conn, rm) => {
      requireRM(rm);
      return rm!.getSystemInfo();
    },
  },
  {
    uri: "rm://projects",
    name: "rm_projects",
    description: "List all Relational Migrator migration projects",
    mimeType: "application/json",
    isTemplate: false,
    read: (_c, _conn, rm) => {
      requireRM(rm);
      return rm!.get("/api/v1/projects");
    },
  },
  {
    uri: "rm://projects/{projectId}",
    name: "rm_project",
    description: "Relational Migrator project details",
    mimeType: "application/json",
    isTemplate: true,
    read: (_c, _conn, rm, v) => {
      requireRM(rm);
      return rm!.get(`/api/v1/projects/${enc(v.projectId)}`);
    },
  },
  {
    uri: "rm://projects/{projectId}/jobs",
    name: "rm_project_jobs",
    description: "Migration jobs for a Relational Migrator project",
    mimeType: "application/json",
    isTemplate: true,
    read: (_c, _conn, rm, v) => {
      requireRM(rm);
      return rm!.get(`/api/v1/projects/${enc(v.projectId)}/jobs`);
    },
  },
  {
    uri: "rm://jdbc-connections",
    name: "rm_jdbc_connections",
    description: "List JDBC (relational database) connections in Relational Migrator",
    mimeType: "application/json",
    isTemplate: false,
    read: (_c, _conn, rm) => {
      requireRM(rm);
      return rm!.get("/api/v1/connections/jdbc");
    },
  },
  {
    uri: "rm://mongodb-connections",
    name: "rm_mongodb_connections",
    description: "List MongoDB connections in Relational Migrator",
    mimeType: "application/json",
    isTemplate: false,
    read: (_c, _conn, rm) => {
      requireRM(rm);
      return rm!.get("/api/v1/connections/mongodb");
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
 * Throw a clear error if Relational Migrator client is not available.
 */
function requireRM(rm: RelationalMigratorClient | undefined): void {
  if (!rm) {
    throw new Error(
      "Relational Migrator client is not configured.",
    );
  }
  if (!rm.enabled) {
    throw new Error(
      "Relational Migrator integration is disabled. Set ORBIT_RM_ENABLED=true to enable.",
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
