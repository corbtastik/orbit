# OrbitAI TL;DR

## Main Use-Cases Orbit AI Solves

**1. MongoDB Atlas Infrastructure Management via Natural Language**
- Platform teams and DevOps engineers can manage Atlas clusters, security, monitoring, and backups through conversation instead of clicking through the Atlas UI or writing scripts
- Example: "Create a new M10 cluster in AWS us-east-1" or "Scale the production cluster to M30"


**2. Database Operations Without Writing Code**
- Query, insert, update, and delete documents conversationally
- Inspect schemas, run aggregations, export data
- Example: "Show me all users who signed up last week" or "Count documents in the orders collection"

**3. RDBMS-to-MongoDB Migration**
- Introspect relational schemas (PostgreSQL, MSSQL, SQLite)
- Design document mappings from tables to collections
- Preview transformations and execute migrations
- Example: "Connect to my Postgres database and show me the schema for the customers table"

---

## MCP Tool Categories

| Category | Tool Count | Purpose |
|----------|------------|---------|
| **Atlas Admin** | 41 | Manage Atlas infrastructure via Admin API |
| **MongoDB Database** | 19 | CRUD operations on MongoDB collections |
| **RDBMS Migration** | 7 | Schema introspection and data migration |

**Atlas Admin Tools (41)** - organized by domain:
- Clusters (dedicated, Flex, serverless, global, outages)
- Security (database users, roles, IP access lists, encryption, peering)
- Monitoring (metrics, alerts, performance advisor, events)
- Backups (cloud backup, shared tier, legacy)
- Services (Search indexes, Vector Search, Data Federation, Streams)
- Organizations & Projects (teams, API keys, service accounts)
- Billing & compliance

**MongoDB Database Tools (19):**
- Connection: `connect-mongodb`
- Read: `find`, `aggregate`, `count`, `collection-schema`, `list-collections`, `list-databases`, `get-index-info`
- Write: `insert-one`, `insert-many`, `replace-one`, `update-one`, `update-many`
- Delete: `delete-one`, `delete-many`
- Export: `export-json`, `aggregate-out`

**RDBMS Tools (7):**
- `connect-rdbms`, `introspect-schema`
- `create-mapping`, `update-mapping`, `validate-mapping`, `preview-document`
- `execute-mapping`, `list-mappings`, `delete-mapping`

---

## In Short

Orbit AI is a **MongoDB Atlas operations assistant** - it turns the Atlas Admin API and MongoDB driver into conversational tools so teams can manage infrastructure and data without context-switching to dashboards or writing boilerplate code.

## Prompts

### Clusters

```text
List all my Atlas clusters
Show me the configuration details for cluster "devdb"
Create a new M10 cluster named "dev-cluster" in AWS us-east-1
Scale cluster "devdb" to M20
Pause cluster "dev-cluster" to save costs
Remove cluster "dev-cluster"
Scale cluster "devdb" to back to M10
```

### Security

```text
List all database users in the project
Create a database user "app-user" with readWrite access to the "orders" database
Show the current IP access list
Add IP address 203.0.113.50 to the access list with comment "Office VPN"
List all custom database roles
Show network peering connections for this project
```

### Monitoring

```text
Show me performance metrics for cluster "production"
List all active alerts
Show performance advisor recommendations for cluster "production"
Get recent events for the project
List all configured alert integrations
```

### Backups

```text
List all cloud backup snapshots for cluster "production"
Show the backup schedule for cluster "production"
Restore cluster "production" from the most recent snapshot to a new cluster named "production-restore"
```
