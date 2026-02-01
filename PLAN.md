# OrbitAI - MongoDB Atlas MCP Server Implementation Plan

## Executive Summary

This plan outlines the development of **OrbitAI**, a comprehensive MongoDB Atlas MCP (Model Context Protocol) server that exposes 100% of MongoDB Atlas Admin API and SDK capabilities through natural language interfaces. OrbitAI enables platform teams, DevOps engineers, and administrators to manage their entire MongoDB Atlas infrastructure using conversational AI.

## Project Overview

**Product Name:** OrbitAI

**Tagline:** "Your AI-powered MongoDB Atlas mission control"

**Goal:** Enable users to manage MongoDB Atlas infrastructure, clusters, security, monitoring, and costs using natural language through an AI-powered interface that covers all Atlas platform capabilities.

**Primary Focus:** MongoDB Atlas platform management and administration (NOT database CRUD operations)

**Target Audiences:**
1. MCP clients (Claude Desktop, other MCP-compatible applications)
2. CLI users (DevOps engineers, SREs, platform administrators)
3. Web UI users (engineering managers, technical leads, operations teams)

**Core Technologies:**
- MCP Protocol (TypeScript/Python SDK)
- MongoDB Atlas Admin API v2.0 (REST API)
- MongoDB Atlas SDK (Go) - for reference/validation
- Authentication: Atlas API Keys, OAuth 2.0

**Note on Implementation:** While the official MongoDB Atlas SDK is in Go, OrbitAI will primarily interact with the Atlas Admin API v2.0 REST endpoints directly using HTTP clients (axios/fetch for TypeScript, requests for Python). The Go SDK documentation will serve as a valuable reference for API capabilities and patterns.

---

## Phase 1: Research & Architecture (Week 1-2)

### 1.1 MongoDB Atlas Admin API Audit

**Objective:** Catalog ALL MongoDB Atlas platform management capabilities across the Atlas Admin API.

**Tasks:**
1. **Cluster & Deployment Management**
   - Cluster lifecycle (create, configure, modify, pause, resume, delete)
   - Advanced cluster configuration
   - Multi-region deployments
   - Global clusters
   - Serverless instances
   - Flex clusters
   - Auto-scaling policies
   - Cluster tier management
   - Connection string management
   - Regional outage simulation

2. **Organization & Project Administration**
   - Organization management
   - Project creation and configuration
   - Team management
   - Access control and permissions
   - API key management (organization and project level)
   - API access list configuration
   - Federated authentication setup
   - Atlas users and roles

3. **Security & Access Control**
   - Database user management
   - Custom database roles
   - IP allow lists (access lists)
   - Network peering (AWS, Azure, GCP)
   - Private endpoints (AWS PrivateLink, Azure Private Link, GCP Private Service Connect)
   - Encryption at rest configuration
   - Customer-managed encryption keys (CMEK)
   - LDAP/Active Directory integration
   - X.509 certificate authentication
   - Auditing configuration
   - Cloud provider access roles

4. **Monitoring & Alerting**
   - Real-time metrics and measurements
   - Process monitoring
   - Disk utilization tracking
   - Database and collection metrics
   - Alert configuration and management
   - Event tracking and history
   - Performance Advisor integration
   - Query profiling
   - Index suggestions
   - Slow query analysis
   - Third-party integrations (Datadog, PagerDuty, etc.)

5. **Backup & Disaster Recovery**
   - Cloud backup configuration
   - Snapshot management (on-demand and scheduled)
   - Backup compliance policies
   - Continuous backup settings
   - Point-in-time restore
   - Snapshot retention policies
   - Checkpoint management
   - Restore job monitoring
   - Serverless backup configuration
   - Export backup to cloud storage

6. **Atlas Services & Features**
   - Atlas Search index management
   - Vector Search configuration
   - Atlas Data Lake setup and management
   - Online Archive configuration
   - Data Federation setup
   - Atlas Triggers management
   - Atlas Functions deployment
   - Atlas App Services configuration
   - Atlas Device Sync
   - Data API configuration
   - Atlas Streams (Kafka integration)
   - Charts API integration

7. **Cost Management & Billing**
   - Organization invoices
   - Invoice line items
   - Pending invoices
   - Payment method management
   - Cost analysis and reporting
   - Usage tracking
   - Budget alerts
   - Billing contact management

8. **Network & Infrastructure**
   - VPC peering connections
   - Private endpoints
   - Network containers
   - Custom DNS configuration
   - Maintenance windows
   - Push-based log export
   - Cloud provider snapshots
   - Regional configuration

9. **Compliance & Governance**
   - Backup compliance policies
   - Audit log configuration
   - Data governance settings
   - Encryption policies
   - Access tracking
   - Compliance reporting

10. **Migration & Integration**
    - Live migration from other MongoDB deployments
    - Live import from cloud providers
    - Integration with CI/CD pipelines
    - Terraform provider capabilities
    - CloudFormation integration
    - Programmatic API workflows

11. **Create Comprehensive API Mapping Document**
    - Categorize all Atlas Admin API endpoints
    - Document required parameters for each endpoint
    - Note authentication and authorization requirements
    - Identify rate limits and quotas
    - Reference Go SDK implementation for best practices
    - Document response formats and pagination

**Reference Resources:**
- MongoDB Atlas Admin API v2.0 documentation: https://www.mongodb.com/docs/atlas/reference/api-resources-spec/
- MongoDB Atlas SDK (Go): https://www.mongodb.com/docs/atlas/sdk/
- The Go SDK provides excellent examples of:
  - Proper API usage patterns
  - Error handling approaches
  - Request/response type definitions
  - Pagination and filtering strategies

### 1.2 MCP Architecture Design

**Objective:** Design the MCP server architecture to efficiently expose MongoDB capabilities.

**Key Architectural Decisions:**

1. **Tool Organization Strategy**
   - Option A: Fine-grained tools (one per operation type) - Better for discoverability
   - Option B: Coarse-grained tools (grouped by domain) - Better for context management
   - **Recommendation:** Hybrid approach with ~50-80 tools grouped by logical domains

2. **Tool Categorization**
   ```
   Cluster Management:
   - create_cluster
   - modify_cluster_configuration
   - scale_cluster
   - pause_cluster
   - resume_cluster
   - delete_cluster
   - get_cluster_details
   - list_clusters
   - configure_autoscaling
   - test_failover
   
   Organization & Projects:
   - create_project
   - list_projects
   - get_project_details
   - manage_project_settings
   - list_organizations
   - get_organization_details
   - manage_teams
   
   User & Access Management:
   - create_database_user
   - update_database_user
   - delete_database_user
   - list_database_users
   - create_custom_role
   - manage_ip_allowlist
   - configure_network_peering
   - setup_private_endpoint
   - manage_api_keys
   
   Security & Compliance:
   - configure_encryption_at_rest
   - setup_ldap_authentication
   - manage_x509_certificates
   - configure_auditing
   - get_audit_logs
   - manage_backup_compliance
   
   Monitoring & Performance:
   - get_cluster_metrics
   - get_process_measurements
   - list_slow_queries
   - get_performance_advisor_suggestions
   - create_alert_configuration
   - list_alerts
   - get_cluster_events
   - configure_monitoring_integrations
   
   Backup & Restore:
   - create_snapshot
   - list_snapshots
   - restore_from_snapshot
   - configure_backup_policy
   - get_restore_jobs
   - manage_backup_compliance
   - export_snapshot
   
   Atlas Services:
   - create_search_index
   - manage_search_indexes
   - configure_vector_search
   - setup_data_lake
   - manage_online_archive
   - create_trigger
   - deploy_function
   - configure_app_services
   - setup_data_federation
   
   Billing & Cost Management:
   - get_invoices
   - get_invoice_details
   - list_usage
   - analyze_costs
   - get_spending_by_project
   - configure_budget_alerts
   
   Network & Infrastructure:
   - create_network_peering
   - setup_private_endpoint
   - configure_maintenance_window
   - manage_network_containers
   - setup_custom_dns
   ```

3. **Resource Management**
   - Define resources for: clusters, databases, collections, users, projects
   - Implement resource discovery and enumeration
   - Support resource templates and URIs

4. **Prompt Engineering**
   - System prompts for MongoDB-specific guidance
   - Example queries and use cases
   - Common patterns and best practices
   - Error handling guidance

---

## Phase 2: Core MCP Server Development (Week 3-6)

### 2.1 Development Stack Selection

**Primary Implementation:** TypeScript (recommended for MCP ecosystem)
- Use `@modelcontextprotocol/sdk` npm package for MCP server
- Axios or native fetch for Atlas Admin API REST calls
- No MongoDB driver needed (OrbitAI focuses on platform management, not data operations)

**Alternative:** Python
- Use `mcp` Python package for MCP server
- Requests library for Atlas Admin API REST calls

**Recommendation:** TypeScript for better MCP ecosystem integration and strong typing support for API responses

**About the Atlas SDK:**
- The official MongoDB Atlas SDK is written in Go (https://www.mongodb.com/docs/atlas/sdk/)
- OrbitAI will use the Atlas Admin API v2.0 REST endpoints directly via HTTP/HTTPS
- The Go SDK documentation serves as an excellent reference for:
  - Available API endpoints and capabilities
  - Request/response schemas
  - Best practices and patterns
  - API versioning and compatibility
- If performance-critical operations are needed, a Go microservice could be integrated later

### 2.2 Project Structure

**Monorepo with npm workspaces.** The core Atlas SDK is shared by both the MCP server and the HTTP API. The CLI and Web UI are separate applications.

See `docs/MCP-ARCHITECTURE.md` for the full project structure diagram.

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
│   ├── mcp-server/        # MCP protocol adapter over core
│   │   ├── src/
│   │   │   ├── tools/     # 41 MCP tools wrapping core domain ops
│   │   │   ├── resources/ # MCP resource definitions
│   │   │   ├── prompts/   # MCP prompt templates
│   │   │   ├── server.ts  # MCP server init (stdio + SSE transports)
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── api/               # HTTP API adapter over core (for Web UI)
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
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
├── docs/                  # Architecture docs, API catalog
├── scripts/               # Build/generation scripts
├── package.json           # Workspace root (npm workspaces)
├── tsconfig.base.json     # Shared TypeScript config
└── README.md
```

**Layering rule:** `packages/core` has zero knowledge of MCP, HTTP frameworks, or UI.

```
apps/cli ──▶ packages/mcp-server ──▶ packages/core ──▶ Atlas Admin API
apps/web ──▶ packages/api ─────────▶ packages/core ──▶ Atlas Admin API
```

### 2.3 Authentication & API Client Management

**Atlas API Authentication:**
1. Support multiple authentication methods:
   - Atlas Organization API Keys (for org-level operations)
   - Atlas Project API Keys (for project-scoped operations)
   - Programmatic API Keys
   - OAuth 2.0 (future enhancement)

2. Configuration options:
   ```typescript
   interface OrbitAIConfig {
     atlasPublicKey: string;        // Atlas API public key
     atlasPrivateKey: string;       // Atlas API private key
     atlasOrgId?: string;           // Organization ID (optional)
     atlasProjectId?: string;       // Default project ID (optional)
     atlasGroupId?: string;         // Project group ID (legacy)
     apiBaseUrl?: string;           // API base URL (default: https://cloud.mongodb.com/api/atlas/v2)
     rateLimitRetry?: boolean;      // Retry on rate limit (default: true)
     maxRetries?: number;           // Max retry attempts (default: 3)
     requestTimeout?: number;       // Request timeout in ms (default: 30000)
   }
   ```

3. Secure credential storage:
   - Support environment variables
   - Support configuration files with encryption
   - OS keychain integration
   - MCP settings integration
   - Vault integration for enterprise deployments

### 2.4 Tool Implementation Strategy

**For each Atlas capability:**

1. **Tool Definition**
   ```typescript
   {
     name: "create_cluster",
     description: "Create a new MongoDB Atlas cluster with specified configuration including cloud provider, region, tier, and features",
     inputSchema: {
       type: "object",
       properties: {
         projectId: { 
           type: "string", 
           description: "Atlas project ID where the cluster will be created" 
         },
         name: { 
           type: "string", 
           description: "Name of the cluster (3-64 characters, alphanumeric and hyphens)" 
         },
         providerSettings: {
           type: "object",
           description: "Cloud provider configuration",
           properties: {
             providerName: { 
               type: "string", 
               enum: ["AWS", "AZURE", "GCP"],
               description: "Cloud provider" 
             },
             regionName: { 
               type: "string", 
               description: "Cloud provider region (e.g., US_EAST_1, AZURE_EASTUS, CENTRAL_US)" 
             },
             instanceSizeName: { 
               type: "string", 
               description: "Cluster tier (e.g., M10, M20, M30, M40, M50, M60, M80)" 
             }
           }
         },
         replicationSpecs: {
           type: "array",
           description: "Replication configuration for multi-region clusters"
         },
         autoScaling: {
           type: "object",
           description: "Auto-scaling configuration"
         },
         backupEnabled: {
           type: "boolean",
           description: "Enable continuous backup"
         }
       },
       required: ["projectId", "name", "providerSettings"]
     }
   }
   ```

2. **Implementation Pattern**
   ```typescript
   async function createCluster(args: CreateClusterArgs): Promise<ToolResult> {
     try {
       // Validate inputs
       validateProjectId(args.projectId);
       validateClusterName(args.name);
       validateClusterTier(args.providerSettings.instanceSizeName);
       
       // Get Atlas API client
       const atlasClient = await getAtlasClient();
       
       // Prepare cluster configuration
       const clusterConfig = {
         name: args.name,
         clusterType: "REPLICASET",
         providerSettings: {
           providerName: args.providerSettings.providerName,
           regionName: args.providerSettings.regionName,
           instanceSizeName: args.providerSettings.instanceSizeName,
           diskIOPS: args.providerSettings.diskIOPS,
           encryptEBSVolume: args.providerSettings.encryptEBSVolume ?? true
         },
         autoScaling: args.autoScaling || {
           diskGBEnabled: true,
           compute: {
             enabled: true,
             scaleDownEnabled: true,
             minInstanceSize: args.providerSettings.instanceSizeName,
             maxInstanceSize: getNextTier(args.providerSettings.instanceSizeName)
           }
         },
         backupEnabled: args.backupEnabled ?? true,
         pitEnabled: args.backupEnabled ?? true,
         replicationSpecs: args.replicationSpecs || [{
           numShards: 1,
           regionConfigs: [{
             regionName: args.providerSettings.regionName,
             priority: 7,
             electableNodes: 3,
             readOnlyNodes: 0,
             analyticsNodes: 0
           }]
         }]
       };
       
       // Create cluster via Atlas API
       const response = await atlasClient.post(
         `/groups/${args.projectId}/clusters`,
         clusterConfig
       );
       
       // Format response
       return {
         content: [{
           type: "text",
           text: JSON.stringify({
             message: `Cluster '${args.name}' creation initiated`,
             clusterId: response.data.id,
             stateName: response.data.stateName,
             connectionStrings: response.data.connectionStrings,
             estimatedDeploymentTime: "10-15 minutes",
             details: {
               provider: args.providerSettings.providerName,
               region: args.providerSettings.regionName,
               tier: args.providerSettings.instanceSizeName,
               nodes: 3,
               autoScaling: args.autoScaling ? "enabled" : "disabled",
               backup: args.backupEnabled ? "enabled" : "disabled"
             }
           }, null, 2)
         }]
       };
     } catch (error) {
       return handleAtlasError(error, "create_cluster");
     }
   }
   ```

3. **Error Handling**
   - Catch and format Atlas API errors
   - Provide helpful error messages
   - Include troubleshooting suggestions
   - Log errors for debugging
   - Handle rate limiting gracefully

### 2.5 Resource Implementation

**Resource Types:**

1. **Organizations** (`orbitai://organizations/{orgId}`)
   - List all organizations accessible by the API key
   - Get organization details (name, plan tier, features enabled)
   - List organization users and teams
   - Access organization settings

2. **Projects** (`orbitai://organizations/{orgId}/projects/{projectId}`)
   - List projects in an organization
   - Get project details (name, clusters, teams, settings)
   - Show project quotas and limits
   - List project API keys

3. **Clusters** (`orbitai://projects/{projectId}/clusters/{clusterName}`)
   - List all clusters in a project
   - Get cluster details (size, tier, region, version, status)
   - Show cluster connection strings
   - Display cluster metrics and health status

4. **Database Users** (`orbitai://projects/{projectId}/databaseUsers`)
   - List database users for a project
   - Show user roles and privileges
   - Display authentication mechanisms

5. **Network Access** (`orbitai://projects/{projectId}/accessLists`)
   - List IP allow list entries
   - Show VPC peering connections
   - Display private endpoint configurations

6. **Backups** (`orbitai://clusters/{clusterName}/backups`)
   - List available snapshots
   - Show backup policies
   - Display restore jobs

7. **Alerts** (`orbitai://projects/{projectId}/alerts`)
   - List active alerts
   - Show alert configurations
   - Display alert history

### 2.6 Prompt Templates

**Built-in Prompts:**

1. **Cluster Builder**
   ```
   Help me design a MongoDB Atlas cluster:
   - Workload type: {{workload_type}}
   - Expected traffic: {{traffic_pattern}}
   - Cloud provider preference: {{cloud_provider}}
   - Budget constraints: {{budget}}
   - High availability requirements: {{ha_requirements}}
   ```

2. **Cost Analyzer**
   ```
   Analyze my Atlas spending:
   - Organization: {{org_name}}
   - Time period: {{time_period}}
   - Break down by: {{breakdown_type}} (project/cluster/service)
   - Show recommendations for cost optimization
   ```

3. **Security Advisor**
   ```
   Review security configuration for:
   - Project: {{project_name}}
   - Cluster: {{cluster_name}}
   - Check: authentication, network access, encryption, auditing
   - Provide security hardening recommendations
   ```

4. **Performance Optimizer**
   ```
   Optimize cluster performance:
   - Cluster: {{cluster_name}}
   - Current issues: {{performance_issues}}
   - Review: tier sizing, auto-scaling, index recommendations, slow queries
   ```

5. **Disaster Recovery Planner**
   ```
   Plan disaster recovery for:
   - Cluster: {{cluster_name}}
   - RTO target: {{recovery_time_objective}}
   - RPO target: {{recovery_point_objective}}
   - Show current backup configuration and recommendations
   ```

---

## Phase 3: Comprehensive Feature Coverage (Week 7-10)

### 3.1 Priority 1: Core Cluster Management (Week 7)

Implement all cluster lifecycle and configuration operations:
- [x] Create clusters (dedicated, serverless, flex)
- [x] Modify cluster configuration
- [x] Scale clusters (vertical and horizontal)
- [x] Pause and resume clusters
- [x] Delete clusters
- [x] Configure auto-scaling policies
- [x] Manage multi-region deployments
- [x] Configure global clusters
- [x] Set maintenance windows
- [x] Test cluster failover
- [x] Get cluster connection strings
- [x] Update MongoDB version
- [x] Configure BI Connector

### 3.2 Priority 2: Organization & Project Management (Week 7)

Implement org and project operations:
- [x] Create and manage projects
- [x] List and manage organizations
- [x] Manage teams and team membership
- [x] Configure project settings
- [x] Manage organization settings
- [x] Create and manage API keys (org and project level)
- [x] Configure API access lists
- [x] Manage programmatic access

### 3.3 Priority 3: Security & Access Control (Week 8)

Implement security operations:
- [x] Database user management (create, update, delete, list)
- [x] Custom database roles creation and management
- [x] IP allow list management (add, modify, delete)
- [x] VPC peering configuration (AWS, Azure, GCP)
- [x] Private endpoint setup (AWS PrivateLink, Azure Private Link, GCP PSC)
- [x] Encryption at rest configuration
- [x] Customer-managed encryption keys (CMEK)
- [x] LDAP/Active Directory integration
- [x] X.509 certificate authentication
- [x] Federated authentication configuration
- [x] Auditing setup and configuration
- [x] Cloud provider access role management

### 3.4 Priority 4: Monitoring & Observability (Week 8)

Implement monitoring and alerting features:
- [x] Real-time cluster metrics retrieval
- [x] Process measurements and statistics
- [x] Disk usage monitoring
- [x] Database and collection metrics
- [x] Alert configuration and management
- [x] Event tracking and history
- [x] Performance Advisor integration
- [x] Slow query log retrieval and analysis
- [x] Index usage statistics
- [x] Connection statistics
- [x] Third-party integration configuration (Datadog, PagerDuty, etc.)
- [x] Custom metric alerts

### 3.5 Priority 5: Backup & Disaster Recovery (Week 9)

Implement backup operations:
- [x] Snapshot creation (on-demand)
- [x] Snapshot scheduling and management
- [x] Point-in-time restore
- [x] Continuous backup configuration
- [x] Backup compliance policies
- [x] Cross-region backup copies
- [x] Serverless backup configuration
- [x] Export snapshots to cloud storage
- [x] Restore job monitoring and management
- [x] Checkpoint management
- [x] Queryable backup configuration

### 3.6 Priority 6: Advanced Atlas Services (Week 9)

Implement specialized Atlas capabilities:
- [x] Atlas Search index creation and management
- [x] Vector Search configuration
- [x] Atlas Data Lake setup and management
- [x] Data Federation configuration
- [x] Online Archive setup and management
- [x] Atlas Triggers creation and management
- [x] Atlas Functions deployment
- [x] Atlas App Services configuration
- [x] Atlas Device Sync setup
- [x] Data API endpoint management
- [x] Atlas Streams (Kafka) configuration

### 3.7 Priority 7: Billing & Cost Management (Week 10)

Implement cost management capabilities:
- [x] Invoice retrieval and analysis
- [x] Invoice line item details
- [x] Pending invoice queries
- [x] Usage tracking and reporting
- [x] Cost analysis by project/cluster
- [x] Spending trends over time
- [x] Payment method management
- [x] Budget alert configuration
- [x] Cost optimization recommendations

### 3.8 Priority 8: Network & Infrastructure (Week 10)

Implement network operations:
- [x] Network container management
- [x] VPC peering connection setup
- [x] Private endpoint configuration
- [x] Custom DNS configuration
- [x] Maintenance window scheduling
- [x] Push-based log export configuration
- [x] Cloud provider snapshot management
- [x] Regional configuration
- [x] Network diagnostic tools

---

## Phase 4: CLI Development (Week 11-12)

### 4.1 CLI Architecture

**Tool:** Commander.js or Yargs for TypeScript

**Structure:**
```bash
orbit-ai [command] [options]

Commands:
  # Removed: database query operations - OrbitAI focuses on Atlas platform management
  cluster <action>                 # Cluster operations
  user <action>                    # User management
  monitor <cluster>                # View metrics
  backup <action>                  # Backup operations
  search <action>                  # Atlas Search operations
  chat                            # Interactive chat mode
  
Options:
  --config <path>                 # Config file path
  --profile <name>                # Use named profile
  --output <format>               # json|table|yaml
  --verbose                       # Verbose output
```

### 4.2 CLI Features

1. **Interactive Chat Mode**
   ```bash
   $ orbit-ai chat
   Connected to: MyCluster (M10)
   
   You: Show me all users in the users collection who signed up this month
   AI: Executing query on users collection...
   Found 1,247 users. Would you like to see the first 10?
   
   You: Yes, and show me their email domains
   AI: [Shows results with aggregation]
   ```

2. **Configuration Management**
   ```bash
   $ orbit-ai config init
   $ orbit-ai config set-profile production
   $ orbit-ai config list-profiles
   ```

3. **Output Formatting**
   - JSON for scripting
   - Tables for human readability
   - YAML for configuration
   - CSV for data export

### 4.3 CLI Implementation

```typescript
// cli/index.ts
import { Command } from 'commander';
import { MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const program = new Command();

program
  .name('orbit-ai')
  .description('OrbitAI - MongoDB Atlas AI-powered CLI')
  .version('1.0.0');

program
  .command('query <database> <collection>')
  .description('Query collection using natural language')
  .option('-l, --limit <number>', 'Limit results', '10')
  .action(async (database, collection, options) => {
    const client = await createMCPClient();
      database,
      collection,
      limit: parseInt(options.limit)
    });
    console.log(formatOutput(result, options.output));
  });

program
  .command('chat')
  .description('Start interactive chat session')
  .action(async () => {
    const client = await createMCPClient();
    // Implement REPL loop
    startChatSession(client);
  });

program.parse();
```

---

## Phase 5: Testing & Documentation (Week 13-14)

### 5.1 Testing Strategy

**Unit Tests:**
- Test each tool implementation
- Mock MongoDB client and Atlas API
- Validate input schemas
- Test error handling

**Integration Tests:**
- Test against real MongoDB Atlas test cluster
- Verify tool chains work together
- Test resource enumeration
- Validate prompt templates

**E2E Tests:**
- Test complete workflows (create cluster → add data → query → delete)
- Test CLI commands
- Test MCP client integration

**Test Coverage Goal:** 80%+ code coverage

### 5.2 Documentation

**README.md:**
- Quick start guide
- Installation instructions
- Configuration guide
- Basic examples

**API.md:**
- Complete tool reference
- Resource types
- Authentication methods
- Rate limits and quotas

**EXAMPLES.md:**
- Common use cases with code
- Natural language query examples
- Complex workflow examples
- Best practices

**DEPLOYMENT.md:**
- Deployment options (Docker, npm, binary)
- Production configuration
- Security hardening
- Monitoring and logging

---

## Phase 6: Frontend UI Development (Week 15-18)

### 6.1 UI Architecture

**Technology Stack:**
- Frontend: React + TypeScript
- UI Framework: Shadcn/UI or Material-UI
- State Management: Zustand or Redux Toolkit
- MCP Integration: Custom WebSocket transport or HTTP bridge
- Authentication: OAuth 2.0 + JWT

**Architecture Pattern:**
```
Frontend (React) 
    ↓ WebSocket/HTTP
Backend Adapter (Express/FastAPI)
    ↓ stdio/HTTP
MCP Server
    ↓
MongoDB Atlas
```

### 6.2 UI Features

**Dashboard View:**
- Connected clusters overview
- Real-time metrics graphs
- Recent queries history
- Quick actions panel

**Natural Language Query Interface:**
- Chat-based query builder
- Query suggestions based on schema
- Result visualization (tables, charts)
- Export capabilities (JSON, CSV, Excel)

**Cluster Management:**
- Visual cluster creation wizard
- Configuration editor
- Scaling controls
- Cost estimation

**Data Explorer:**
- Browse databases and collections
- Schema visualization
- Index management
- Sample data preview

**Monitoring:**
- Real-time metrics dashboard
- Alert configuration UI
- Performance insights
- Query profiler

**User Management:**
- User and role management
- Access control visualization
- Audit log viewer

### 6.3 UI Implementation Plan

**Week 15: Core UI Framework**
- Set up React application
- Implement authentication flow
- Create MCP backend adapter
- Build basic layout and navigation

**Week 16: Query Interface**
- Natural language input component
- Query result visualization
- Query history
- Saved queries

**Week 17: Management Features**
- Cluster management UI
- User management UI
- Configuration editors

**Week 18: Polish & Advanced Features**
- Real-time updates (WebSocket)
- Advanced visualizations
- Responsive design
- Accessibility improvements

---

## Phase 7: Deployment & Distribution (Week 19-20)

### 7.1 Package Distribution

**npm Package:**
```bash
npm install -g orbitai
orbitai start
```

**Docker Image:**
```bash
docker run -d -p 3000:3000 \
  -e ATLAS_PUBLIC_KEY="..." \
  -e ATLAS_PRIVATE_KEY="..." \
  -e ATLAS_PROJECT_ID="..." \
  orbitai/server
```

**Standalone Binaries:**
- Windows .exe
- macOS .app / binary
- Linux binary (.tar.gz, .deb, .rpm)

### 7.2 MCP Server Registry

**Publish to MCP Registry:**
- Create server manifest
- Submit to Anthropic's MCP registry
- Provide installation guide
- Maintain version history

### 7.3 Documentation Site

**Deploy documentation:**
- Use Docusaurus or VitePress
- Host on Vercel/Netlify
- Include:
  - Getting started tutorial
  - API reference
  - Video demonstrations
  - Community examples

---

## Technical Considerations

### Security

1. **Credential Management:**
   - Never log credentials
   - Support credential rotation
   - Use secure storage (OS keychain)
   - Implement least-privilege access

2. **Input Validation:**
   - Sanitize all user inputs
   - Validate MongoDB queries for injection
   - Rate limiting on API calls
   - Prevent NoSQL injection

3. **Audit Logging:**
   - Log all operations with timestamps
   - Track user attribution
   - Maintain audit trail
   - Export logs for compliance

### Performance

1. **Connection Pooling:**
   - Maintain persistent connections
   - Configure appropriate pool sizes
   - Implement connection retry logic
   - Monitor connection health

2. **Caching:**
   - Cache cluster metadata
   - Cache schema information
   - Implement TTL-based invalidation
   - Use Redis for distributed caching (optional)

3. **Rate Limiting:**
   - Respect Atlas API rate limits
   - Implement client-side throttling
   - Queue requests during peak usage
   - Provide rate limit visibility

### Scalability

1. **Multi-tenancy:**
   - Support multiple Atlas accounts
   - Isolate resources per user/organization
   - Implement resource quotas
   - Handle concurrent requests

2. **Horizontal Scaling:**
   - Stateless server design
   - Load balancer support
   - Session affinity (if needed)
   - Distributed caching

### Error Handling

1. **Comprehensive Error Messages:**
   - User-friendly error descriptions
   - Actionable troubleshooting steps
   - Link to documentation
   - Include error codes

2. **Retry Logic:**
   - Exponential backoff for transient errors
   - Circuit breaker pattern
   - Idempotent operations where possible

---

## Success Metrics

### Technical Metrics

- **API Coverage:** 100% of MongoDB Atlas API surface area
- **Test Coverage:** >80% code coverage
- **Performance:** <500ms response time for 95% of operations
- **Uptime:** 99.9% availability
- **Error Rate:** <1% of requests

### User Metrics

- **Adoption:** Number of installations/deployments
- **Engagement:** Daily/monthly active users
- **Satisfaction:** User feedback scores
- **Success Rate:** Percentage of successful queries
- **Time Saved:** Reduction in time for common tasks

---

## Risk Management

### Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| MongoDB API changes | High | Version pinning, automated testing, monitoring MongoDB release notes |
| MCP protocol evolution | Medium | Follow MCP SDK updates, maintain backward compatibility |
| Rate limiting issues | Medium | Implement intelligent throttling, provide usage dashboards |
| Authentication complexity | High | Comprehensive documentation, example configurations, support multiple auth methods |
| Performance at scale | High | Load testing, optimization, caching strategies |

### Project Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Scope creep | High | Phased approach, MVP definition, strict prioritization |
| Resource constraints | Medium | Modular architecture, community contributions, open source model |
| Documentation debt | Medium | Documentation-first approach, auto-generated docs where possible |
| User adoption | Medium | Marketing, examples, tutorials, community building |

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| 1. Research & Architecture | 2 weeks | Architecture document, API mapping |
| 2. Core MCP Server | 4 weeks | Working MCP server with basic tools |
| 3. Comprehensive Features | 4 weeks | All MongoDB capabilities implemented |
| 4. CLI Development | 2 weeks | Functional CLI tool |
| 5. Testing & Documentation | 2 weeks | Test suite, complete documentation |
| 6. Frontend UI | 4 weeks | Web-based UI application |
| 7. Deployment | 2 weeks | Published packages, documentation site |
| **Total** | **20 weeks** | Production-ready system |

---

## Next Steps

### Immediate Actions (Week 1)

1. **Set up development environment:**
   - Initialize TypeScript project
   - Install MCP SDK and MongoDB drivers
   - Set up testing framework (Jest/Vitest)
   - Configure linting and formatting

2. **Create MongoDB Atlas test environment:**
   - Provision test cluster
   - Generate API keys
   - Create sample databases and collections
   - Document connection details

3. **Build proof of concept:**
   - Implement 3-5 basic tools (query, insert, list clusters)
   - Test with MCP Inspector
   - Validate approach
   - Gather early feedback

4. **Begin API audit:**
   - Start cataloging MongoDB Atlas API endpoints
   - Document authentication requirements
   - Identify tool groupings
   - Create API coverage tracking spreadsheet

### Success Criteria for POC

- MCP server starts without errors
- Can authenticate to MongoDB Atlas
- Successfully execute basic query operation
- Results properly formatted for MCP client
- Error handling works correctly
- Can connect via MCP Inspector or Claude Desktop

---

## Appendix

### A. MongoDB Atlas Admin API v2 — Verified Endpoint Groups

**Verified against OpenAPI spec (x-xgen-sha: 1f6e58a6e86ac43e73836fcb78191467b0263351)**
**295 paths, 473 operations, 52 tags across 11 domains**

See `docs/atlas-api-catalog.yaml` for the complete structured catalog.

**Atlas Admin API v2 Tags (52 — 100% coverage):**

1. Clusters (20 ops)
2. Flex Clusters (6 ops)
3. Serverless Instances (5 ops)
4. Cluster Outage Simulation (3 ops)
5. Global Clusters (5 ops)
6. Organizations (15 ops)
7. Projects (23 ops)
8. Teams (13 ops)
9. Programmatic API Keys (14 ops)
10. Service Accounts (22 ops)
11. MongoDB Cloud Users (19 ops)
12. Database Users (5 ops)
13. Custom Database Roles (5 ops)
14. Project IP Access List (5 ops)
15. Network Peering (13 ops)
16. Private Endpoint Services (9 ops)
17. Serverless Private Endpoints (5 ops)
18. X.509 Authentication (3 ops)
19. LDAP Configuration (5 ops)
20. Federated Authentication (18 ops)
21. Cloud Provider Access (5 ops)
22. Encryption at Rest using Customer Key Management (6 ops)
23. Monitoring and Logs (14 ops)
24. Alert Configurations (8 ops)
25. Alerts (4 ops)
26. Performance Advisor (11 ops)
27. Events (5 ops)
28. Collection Level Metrics (9 ops)
29. Access Tracking (2 ops)
30. Third-Party Integrations (5 ops)
31. Query Shape Insights (5 ops)
32. Cloud Backups (35 ops)
33. Shared-Tier Snapshots (3 ops)
34. Shared-Tier Restore Jobs (3 ops)
35. Flex Snapshots (3 ops)
36. Flex Restore Jobs (3 ops)
37. Legacy Backup (11 ops)
38. Atlas Search (18 ops)
39. Data Federation (14 ops)
40. Data Lake Pipelines (13 ops)
41. Online Archive (6 ops)
42. Streams (30 ops)
43. Rolling Index (1 op)
44. Invoices (9 ops)
45. AWS Clusters DNS (2 ops)
46. Maintenance Windows (5 ops)
47. Push-Based Log Export (9 ops)
48. Resource Policies (7 ops)
49. Auditing (2 ops)
50. Cloud Migration Service (8 ops)
51. Root (2 ops)
52. Activity Feed (2 ops)

**Not part of the Atlas Admin API v2 (separate APIs):**

The following were listed in the original appendix but are **not endpoints in the Atlas Admin API v2**. They belong to the Atlas App Services API (`services.cloud.mongodb.com`) or are server-level features configured via MongoDB drivers, not the Admin REST API.

| Item | Reason |
|------|--------|
| Triggers | Atlas App Services API |
| Functions | Atlas App Services API |
| App Services | Atlas App Services API |
| Data API | Atlas App Services API |
| GraphQL API | Atlas App Services API |
| Device Sync | Atlas App Services API |
| Atlas Charts | Atlas Charts API (separate) |
| Atlas for Government | Same Admin API, different base URL (`cloud.mongodbgov.com`) — no separate endpoints |
| Workflow Tasks | Internal/deprecated — no public endpoints |
| Cloud Provider Container Registry | Not in current public API spec |
| Time Series Collections | MongoDB server feature configured via driver, not Admin API |

### B. Tool Naming Conventions

**Pattern:** `{category}_{action}_{resource}`

Examples:
- `cluster_create_deployment`
- `user_manage_access`
- `backup_restore_snapshot`
- `search_create_index`
- `monitor_get_metrics`

### C. Resource URI Patterns

```
orbitai://
  ├── organizations/{orgId}
  │   ├── info
  │   ├── users
  │   ├── teams
  │   ├── api-keys
  │   └── projects/{projectId}
  │       ├── info
  │       ├── settings
  │       ├── clusters/{clusterName}
  │       │   ├── configuration
  │       │   ├── metrics
  │       │   ├── connection-strings
  │       │   ├── backups/{snapshotId}
  │       │   └── search-indexes/{indexName}
  │       ├── database-users/{username}
  │       ├── network
  │       │   ├── access-lists
  │       │   ├── peering-connections
  │       │   └── private-endpoints
  │       ├── alerts/{alertId}
  │       ├── events
  │       ├── data-lakes/{dataLakeName}
  │       ├── triggers/{triggerId}
  │       └── functions/{functionName}
  └── billing
      ├── invoices/{invoiceId}
      └── usage
```

### D. Example Natural Language Queries for OrbitAI

**Cluster Management:**
- "Create a 3 node M10 cluster on Azure in us-east and enable autoscaling"
- "Scale my production cluster to M30"
- "Show me the current CPU usage of all clusters"
- "Pause the development cluster to save costs"
- "Add a read-only replica node to the cluster my-dev in project fun-dev"
- "Tell me what MongoDB clusters are the most active at this time"
- "Add a search node to the acme-cluster in the acme project"
- "Create a global cluster with regions in US, EU, and Asia"
- "Enable continuous backup on all production clusters"

**Cost & Billing:**
- "Tell me how much Org ABC spent each month in 2025"
- "What's my current monthly Atlas spending?"
- "Show me cost breakdown by project for Q4 2025"
- "Which clusters are costing the most this month?"
- "Project my spending for next month based on current usage"
- "Show me all clusters under $100/month"

**User & Security:**
- "Create a read-only user for the analytics team"
- "Add IP address 203.0.113.0 to the allowlist"
- "Show me all users with admin privileges in project XYZ"
- "Configure private endpoint for production cluster on AWS"
- "Enable encryption at rest with customer-managed keys"
- "Set up LDAP authentication for my organization"
- "Create a custom role with read access to specific databases"

**Monitoring & Performance:**
- "Alert me when any cluster CPU usage exceeds 80%"
- "Show Performance Advisor recommendations for prod-cluster"
- "What clusters have the most connections right now?"
- "Display disk usage trends for the last 30 days"
- "Show me all active alerts"
- "What events occurred on cluster-prod in the last 24 hours?"

**Backup & Recovery:**
- "Create a snapshot of my-cluster before the deployment"
- "Show me all available backups for production"
- "Configure daily backup retention for 30 days"
- "Restore cluster-prod to yesterday at 3pm"
- "What's the backup policy for my serverless instances?"

**Network & Infrastructure:**
- "Set up VPC peering between my Atlas cluster and AWS VPC"
- "Create a private endpoint for cluster-secure"
- "Schedule maintenance window for Sundays at 2am"
- "Show all network peering connections"

**Atlas Services:**
- "Create an Atlas Search index on the products collection"
- "Set up Data Lake for archiving old orders"
- "Configure an Atlas Trigger for new user signups"
- "Deploy a function to validate email addresses"
- "Enable vector search on my embeddings collection"

**Organization & Projects:**
- "Create a new project called 'Mobile App Backend'"
- "List all projects in my organization"
- "Add user john@example.com to the DevOps team"
- "Show me all API keys for this project"
- "Create a project-level API key with limited permissions"

### E. Configuration File Example

```yaml
# .orbitai.yaml

profiles:
  production:
    atlas_public_key: ${ATLAS_PROD_PUBLIC_KEY}
    atlas_private_key: ${ATLAS_PROD_PRIVATE_KEY}
    atlas_project_id: 507f1f77bcf86cd799439011
    atlas_org_id: 507f191e810c19729de860ea
    
  staging:
    atlas_public_key: ${ATLAS_STAGING_PUBLIC_KEY}
    atlas_private_key: ${ATLAS_STAGING_PRIVATE_KEY}
    atlas_project_id: 507f1f77bcf86cd799439012
    atlas_org_id: 507f191e810c19729de860ea

  development:
    atlas_public_key: ${ATLAS_DEV_PUBLIC_KEY}
    atlas_private_key: ${ATLAS_DEV_PRIVATE_KEY}
    atlas_project_id: 507f1f77bcf86cd799439013
    atlas_org_id: 507f191e810c19729de860ea

settings:
  default_profile: development
  log_level: info
  output_format: table
  page_size: 20
  retry_on_rate_limit: true
  max_retries: 3
  
mcp:
  server_name: orbitai
  version: 1.0.0
  
security:
  credential_store: system-keychain  # or env, file, vault
  ssl_verify: true
  api_timeout: 30000  # milliseconds
```
    atlas_private_key: ${ATLAS_DEV_PRIVATE_KEY}
    atlas_project_id: 507f1f77bcf86cd799439012
    default_database: app_development

settings:
  default_profile: development
  log_level: info
  output_format: table
  page_size: 20
  
mcp:
  server_name: mongodb-atlas
  version: 1.0.0
  
security:
  credential_store: system-keychain  # or env, file, vault
  ssl_verify: true
```

---

## Conclusion

This implementation plan provides a comprehensive roadmap for building a complete MongoDB Atlas MCP server with CLI and UI capabilities. The phased approach ensures steady progress while maintaining quality and allowing for iterative improvements.

**Key Success Factors:**
1. Complete API coverage from day one
2. Excellent documentation and examples
3. Robust error handling and user feedback
4. Performance optimization
5. Security-first approach
6. Active community engagement

The 20-week timeline is aggressive but achievable with focused effort. The modular architecture allows for parallel development across different components and enables community contributions once open-sourced.