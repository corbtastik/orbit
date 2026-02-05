# Demo: Orbit with Claude Code (5 min)

## Pre-Demo Setup

1. Local MongoDB running on `localhost:27017`
2. Atlas API credentials configured
3. Claude Code connected to Orbit MCP server
4. Environment variables set:
   ```bash
   export MONGODB_CONN_LOCAL="mongodb://localhost:27017"
   export MONGODB_CONN_ATLAS="mongodb+srv://user:pass@cluster.mongodb.net"  # Set after cluster creation
   ```

---

## Demo Flow

### Opening (30 sec)

**You say**: "I'm going to show you Orbit - an AI-powered MongoDB mission control. I can manage both local MongoDB databases and MongoDB Atlas infrastructure using natural language through Claude Code."

**Prompt**:
```
List my available MongoDB connections
```

*Expected: Shows local connection is registered*

---

### Act 1: Build Local Database (1.5 min)

**You say**: "Let's start by building a telco customer database locally."

**Prompt 1**:
```
Connect to my local MongoDB and create a database called orbit-telco
```

**Prompt 2**:
```
Create a plans collection in orbit-telco with these service plans:

[
  { "_id": "plan_unlimited_pro", "name": "Unlimited Pro", "type": "postpaid", "monthlyRate": 85.00, "dataLimit": null, "features": ["5G", "hotspot_50gb", "hd_streaming"] },
  { "_id": "plan_unlimited_basic", "name": "Unlimited Basic", "type": "postpaid", "monthlyRate": 65.00, "dataLimit": null, "features": ["5G", "hotspot_10gb"] },
  { "_id": "plan_family_share", "name": "Family Share 100GB", "type": "postpaid", "monthlyRate": 120.00, "dataLimit": 102400, "features": ["5G", "multi_line_discount"] },
  { "_id": "plan_prepaid_30", "name": "Prepaid 30", "type": "prepaid", "monthlyRate": 30.00, "dataLimit": 5120, "features": ["4G"] },
  { "_id": "plan_prepaid_50", "name": "Prepaid 50", "type": "prepaid", "monthlyRate": 50.00, "dataLimit": 15360, "features": ["5G"] },
  { "_id": "plan_business_elite", "name": "Business Elite", "type": "postpaid", "monthlyRate": 95.00, "dataLimit": null, "features": ["5G", "priority_support", "international_roaming"] }
]
```

**Prompt 3**:
```
Now create a customers collection with these subscribers:

[
  { "_id": "cust_1001", "firstName": "Maria", "lastName": "Santos", "planId": "plan_unlimited_pro", "region": "northeast", "accountStatus": "active" },
  { "_id": "cust_1002", "firstName": "James", "lastName": "Chen", "planId": "plan_family_share", "region": "west", "accountStatus": "active" },
  { "_id": "cust_1003", "firstName": "Aisha", "lastName": "Patel", "planId": "plan_prepaid_50", "region": "south", "accountStatus": "active" },
  { "_id": "cust_1004", "firstName": "Robert", "lastName": "Kim", "planId": "plan_business_elite", "region": "west", "accountStatus": "active" },
  { "_id": "cust_1005", "firstName": "Sofia", "lastName": "Rodriguez", "planId": "plan_unlimited_basic", "region": "south", "accountStatus": "active" },
  { "_id": "cust_1006", "firstName": "David", "lastName": "Thompson", "planId": "plan_prepaid_30", "region": "midwest", "accountStatus": "active" },
  { "_id": "cust_1007", "firstName": "Emily", "lastName": "Okonkwo", "planId": "plan_unlimited_pro", "region": "northeast", "accountStatus": "active" },
  { "_id": "cust_1008", "firstName": "Michael", "lastName": "Brown", "planId": "plan_business_elite", "region": "northeast", "accountStatus": "active" },
  { "_id": "cust_1009", "firstName": "Lisa", "lastName": "Nguyen", "planId": "plan_family_share", "region": "west", "accountStatus": "active" },
  { "_id": "cust_1010", "firstName": "Carlos", "lastName": "Mendez", "planId": "plan_prepaid_50", "region": "south", "accountStatus": "suspended" }
]
```

**Prompt 4**:
```
Create a billing collection with January charges for these customers:

[
  { "_id": "bill_1001_2024_01", "customerId": "cust_1001", "period": "2024-01", "planCharge": 85.00, "roamingCharge": 0, "taxes": 7.23, "totalDue": 92.23, "status": "paid" },
  { "_id": "bill_1002_2024_01", "customerId": "cust_1002", "period": "2024-01", "planCharge": 120.00, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid" },
  { "_id": "bill_1003_2024_01", "customerId": "cust_1003", "period": "2024-01", "planCharge": 50.00, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "paid" },
  { "_id": "bill_1004_2024_01", "customerId": "cust_1004", "period": "2024-01", "planCharge": 95.00, "roamingCharge": 85.00, "taxes": 15.30, "totalDue": 195.30, "status": "paid" },
  { "_id": "bill_1005_2024_01", "customerId": "cust_1005", "period": "2024-01", "planCharge": 65.00, "roamingCharge": 0, "taxes": 5.53, "totalDue": 70.53, "status": "paid" },
  { "_id": "bill_1006_2024_01", "customerId": "cust_1006", "period": "2024-01", "planCharge": 30.00, "roamingCharge": 0, "taxes": 2.55, "totalDue": 32.55, "status": "paid" },
  { "_id": "bill_1007_2024_01", "customerId": "cust_1007", "period": "2024-01", "planCharge": 85.00, "roamingCharge": 5.00, "taxes": 7.65, "totalDue": 97.65, "status": "paid" },
  { "_id": "bill_1008_2024_01", "customerId": "cust_1008", "period": "2024-01", "planCharge": 95.00, "roamingCharge": 150.00, "taxes": 20.83, "totalDue": 265.83, "status": "paid" },
  { "_id": "bill_1009_2024_01", "customerId": "cust_1009", "period": "2024-01", "planCharge": 120.00, "roamingCharge": 0, "taxes": 10.20, "totalDue": 130.20, "status": "paid" },
  { "_id": "bill_1010_2024_01", "customerId": "cust_1010", "period": "2024-01", "planCharge": 50.00, "roamingCharge": 0, "taxes": 4.25, "totalDue": 54.25, "status": "overdue" }
]
```

---

### Act 2: Query Local (45 sec)

**You say**: "Now let's query our data with natural language."

**Prompt 5** (Simple):
```
Show me all customers on unlimited plans in the orbit-telco database
```

**Prompt 6** (Analytical):
```
Calculate total revenue by plan type for January in orbit-telco. Join billing with customers and plans to get plan types.
```

*Expected: Shows aggregation with postpaid vs prepaid revenue breakdown*

---

### Act 3: Provision Atlas (45 sec)

**You say**: "Now let's provision a production cluster on MongoDB Atlas."

**Prompt 7**:
```
Create an M10 cluster called telco-prod in AWS us-east-1 for my Atlas project
```

*Note: If demo timing is tight, have cluster pre-created and just show:*
```
List my Atlas clusters and their status
```

---

### Act 4: Migrate to Atlas (1 min)

**You say**: "With both connections available, I can migrate data between them."

**Prompt 8**:
```
Connect to my Atlas cluster and list available connections
```

**Prompt 9**:
```
Copy the plans, customers, and billing collections from local orbit-telco to Atlas orbit-telco database
```

**Prompt 10**:
```
Verify the migration - count documents in each collection on both local and Atlas
```

---

### Act 5: Atlas Management (45 sec)

**You say**: "Orbit also gives me full Atlas administrative capabilities."

**Prompt 11**:
```
Show my Atlas billing summary for this organization
```

**Prompt 12**:
```
Run a security audit - show all database users and IP access list entries for my project
```

---

### Closing (15 sec)

**You say**: "With Orbit, I can manage the full lifecycle - from local development to production Atlas - all through natural language. No CLI commands to memorize, no console navigation. Just describe what you need."

---

## Quick Recovery Prompts

If something goes wrong, use these:

- "List databases on local connection"
- "Show collections in orbit-telco"
- "What Atlas clusters do I have?"
- "Show my Atlas projects"

---

## Key Points to Emphasize

1. **Multi-connection**: Same tool works across local and Atlas
2. **Natural language**: No need to know MongoDB query syntax
3. **Full lifecycle**: Dev (local) → Production (Atlas) in one tool
4. **Admin + Dev**: Both database operations AND Atlas management
5. **Real queries**: Aggregations, joins, analytics - not just CRUD

---

## Cleanup

After the demo, remove everything we created:

**Prompt** (Drop local database):
```
Drop the orbit-telco database on local MongoDB
```

**Prompt** (Drop Atlas database):
```
Drop the orbit-telco database on Atlas
```

**Prompt** (Delete Atlas cluster):
```
Delete the telco-prod cluster from Atlas
```

**Prompt** (Verify cleanup):
```
List databases on local and list my Atlas clusters to confirm cleanup
```

### Manual Cleanup Commands (if needed)

If Orbit isn't available, use these directly:

```bash
# Local MongoDB
mongosh --eval "use orbit-telco" --eval "db.dropDatabase()"

# Atlas cluster (via Atlas CLI or Console)
atlas clusters delete telco-prod --projectId <your-project-id> --force
```
