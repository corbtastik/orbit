# OrbitAI — Post-Database-Tools TODO

Capabilities from the MongoDB MCP Server that are not yet implemented in OrbitAI. These should be prioritized after database tools testing is complete.

## Vector Search Support

The MongoDB MCP Server's `create-index` tool handles both standard and vector search indexes. Their implementation detects the index type based on the parameters passed in.

**What to implement:**
- Extend `create-index` to accept vector search index definitions (`type: "vectorSearch"`, `fields` with `dimensions`, `similarity`, `numCandidates`)
- Extend `drop-index` to handle vector search index deletion
- Add a `vector-search` tool or extend `find` to support `$vectorSearch` aggregation stage
- `collection-indexes` should already surface vector search indexes (verify with a live Atlas cluster)

**Reference:** [MongoDB Vector Search](https://www.mongodb.com/docs/atlas/atlas-vector-search/vector-search-overview/)

## Automatic Embedding Generation

The MongoDB MCP Server's `insert-many` tool can auto-generate embeddings for fields that have vector search indexes, using Voyage AI embedding models.

**What to implement:**
- Accept an optional Voyage AI API key via `VOYAGE_AI_API_KEY` env var
- On `insert-many`, detect if the target collection has a vector search index
- If so, automatically generate embeddings for the indexed field before inserting
- Add a `voyage-ai` dependency or use their REST API directly

**Reference:** [Voyage AI Embeddings](https://docs.voyageai.com/docs/embeddings)

## Performance Advisor Tools (Atlas)

Four Atlas-side tools that surface index and query optimization recommendations directly from the Atlas Performance Advisor API.

**What to implement:**
- `list-cluster-suggested-indexes` — recommends indexes based on actual query patterns
- `list-drop-indexes` — identifies unused indexes that waste space and slow writes
- `list-schema-advice` — suggests data model improvements based on real data
- `list-slow-queries` — surfaces poorly performing queries

**Note:** These are Atlas Admin API operations, not database driver operations. They may already be partially covered by our existing `get_performance_advisor` Atlas tool — verify overlap before adding dedicated tools.

**Reference:** [Atlas Performance Advisor](https://www.mongodb.com/docs/atlas/performance-advisor/)

## Local Cluster Management

The MongoDB MCP Server can create and manage local MongoDB clusters using the `mongodb-atlas-local` Docker image, removing manual setup steps from local development.

**What to implement:**
- `create-local-cluster` — pull and run `mongodb-atlas-local` Docker image
- `list-local-clusters` — list running local clusters
- `stop-local-cluster` — stop a running local cluster
- Auto-connect to newly created local clusters
- Requires Docker to be installed and running

**Reference:** [Atlas Local Development](https://www.mongodb.com/docs/atlas/cli/current/atlas-cli-deploy-local/)

## Assistant / Knowledge Tools (Upcoming)

MongoDB is adding assistant tools that integrate with the MongoDB assistant for knowledge search and retrieval. These were previewed in the Winter 2026 blog post but may not be fully released yet.

**What to implement (when available):**
- `list-knowledge-sources` — retrieve available data sources from the MongoDB assistant
- `search-knowledge` — run natural language queries against the MongoDB assistant knowledge base

**Reference:** [MongoDB MCP Server Winter 2026](https://www.mongodb.com/company/blog/product-release-announcements/whats-new-mongodb-mcp-server-winter-2026-edition)
