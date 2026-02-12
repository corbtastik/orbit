# OrbitAI - MongoDB Relational Migrator MCP Server Implementation Plan

## Executive Summary

This plan outlines the implementation of **Relational Migrator API support** for OrbitAI, extending the MCP server to cover 100% of the MongoDB Relational Migrator REST API v1. This enables platform teams and developers to manage database migrations from relational databases (Oracle, SQL Server, MySQL, PostgreSQL, DB2, Sybase) to MongoDB using conversational AI.

---

## Project Overview

**Feature Name:** Relational Migrator Integration

**Tagline:** "AI-powered relational-to-MongoDB migration management"

**Goal:** Enable users to manage the complete migration lifecycle—from schema mapping to code generation to job execution—using natural language through the OrbitAI MCP server.

**Target Audiences:**
1. Database migration teams
2. Application modernization engineers
3. DevOps teams managing data migrations
4. Developers converting relational applications to MongoDB

---

## Relational Migrator API Overview

### API Characteristics

| Property | Value |
|----------|-------|
| **Base URL** | `http://127.0.0.1:8278/api/v1` (configurable) |
| **Ports** | 8278 (default), 8080, or 443 |
| **Authentication** | None (local-only by default) |
| **API Version** | 1.15.x |
| **Transport** | HTTP REST |
| **OpenAPI Spec** | Available at `/api-docs` |

### Key Differences from Atlas Admin API

| Aspect | Atlas Admin API | Relational Migrator API |
|--------|-----------------|------------------------|
| **Location** | Cloud (cloud.mongodb.com) | Local (user's machine/server) |
| **Authentication** | Digest Auth (API keys) | None |
| **State** | Stateless | Stateful (projects, jobs) |
| **Deployment** | Multi-tenant SaaS | Single-instance desktop/server |

---

## API Endpoint Groups (Estimated)

Based on product documentation and search results, the Relational Migrator API covers these domains:

### Domain 1: Project Management
- **Endpoints:** ~8-12 operations
- **Purpose:** Create, open, save, export/import migration projects
- **Key Operations:**
  - List projects
  - Create project
  - Open project
  - Save project
  - Export project
  - Import project
  - Get project metadata

### Domain 2: Connection Management
- **Endpoints:** ~10-15 operations
- **Purpose:** Manage source (relational) and destination (MongoDB) database connections
- **Key Operations:**
  - List connections
  - Create/test source connection (Oracle, SQL Server, MySQL, PostgreSQL, DB2, Sybase)
  - Create/test destination connection (MongoDB)
  - Update connection
  - Delete connection
  - Get connection status

### Domain 3: Schema Discovery & Mapping
- **Endpoints:** ~15-20 operations
- **Purpose:** Discover relational schema, define MongoDB target schema, create mapping rules
- **Key Operations:**
  - Discover relational schema
  - Get tables/views/columns
  - Create MongoDB collection mappings
  - Define embedding rules
  - Define array rules
  - Create field mappings
  - Get/update mapping rules
  - Validate mappings
  - Apply recommended mappings

### Domain 4: Migration Jobs
- **Endpoints:** ~12-18 operations
- **Purpose:** Create, configure, run, monitor, and manage migration jobs
- **Key Operations:**
  - Create job (snapshot, continuous, or both)
  - Start job
  - Stop job
  - Pause job
  - Resume job
  - Get job status
  - Get job progress
  - Get job logs/events
  - List jobs
  - Delete job
  - Configure job settings (batch size, parallelism, filters)

### Domain 5: Code Generation
- **Endpoints:** ~8-12 operations
- **Purpose:** Generate application code based on schema mappings
- **Key Operations:**
  - Generate entity classes (C#, Java, JavaScript)
  - Generate repository/DAO code
  - Generate API code
  - Get available templates
  - Configure code generation settings
  - Export generated code

### Domain 6: Query Conversion
- **Endpoints:** ~6-10 operations
- **Purpose:** Convert SQL queries, views, and stored procedures to MongoDB queries
- **Key Operations:**
  - Convert SQL query
  - Convert stored procedure
  - Convert view
  - Validate converted query
  - Test query execution
  - Get conversion suggestions

### Domain 7: Data Validation
- **Endpoints:** ~5-8 operations
- **Purpose:** Validate migrated data between source and destination
- **Key Operations:**
  - Run validation job
  - Get validation results
  - Compare row counts
  - Sample data comparison
  - Get validation report

### Domain 8: System & Configuration
- **Endpoints:** ~5-8 operations
- **Purpose:** System health, configuration, and metadata
- **Key Operations:**
  - Get system status
  - Get API version
  - Get supported databases
  - Get configuration
  - Update configuration

---

## Estimated Total API Coverage

| Domain | Estimated Endpoints | Estimated Operations |
|--------|---------------------|---------------------|
| Projects | 8-12 | 8-12 |
| Connections | 10-15 | 10-15 |
| Schema/Mapping | 15-20 | 20-30 |
| Migration Jobs | 12-18 | 15-25 |
| Code Generation | 8-12 | 10-15 |
| Query Conversion | 6-10 | 8-12 |
| Data Validation | 5-8 | 6-10 |
| System/Config | 5-8 | 5-8 |
| **Total** | **~70-100** | **~80-130** |

---

## Architecture Design

### Client Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │  Atlas Tools    │  │  Relational Migrator Tools       │  │
│  │  (41 tools)     │  │  (~8-12 tools)                   │  │
│  └────────┬────────┘  └──────────────┬───────────────────┘  │
│           │                          │                       │
│           ▼                          ▼                       │
│  ┌─────────────────┐  ┌──────────────────────────────────┐  │
│  │  AtlasClient    │  │  RelationalMigratorClient        │  │
│  │  (Digest Auth)  │  │  (No Auth)                       │  │
│  └────────┬────────┘  └──────────────┬───────────────────┘  │
│           │                          │                       │
└───────────┼──────────────────────────┼───────────────────────┘
            │                          │
            ▼                          ▼
    Atlas Admin API           Relational Migrator API
  (cloud.mongodb.com)        (localhost:8278/api/v1)
```

### Tool Organization Strategy

Following the existing Orbit pattern of **"one tool per domain"** with action parameters:

| MCP Tool Name | Domain | Estimated Actions |
|---------------|--------|-------------------|
| `manage_rm_projects` | Project Management | 8-12 |
| `manage_rm_connections` | Connection Management | 10-15 |
| `manage_rm_schema` | Schema Discovery & Mapping | 20-30 |
| `manage_rm_jobs` | Migration Jobs | 15-25 |
| `manage_rm_codegen` | Code Generation | 10-15 |
| `manage_rm_queries` | Query Conversion | 8-12 |
| `manage_rm_validation` | Data Validation | 6-10 |
| `get_rm_system_info` | System & Configuration | 5-8 |

**Total:** ~8 new MCP tools with ~80-130 actions

---

## Implementation Phases

### Phase 1: Research & API Discovery (1-2 days)

#### 1.1 Obtain OpenAPI Specification
- Download Relational Migrator (https://www.mongodb.com/try/download/relational-migrator)
- Install locally and start the application
- Access OpenAPI spec at `http://127.0.0.1:8278/api-docs` or similar
- Extract complete endpoint listing

#### 1.2 Document API Endpoints
- Create comprehensive endpoint mapping document
- Categorize by domain
- Note request/response schemas
- Identify required vs optional parameters
- Document error responses

#### 1.3 Validate API Behavior
- Test key endpoints manually (curl, Postman)
- Verify authentication (or lack thereof)
- Test error handling
- Document any undocumented behaviors

---

### Phase 2: Core Infrastructure (2-3 days)

#### 2.1 Create RelationalMigratorClient

**File:** `packages/core/src/client/relational-migrator-client.ts`

```typescript
export interface RelationalMigratorConfig {
  baseUrl: string;      // Default: http://127.0.0.1:8278
  apiVersion: string;   // Default: v1
  timeoutMs: number;    // Default: 30000
}

export class RelationalMigratorClient {
  constructor(config?: Partial<RelationalMigratorConfig>);

  async request<T>(options: RequestOptions): Promise<ApiResponse<T>>;
  async get<T>(path: string, query?: Record<string, unknown>): Promise<T>;
  async post<T>(path: string, body?: unknown): Promise<T>;
  async put<T>(path: string, body?: unknown): Promise<T>;
  async delete<T>(path: string): Promise<T>;

  // Health check
  async isAvailable(): Promise<boolean>;
}
```

**Key Differences from AtlasClient:**
- No authentication handling (Digest auth not needed)
- Local service discovery (check if Relational Migrator is running)
- Simpler error handling
- Connection health checks

#### 2.2 Add Configuration Support

**File:** Update `packages/core/src/config/config.ts`

```typescript
interface OrbitConfig {
  // ... existing config ...

  relationalMigrator?: {
    baseUrl?: string;      // Default: http://127.0.0.1:8278
    apiVersion?: string;   // Default: v1
    enabled?: boolean;     // Default: true
  };
}
```

**Environment Variables:**
- `ORBIT_RM_URL` - Override base URL
- `ORBIT_RM_ENABLED` - Enable/disable RM tools (default: true)

#### 2.3 Create Error Types

**File:** `packages/core/src/errors/relational-migrator-error.ts`

```typescript
export class RelationalMigratorError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    public readonly endpoint: string,
  );
}

export class RelationalMigratorUnavailableError extends Error {
  // When RM is not running or not reachable
}
```

---

### Phase 3: Domain Implementation (3-5 days)

#### 3.1 Create Domain Action Maps

**Directory:** `packages/core/src/domains/relational-migrator/`

```
relational-migrator/
├── index.ts           # Export all action maps
├── projects.ts        # Project management actions
├── connections.ts     # Connection management actions
├── schema.ts          # Schema discovery & mapping actions
├── jobs.ts            # Migration job actions
├── codegen.ts         # Code generation actions
├── queries.ts         # Query conversion actions
├── validation.ts      # Data validation actions
└── system.ts          # System info actions
```

**Example - jobs.ts:**
```typescript
import type { ActionMap } from "../base.js";

const P = "/api/v1";

export const rmJobActions: ActionMap = {
  list:              { method: "GET",    path: `${P}/jobs` },
  get:               { method: "GET",    path: `${P}/jobs/{jobId}` },
  create:            { method: "POST",   path: `${P}/jobs`, hasBody: true },
  start:             { method: "POST",   path: `${P}/jobs/{jobId}/start` },
  stop:              { method: "POST",   path: `${P}/jobs/{jobId}/stop` },
  pause:             { method: "POST",   path: `${P}/jobs/{jobId}/pause` },
  resume:            { method: "POST",   path: `${P}/jobs/{jobId}/resume` },
  delete:            { method: "DELETE", path: `${P}/jobs/{jobId}` },
  get_status:        { method: "GET",    path: `${P}/jobs/{jobId}/status` },
  get_progress:      { method: "GET",    path: `${P}/jobs/{jobId}/progress` },
  get_logs:          { method: "GET",    path: `${P}/jobs/{jobId}/logs` },
  update_config:     { method: "PUT",    path: `${P}/jobs/{jobId}/config`, hasBody: true },
};
```

#### 3.2 Create Dispatch Function for RM

The existing `dispatch()` function works with `AtlasClient`. Create a parallel version for `RelationalMigratorClient`:

**File:** `packages/core/src/domains/relational-migrator/base.ts`

```typescript
export async function dispatchRM<T = unknown>(
  client: RelationalMigratorClient,
  actions: ActionMap,
  params: DomainParams,
): Promise<T>;
```

---

### Phase 4: MCP Tool Integration (2-3 days)

#### 4.1 Create Tool Registry Entries

**File:** `packages/mcp-server/src/tools/relational-migrator/registry.ts`

```typescript
export interface RMToolDef {
  name: string;
  description: string;
  actions: ActionMap;
}

export const RM_TOOL_REGISTRY: RMToolDef[] = [
  {
    name: "manage_rm_projects",
    description: "Manage Relational Migrator projects — create, open, save, import, export migration projects.",
    actions: rmProjectActions,
  },
  {
    name: "manage_rm_connections",
    description: "Manage database connections — configure source (Oracle, SQL Server, MySQL, PostgreSQL) and destination (MongoDB) connections.",
    actions: rmConnectionActions,
  },
  {
    name: "manage_rm_schema",
    description: "Discover relational schema and define MongoDB mappings — tables, collections, embedding rules, field transformations.",
    actions: rmSchemaActions,
  },
  {
    name: "manage_rm_jobs",
    description: "Manage migration jobs — create, start, stop, monitor snapshot and continuous (CDC) migration jobs.",
    actions: rmJobActions,
  },
  {
    name: "manage_rm_codegen",
    description: "Generate application code from schema mappings — entity classes, repositories, APIs in C#, Java, JavaScript.",
    actions: rmCodegenActions,
  },
  {
    name: "manage_rm_queries",
    description: "Convert SQL queries, views, and stored procedures to MongoDB query language.",
    actions: rmQueryActions,
  },
  {
    name: "manage_rm_validation",
    description: "Validate migrated data — compare source and destination, run validation jobs, get reports.",
    actions: rmValidationActions,
  },
  {
    name: "get_rm_system_info",
    description: "Get Relational Migrator system status, API version, supported databases, and configuration.",
    actions: rmSystemActions,
  },
];
```

#### 4.2 Update Server Registration

**File:** Update `packages/mcp-server/src/server.ts`

```typescript
export function createServer(
  atlasClient: AtlasClient,
  rmClient?: RelationalMigratorClient,  // NEW
  conn?: ConnectionManager,
  options: ServerOptions = {},
): Server {
  // Register Atlas tools
  // Register Database tools
  // Register Relational Migrator tools (NEW)
}
```

#### 4.3 Add Tool Call Routing

Handle Relational Migrator tool calls with appropriate client routing:

```typescript
// In tools/call handler
if (name.startsWith("manage_rm_") || name === "get_rm_system_info") {
  return handleRelationalMigratorTool(rmClient, toolDef, args);
}
```

---

### Phase 5: Resources & Prompts (1-2 days)

#### 5.1 Add MCP Resources

**File:** `packages/mcp-server/src/resources-rm.ts`

```typescript
export const RM_RESOURCE_REGISTRY = [
  {
    uri: "rm://projects",
    name: "Migration Projects",
    description: "List of all Relational Migrator projects",
    mimeType: "application/json",
  },
  {
    uri: "rm://connections",
    name: "Database Connections",
    description: "Configured source and destination connections",
    mimeType: "application/json",
  },
  {
    uri: "rm://jobs",
    name: "Migration Jobs",
    description: "Active and completed migration jobs",
    mimeType: "application/json",
  },
  {
    uri: "rm://system/status",
    name: "System Status",
    description: "Relational Migrator system health and version",
    mimeType: "application/json",
  },
];
```

#### 5.2 Add MCP Prompts

**File:** `packages/mcp-server/src/prompts-rm.ts`

```typescript
export const RM_PROMPT_REGISTRY = [
  {
    name: "migration_planner",
    description: "Plan a relational-to-MongoDB migration strategy",
    arguments: [
      { name: "sourceDatabase", description: "Source database type (Oracle, SQL Server, etc.)", required: true },
      { name: "tables", description: "Comma-separated list of tables to migrate", required: false },
    ],
  },
  {
    name: "schema_designer",
    description: "Design optimal MongoDB schema from relational tables",
    arguments: [
      { name: "tables", description: "Tables to analyze for MongoDB schema design", required: true },
    ],
  },
  {
    name: "code_generator",
    description: "Generate application code for migrated data models",
    arguments: [
      { name: "language", description: "Target language (java, csharp, javascript)", required: true },
      { name: "framework", description: "Target framework (spring-boot, dotnet, express)", required: false },
    ],
  },
];
```

---

### Phase 6: Testing (2-3 days)

#### 6.1 Unit Tests

```
packages/core/src/
├── client/relational-migrator-client.test.ts
├── domains/relational-migrator/
│   ├── projects.test.ts
│   ├── connections.test.ts
│   ├── schema.test.ts
│   ├── jobs.test.ts
│   ├── codegen.test.ts
│   ├── queries.test.ts
│   └── validation.test.ts

packages/mcp-server/src/tools/relational-migrator/
├── registry.test.ts
└── schema.test.ts
```

#### 6.2 Integration Tests

- Test against running Relational Migrator instance
- Verify end-to-end tool execution
- Test error handling when RM is unavailable

#### 6.3 OpenAPI Cross-Validation

Similar to `openapi-crossvalidation.test.ts` for Atlas:

```typescript
// Validate all action maps match OpenAPI spec
describe("Relational Migrator API cross-validation", () => {
  // Compare registered actions against OpenAPI endpoints
});
```

---

### Phase 7: Documentation & Polish (1-2 days)

#### 7.1 Update README.md

- Add Relational Migrator section
- Document configuration options
- Add example usage

#### 7.2 Update MCP-ARCHITECTURE.md

- Document new tools (8 tools, ~100 actions)
- Update tool catalog
- Add architecture diagram update

#### 7.3 Create Demo Files

- `demo/demo-relational-migrator.md` - Example migration workflows

---

## Configuration Summary

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ORBIT_RM_URL` | `http://127.0.0.1:8278` | Relational Migrator base URL |
| `ORBIT_RM_ENABLED` | `true` | Enable/disable RM tools |
| `ORBIT_RM_TIMEOUT` | `30000` | Request timeout (ms) |

### Config File (`.orbit-ai/config.json`)

```json
{
  "relationalMigrator": {
    "baseUrl": "http://127.0.0.1:8278",
    "apiVersion": "v1",
    "enabled": true,
    "timeoutMs": 30000
  }
}
```

---

## File Changes Summary

### New Files (~15-20)

```
packages/core/src/
├── client/relational-migrator-client.ts
├── domains/relational-migrator/
│   ├── index.ts
│   ├── base.ts
│   ├── projects.ts
│   ├── connections.ts
│   ├── schema.ts
│   ├── jobs.ts
│   ├── codegen.ts
│   ├── queries.ts
│   ├── validation.ts
│   └── system.ts
└── errors/relational-migrator-error.ts

packages/mcp-server/src/
├── tools/relational-migrator/
│   ├── index.ts
│   └── registry.ts
├── resources-rm.ts
└── prompts-rm.ts
```

### Modified Files (~5-8)

```
packages/core/src/
├── config/config.ts          # Add RM config
├── client/index.ts           # Export RM client
├── domains/index.ts          # Export RM domains
└── index.ts                  # Export RM modules

packages/mcp-server/src/
├── server.ts                 # Register RM tools
├── tools/index.ts            # Export RM tools
├── resources.ts              # Add RM resources
└── prompts.ts                # Add RM prompts
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenAPI spec unavailable | Low | High | Manual endpoint discovery from docs |
| API changes between versions | Medium | Medium | Version detection, graceful degradation |
| RM not running on user machine | High | Low | Clear error messages, availability checks |
| Undocumented endpoints | Medium | Low | Focus on documented public API |
| Complex state management | Medium | Medium | Stateless tool design, clear error handling |

---

## Success Criteria

1. **100% API Coverage** - All documented Relational Migrator API endpoints accessible via MCP tools
2. **Consistent Patterns** - Same ActionMap/dispatch pattern as Atlas tools
3. **Graceful Degradation** - Clear errors when RM is unavailable
4. **Test Coverage** - Unit tests for all domains
5. **Documentation** - Updated README, architecture docs, demo files

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Research & API Discovery | 1-2 days | Access to Relational Migrator |
| Phase 2: Core Infrastructure | 2-3 days | Phase 1 |
| Phase 3: Domain Implementation | 3-5 days | Phase 2 |
| Phase 4: MCP Tool Integration | 2-3 days | Phase 3 |
| Phase 5: Resources & Prompts | 1-2 days | Phase 4 |
| Phase 6: Testing | 2-3 days | Phase 4 |
| Phase 7: Documentation | 1-2 days | Phase 5-6 |
| **Total** | **~12-20 days** | |

---

## Next Steps

1. **Immediate:** Download and install Relational Migrator locally
2. **Day 1:** Extract OpenAPI specification, document all endpoints
3. **Day 2-3:** Implement `RelationalMigratorClient` and core infrastructure
4. **Day 4-8:** Implement domain action maps based on actual API spec
5. **Day 9-11:** Integrate with MCP server, add resources/prompts
6. **Day 12-14:** Testing and documentation

---

## References

- [MongoDB Relational Migrator Documentation](https://www.mongodb.com/docs/relational-migrator/)
- [Relational Migrator REST API](https://www.mongodb.com/docs/relational-migrator/api-docs/)
- [MongoDB Relational Migrator REST API Reference](https://www.mongodb.com/docs/api/doc/mongodb-relational-migrator-rest-api/)
- [Download Relational Migrator](https://www.mongodb.com/try/download/relational-migrator)
