# Relational Migrator Demo — 10 Minutes

A hands-on demo showing OrbitAI's Relational Migrator integration for AI-assisted database migrations.

**Scenario:** Migrate a PostgreSQL e-commerce database to MongoDB using natural language commands.

## Prerequisites

1. **MongoDB Relational Migrator** — Download from [mongodb.com/try/download/relational-migrator](https://www.mongodb.com/try/download/relational-migrator)
2. **Running RM instance** — Start Relational Migrator (default: `http://127.0.0.1:8278`)
3. **Source database** — PostgreSQL, MySQL, Oracle, SQL Server, DB2, or Sybase
4. **Target MongoDB** — Local instance or Atlas cluster

## Setup

```bash
# Enable Relational Migrator integration
export ORBIT_RM_ENABLED=true
export ORBIT_RM_URL="http://127.0.0.1:8278"

# Start the OrbitAI MCP server
npm run mcp

# Or start in HTTP mode for the CLI
ORBIT_MCP_HTTP=true npm run mcp
```

---

## Demo Script

### Act 1: Check System Health (30 sec)

**Prompt 1:**
```
Is Relational Migrator running? Show me the system info.
```

*Expected: Returns RM version, health status, and available JDBC drivers*

> "First, let's verify Relational Migrator is running and healthy. OrbitAI can talk directly to the RM API."

---

### Act 2: List Existing Connections (30 sec)

**Prompt 2:**
```
Show me the configured JDBC and MongoDB connections in Relational Migrator
```

*Expected: Lists any pre-configured database connections*

> "RM stores connection configurations separately from projects. Let's see what's already set up."

---

### Act 3: Create JDBC Connection (60 sec)

**Prompt 3:**
```
Create a JDBC connection to my PostgreSQL database:
- Name: ecommerce-postgres
- Host: localhost
- Port: 5432
- Database: ecommerce
- Username: postgres
- Password: postgres123
```

*Expected: Creates and tests the JDBC connection*

> "We're connecting to our source PostgreSQL database. RM will test the connection automatically."

---

### Act 4: Create MongoDB Connection (60 sec)

**Prompt 4:**
```
Create a MongoDB connection to my local instance:
- Name: target-mongodb
- Connection string: mongodb://localhost:27017
```

*Expected: Creates and tests the MongoDB connection*

> "Now we set up our target MongoDB. This could be Atlas — just use a connection string."

---

### Act 5: Discover Source Schema (90 sec)

**Prompt 5:**
```
Discover the schema from my ecommerce-postgres connection. Show me the tables and their relationships.
```

*Expected: Runs schema discovery, returns tables with columns and foreign keys*

> "Schema discovery is the foundation of any migration. RM analyzes the source database structure and identifies relationships."

---

### Act 6: Create Migration Project (60 sec)

**Prompt 6:**
```
Create a new Relational Migrator project called "ecommerce-migration" using the ecommerce-postgres source and target-mongodb destination
```

*Expected: Creates project with connections linked*

> "Projects in RM contain the mapping rules and migration configuration. We're creating one for our e-commerce migration."

---

### Act 7: Get Schema Recommendations (90 sec)

**Prompt 7:**
```
Show me the schema recommendations for my ecommerce-migration project. What embedding strategies does RM suggest?
```

*Expected: Returns MongoDB schema suggestions based on source schema analysis*

> "This is where RM shines — it recommends how to transform relational tables into MongoDB documents, suggesting embedding vs referencing based on relationships."

---

### Act 8: Create Migration Job (60 sec)

**Prompt 8:**
```
Create a snapshot migration job for the ecommerce-migration project. Include all tables.
```

*Expected: Creates a one-time migration job configuration*

> "We're setting up a snapshot migration — a one-time bulk transfer. For ongoing sync, you'd use CDC mode."

---

### Act 9: Monitor Job Status (45 sec)

**Prompt 9:**
```
What's the status of my migration jobs? Show me progress and any errors.
```

*Expected: Lists jobs with status, progress percentages, document counts*

> "RM tracks migration progress in real-time. You can see documents migrated, errors, and estimated time remaining."

---

### Act 10: View Analysis Report (45 sec)

**Prompt 10:**
```
Generate a pre-migration analysis report for my ecommerce-migration project
```

*Expected: Returns analysis of migration complexity, potential issues, recommendations*

> "Before running a production migration, always generate an analysis report. It identifies potential issues and data type incompatibilities."

---

## Timing Summary

| Act | Duration | Cumulative |
|-----|----------|------------|
| System Health | 30s | 0:30 |
| List Connections | 30s | 1:00 |
| Create JDBC | 60s | 2:00 |
| Create MongoDB | 60s | 3:00 |
| Discover Schema | 90s | 4:30 |
| Create Project | 60s | 5:30 |
| Recommendations | 90s | 7:00 |
| Create Job | 60s | 8:00 |
| Monitor Status | 45s | 8:45 |
| Analysis Report | 45s | 9:30 |

---

## Using MCP Prompts

OrbitAI includes specialized prompts for complex migration workflows:

### Migration Planner Prompt
```
Use the migration_planner prompt for:
- Source: postgresql
- Strategy: snapshot
```

*This guided workflow helps plan end-to-end migrations with best practices.*

### Schema Designer Prompt
```
Use the schema_designer prompt for project "abc123" with:
- Access patterns: "read orders with items, update customer profiles"
- Optimization: read-heavy
```

*This helps design optimal MongoDB schemas based on your access patterns.*

---

## Common Operations Quick Reference

### System Operations
```
Check RM health status
Show available JDBC drivers
Get environment information
```

### Connection Management
```
List all JDBC connections
Test the oracle-prod connection
Delete the old-mysql connection
```

### Project Operations
```
List my migration projects
Export the ecommerce-migration project
Copy project abc123 to a new project
```

### Job Management
```
Start the migration job for ecommerce-migration
Pause the running job
Resume the paused job
Show job logs for the last hour
```

### Schema Operations
```
Parse this DDL file and show me the schema
Refresh schema discovery for project abc123
```

---

## Environment Configuration

Add to `~/.orbit-ai/config.json`:

```json
{
  "relationalMigrator": {
    "enabled": true,
    "url": "http://127.0.0.1:8278",
    "timeout": 30000
  }
}
```

Or use environment variables:

```bash
export ORBIT_RM_ENABLED=true
export ORBIT_RM_URL="http://127.0.0.1:8278"
export ORBIT_RM_TIMEOUT=30000
```

---

## Supported Source Databases

| Database | JDBC Driver |
|----------|-------------|
| PostgreSQL | org.postgresql.Driver |
| MySQL | com.mysql.cj.jdbc.Driver |
| Oracle | oracle.jdbc.OracleDriver |
| SQL Server | com.microsoft.sqlserver.jdbc.SQLServerDriver |
| IBM DB2 | com.ibm.db2.jcc.DB2Driver |
| Sybase | com.sybase.jdbc4.jdbc.SybDriver |

---

## Tips for Production Migrations

1. **Always run analysis first** — Identify issues before migrating
2. **Test with a subset** — Migrate one table first to validate mappings
3. **Monitor resources** — Large migrations can be resource-intensive
4. **Use CDC for live systems** — Minimize downtime with change data capture
5. **Backup everything** — Always have rollback options
