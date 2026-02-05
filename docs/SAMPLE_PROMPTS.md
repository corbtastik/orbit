# OrbitAI Sample Prompts

Sample prompts for testing OrbitAI's MCP server tools. These cover Atlas Admin API operations, MongoDB database operations, combined workflows, and guided data exploration.

## Atlas API / Infrastructure Operations

Prompts that exercise the existing 41 Atlas Admin API tools.

1. "Create an M10 cluster named `staging-east` in my project on AWS us-east-1 with 3 nodes and auto-scaling up to M30."
2. "Show me all database users across my projects that have the `atlasAdmin` role and tell me which ones don't have IP restrictions."
3. "Pause all non-production clusters in my org that have the tag `env:dev` to save costs over the weekend."
4. "Set up a backup schedule for my `prod-analytics` cluster with daily snapshots retained for 7 days and weekly snapshots retained for 4 weeks."
5. "Add a network peering connection between my Atlas project and my AWS VPC `vpc-0abc123` in us-west-2, then add the CIDR block to the IP access list."

## MongoDB Database Operations

Prompts that exercise the 23 database tools via the MongoDB Node.js driver.

1. "Connect to my local MongoDB and find all documents in the `orders` collection where `status` is `pending` and `total` is greater than 500, sorted by `createdAt` descending, limit 20."
2. "Run an aggregation on `analytics.events` that groups by `eventType`, counts occurrences, and computes the average `duration` for each type, sorted by count descending."
3. "Show me the schema of the `users` collection in the `appdb` database — I want to understand the shape of the documents before writing queries."
4. "Create an index on `orders.customerId` and `orders.createdAt` as a compound index, then explain a find query that filters on both fields to confirm it's using the index."
5. "Delete all documents in `logs.requests` where `timestamp` is older than 2025-01-01, then show me the storage size of the collection to see how much space we freed."

## Combined Atlas Infra + Database Operations

Prompts that chain Atlas Admin API tools with database tools.

1. "Create a new M10 Flex cluster called `demo-store` on AWS, then once it's ready connect to it and create a `products` collection with sample data — 10 electronics items with name, price, and category fields."
2. "List all my Atlas clusters, connect to the `prod-west` cluster, then run `db-stats` on every database to give me a storage usage report across the whole cluster."
3. "Check the performance advisor recommendations for my `analytics` cluster, then connect to it and create the suggested indexes on the `events` collection."
4. "Show me the alerts firing on my `prod-main` cluster, then connect to it and run an explain on the slow query from the alert to see if it's missing an index."
5. "Spin up a new M20 cluster named `migration-target` in the same region as my `legacy-app` cluster, connect to `legacy-app`, export all documents from `app.customers`, then connect to `migration-target` and insert them."

## Data Explorer Workflow

Prompts that exercise the `data_explorer` guided prompt for discovering unfamiliar databases.

1. "I just inherited a MongoDB instance at `mongodb+srv://reader@cluster0.abc.mongodb.net` — walk me through what's in there. What databases exist, what collections are in each, and show me sample documents from the largest collections."
2. "Connect to our staging database and explore the `ecommerce` database. I need to understand the data model — show me the schema for every collection and how they relate to each other."
3. "I need to audit our `billing` database. List all collections, show me the indexes on each, then sample 5 documents from each collection so I can check for PII fields."
4. "Explore the `iot_platform` database — show me collection storage sizes, document counts, and schemas. I'm trying to figure out which collections are growing fastest and whether they're indexed properly."
5. "Connect to production read-only and give me a full inventory: databases, collections per database, document counts, storage sizes, and flag any collections over 10GB that are missing indexes on commonly filtered fields."
