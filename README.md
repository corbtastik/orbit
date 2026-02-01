# OrbitAI

Your AI-powered MongoDB Atlas mission control.

OrbitAI is a TypeScript monorepo that provides full coverage of the MongoDB Atlas Admin API v2 through three interfaces: a conversational AI terminal shell, an MCP server for AI clients, and a core SDK. It enables platform teams, DevOps engineers, and administrators to manage Atlas infrastructure using natural language.

## Architecture

```
┌──────────────────────────────────────────────┐
│                 @orbit/cli                   │
│        Conversational AI Terminal Shell       │
│   (Anthropic, OpenAI, Google, Ollama)        │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────┴───────────────────────────┐
│               @orbit/core                    │
│    Atlas Client, Digest Auth, 41 Domains     │
│           473 API Operations                 │
└──────────────────┬───────────────────────────┘
                   │
┌──────────────────┴───────────────────────────┐
│       MongoDB Atlas Admin API v2.0           │
│      cloud.mongodb.com (HTTP Digest)         │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│           @orbit/mcp-server                  │
│     41 Tools, 15 Resources, 5 Prompts        │
│  (Claude Desktop, Cursor, MCP clients)       │
└──────────────────┬───────────────────────────┘
                   │
                   └──── @orbit/core
```

## Packages

| Package | Description |
|---------|-------------|
| `@orbit/core` | Atlas API client with HTTP Digest auth, 41 domain action maps covering 473 operations |
| `@orbit/mcp-server` | Model Context Protocol server exposing tools, resources, and guided prompts |
| `@orbit/cli` | `orbit-ai` — conversational terminal shell with pluggable LLM providers |

## Capabilities

- **Cluster Management** — Create, scale, pause, resume, and configure dedicated, Flex, serverless, and global clusters
- **Security & Access** — Database users, custom roles, IP access lists, network peering, private endpoints, encryption, LDAP, X.509, and auditing
- **Monitoring & Alerts** — Real-time metrics, performance advisor, slow query analysis, collection stats, and third-party integrations
- **Backup & Recovery** — Cloud backup snapshots, point-in-time restore, compliance policies, and export to cloud storage
- **Atlas Services** — Search indexes, Vector Search, Data Federation, Data Lake Pipelines, Online Archive, and Stream Processing
- **Billing & Cost** — Invoices, cost explorer, line items, and SKU information
- **Org & Project Admin** — Organizations, projects, teams, API keys, service accounts, and user management

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas account with [API keys](https://www.mongodb.com/docs/atlas/configure-api-access/)

## Setup

```bash
git clone https://github.com/corbtastik/orbit.git
cd orbit
npm install
npm run build
```

## Using orbit-ai (CLI)

`orbit-ai` is a conversational AI terminal shell. Type natural language and the LLM translates your intent into Atlas API operations.

### Quick Start

```bash
# Set credentials
export ATLAS_PUBLIC_KEY="your-public-key"
export ATLAS_PRIVATE_KEY="your-private-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# Interactive mode
node apps/cli/dist/index.js

# One-shot mode
node apps/cli/dist/index.js "list all my projects"
```

### Options

```
-p, --provider <name>   LLM provider: anthropic, openai, google, ollama
-m, --model <model>     Model name (e.g. claude-sonnet-4-20250514)
    --api-key <key>     API key for the LLM provider
-v, --verbose           Show tool details and token usage
    --max-tokens <n>    Max response tokens (default: 4096)
-h, --help              Show help
    --version           Show version
```

### Shell Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/clear` | Clear conversation history |
| `/quit` | Exit the shell |

### Configuration

Configuration is resolved in order: CLI flags > environment variables > config file > defaults.

**Environment variables:**

| Variable | Description |
|----------|-------------|
| `ATLAS_PUBLIC_KEY` | Atlas API public key |
| `ATLAS_PRIVATE_KEY` | Atlas API private key |
| `ATLAS_ORG_ID` | Default organization ID |
| `ATLAS_GROUP_ID` | Default project (group) ID |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `ORBIT_LLM_PROVIDER` | LLM provider name |
| `ORBIT_LLM_MODEL` | Model override |

**Config file:** `~/.orbit-ai/config.json`

```json
{
  "atlas": {
    "publicKey": "...",
    "privateKey": "...",
    "orgId": "...",
    "groupId": "..."
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 4096
  },
  "defaults": {
    "maxToolTurns": 10,
    "verbose": false
  }
}
```

### Example Session

```
  ◉ orbit-ai — MongoDB Atlas AI Shell
  anthropic/claude-sonnet-4-20250514
  Type your request in natural language. Ctrl+C to exit.

❯ list my projects
  ✦ manage_projects → list

  You have 3 projects:
  | Name       | ID                       |
  |------------|--------------------------|
  | production | 64a1b2c3d4e5f6a7b8c9d0e1 |
  | staging    | 64a1b2c3d4e5f6a7b8c9d0e2 |
  | dev        | 64a1b2c3d4e5f6a7b8c9d0e3 |

❯ show clusters in the production project
  ✦ manage_clusters → list

  The production project has 2 clusters:
  - **prod-main** (M30, AWS us-east-1, MongoDB 8.0)
  - **prod-analytics** (M50, AWS us-west-2, MongoDB 8.0)

❯ /quit
```

## Using the MCP Server

The MCP server exposes OrbitAI to any MCP-compatible client (Claude Desktop, Cursor, etc.).

```bash
# Set Atlas credentials
export ATLAS_PUBLIC_KEY="your-public-key"
export ATLAS_PRIVATE_KEY="your-private-key"

# Run the server
node packages/mcp-server/dist/index.js
```

### Claude Desktop Configuration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "orbit": {
      "command": "node",
      "args": ["/path/to/orbit/packages/mcp-server/dist/index.js"],
      "env": {
        "ATLAS_PUBLIC_KEY": "your-public-key",
        "ATLAS_PRIVATE_KEY": "your-private-key"
      }
    }
  }
}
```

## Development

```bash
# Build all packages
npm run build

# Run tests (70 tests, 10 test files)
npm test

# Build a single workspace
npm run build --workspace=packages/core
npm run build --workspace=packages/mcp-server
npm run build --workspace=apps/cli

# Clean all
npm run clean
```

### Project Structure

```
orbit/
├── packages/
│   ├── core/           @orbit/core — Atlas client, auth, domains
│   │   └── src/
│   │       ├── auth/       Digest auth, config resolution
│   │       ├── client/     AtlasClient HTTP client
│   │       ├── domains/    41 domain action maps (473 operations)
│   │       ├── errors/     AtlasApiError, AtlasConfigError
│   │       └── types/      Shared TypeScript types
│   └── mcp-server/     @orbit/mcp-server — MCP protocol server
│       └── src/
│           ├── tools/      41 tools with JSON Schema generation
│           ├── resources.ts  15 read-only resources
│           ├── prompts.ts    5 guided workflow prompts
│           └── server.ts     MCP server wiring
├── apps/
│   └── cli/            @orbit/cli — orbit-ai terminal shell
│       └── src/
│           ├── agent/      Conversation loop, system prompt
│           ├── config/     CLI configuration resolution
│           ├── providers/  LLM provider abstraction (Anthropic, ...)
│           ├── tools/      Tool registry, schema, executor
│           └── ui/         Theme, spinner, renderer, prompt
├── docs/               API docs, OpenAPI spec, architecture
└── scripts/            OpenAPI parser utilities
```

## Prompt Testing

Sample natural language prompts for testing orbit-ai across all major capability areas.

### Cluster & Deployment Management

1. `List all my projects and show which ones have clusters running`
2. `Create a new M10 cluster called analytics-dev in my staging project on AWS us-east-1 with backup enabled`
3. `Scale the prod-primary cluster up to M50 and enable disk auto-scaling`
4. `Pause all clusters in the dev project to save costs over the weekend`
5. `What MongoDB version is each of my clusters running? Flag any that are more than one major version behind`

### Security & Access Control

6. `Add a read-only database user called reporting_svc with access only to the sales database`
7. `Whitelist the CIDR block 10.0.0.0/16 in my production project and remove any entries that expired before January 1st`
8. `Show me all database users in the production project and their assigned roles`
9. `Set up a private endpoint for my prod-main cluster on AWS in us-east-1`
10. `Enable encryption at rest with AWS KMS for all clusters in the production project`

### Monitoring & Alerts

11. `What alerts are currently firing across all my projects?`
12. `Show me the Performance Advisor recommendations for my prod-primary cluster`
13. `Create an alert that notifies me when any cluster's CPU exceeds 80% for more than 5 minutes`
14. `Show me the slow query log for the orders database on cluster east-primary over the last 24 hours`
15. `What are the current connection counts and opcounter rates for my production clusters?`

### Backup & Disaster Recovery

16. `Take an on-demand snapshot of cluster east-primary, then show me the backup schedule and retention policy`
17. `List all available snapshots for my prod-main cluster from the last 7 days`
18. `Update the backup compliance policy to retain daily snapshots for 30 days and weekly for 1 year`
19. `Restore cluster prod-analytics to the most recent snapshot before yesterday at 3pm UTC`
20. `Export the latest snapshot of prod-main to my S3 bucket in us-east-1`

### Billing & Cost Management

21. `How much did my organization spend last month? Break it down by project.`
22. `Show me the invoice line items for the current billing period sorted by cost`
23. `Compare spending between my production and staging projects for the last 3 months`

### Atlas Services

24. `Create an Atlas Search index on the products collection with mappings for name, description, and the embedding field as a vector with 1536 dimensions`
25. `Set up a Data Federation endpoint that queries across my prod-main cluster and my S3 data lake`
26. `Create a Stream Processing pipeline that reads from the orders topic and writes to the analytics collection`

### Organization & Project Admin

27. `Set up a maintenance window for Sundays at 3am UTC and enable auto-defer for my production project`
28. `Create a new project called mobile-backend under my organization and add the platform-team to it`
29. `List all API keys in my organization and show which ones have been used in the last 30 days`
30. `Invite user jane@example.com to the production project with the readWriteAnyDatabase role`

### Multi-step & Conversational

These test the agent's ability to chain tool calls and maintain context across turns.

31. `Show me my most expensive cluster, then tell me what Performance Advisor recommends for it`
32. `Find all clusters without backup enabled, then enable cloud backup on each one`
33. `Which projects have no alert configurations? Set up a default CPU and disk alert for each one.`
34. `List my clusters, pick the one with the most connections, and show me its slow queries`

## License

TBD

## Author

[@corbtastik](https://github.com/corbtastik)
