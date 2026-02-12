/**
 * MCP prompt definitions.
 *
 * Each prompt produces a structured message that guides an LLM
 * through a multi-step workflow using the available tools.
 */

export interface PromptArgDef {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptDef {
  name: string;
  description: string;
  arguments: PromptArgDef[];
  /** Build the prompt messages from the provided arguments. */
  build: (args: Record<string, string>) => PromptMessage[];
}

export interface PromptMessage {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
}

function userMsg(text: string): PromptMessage {
  return { role: "user", content: { type: "text", text } };
}

// ---------------------------------------------------------------------------
// Prompt 1: cluster_builder
// ---------------------------------------------------------------------------
const clusterBuilder: PromptDef = {
  name: "cluster_builder",
  description:
    "Design a new Atlas cluster with recommended configuration based on workload, provider, region, and budget.",
  arguments: [
    {
      name: "workload_type",
      description:
        "Type of workload: transactional, analytical, mixed, or development",
      required: true,
    },
    {
      name: "cloud_provider",
      description: "Cloud provider: AWS, Azure, or GCP",
      required: true,
    },
    {
      name: "region",
      description: "Target deployment region",
      required: true,
    },
    {
      name: "environment",
      description: "Environment: production, staging, or development",
      required: false,
    },
    {
      name: "budget_monthly_usd",
      description: "Monthly budget constraint in USD",
      required: false,
    },
    {
      name: "high_availability",
      description:
        "HA level: standard, multi-region, or global",
      required: false,
    },
  ],
  build: (args) => {
    const env = args.environment ?? "production";
    const budget = args.budget_monthly_usd
      ? `\nBudget constraint: $${args.budget_monthly_usd}/month.`
      : "";
    const ha = args.high_availability
      ? `\nHigh availability requirement: ${args.high_availability}.`
      : "";

    return [
      userMsg(
        `Design a MongoDB Atlas cluster for the following requirements:

- Workload type: ${args.workload_type}
- Cloud provider: ${args.cloud_provider}
- Region: ${args.region}
- Environment: ${env}${budget}${ha}

Steps:
1. Use the manage_clusters tool with action "list_provider_regions" to verify the region is available.
2. Recommend a cluster tier (instance size), storage configuration, and replication factor.
3. For production workloads, recommend backup schedule and alert configurations.
4. Provide the complete cluster creation payload that can be passed to manage_clusters with action "create".
5. If budget is specified, estimate monthly cost and suggest optimizations if over budget.`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 2: cost_analyzer
// ---------------------------------------------------------------------------
const costAnalyzer: PromptDef = {
  name: "cost_analyzer",
  description:
    "Analyze Atlas spending and provide optimization recommendations.",
  arguments: [
    {
      name: "orgId",
      description: "Atlas organization ID",
      required: true,
    },
    {
      name: "time_period",
      description: "Analysis period: last-30d, last-90d, or last-year",
      required: false,
    },
    {
      name: "breakdown",
      description: "Breakdown type: project, cluster, or service",
      required: false,
    },
  ],
  build: (args) => {
    const period = args.time_period ?? "last-30d";
    const breakdown = args.breakdown ?? "project";

    return [
      userMsg(
        `Analyze Atlas spending for organization ${args.orgId}:

1. Use manage_billing with action "list_invoices" to retrieve recent invoices for the ${period} period.
2. Use manage_billing with action "get_cost_explorer" to get a ${breakdown}-level cost breakdown.
3. Identify the top 3 cost drivers.
4. For each cluster, check if:
   - It is over-provisioned (use get_monitoring_data for CPU/memory metrics).
   - Auto-scaling is configured (use manage_clusters to check).
   - There are unused indexes (use get_performance_advisor).
5. Provide a summary with specific recommendations and estimated savings.`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 3: security_reviewer
// ---------------------------------------------------------------------------
const securityReviewer: PromptDef = {
  name: "security_reviewer",
  description:
    "Review the security posture for an Atlas project or cluster.",
  arguments: [
    {
      name: "groupId",
      description: "Atlas project (group) ID",
      required: true,
    },
    {
      name: "clusterName",
      description: "Specific cluster to review (optional — reviews all if omitted)",
      required: false,
    },
    {
      name: "checks",
      description:
        "Specific checks to run: auth, network, encryption, auditing, or all",
      required: false,
    },
  ],
  build: (args) => {
    const checks = args.checks ?? "all";
    const clusterScope = args.clusterName
      ? ` focusing on cluster "${args.clusterName}"`
      : "";

    return [
      userMsg(
        `Review the security posture for project ${args.groupId}${clusterScope}.

Checks to perform (${checks}):

1. **Authentication**: Use manage_database_users to list users. Check for overly broad roles (atlasAdmin on all DBs). Verify no password-based users without IP restrictions.
2. **Network**: Use manage_ip_access_list to check for 0.0.0.0/0 entries. Use manage_network_peering and manage_private_endpoints to verify private connectivity.
3. **Encryption**: Use manage_encryption to verify encryption at rest is enabled with customer-managed keys.
4. **Auditing**: Use manage_auditing to check if database auditing is configured.
5. **Access Control**: Use manage_custom_roles to review custom roles for least-privilege compliance.

For each finding:
- Classify severity (critical, high, medium, low)
- Provide specific remediation steps using the available tools
- Reference relevant MongoDB security best practices`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 4: performance_optimizer
// ---------------------------------------------------------------------------
const performanceOptimizer: PromptDef = {
  name: "performance_optimizer",
  description:
    "Analyze cluster performance and suggest improvements.",
  arguments: [
    {
      name: "groupId",
      description: "Atlas project (group) ID",
      required: true,
    },
    {
      name: "clusterName",
      description: "Cluster name to analyze",
      required: true,
    },
    {
      name: "issues",
      description:
        "Specific issues: slow-queries, high-cpu, high-connections, or all",
      required: false,
    },
  ],
  build: (args) => {
    const issues = args.issues ?? "all";

    return [
      userMsg(
        `Analyze performance for cluster "${args.clusterName}" in project ${args.groupId}.

Issues to investigate (${issues}):

1. Use get_monitoring_data with action "list_processes" to find the cluster's mongod processes.
2. Use get_monitoring_data with action "get_process_measurements" for CPU, memory, connections, opcounters, and replication lag.
3. Use get_performance_advisor with action "list_slow_queries" to identify slow operations.
4. Use get_performance_advisor with action "list_suggested_indexes" for index recommendations.
5. Use get_performance_advisor with action "list_drop_index_suggestions" for unused indexes.
6. Check the cluster configuration with manage_clusters action "get_process_args" for suboptimal settings.

For each finding:
- Quantify the impact (e.g., "95th percentile query time: 2.3s")
- Provide a specific fix with the exact tool action and parameters
- Estimate the expected improvement`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 5: disaster_recovery_planner
// ---------------------------------------------------------------------------
const disasterRecoveryPlanner: PromptDef = {
  name: "disaster_recovery_planner",
  description:
    "Review backup configuration and plan disaster recovery.",
  arguments: [
    {
      name: "groupId",
      description: "Atlas project (group) ID",
      required: true,
    },
    {
      name: "clusterName",
      description: "Cluster name to plan DR for",
      required: true,
    },
    {
      name: "rto_minutes",
      description: "Recovery Time Objective in minutes",
      required: false,
    },
    {
      name: "rpo_minutes",
      description: "Recovery Point Objective in minutes",
      required: false,
    },
  ],
  build: (args) => {
    const rto = args.rto_minutes ?? "not specified";
    const rpo = args.rpo_minutes ?? "not specified";

    return [
      userMsg(
        `Plan disaster recovery for cluster "${args.clusterName}" in project ${args.groupId}.

RTO target: ${rto} minutes
RPO target: ${rpo} minutes

Steps:
1. Use manage_cloud_backups with action "get_schedule" to review the current backup schedule.
2. Use manage_cloud_backups with action "list_snapshots" to check recent snapshot availability.
3. Use manage_cloud_backups with action "get_compliance_policy" to review compliance settings.
4. Use manage_clusters with action "get" to check the cluster's replication configuration and region distribution.
5. If RTO/RPO targets are specified, evaluate whether the current configuration meets them.
6. Recommend:
   - Backup frequency adjustments
   - Point-in-time restore window changes
   - Cross-region replication if not configured
   - Whether to enable compliance policy for backup retention
   - Steps to test a restore using manage_cloud_backups with action "create_restore_job"
7. Provide a runbook for the recovery procedure.`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 6: data_explorer
// ---------------------------------------------------------------------------
const dataExplorer: PromptDef = {
  name: "data_explorer",
  description:
    "Guided workflow for exploring an unfamiliar MongoDB database. " +
    "Walks through connecting, listing databases and collections, " +
    "inspecting schemas, and sampling data.",
  arguments: [
    {
      name: "connectionString",
      description:
        "MongoDB connection string. If omitted, assumes already connected.",
      required: false,
    },
    {
      name: "database",
      description:
        "Specific database to explore. If omitted, lists all databases first.",
      required: false,
    },
    {
      name: "sampleSize",
      description: "Number of documents to sample per collection (default: 5)",
      required: false,
    },
  ],
  build: (args) => {
    const sampleSize = args.sampleSize ?? "5";
    const connectStep = args.connectionString
      ? `1. Use the **connect** tool with connection string: \`${args.connectionString}\``
      : "1. Verify you are connected (or use the **connect** tool if needed).";
    const dbStep = args.database
      ? `2. Focus on the **${args.database}** database.`
      : "2. Use **list-databases** to see all available databases and their sizes. Pick the most interesting one.";

    return [
      userMsg(
        `Explore this MongoDB instance and help me understand the data:

${connectStep}
${dbStep}
3. Use **list-collections** to see all collections in the target database.
4. For each collection:
   a. Use **collection-schema** with sampleSize=${sampleSize} to understand the document shape.
   b. Use **collection-storage-size** to understand how much data it holds.
   c. Use **collection-indexes** to see what indexes exist.
5. Use **count** to get the document count for each collection.
6. Summarize:
   - Database and collection inventory (name, doc count, storage size)
   - Data model overview (key fields, relationships between collections)
   - Index coverage assessment (are common query patterns covered?)
   - Any notable observations (empty collections, missing indexes, large documents)`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 7: query_optimizer
// ---------------------------------------------------------------------------
const queryOptimizer: PromptDef = {
  name: "query_optimizer",
  description:
    "Analyze a slow query and suggest index optimizations. " +
    "Uses explain plans and existing indexes to recommend improvements.",
  arguments: [
    {
      name: "database",
      description: "Database name where the slow query runs.",
      required: true,
    },
    {
      name: "collection",
      description: "Collection name the query targets.",
      required: true,
    },
    {
      name: "query",
      description:
        'The slow query filter as JSON. Example: { "status": "active", "region": "us-east" }',
      required: true,
    },
    {
      name: "sort",
      description:
        'Sort specification if applicable. Example: { "createdAt": -1 }',
      required: false,
    },
  ],
  build: (args) => {
    const sortStep = args.sort
      ? `\n- Sort: \`${args.sort}\``
      : "";

    return [
      userMsg(
        `Analyze and optimize this query on **${args.database}.${args.collection}**:

- Filter: \`${args.query}\`${sortStep}

Steps:
1. Use **explain** with method "find", the filter above, and verbosity "executionStats" to get the current query plan.
2. Use **collection-indexes** to list existing indexes on the collection.
3. Analyze the explain output:
   - Is it doing a COLLSCAN (full collection scan)?
   - How many documents were examined vs. returned?
   - What is the execution time?
4. If the query is suboptimal, recommend a new index:
   - Specify the exact index keys and order (ESR rule: Equality, Sort, Range).
   - Use **create-index** to create it.
5. Re-run **explain** after creating the index to confirm the improvement.
6. Report:
   - Before: scan type, docs examined, execution time
   - After: scan type, docs examined, execution time
   - Index created: key specification`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 8: migration_planner (Relational Migrator)
// ---------------------------------------------------------------------------
const migrationPlanner: PromptDef = {
  name: "migration_planner",
  description:
    "Plan a relational-to-MongoDB migration using Relational Migrator. " +
    "Analyzes source schema, recommends target MongoDB schema, and creates a migration project.",
  arguments: [
    {
      name: "source_database_type",
      description:
        "Source database type: postgresql, mysql, oracle, sqlserver, db2, or sybase",
      required: true,
    },
    {
      name: "source_connection",
      description:
        "Source JDBC connection name (if already configured in RM) or connection details",
      required: false,
    },
    {
      name: "target_connection",
      description:
        "Target MongoDB connection name (if already configured in RM) or connection string",
      required: false,
    },
    {
      name: "migration_strategy",
      description:
        "Strategy: snapshot (one-time) or cdc (continuous/real-time)",
      required: false,
    },
  ],
  build: (args) => {
    const strategy = args.migration_strategy ?? "snapshot";
    const sourceConn = args.source_connection
      ? `\nSource connection: ${args.source_connection}`
      : "";
    const targetConn = args.target_connection
      ? `\nTarget connection: ${args.target_connection}`
      : "";

    return [
      userMsg(
        `Plan a migration from ${args.source_database_type} to MongoDB using Relational Migrator.
${sourceConn}${targetConn}
Migration strategy: ${strategy}

Steps:
1. Use **get_rm_system_info** with action "get_info" to verify Relational Migrator is running and check supported drivers.
2. Use **manage_rm_connections** with action "list_jdbc" to see existing JDBC connections.
3. Use **manage_rm_connections** with action "list_mongodb" to see existing MongoDB connections.
4. If connections don't exist:
   - Create JDBC connection using manage_rm_connections action "create_jdbc"
   - Create MongoDB connection using manage_rm_connections action "create_mongodb"
5. Test both connections using "test_jdbc" and "test_mongodb" actions.
6. Use **manage_rm_schema** with action "discover_jdbc" to discover the source database schema.
7. Use **manage_rm_projects** with action "create" to create a new migration project.
8. Use **manage_rm_projects** with action "get_recommendations" to get schema mapping recommendations.
9. Use **manage_rm_analysis** with action "get_report" to run pre-migration analysis and identify risks.
10. Summarize the migration plan:
    - Source tables discovered
    - Recommended MongoDB collections
    - Data transformation rules
    - Potential issues from analysis
    - Estimated migration approach (${strategy})`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Prompt 9: schema_designer (Relational Migrator)
// ---------------------------------------------------------------------------
const schemaDesigner: PromptDef = {
  name: "schema_designer",
  description:
    "Design an optimal MongoDB schema from relational tables. " +
    "Recommends embedding vs referencing strategies based on access patterns.",
  arguments: [
    {
      name: "projectId",
      description: "Relational Migrator project ID to use for schema design",
      required: true,
    },
    {
      name: "access_patterns",
      description:
        "Common access patterns, e.g., 'read orders with items', 'update user profile'",
      required: false,
    },
    {
      name: "optimization_goal",
      description:
        "Optimization focus: read-heavy, write-heavy, or balanced",
      required: false,
    },
  ],
  build: (args) => {
    const goal = args.optimization_goal ?? "balanced";
    const patterns = args.access_patterns
      ? `\nAccess patterns to optimize for: ${args.access_patterns}`
      : "";

    return [
      userMsg(
        `Design an optimal MongoDB schema for project ${args.projectId}.
${patterns}
Optimization goal: ${goal}

Steps:
1. Use **manage_rm_projects** with action "get" to retrieve the project details and current schema.
2. Use **manage_rm_schema** with action "get" to get the relational schema information.
3. Use **manage_rm_projects** with action "get_recommendations" for AI-powered schema recommendations.
4. Analyze the relational schema and recommend:
   - Which tables should become embedded subdocuments (1:1 or 1:few relationships)
   - Which tables should remain as separate collections with references (1:many or many:many)
   - Denormalization opportunities for read-heavy access patterns
5. For each recommended collection:
   - Document structure with field types
   - Recommended indexes based on access patterns
   - Estimated document size and growth
6. Consider MongoDB best practices:
   - 16MB document size limit
   - Avoid unbounded arrays
   - Use appropriate field names (short but descriptive)
7. Provide mapping rules that can be applied using manage_rm_projects action "update".
8. Run **manage_rm_analysis** with action "get_report" to validate the schema design.`,
      ),
    ];
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const PROMPT_REGISTRY: PromptDef[] = [
  clusterBuilder,
  costAnalyzer,
  securityReviewer,
  performanceOptimizer,
  disasterRecoveryPlanner,
  dataExplorer,
  queryOptimizer,
  migrationPlanner,
  schemaDesigner,
];
