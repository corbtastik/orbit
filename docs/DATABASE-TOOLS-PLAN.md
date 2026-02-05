# Plan: Add MongoDB Database Tools to Orbit MCP Server

## Goal

Extend the Orbit MCP server to cover direct MongoDB database operations alongside the existing Atlas Admin API tools — one MCP server for all things MongoDB. Implement all 23 database tools from the MongoDB MCP Server.

## Approach: Separate Executor (Approach 2)

Keep the existing ActionMap/dispatch()/AtlasClient path untouched. Add a parallel database tool system with its own executor that routes through the MongoDB Node.js driver. The MCP server's CallToolRequest handler checks which type of tool is being called and routes accordingly.

**Why not extend ActionMap:** Database operations have fundamentally different parameter shapes (filter/projection/sort vs pipeline vs documents). The ActionMap pattern works for HTTP because all actions share `pathParams + query + body`. Database tools each need their own schema.

**Why individual tools, not action-enum:** Each database operation has unique parameters. `find` needs filter/projection/sort/limit. `aggregate` needs pipeline. `insert-many` needs documents. One tool per operation with a dedicated schema gives the LLM better guidance than a generic action enum with a catch-all params object.

## Database Tools to Implement (23)

### Connection (2)
| Tool | Driver Operation | Params |
|------|-----------------|--------|
| `connect` | `MongoClient.connect()` | connectionString |
| `switch-connection` | `MongoClient.connect()` | connectionString |

### Read (5)
| Tool | Driver Operation | Params |
|------|-----------------|--------|
| `find` | `collection.find()` | database, collection, filter?, projection?, sort?, limit?, skip? |
| `aggregate` | `collection.aggregate()` | database, collection, pipeline |
| `count` | `collection.countDocuments()` | database, collection, query? |
| `explain` | `cursor.explain()` | database, collection, method (find/aggregate/count), verbosity? |
| `export` | `collection.find()` / `.aggregate()` | database, collection, exportTarget, format? |

### Write (3)
| Tool | Driver Operation | Params |
|------|-----------------|--------|
| `insert-many` | `collection.insertMany()` | database, collection, documents |
| `create-index` | `collection.createIndex()` | database, collection, keys, options? |
| `create-collection` | `db.createCollection()` | database, collection |

### Update (2)
| Tool | Driver Operation | Params |
|------|-----------------|--------|
| `update-many` | `collection.updateMany()` | database, collection, filter, update, upsert? |
| `rename-collection` | `db.renameCollection()` | database, collection, newName, dropTarget? |

### Delete (4)
| Tool | Driver Operation | Params |
|------|-----------------|--------|
| `delete-many` | `collection.deleteMany()` | database, collection, filter? |
| `drop-collection` | `db.dropCollection()` | database, collection |
| `drop-database` | `db.dropDatabase()` | database |
| `drop-index` | `collection.dropIndex()` | database, collection, indexName |

### Metadata (7)
| Tool | Driver Operation | Params |
|------|-----------------|--------|
| `list-databases` | `client.db().admin().listDatabases()` | (none) |
| `list-collections` | `db.listCollections()` | database |
| `collection-indexes` | `collection.indexes()` | database, collection |
| `collection-schema` | `collection.aggregate([$sample])` | database, collection, sampleSize? |
| `collection-storage-size` | `collection.aggregate([$collStats])` | database, collection |
| `db-stats` | `db.command({ dbStats: 1 })` | database |
| `mongodb-logs` | `admin.command({ getLog })` | type?, limit? |

## File Structure

```
packages/mcp-server/
  package.json                          # MOD — add mongodb driver dependency
  src/
    index.ts                            # MOD — create ConnectionManager, pass to createServer
    server.ts                           # MOD — accept ConnectionManager, add database tool dispatch
    tools/
      registry.ts                       # MOD — export combined tool list for ListTools
      database/                         # NEW directory
        types.ts                        # DatabaseToolDef interface
        connection.ts                   # ConnectionManager class
        executor.ts                     # Execute database tool calls via driver
        read-tools.ts                   # find, aggregate, count, explain, export
        write-tools.ts                  # insert-many, create-index, create-collection
        update-tools.ts                 # update-many, rename-collection
        delete-tools.ts                 # delete-many, drop-collection, drop-database, drop-index
        metadata-tools.ts              # list-databases, list-collections, collection-indexes, etc.
        connection-tools.ts            # connect, switch-connection
        index.ts                        # Re-export all database tools
    resources.ts                        # MOD — add mongodb:// resources
    prompts.ts                          # MOD — add database prompts
```

No changes to `packages/core/` — the MongoDB driver stays in mcp-server only, keeping core lightweight with zero external dependencies.

## Key Interfaces

### DatabaseToolDef

```typescript
export interface DatabaseToolDef {
  name: string;
  description: string;
  operationType: "read" | "write" | "connection";
  inputSchema: object;     // JSON Schema specific to this tool
  execute: (
    conn: ConnectionManager,
    args: Record<string, unknown>,
  ) => Promise<unknown>;
}
```

Unlike the ActionMap tools (which share a generic schema and route through `dispatch()`), each database tool has its own schema and executor function. This gives the LLM precise parameter guidance per operation.

### ConnectionManager

```typescript
export class ConnectionManager {
  private client: MongoClient | null = null;
  private connectionString: string | null = null;

  async connect(connectionString: string): Promise<void>;
  async disconnect(): Promise<void>;
  getClient(): MongoClient;              // throws if not connected
  getDb(name: string): Db;
  getCollection(db: string, coll: string): Collection;
  isConnected(): boolean;
}
```

Wraps MongoClient lifecycle. Created once in `index.ts`, passed to `createServer()`. Supports connect/disconnect/switch via tool calls or initial env var (`MONGODB_CONNECTION_STRING`).

## Server Changes

### createServer signature

```typescript
// Before:
export function createServer(client: AtlasClient): Server

// After:
export function createServer(client: AtlasClient, conn?: ConnectionManager): Server
```

ConnectionManager is optional — if no MongoDB connection string is configured and no `connect` tool call is made, database tools return a clear error ("Not connected. Use the connect tool first.").

### CallToolRequest handler

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;
  const args = (request.params.arguments ?? {}) as Record<string, unknown>;

  // Check database tools first
  const dbTool = dbToolIndex.get(name);
  if (dbTool) {
    if (dbTool.operationType === "write" && readOnly) {
      return errorResult("Write operations are disabled in read-only mode.");
    }
    if (dbTool.operationType !== "connection" && !conn?.isConnected()) {
      return errorResult("Not connected to MongoDB. Use the connect tool first.");
    }
    try {
      const result = await dbTool.execute(conn!, args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (err: unknown) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }
  }

  // Existing Atlas tool dispatch (unchanged)
  const entry = toolIndex.get(name);
  // ... existing code ...
});
```

### ListTools handler

Combine both tool types into a single list:

```typescript
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Existing Atlas tools (from toolIndex)
      ...Array.from(toolIndex.entries()).map(([name, entry]) => ({
        name, description: entry.description, inputSchema: entry.inputSchema,
      })),
      // Database tools (from dbToolIndex)
      ...Array.from(dbToolIndex.entries()).map(([name, entry]) => ({
        name, description: entry.description, inputSchema: entry.inputSchema,
      })),
    ],
  };
});
```

## Read-Only Mode

Add `--read-only` flag support via env var `ORBIT_READ_ONLY=true` or constructor param. When enabled:
- All database tools with `operationType: "write"` are blocked
- Connection and read tools still work
- Atlas Admin API tools are unaffected (they have their own auth/permission model)

## New Resources

```typescript
// Add to resources.ts
{ uri: "mongodb://databases", name: "databases", read: () => conn.getClient().db().admin().listDatabases() }
{ uri: "mongodb://databases/{database}/collections", ... }
{ uri: "mongodb://databases/{database}/collections/{collection}/schema", ... }
{ uri: "mongodb://databases/{database}/collections/{collection}/indexes", ... }
{ uri: "mongodb://databases/{database}/stats", ... }
```

Resources return error if not connected.

## New Prompts

```typescript
// Add to prompts.ts

// data_explorer — guided workflow for exploring an unfamiliar database
// Walks through: connect -> list-databases -> list-collections -> collection-schema -> find (sample)

// query_optimizer — analyze slow queries and suggest indexes
// Walks through: explain -> collection-indexes -> suggest create-index
```

## Entry Point Changes

```typescript
// packages/mcp-server/src/index.ts
async function main(): Promise<void> {
  const atlasClient = new AtlasClient();

  const conn = new ConnectionManager();
  // Auto-connect if env var is set
  const mongoUri = process.env.MONGODB_CONNECTION_STRING;
  if (mongoUri) {
    await conn.connect(mongoUri);
  }

  const readOnly = process.env.ORBIT_READ_ONLY === "true";
  const server = createServer(atlasClient, conn, { readOnly });
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Graceful shutdown
  process.on("SIGINT", async () => {
    await conn.disconnect();
    await server.close();
    process.exit(0);
  });
}
```

## Dependencies

Add to `packages/mcp-server/package.json`:

```json
"mongodb": "^6.12.0"
```

Single new dependency. No Express, no AI SDK, no React, no Vite.

## Implementation Steps

### Step 1: Create feature branch
`git checkout -b feature/database-tools`

### Step 2: Add mongodb dependency
`npm install mongodb --workspace=packages/mcp-server`

### Step 3: Create database tool infrastructure
- `tools/database/types.ts` — DatabaseToolDef interface
- `tools/database/connection.ts` — ConnectionManager class

### Step 4: Implement connection tools
- `tools/database/connection-tools.ts` — connect, switch-connection

### Step 5: Implement metadata tools
- `tools/database/metadata-tools.ts` — list-databases, list-collections, collection-indexes, collection-schema, collection-storage-size, db-stats, mongodb-logs

### Step 6: Implement read tools
- `tools/database/read-tools.ts` — find, aggregate, count, explain, export

### Step 7: Implement write tools
- `tools/database/write-tools.ts` — insert-many, create-index, create-collection

### Step 8: Implement update tools
- `tools/database/update-tools.ts` — update-many, rename-collection

### Step 9: Implement delete tools
- `tools/database/delete-tools.ts` — delete-many, drop-collection, drop-database, drop-index

### Step 10: Create barrel export
- `tools/database/index.ts` — export DATABASE_TOOLS array

### Step 11: Update server.ts
- Accept ConnectionManager + readOnly option
- Build dbToolIndex from DATABASE_TOOLS
- Add database tool dispatch to CallToolRequest handler
- Merge database tools into ListTools response

### Step 12: Update index.ts
- Create ConnectionManager
- Auto-connect from MONGODB_CONNECTION_STRING env var
- Pass to createServer
- Disconnect on shutdown

### Step 13: Update registry.ts
- Export combined tool list if needed for cross-referencing

### Step 14: Add new resources
- mongodb:// URI resources for database browsing

### Step 15: Add new prompts
- data_explorer and query_optimizer

### Step 16: Update mcp-server package.json version
- Bump to 0.2.0

### Step 17: Build and test

## Testing

### Unit tests
- ConnectionManager: connect, disconnect, switch, getDb, getCollection, isConnected
- Each database tool executor: mock MongoClient/Db/Collection, verify correct driver method called with correct params
- Read-only mode: verify write tools are blocked
- Server dispatch: verify database tools route through dbToolIndex, Atlas tools through toolIndex
- Not-connected error: verify clear error when calling database tools without connection

### Integration test (manual)
```bash
# Build
npm run build --workspace=packages/mcp-server

# Start with local MongoDB
MONGODB_CONNECTION_STRING=mongodb://localhost:27017 \
ATLAS_PUBLIC_KEY=xxx ATLAS_PRIVATE_KEY=xxx \
node packages/mcp-server/dist/index.js

# Or use with Claude Desktop config:
{
  "mcpServers": {
    "orbit": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "ATLAS_PUBLIC_KEY": "xxx",
        "ATLAS_PRIVATE_KEY": "xxx",
        "MONGODB_CONNECTION_STRING": "mongodb://localhost:27017"
      }
    }
  }
}

# Test prompts via Claude Desktop:
# 1. "List all databases" -> calls list-databases
# 2. "Show me the collections in the test database" -> calls list-collections
# 3. "Find all documents in test.users where age > 25" -> calls find
# 4. "Create a products collection and insert sample data" -> calls create-collection + insert-many
# 5. "What indexes exist on test.users?" -> calls collection-indexes
# 6. "Create an M20 cluster on Azure and then create a storefront database" -> chains Atlas + database tools
```

## What This Achieves

| Capability | Before | After |
|---|---|---|
| Atlas Admin API | 41 tools, 473 operations | Unchanged |
| Database operations | None | 23 tools (find, aggregate, insert, update, delete, etc.) |
| Connection management | None | connect, switch-connection |
| Database resources | None | 5 new mongodb:// resources |
| Database prompts | None | 2 new guided workflows |
| External dependencies | 2 (core + MCP SDK) | 3 (+ mongodb driver) |
| Cross-domain prompts | Atlas only | Atlas + database (e.g., create cluster then populate data) |
