# OrbitAI TL;DR

## Main Use-Cases

**1. MongoDB Atlas Infrastructure Management via Natural Language**

Platform teams and DevOps engineers can manage Atlas clusters, security, monitoring, and backups through conversation instead of clicking through the Atlas UI or writing scripts.

**2. Database Operations Without Writing Code**

Query, insert, update, and delete documents conversationally. Inspect schemas, run aggregations, and export data.

**3. RDBMS-to-MongoDB Migration**

Introspect relational schemas (PostgreSQL, MSSQL, SQLite, MySQL, Oracle), design document mappings from tables to collections, preview transformations, and execute migrations.

---

## MCP Tool Categories

| Category | Tool Count | Purpose |
|----------|------------|---------|
| **Atlas Admin** | 41 | Manage Atlas infrastructure via Admin API |
| **MongoDB Database** | 25 | CRUD operations on MongoDB collections |
| **RDBMS Migration** | 20 | Schema introspection and data migration |
| **Total** | **86** | |

### Atlas Admin Tools (41)

Organized by domain:

- **Clusters**: dedicated, Flex, serverless, global, outage simulation
- **Organizations & Projects**: teams, API keys, service accounts, cloud users
- **Security**: database users, custom roles, IP access lists, network peering, private endpoints, authentication, encryption
- **Monitoring**: metrics, alerts, performance advisor, events, integrations
- **Backups**: cloud backup, shared tier, legacy
- **Services**: Atlas Search, Vector Search, Data Federation, Data Lake, Online Archive, Streams
- **Billing**: invoices, cost explorer
- **Infrastructure**: maintenance windows, log export, resource policies
- **Compliance**: auditing
- **Migration**: live migration

### MongoDB Database Tools (25)

- **Connection**: `list-connections`, `connect`, `disconnect`
- **Metadata**: `list-databases`, `list-collections`, `collection-indexes`, `collection-schema`, `collection-storage-size`, `db-stats`, `mongodb-logs`
- **Read**: `find`, `aggregate`, `count`, `explain`, `export`
- **Write**: `insert-many`, `create-index`, `create-collection`, `aggregate-out`
- **Update**: `update-many`, `rename-collection`
- **Delete**: `delete-many`, `drop-collection`, `drop-database`, `drop-index`
- **File**: `write-json`

### RDBMS Migration Tools (20)

- **Connection**: `connect-rdbms`, `disconnect-rdbms`, `list-rdbms`
- **Schema**: `introspect-schema`, `analyze-relationships`, `recommend-patterns`
- **Mapping**: `create-mapping`, `update-mapping`, `preview-document`, `validate-mapping`, `list-mappings`, `delete-mapping`
- **Migration**: `estimate-migration`, `migrate-collection`, `migrate-all`, `verify-migration`
- **Utility**: `generate-indexes`, `generate-validation`, `export-mapping`, `import-mapping`

---

## In Short

OrbitAI is a **MongoDB Atlas operations assistant** that turns the Atlas Admin API and MongoDB driver into conversational tools so teams can manage infrastructure and data without context-switching to dashboards or writing boilerplate code.

---

## Demo Prompts

### Atlas: Clusters

```text
List all my Atlas clusters
Show me the configuration details for cluster "devdb"
Create a new M10 cluster named "dev-cluster" in AWS us-east-1
Scale cluster "devdb" to M20
Pause cluster "dev-cluster" to save costs
Remove cluster "dev-cluster"
Scale cluster "devdb" back to M10
```

### Atlas: Security

```text
List all database users in the project
Create a database user "app-user" with readWrite access to the "orders" database
Show the current IP access list
Add IP address 203.0.113.50 to the access list with comment "Office VPN"
List all custom database roles
Show network peering connections for this project
```

### Atlas: Monitoring

```text
Show me performance metrics for cluster "production"
List all active alerts
Show performance advisor recommendations for cluster "production"
Get recent events for the project
List all configured alert integrations
```

### Atlas: Backups

```text
List all cloud backup snapshots for cluster "production"
Show the backup schedule for cluster "production"
Restore cluster "production" from the most recent snapshot to a new cluster named "production-restore"
```

### Database: Connection

```text
List all available MongoDB connections
Connect to the "local" MongoDB connection
Connect to the "atlas" MongoDB connection
Show the current MongoDB connection status
```

### Database: Query

```text
List all databases on the connected MongoDB instance
Show all collections in the "app" database
Show me the schema for the "users" collection
Count documents in the "orders" collection
Find all documents in the "users" collection
Find users where status is "active"
Find the 10 most recent orders
Find products with price greater than 100
Get index information for the "orders" collection
```

### Database: Aggregations

```text
Count orders grouped by status
Calculate the average order total by customer
Find the top 5 customers by total spend
Show monthly sales totals for 2024
Aggregate users by signup month
Find duplicate email addresses in the users collection
```

### Database: Insert

```text
Insert a new user with name "John Doe" and email "john@example.com"
Insert multiple products into the "products" collection
Add a new order for customer "cust123" with total 99.99
```

### Database: Update

```text
Update user with email "john@example.com" to set status "verified"
Set all orders with status "pending" older than 30 days to "expired"
Increment the "loginCount" field for user "user123"
Add a tag "premium" to all products with price over 500
```

### Database: Delete

```text
Delete the user with email "test@example.com"
Remove all orders with status "cancelled"
Delete products where inventory is 0
```

### Database: Export

```text
Export the "users" collection to JSON
Export all orders from the last 30 days to a file
Export products with category "electronics" to JSON
```

---

## Tool Test Prompts

Complete test prompts for all 86 tools with requirements.

### Atlas Admin API Tools (41 Tools)

**Global Requirements:**
- Valid Atlas API credentials configured
- Optional: `atlasProfile` parameter for multi-org testing

#### Cluster & Deployment Management

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_clusters` | `List all clusters in my Atlas project` | groupId |
| `manage_flex_clusters` | `List all Flex clusters in project` | groupId |
| `manage_serverless_instances` | `List all serverless instances` | groupId |
| `manage_global_clusters` | `Show global cluster zone mappings for cluster "global-prod"` | groupId, global cluster |
| `simulate_cluster_outage` | `Show outage simulation status for cluster "devdb"` | groupId, cluster name |

#### Organization & Project Administration

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_organizations` | `List all my Atlas organizations` | None |
| `manage_projects` | `List all projects in my organization` | orgId |
| `manage_teams` | `List all teams in my organization` | orgId |
| `manage_api_keys` | `List all API keys for this organization` | orgId |
| `manage_service_accounts` | `List service accounts in my organization` | orgId |
| `manage_cloud_users` | `List all cloud users in my organization` | orgId |

#### Security & Access Control

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_database_users` | `List all database users in the project` | groupId |
| `manage_custom_roles` | `List all custom database roles` | groupId |
| `manage_ip_access_list` | `Show the current IP access list` | groupId |
| `manage_network_peering` | `List all VPC peering connections` | groupId |
| `manage_private_endpoints` | `List private endpoint services for AWS` | groupId |
| `manage_authentication` | `Show X.509 authentication configuration` | groupId |
| `manage_cloud_provider_access` | `List cloud provider access roles` | groupId |
| `manage_encryption` | `Show encryption at rest configuration` | groupId |

#### Monitoring & Alerting

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `get_monitoring_data` | `Show processes and hosts in the project` | groupId |
| `manage_alert_configs` | `List all alert configurations` | groupId |
| `manage_alerts` | `Show all active alerts` | groupId |
| `get_performance_advisor` | `Show performance advisor recommendations for cluster "devdb"` | groupId, cluster with activity |
| `get_events` | `Show recent events in the project` | groupId |
| `manage_collection_metrics` | `List pinned namespaces for monitoring` | groupId |
| `manage_integrations` | `List all third-party integrations` | groupId |

#### Backup & Disaster Recovery

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_cloud_backups` | `List backup snapshots for cluster "devdb"` | groupId, cluster with backups |
| `manage_shared_tier_backups` | `List backups for shared-tier cluster` | groupId, M2/M5/Flex cluster |
| `manage_legacy_backups` | `List legacy backup snapshots` | groupId, legacy backup cluster |

#### Atlas Services & Features

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_atlas_search` | `List Atlas Search indexes for cluster "devdb"` | groupId, cluster name |
| `manage_data_federation` | `List Data Federation instances` | groupId |
| `manage_data_lake_pipelines` | `List data lake pipelines` | groupId |
| `manage_online_archive` | `List online archive configurations for cluster "devdb"` | groupId, cluster name |
| `manage_streams` | `List Atlas Stream Processing instances` | groupId |

#### Cost Management

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_billing` | `Show pending invoices for my organization` | orgId |

#### Network & Infrastructure

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_maintenance` | `Show maintenance window configuration` | groupId |
| `manage_log_export` | `List log export configurations` | groupId |
| `manage_resource_policies` | `List resource policies for the organization` | orgId |

#### Compliance & Governance

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_auditing` | `Show auditing configuration for the project` | groupId |

#### Migration

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `manage_live_migration` | `List live migration jobs` | groupId |

#### Platform

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `get_platform_info` | `Show Atlas system status and control plane IPs` | None |

---

### MongoDB Database Tools (25 Tools)

**Global Requirements:**
- MongoDB connection configured (`MONGODB_CONN_*` env var)

#### Connection Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `list-connections` | `List all available MongoDB connections` | At least one connection |
| `connect` | `Connect to the "local" MongoDB connection` | Connection registered |
| `disconnect` | `Disconnect from the current MongoDB connection` | Active connection |

#### Metadata Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `list-databases` | `List all databases on the MongoDB instance` | Active connection |
| `list-collections` | `Show all collections in the "app" database` | Database exists |
| `collection-indexes` | `List indexes on the "users" collection in "app" database` | Collection exists |
| `collection-schema` | `Infer schema for the "users" collection` | Collection with documents |
| `collection-storage-size` | `Show storage stats for "orders" collection` | Collection exists |
| `db-stats` | `Get statistics for the "app" database` | Database exists |
| `mongodb-logs` | `Show recent MongoDB server logs` | Active connection |

#### Read Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `find` | `Find all documents in "users" collection limit 10` | Collection with documents |
| `aggregate` | `Count documents in "orders" grouped by status` | Collection with documents |
| `count` | `Count all documents in the "products" collection` | Collection exists |
| `explain` | `Explain the query plan for finding users by email` | Collection exists |
| `export` | `Export the "users" collection to JSON` | Collection with documents |

#### Write Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `insert-many` | `Insert a test document into "test" collection with name "demo"` | Database exists, not read-only |
| `create-index` | `Create an index on "email" field in "users" collection` | Collection exists, not read-only |
| `create-collection` | `Create a new collection called "audit_logs"` | Database exists, not read-only |
| `aggregate-out` | `Aggregate orders by customer and output to "customer_totals"` | Collection with data, not read-only |

#### Update Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `update-many` | `Update all users with status "pending" to "active"` | Collection with docs, not read-only |
| `rename-collection` | `Rename collection "old_logs" to "archived_logs"` | Collection exists, not read-only |

#### Delete Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `delete-many` | `Delete all documents in "test" collection where type is "temp"` | Collection with docs, not read-only |
| `drop-collection` | `Drop the "temp_data" collection` | Collection exists, not read-only |
| `drop-database` | `Drop the "test_db" database` | Database exists, not read-only |
| `drop-index` | `Drop index "email_1" from "users" collection` | Index exists, not read-only |

#### File Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `write-json` | `Write users collection to /tmp/users.json` | Data to export, filesystem access |

---

### RDBMS Migration Tools (20 Tools)

**Global Requirements:**
- RDBMS source database (PostgreSQL, MSSQL, SQLite, MySQL, or Oracle)
- MongoDB target connection for migration execution

#### Connection Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `connect-rdbms` | `Connect to PostgreSQL at localhost:5432/mydb as user "postgres"` | RDBMS server running |
| `disconnect-rdbms` | `Disconnect from the RDBMS connection` | Active RDBMS connection |
| `list-rdbms` | `List all RDBMS connections` | None |

#### Schema Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `introspect-schema` | `Show schema for all tables in the connected database` | Active RDBMS connection |
| `analyze-relationships` | `Analyze foreign key relationships for the "orders" table` | RDBMS with foreign keys |
| `recommend-patterns` | `Recommend migration patterns for the "customers" table` | Table with relationships |

#### Mapping Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `create-mapping` | `Create a direct mapping for "customers" table to "customers" collection` | Table exists |
| `update-mapping` | `Update the "customers" mapping to embed "addresses"` | Existing mapping |
| `preview-document` | `Preview sample documents for the "customers" mapping` | Existing mapping |
| `validate-mapping` | `Validate the "orders" mapping configuration` | Existing mapping |
| `list-mappings` | `List all defined table mappings` | At least one mapping |
| `delete-mapping` | `Delete the "temp_mapping" mapping` | Existing mapping |

#### Migration Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `estimate-migration` | `Estimate migration size for "customers" mapping` | Existing mapping |
| `migrate-collection` | `Migrate the "customers" table using its mapping` | Mapping, both connections, not read-only |
| `migrate-all` | `Migrate all defined mappings` | Mappings, both connections, not read-only |
| `verify-migration` | `Verify the "customers" migration completed correctly` | Completed migration |

#### Utility Tools

| Tool | Test Prompt | Requirements |
|------|-------------|--------------|
| `generate-indexes` | `Generate index recommendations from RDBMS indexes for "orders" mapping` | Mapping with source indexes |
| `generate-validation` | `Generate JSON Schema validation for "customers" mapping` | Mapping with constraints |
| `export-mapping` | `Export all mappings to JSON` | At least one mapping |
| `import-mapping` | `Import mappings from the provided JSON` | Valid mapping JSON |

---

## Test Requirements Matrix

| Requirement | Tools Affected |
|-------------|----------------|
| **Atlas API credentials** | All 41 Atlas tools |
| **Atlas orgId** | 8 tools (org-level operations) |
| **Atlas groupId** | 33 tools (project-level operations) |
| **MongoDB connection** | All 25 database tools |
| **Database with data** | 15 database tools |
| **RDBMS connection** | All 20 RDBMS tools |
| **Not read-only mode** | 15 write tools |
| **Existing mapping** | 10 RDBMS tools |
