# Orbit Demo Script — 5 Minutes

A cohesive demo showing Orbit's multi-connection MongoDB support and Atlas Admin API integration using Claude Code.

**Scenario:** Build a telco (Verizon-style) customer database locally, query it, then migrate to Atlas.

## Setup Before Recording

```bash
# Make sure everything is built
npm run build

# Start the MCP server (in a terminal you won't show)
npm run mcp
```

Ensure Claude Code is connected to the Orbit MCP server.

---

## Demo Script

### Opening (15 sec)

*Show Claude Code interface*

> "I'm going to show you Orbit — an MCP server that gives Claude full control over MongoDB, both local databases and Atlas cloud infrastructure. Let's build a telco customer database from scratch."

---

### Act 1: Discover Connections (30 sec)

**Prompt 1:**
```
List my available MongoDB connections
```

*Expected: Shows "local" and "atlas" connections, both registered but not connected*

> "Orbit automatically picked up my connection strings from environment variables. I have a local MongoDB and an Atlas cluster ready to go."

---

### Act 2: Build Local Database (90 sec)

**Prompt 2:**
```
On my local connection, create a database called "verizon" with three collections: customers, plans, and usage. Then populate them with sample data:

- plans: 3 mobile plans (Basic $35, Plus $55, Premium $85) with data limits and features
- customers: 5 customers with names, emails, phone numbers, and plan references
- usage: Current month usage records for each customer showing data_gb, minutes, and texts
```

*Expected: Creates collections, inserts ~13 documents total, shows the inserted data*

> "Claude just created our entire schema and populated it with realistic telco data — customers, their plans, and this month's usage."

---

### Act 3: Query Local Data (45 sec)

**Prompt 3:**
```
On local, show me which customers are over 80% of their data limit this month. Include their name, plan, and usage.
```

*Expected: Aggregation joining customers → plans → usage, filtering by data threshold*

> "This is a real query a telco would run to identify customers at risk of overage charges."

---

### Act 4: Atlas Admin Operations (45 sec)

**Prompt 4:**
```
Show me my Atlas projects and the clusters in each one
```

*Expected: Lists Atlas projects and clusters via the Admin API*

> "Now let's look at our cloud infrastructure. Orbit also has full Atlas Admin API coverage — I can manage clusters, users, backups, all through natural language."

---

### Act 5: Migrate to Atlas (60 sec)

**Prompt 5:**
```
Migrate the entire verizon database from local to atlas. Export all collections from local and import them to a new verizon database on atlas.
```

*Expected: Exports 3 collections from local, inserts into atlas*

> "Data migration between environments — local dev to cloud production — in one sentence."

---

### Act 6: Verify Migration (30 sec)

**Prompt 6:**
```
On atlas, count the documents in each collection in the verizon database and show me one sample customer with their plan details
```

*Expected: Shows counts matching local, displays a joined customer record*

> "Same data, now running in Atlas. The multi-connection feature lets Claude work across environments seamlessly."

---

### Closing (15 sec)

> "That's Orbit — database operations, Atlas administration, and cross-environment workflows, all through natural conversation. Check it out on GitHub."

---

## Timing Summary

| Act | Duration | Cumulative |
|-----|----------|------------|
| Opening | 15s | 0:15 |
| Connections | 30s | 0:45 |
| Build DB | 90s | 2:15 |
| Query | 45s | 3:00 |
| Atlas Admin | 45s | 3:45 |
| Migration | 60s | 4:45 |
| Verify | 30s | 5:15 |
| Closing | 15s | 5:30 |

*Buffer for Claude response time. Cut any section if running long.*

---

## Backup Prompts (if time)

```
Create an index on customers.email for faster lookups
```

```
Show me the query execution plan for finding customers by phone number
```

```
What's the total revenue per plan based on current customer counts?
```

---

## Environment Setup

Your `.env` file should have:

```bash
# Atlas Admin API
ATLAS_PUBLIC_KEY="your-key"
ATLAS_PRIVATE_KEY="your-key"

# Named connections
MONGODB_CONN_LOCAL="mongodb://localhost:27017"
MONGODB_CONN_ATLAS="mongodb+srv://user:pass@cluster.mongodb.net/..."
```

These create connection names `local` and `atlas` that the prompts reference.

## Mongoball DEMO

I want to refine what we are doing for a demo of OrbitAI. These are the things I want to show in the demo (I'm listing them in no specifc order).

- Show creating a local MongoDB database, populating a schema (documents), creating indexes
- Show creating 5 users with roles/perms: adminUser (root on admin), powerUser (dbAdminAnyDatabase on admin, readWriteAnyDatabase on admin)
- Use the mongoball data set: ~/dev/github/corbtastik/mongoball
- Run 10 demo queries on mongoball, ranging from simple, medium to difficult
- Show creating an Atlas MongoDB M10 Cluster on Azure, southcentralus region, called orbit-demo
- Show creating a database admin user for orbit-demo cluster, add my IP to the whitelist
- Show migrating the local mongoball database to Atlas orbit-demo cluster
- Show connecting and running the demo queries on mongoball on Atlas orbit-demo cluster
- Show adding a readonly replica on the orbit-demo cluster
- Show running 10 other Atlas commands on the platform (security audit, billing, performance etc)
- Show a few operations accross both the local MongoDB instance and the Atlas cluster to showcase the unified control plan aspects of Orbit
- Lastly reset/teardown everything so that the environments are like they were before.
