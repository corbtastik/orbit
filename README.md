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

## License

TBD

## Author

[@corbtastik](https://github.com/corbtastik)
