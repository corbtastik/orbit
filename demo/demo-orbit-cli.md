# Demo: orbit-cli (5 min)

## Pre-Demo Setup

1. Local MongoDB running on `localhost:27017`
2. Atlas API credentials configured in environment
3. Environment variables set:
   ```bash
   export ATLAS_PUBLIC_KEY="your-public-key"
   export ATLAS_PRIVATE_KEY="your-private-key"
   export ATLAS_GROUP_ID="your-project-id"
   export MONGODB_CONN_LOCAL="mongodb://localhost:27017"
   export MONGODB_CONN_ATLAS="mongodb+srv://user:pass@cluster.mongodb.net"
   export ANTHROPIC_API_KEY="your-key"  # or use other provider
   ```
4. Terminal with good font size for demo visibility

---

## Demo Flow

### Opening (30 sec)

**You say**: "I'm going to show you orbit-ai - a terminal-native AI shell for MongoDB. It works with multiple LLM providers and gives you conversational access to both MongoDB databases and Atlas infrastructure."

**Command**:
```bash
orbit-ai
```

*Shows gradient banner, enters interactive mode*

**Prompt**:
```
/config
```

*Shows current configuration - provider, model, Atlas settings*

---

### Act 1: Build Local Database (1.5 min)

**You say**: "Let's build a telco customer database from scratch."

**Prompt 1**:
```
Connect to local MongoDB and create a database called orbit-telco with a plans collection containing these service plans:

[
  { "_id": "plan_unlimited_pro", "name": "Unlimited Pro", "type": "postpaid", "monthlyRate": 85.00, "features": ["5G", "hotspot_50gb"] },
  { "_id": "plan_unlimited_basic", "name": "Unlimited Basic", "type": "postpaid", "monthlyRate": 65.00, "features": ["5G", "hotspot_10gb"] },
  { "_id": "plan_family_share", "name": "Family Share", "type": "postpaid", "monthlyRate": 120.00, "features": ["5G", "multi_line"] },
  { "_id": "plan_prepaid_30", "name": "Prepaid 30", "type": "prepaid", "monthlyRate": 30.00, "features": ["4G"] },
  { "_id": "plan_business_elite", "name": "Business Elite", "type": "postpaid", "monthlyRate": 95.00, "features": ["5G", "international_roaming"] }
]
```

**Prompt 2**:
```
Add a customers collection with these subscribers:

[
  { "_id": "cust_1001", "firstName": "Maria", "lastName": "Santos", "planId": "plan_unlimited_pro", "region": "northeast", "accountStatus": "active" },
  { "_id": "cust_1002", "firstName": "James", "lastName": "Chen", "planId": "plan_family_share", "region": "west", "accountStatus": "active" },
  { "_id": "cust_1003", "firstName": "Aisha", "lastName": "Patel", "planId": "plan_prepaid_30", "region": "south", "accountStatus": "active" },
  { "_id": "cust_1004", "firstName": "Robert", "lastName": "Kim", "planId": "plan_business_elite", "region": "west", "accountStatus": "active" },
  { "_id": "cust_1005", "firstName": "Sofia", "lastName": "Rodriguez", "planId": "plan_unlimited_basic", "region": "south", "accountStatus": "active" },
  { "_id": "cust_1006", "firstName": "Emily", "lastName": "Okonkwo", "planId": "plan_unlimited_pro", "region": "northeast", "accountStatus": "active" },
  { "_id": "cust_1007", "firstName": "Michael", "lastName": "Brown", "planId": "plan_business_elite", "region": "northeast", "accountStatus": "active" },
  { "_id": "cust_1008", "firstName": "Carlos", "lastName": "Mendez", "planId": "plan_prepaid_30", "region": "south", "accountStatus": "suspended" }
]
```

**Prompt 3**:
```
Add billing records for January:

[
  { "_id": "bill_1001", "customerId": "cust_1001", "period": "2024-01", "planCharge": 85.00, "roamingCharge": 0, "totalDue": 92.23, "status": "paid" },
  { "_id": "bill_1002", "customerId": "cust_1002", "period": "2024-01", "planCharge": 120.00, "roamingCharge": 0, "totalDue": 130.20, "status": "paid" },
  { "_id": "bill_1003", "customerId": "cust_1003", "period": "2024-01", "planCharge": 30.00, "roamingCharge": 0, "totalDue": 32.55, "status": "paid" },
  { "_id": "bill_1004", "customerId": "cust_1004", "period": "2024-01", "planCharge": 95.00, "roamingCharge": 85.00, "totalDue": 195.30, "status": "paid" },
  { "_id": "bill_1005", "customerId": "cust_1005", "period": "2024-01", "planCharge": 65.00, "roamingCharge": 0, "totalDue": 70.53, "status": "paid" },
  { "_id": "bill_1006", "customerId": "cust_1006", "period": "2024-01", "planCharge": 85.00, "roamingCharge": 5.00, "totalDue": 97.65, "status": "paid" },
  { "_id": "bill_1007", "customerId": "cust_1007", "period": "2024-01", "planCharge": 95.00, "roamingCharge": 150.00, "totalDue": 265.83, "status": "paid" },
  { "_id": "bill_1008", "customerId": "cust_1008", "period": "2024-01", "planCharge": 30.00, "roamingCharge": 0, "totalDue": 32.55, "status": "overdue" }
]
```

---

### Act 2: Query Local (45 sec)

**You say**: "Now let's query our data conversationally."

**Prompt 4** (Simple):
```
Show me all customers on unlimited plans
```

**Prompt 5** (Analytical):
```
What's the total revenue by plan type? Join billing with customers and plans.
```

*Shows aggregation result with pretty markdown formatting*

---

### Act 3: Provision Atlas (45 sec)

**You say**: "Let's provision a cluster on MongoDB Atlas."

**Prompt 6**:
```
Create an M10 cluster called telco-prod in AWS us-east-1
```

*Alternative if cluster exists:*
```
List my Atlas clusters with their status
```

---

### Act 4: Migrate to Atlas (1 min)

**You say**: "Now I'll migrate our local data to Atlas."

**Prompt 7**:
```
List my available MongoDB connections
```

**Prompt 8**:
```
Copy the orbit-telco database from local to Atlas - all collections
```

**Prompt 9**:
```
Verify the migration by comparing document counts between local and Atlas
```

---

### Act 5: Atlas Management + Provider Demo (1 min)

**You say**: "Orbit gives me full Atlas admin capabilities too."

**Prompt 10**:
```
Show my Atlas billing summary
```

**Prompt 11**:
```
Run a security audit - list database users and IP whitelist
```

*Exit and show one-shot + provider switching:*

```
/quit
```

**Command** (One-shot mode):
```bash
orbit-ai "How many customers are on each plan type in orbit-telco on Atlas?"
```

**Command** (Different provider - if configured):
```bash
orbit-ai --provider openai "List my Atlas projects"
```

---

### Closing (15 sec)

**You say**: "orbit-ai is terminal-native, works with multiple LLM providers, and gives you conversational control over the full MongoDB ecosystem - from local dev databases to production Atlas infrastructure."

---

## Shell Commands Reference

During demo, you can use these shell commands:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/config` | Show current configuration |
| `/clear` | Clear conversation history |
| `/quit` | Exit the shell |

---

## One-Shot Examples (Bonus)

If you have extra time, show these one-liners:

```bash
# Quick cluster check
orbit-ai "What's the status of my telco-prod cluster?"

# Security check
orbit-ai "Are there any database users with readWriteAnyDatabase role?"

# Cost query
orbit-ai "What were my Atlas charges last month?"

# With verbose output
orbit-ai --verbose "Count documents in customers collection on Atlas"
```

---

## Provider Switching (Bonus)

Show multi-provider support:

```bash
# Anthropic (default)
orbit-ai "List my clusters"

# OpenAI
orbit-ai --provider openai "List my clusters"

# Google
orbit-ai --provider google "List my clusters"

# Local Ollama
orbit-ai --provider ollama --model llama3.1 "List databases on local"
```

---

## Key Points to Emphasize

1. **Terminal-native**: Built for developers who live in the terminal
2. **Multi-provider**: Works with Anthropic, OpenAI, Google, Ollama
3. **Interactive + One-shot**: REPL mode or quick command-line queries
4. **Pretty output**: Markdown rendering makes responses readable
5. **Full lifecycle**: Local dev → Atlas production in one tool
6. **Scriptable**: Can be used in CI/CD pipelines and automation

---

## Quick Recovery

If something goes wrong:

```
/clear
```

Then start fresh with:
```
List databases on local connection
```

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

### One-Shot Cleanup (Alternative)

Run cleanup commands directly from terminal:

```bash
# Drop local database
orbit-ai "Drop the orbit-telco database on local"

# Drop Atlas database
orbit-ai "Drop the orbit-telco database on Atlas"

# Delete Atlas cluster
orbit-ai "Delete the telco-prod cluster"

# Verify
orbit-ai "List databases on local and list Atlas clusters"
```

### Manual Cleanup Commands (if needed)

If Orbit isn't available, use these directly:

```bash
# Local MongoDB
mongosh --eval "use orbit-telco" --eval "db.dropDatabase()"

# Atlas cluster (via Atlas CLI or Console)
atlas clusters delete telco-prod --projectId <your-project-id> --force
```
