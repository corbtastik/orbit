import type { ActionMap } from "@orbit/core";
import {
  rmSystemActions,
  rmProjectActions,
  rmConnectionActions,
  rmSchemaActions,
  rmJobActions,
  rmAnalysisActions,
} from "@orbit/core";

/**
 * Defines a single MCP tool backed by a Relational Migrator ActionMap.
 */
export interface RMToolDef {
  name: string;
  description: string;
  actions: ActionMap;
}

/**
 * All 6 Relational Migrator MCP tools and their backing action maps.
 */
export const RM_TOOL_REGISTRY: RMToolDef[] = [
  // System & Health
  {
    name: "get_rm_system_info",
    description:
      "Get Relational Migrator system information — version, health status, supported databases, JDBC drivers, and deployment environment.",
    actions: rmSystemActions,
  },

  // Project Management
  {
    name: "manage_rm_projects",
    description:
      "Manage Relational Migrator projects — list, create, update, delete, export, and import migration projects. " +
      "Get schema recommendations and job readiness status.",
    actions: rmProjectActions,
  },

  // Connection Management
  {
    name: "manage_rm_connections",
    description:
      "Manage database connections — create, update, delete, and test JDBC (Oracle, SQL Server, MySQL, PostgreSQL, DB2, Sybase) " +
      "and MongoDB connections for migrations.",
    actions: rmConnectionActions,
  },

  // Schema Discovery
  {
    name: "manage_rm_schema",
    description:
      "Discover and manage relational database schemas — connect to databases via JDBC to discover tables, columns, and relationships, " +
      "or parse DDL files to create schemas.",
    actions: rmSchemaActions,
  },

  // Migration Jobs
  {
    name: "manage_rm_jobs",
    description:
      "Manage migration jobs — create snapshot or CDC (continuous) jobs, start, stop, pause, resume, retry jobs, " +
      "view logs, and monitor job progress and verification status.",
    actions: rmJobActions,
  },

  // Pre-migration Analysis
  {
    name: "manage_rm_analysis",
    description:
      "Run pre-migration analysis — identify potential data and configuration risks, view analysis reports and rules, " +
      "manage analysis tasks before migrating to MongoDB.",
    actions: rmAnalysisActions,
  },
];
