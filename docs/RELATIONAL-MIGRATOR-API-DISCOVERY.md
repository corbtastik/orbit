# MongoDB Relational Migrator API Discovery

**Discovery Date:** 2026-02-12
**API Version:** 1.15.2
**Base URL:** `http://127.0.0.1:8278/api/v1`
**Transport:** HTTP (no authentication required by default)

---

## Complete Verified Endpoint List

### System & Health
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/info` | ✅ | System information, drivers, features |
| GET | `/api/v1/news` | ✅ | Product announcements |
| GET | `/actuator` | ✅ | Actuator endpoints |
| GET | `/actuator/health` | ✅ | Health status |

### Project Management
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/project` | ✅ | List all projects |
| GET | `/api/v1/project/{id}` | ✅ | Get project details |
| POST | `/api/v1/project` | ✅ | Create project (requires: name, type, schemasId, content) |
| PUT | `/api/v1/project/{id}` | ✅ | Update project (requires: id, name, type, schemasId, content) |
| DELETE | `/api/v1/project/{id}` | ✅ | Delete project |
| GET | `/api/v1/project/{id}/collections` | ✅ | Get project collections |
| GET | `/api/v1/project/{id}/export` | ✅ | Export project |
| POST | `/api/v1/project/import` | ✅ | Import project (requires: version field in body) |
| POST | `/api/v1/project/recommendation` | ✅ | Get schema recommendations (requires: schema) |

### Connection Management
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/connections/jdbc` | ✅ | List JDBC connections |
| GET | `/api/v1/connections/mongodb` | ✅ | List MongoDB connections |
| POST | `/api/v1/connections/jdbc` | ✅ | Create JDBC connection (requires: name, url, type) |
| POST | `/api/v1/connections/mongodb` | ✅ | Create MongoDB connection (requires: name, connectionString) |
| GET | `/api/v1/connections/jdbc/{id}` | ✅ | Get JDBC connection |
| GET | `/api/v1/connections/mongodb/{id}` | ✅ | Get MongoDB connection |
| DELETE | `/api/v1/connections/jdbc/{id}` | ⚠️ | Delete JDBC connection |
| DELETE | `/api/v1/connections/mongodb/{id}` | ⚠️ | Delete MongoDB connection |

### Connectivity Testing
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/connectivity/environment` | ✅ | Get deployment environment |
| POST | `/api/v1/connectivity/jdbc` | ✅ | Test JDBC connection (requires: url, type) |
| POST | `/api/v1/connectivity/mongodb` | ✅ | Test MongoDB connection (requires: connectionString) |

### Schema Discovery
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/schema/{id}` | ✅ | Get schema by ID |
| POST | `/api/v1/schema/jdbc` | ✅ | Discover schema from JDBC (requires: jdbcConnectionDetails) |
| POST | `/api/v1/schema/ddl` | ✅ | Parse DDL (requires: fileName, type, ddlString) |

### Job Management
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/jobs` | ✅ | List all jobs |
| GET | `/api/v1/jobs/{id}` | ✅ | Get job by ID |
| POST | `/api/v1/jobs` | ✅ | Create job (requires: projectId, jdbcConnectionDetails, mongodbConnectionDetails, options, verification) |
| GET | `/api/v1/jobs/{id}/logs` | ✅ | Get job logs |
| GET | `/api/v1/jobs/{id}/logs/download` | ⚠️ | Download job logs |
| POST | `/api/v1/jobs/{id}/stop` | ✅ | Stop job |
| POST | `/api/v1/jobs/{id}/pause` | ✅ | Pause job |
| POST | `/api/v1/jobs/{id}/resume` | ✅ | Resume job |
| POST | `/api/v1/jobs/{id}/retry` | ⚠️ | Retry job |
| POST | `/api/v1/jobs/{id}/signal` | ⚠️ | Signal job |

### Verification
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/verification/{jobId}` | ⚠️ | Get verification status |
| POST | `/api/v1/verification/{jobId}/stop` | ⚠️ | Stop verification |

### Analysis
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/api/v1/analysis/{projectId}/report` | ⚠️ | Get analysis report |
| GET | `/api/v1/analysis/{projectId}/report/rule` | ⚠️ | Get analysis rules |
| GET | `/api/v1/analysis/{projectId}/task` | ⚠️ | Get analysis tasks |
| POST | `/api/v1/analysis/{projectId}/task/cancel` | ⚠️ | Cancel analysis task |

**Legend:** ✅ Verified working | ⚠️ Discovered but not fully tested

---

## System Information

### GET /api/v1/info

Returns comprehensive system information including version, build details, JDBC driver status, and feature flags.

**Response Example:**
```json
{
  "build": {
    "artifact": "application",
    "name": "MongoDB Relational Migrator",
    "time": "2026-01-07T03:40:40.394Z",
    "version": "1.15.2",
    "group": "com.mongodb.migrator"
  },
  "buildStatus": {
    "latest": true,
    "enabled": true,
    "latestReleaseURL": "https://downloads.mongodb.org/migrator/1.15.2/...",
    "latestReleaseType": "NONE",
    "latestReleaseVersion": "1.15.2"
  },
  "jdbcDriversFound": {
    "SQL_SERVER": { "currentVersion": "12.8.0", "supportedVersions": [">=12.4.0"], "isValid": false, "displayName": "SQL Server" },
    "ORACLE": { "currentVersion": "23.7.0", "supportedVersions": ["^12.2","^19.x","^21.x","^23.x"], "isValid": false, "displayName": "Oracle" },
    "POSTGRESQL": { "currentVersion": "42.7.0", "supportedVersions": [">=42.6.0"], "isValid": false, "displayName": "PostgreSQL" },
    "MYSQL": { "currentVersion": null, "supportedVersions": [], "isValid": false, "displayName": "MySQL" },
    "DB2": { "currentVersion": null, "supportedVersions": [], "isValid": false, "displayName": "Db2" },
    "SYBASE": { "currentVersion": "1.3.0", "supportedVersions": [], "isValid": false, "displayName": "Sybase ASE" },
    "SYBASEIQ": { "currentVersion": null, "supportedVersions": [], "isValid": false, "displayName": "SybaseIQ" },
    "COCKROACHDB": { "currentVersion": "42.7.0", "supportedVersions": [">=24.3.0"], "isValid": false, "displayName": "Cockroach DB" },
    "YUGABYTE": { "currentVersion": null, "supportedVersions": [], "isValid": false, "displayName": "Yugabyte" },
    "SQLANYWHERE": { "currentVersion": null, "supportedVersions": [], "isValid": false, "displayName": "SQL Anywhere" }
  },
  "telemetry": { "enabled": true },
  "credentials": { "isCredentialsStoreValid": true },
  "news": { "enabled": true },
  "featureFlags": {},
  "deployment": { "type": "LOCAL", "environment": "PROD" }
}
```

---

## Health & Actuator Endpoints

### GET /actuator
Returns available actuator endpoints.

### GET /actuator/health
Returns health status with component details.

**Response Example:**
```json
{
  "status": "UP",
  "groups": ["liveness", "readiness"],
  "components": {
    "diskSpace": { "status": "UP", "details": { "total": 494384795648, "free": 250531028992, "threshold": 10485760 } },
    "livenessState": { "status": "UP" },
    "ping": { "status": "UP" },
    "readinessState": { "status": "UP" },
    "ssl": { "status": "UP" }
  }
}
```

---

## Project Management

### GET /api/v1/project
Lists all projects.

**Response Example:**
```json
[
  {
    "id": "4104527c6d34423698efeb9cf4fce2b6",
    "jdbcId": null,
    "mongodbId": null,
    "name": "My Sample Project",
    "type": "POSTGRESQL",
    "lastModified": "2026-01-16T22:08:41.724449Z"
  }
]
```

### GET /api/v1/project/{projectId}
Returns full project details including mappings, collections, relationships, and diagrams.

**Response Structure:**
```json
{
  "id": "string",
  "name": "string",
  "type": "POSTGRESQL|MYSQL|ORACLE|SQL_SERVER|DB2|SYBASE|...",
  "lastModified": "ISO8601 timestamp",
  "schemasId": "string",
  "jdbcId": "string|null",
  "mongodbId": "string|null",
  "content": {
    "settings": {
      "viewMode": "string|null",
      "shouldRecommendSchema": true,
      "casing": "CAMEL_CASE|SNAKE_CASE|...",
      "excludedJsonExportCollections": [],
      "keyHandling": "GENERATED|..."
    },
    "collections": {
      "<collectionId>": { "name": "string" }
    },
    "mappings": {
      "<mappingId>": {
        "settings": {
          "type": "NEW_DOCUMENT|EMBEDDED|...",
          "notes": "string|null",
          "embeddedPath": "string|null",
          "primitive": "string|null",
          "arrayConditions": "object|null",
          "foreignKeyName": "string|null",
          "ruleFilter": "object|null"
        },
        "fields": {
          "<fieldName>": {
            "target": { "name": "string", "included": true, "isNullExcluded": false, "type": "STRING|INTEGER|..." },
            "source": { "name": "string", "databaseSpecificType": "string", "isPrimaryKey": true|false }
          }
        },
        "calculatedFields": {},
        "collectionId": "string",
        "table": "string"
      }
    },
    "relationships": {
      "tables": { "<tablePath>": { "mappings": ["mappingId"] } },
      "collections": { "<collectionId>": { "mappings": ["mappingId"] } },
      "mappings": { "<mappingId>": { "children": [] } }
    },
    "diagrams": {
      "activeTab": "string",
      "tabs": [
        {
          "id": "string",
          "name": "string",
          "notes": "string|null",
          "relational": { "nodes": [], "edges": [] },
          "collection": { "nodes": [], "edges": [] }
        }
      ]
    },
    "tables": {
      "<tableId>": {
        "path": { "database": "string", "schema": "string", "table": "string" }
      }
    }
  },
  "connectionDetails": { "ddl": "string|null" },
  "isSampleProject": true|false
}
```

### POST /api/v1/project
Creates a new project.

**Required Fields:**
- `schemasId` (string, required)
- `content` (object, required)
- `type` (string, required) - Database type: POSTGRESQL, MYSQL, ORACLE, SQL_SERVER, DB2, SYBASE, etc.
- `name` (string, required)

### PUT /api/v1/project/{projectId}
Updates an existing project.

**Required Fields:**
- `id` (string, required) - Must match path parameter
- `schemasId` (string, required)
- `content` (object, required)
- `type` (string, required)
- `name` (string, required)

### DELETE /api/v1/project/{projectId}
Deletes a project. Returns empty response on success.

---

## Job Management

### GET /api/v1/jobs
Lists all migration jobs.

**Response:** Array of job objects (empty array if no jobs)

### POST /api/v1/jobs
Creates a new migration job.

**Required Fields:**
- `jdbcConnectionDetails` (object, required) - Source database connection
- `mongodbConnectionDetails` (object, required) - Target MongoDB connection
- `projectId` (string, required)
- `options` (object, required) - Job configuration options
- `verification` (object, required) - Verification settings

### GET /api/v1/jobs/{jobId}
Returns job details. Returns empty response if job doesn't exist.

### GET /api/v1/jobs/{jobId}/logs
Returns job execution logs.

**Response Example (no logs):**
```json
{
  "jobId": "test-job-id",
  "message": "There were no log files for job with id: test-job-id",
  "description": null,
  "timestamp": "2026-02-12T17:46:30.458612Z"
}
```

---

## Supported Database Types

Based on `/api/v1/info` response:

| Type | Display Name | JDBC Driver Required |
|------|--------------|---------------------|
| `POSTGRESQL` | PostgreSQL | postgresql-*.jar |
| `MYSQL` | MySQL | mysql-connector-*.jar |
| `ORACLE` | Oracle | ojdbc*.jar |
| `SQL_SERVER` | SQL Server | mssql-jdbc-*.jar |
| `DB2` | Db2 | db2jcc*.jar |
| `SYBASE` | Sybase ASE | jconn*.jar |
| `SYBASEIQ` | SybaseIQ | jconn*.jar |
| `COCKROACHDB` | Cockroach DB | postgresql-*.jar |
| `YUGABYTE` | Yugabyte | postgresql-*.jar |
| `SQLANYWHERE` | SQL Anywhere | sajdbc*.jar |

---

## Error Response Format

Standard error response structure:

```json
{
  "jobId": "string|null",
  "message": "Human-readable error message",
  "description": "string|null",
  "timestamp": "ISO8601 timestamp|null"
}
```

Spring Boot error format (for 4xx/5xx errors):

```json
{
  "timestamp": "ISO8601 timestamp",
  "status": 400,
  "error": "Bad Request",
  "path": "/api/v1/endpoint"
}
```

---

## Endpoints Still To Discover

Based on product features, these endpoints likely exist but were not found:

| Feature | Expected Endpoints |
|---------|-------------------|
| Code Generation | GET/POST `/api/v1/codegen/*` |
| Query Converter | POST `/api/v1/query-converter/*` |
| Export to JSON | GET `/api/v1/project/{id}/export/json/*` |
| Job Script | GET `/api/v1/project/{id}/job/script` |
| Job Preview | GET `/api/v1/project/{id}/job/preview` |

---

## MongoDB Field Type Mappings

Based on project mapping data:

| Source SQL Type | MongoDB Target Type |
|-----------------|---------------------|
| smallint | INTEGER |
| integer | INTEGER |
| character | STRING |
| text | STRING |
| varchar | STRING |
| real | DECIMAL |
| date | DATE |
| bytea | BIN_DATA |
| (auto-generated) | OBJECT_ID |

---

## Next Steps for Full API Discovery

1. **Obtain OpenAPI Spec** - The API likely has an OpenAPI spec at a non-standard location
2. **Network Traffic Analysis** - Use browser dev tools while using the UI to capture actual API calls
3. **Contact MongoDB** - Request official API documentation
4. **Test More Endpoints** - Continue systematic exploration of path variations

---

## Notes

- XSRF token is set via cookie but not required for GET requests
- Content-Type: application/json for all POST/PUT requests
- No authentication required by default (local deployment)
- SPA fallback returns HTML for unknown routes
