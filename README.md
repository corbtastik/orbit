# OrbitAI

Your AI-powered MongoDB Atlas mission control.

OrbitAI is a TypeScript monorepo providing conversational access to MongoDB Atlas through an MCP server and AI terminal shell. It enables platform teams, DevOps engineers, and administrators to manage Atlas infrastructure using natural language.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MCP Server                                 │
│                                                                 │
│  ┌─────────────────┐      ┌──────────────────────────────────┐  │
│  │ StdioTransport  │      │ HTTP Server (:3600)              │  │
│  │ (Claude Desktop)│      │ StreamableHTTPServerTransport    │  │
│  └────────┬────────┘      └──────────────┬───────────────────┘  │
│           │                              │                      │
│           └──────────────┬───────────────┘                      │
│                          ▼                                      │
│                   ┌─────────────┐                               │
│                   │   Server    │                               │
│                   │  67 Tools   │──── @orbit/core               │
│                   │ 15 Resources│        │                      │
│                   │  5 Prompts  │        ▼                      │
│                   └─────────────┘   Atlas Admin API             │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        orbit-ai CLI                             │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  McpClientWrapper                                         │  |
│  │  ├─ Primary: HTTP (http://127.0.0.1:3600/mcp)             │  │
│  │  └─ Fallback: Stdio (spawn orbit-mcp-server)              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│                 ┌────────────────┐                              │
│                 │   Agent Loop   │                              │
│                 │   (4 LLMs)     │                              │
│                 └────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

## Packages

| Package | Description |
|---------|-------------|
| `@orbit/core` | Atlas API client, HTTP Digest auth, unified configuration, 41 domain action maps |
| `@orbit/mcp-server` | MCP server with HTTP and stdio transports, 67 tools, 15 resources, 5 prompts |
| `@orbit/cli` | `orbit-ai` — conversational terminal shell with Anthropic, OpenAI, Google, and Ollama support |

## Capabilities

- **Cluster Management** — Create, scale, pause, resume, and configure dedicated, Flex, serverless, and global clusters
- **Database Tools** — Connect to MongoDB instances, query collections, inspect schemas, run aggregations
- **Security & Access** — Database users, custom roles, IP access lists, network peering, private endpoints
- **Monitoring & Alerts** — Real-time metrics, performance advisor, slow query analysis, alert configurations
- **Backup & Recovery** — Cloud backup snapshots, point-in-time restore, export to cloud storage
- **Atlas Services** — Search indexes, Vector Search, Data Federation, Stream Processing
- **Billing & Cost** — Invoices, cost explorer, line items

## Prerequisites

- Node.js 18+
- npm 9+
- MongoDB Atlas account with [API keys](https://www.mongodb.com/docs/atlas/configure-api-access/)

---

## Quick Start

### 1. Clone and Build

```bash
git clone https://github.com/corbtastik/orbit.git
cd orbit
npm install
npm run build
```

### 2. Configure

Create `~/.orbit-ai/config.json`:

```json
{
  "atlas": {
    "publicKey": "your-atlas-public-key",
    "privateKey": "your-atlas-private-key"
  },
  "llm": {
    "provider": "anthropic"
  }
}
```

Set your LLM API key:

```bash
export ANTHROPIC_API_KEY="your-key"
```

### 3. Run

Terminal 1 — start the MCP server:
```bash
./start-server.sh
```

Terminal 2 — start the CLI:
```bash
./start-cli.sh
```

The CLI auto-connects over HTTP when the server is running, and falls back to
spawning the server over stdio when it is not — so `./start-cli.sh` on its own
works too.

Both scripts build on first run, accept `--build` to force a rebuild, and pass
any other flags through:

```bash
./start-server.sh --port 4000
./start-server.sh --cors-origin http://localhost:5173
./start-cli.sh "list my clusters"
./start-cli.sh -v --provider google
```

They load `.env` via `--env-file`, which is what makes `MONGODB_CONN_*`
connections visible to the server.

---

## Configuration

Configuration priority: **CLI flags > Environment variables > Config file > Defaults**

### Config File

**Location:** `~/.orbit-ai/config.json`

```json
{
  "atlas": {
    "publicKey": "your-public-key",
    "privateKey": "your-private-key",
    "orgId": "default-org-id",
    "groupId": "default-project-id",
    "baseUrl": "https://cloud.mongodb.com"
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "apiKey": "your-api-key",
    "baseUrl": null,
    "maxTokens": 4096,
    "temperature": 0
  },
  "server": {
    "http": false,
    "port": 3600,
    "host": "127.0.0.1",
    "readOnly": false,
    "allowedHosts": [],
    "corsOrigins": []
  },
  "mcp": {
    "url": "http://127.0.0.1:3600/mcp",
    "forceStdio": false,
    "httpTimeout": 2000
  },
  "mongodb": {
    "connections": {
      "local": "mongodb://localhost:27017",
      "atlas": "mongodb+srv://user:pass@cluster.mongodb.net"
    }
  },
  "defaults": {
    "outputFormat": "text",
    "maxToolTurns": 10,
    "verbose": false
  }
}
```

### Environment Variables

#### Atlas API

| Variable | Description | Default |
|----------|-------------|---------|
| `ATLAS_PUBLIC_KEY` | MongoDB Atlas public API key (required) | — |
| `ATLAS_PRIVATE_KEY` | MongoDB Atlas private API key (required) | — |
| `ATLAS_ORG_ID` | Default organization ID | — |
| `ATLAS_GROUP_ID` | Default project/group ID | — |
| `ATLAS_BASE_URL` | Atlas API base URL | `https://cloud.mongodb.com` |

#### LLM Provider

| Variable | Description | Default |
|----------|-------------|---------|
| `ORBIT_LLM_PROVIDER` | Provider: `anthropic`, `openai`, `google`, `ollama` | `anthropic` |
| `ORBIT_LLM_MODEL` | Model name | Per-provider default |
| `ORBIT_LLM_API_KEY` | API key (overrides provider-specific keys) | — |
| `ORBIT_LLM_BASE_URL` | Custom API base URL | — |
| `ORBIT_LLM_MAX_TOKENS` | Max response tokens | `4096` |
| `ORBIT_LLM_TEMPERATURE` | Temperature | `0` |

#### Provider-Specific API Keys

| Variable | Provider |
|----------|----------|
| `ANTHROPIC_API_KEY` | Anthropic (Claude) |
| `OPENAI_API_KEY` | OpenAI (GPT) |
| `GOOGLE_API_KEY` | Google (Gemini) |

#### MCP Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `ORBIT_MCP_HTTP` | Start MCP server in HTTP mode | `false` |
| `ORBIT_MCP_PORT` | HTTP server port | `3600` |
| `ORBIT_MCP_HOST` | HTTP server host | `127.0.0.1` |
| `ORBIT_MCP_ALLOWED_HOSTS` | Comma-separated `Host` header allowlist | localhost only |
| `ORBIT_MCP_CORS_ORIGINS` | Comma-separated CORS origin allowlist (`*` for any) | CORS disabled |
| `ORBIT_MCP_URL` | MCP server URL (for CLI) | `http://127.0.0.1:3600/mcp` |
| `ORBIT_MCP_STDIO` | Force CLI to use stdio transport | `false` |
| `ORBIT_MCP_HTTP_TIMEOUT` | HTTP connection timeout (ms) | `2000` |

#### MongoDB Connections

Define named connections using the `MONGODB_CONN_<NAME>` pattern:

```bash
export MONGODB_CONN_LOCAL="mongodb://localhost:27017"
export MONGODB_CONN_ATLAS="mongodb+srv://user:pass@cluster.mongodb.net"
export MONGODB_CONN_PROD="mongodb+srv://user:pass@prod.mongodb.net"
```

The `<NAME>` becomes the connection identifier used in tool calls.

---

## Running the MCP Server

### Stdio Mode (Default)

Used by Claude Desktop, Cursor, and other MCP clients:

```bash
node packages/mcp-server/dist/index.js
```

### HTTP Mode

For development and the orbit-ai CLI:

```bash
ORBIT_MCP_HTTP=true node packages/mcp-server/dist/index.js
```

Or with flags:

```bash
node packages/mcp-server/dist/index.js --http --port 3600
```

Or set `server.http: true` in `~/.orbit-ai/config.json`. Use `--stdio` to force stdio
mode when the config file or environment enables HTTP.

### Calling the Server From Another Local App

The HTTP server speaks MCP over Streamable HTTP, not REST:

| Route | Purpose |
|-------|---------|
| `POST /mcp` | All MCP traffic (initialize, tools/list, tools/call) |
| `DELETE /mcp/:sessionId` | Tear down a session and its database connections |
| `GET /health` | `{ status, sessions, timestamp }` |

From a Node or Electron app, use the MCP SDK client:

```js
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-app", version: "1.0.0" });
await client.connect(new StreamableHTTPClientTransport(new URL("http://127.0.0.1:3600/mcp")));

const { tools } = await client.listTools();
```

Calling raw HTTP requires `Accept: application/json, text/event-stream`, an
`initialize` handshake, and echoing the returned `mcp-session-id` header on every
subsequent request.

#### Browser Clients (CORS)

CORS is **off by default**, which is correct for Node, Electron, and CLI clients.
Browser-based apps need an explicit origin allowlist:

```bash
node packages/mcp-server/dist/index.js --http --cors-origin http://localhost:5173
```

The allowlist echoes matching origins and exposes `mcp-session-id` so a browser
client can carry the session across requests. `--cors-origin` is repeatable, and
`*` allows any origin.

#### Non-Loopback Binding (allowedHosts)

Binding to `127.0.0.1`, `localhost`, or `::1` applies DNS rebinding protection:
any request whose `Host` hostname is not one of those three gets a 403. To reach
the server by another hostname or LAN IP, supply an allowlist:

```bash
node packages/mcp-server/dist/index.js --http --host 0.0.0.0 \
  --allowed-hosts orbit.local,127.0.0.1,localhost
```

`--allowed-hosts` **replaces** the default list rather than extending it, so
include `localhost` and `127.0.0.1` if you still want them.

> **The server has no authentication.** Anything that can reach it drives Atlas
> with your API keys. Keep the bind on loopback unless you add auth in front.
> Note also that `readOnly` gates database and RDBMS tools only — Atlas admin
> tools such as cluster deletion are not covered by it.

### Claude Desktop Configuration

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "orbit": {
      "command": "node",
      "args": ["/path/to/orbit/packages/mcp-server/dist/index.js"],
      "env": {
        "ATLAS_PUBLIC_KEY": "your-public-key",
        "ATLAS_PRIVATE_KEY": "your-private-key",
        "MONGODB_CONN_LOCAL": "mongodb://localhost:27017",
        "MONGODB_CONN_ATLAS": "mongodb+srv://user:pass@cluster.mongodb.net"
      }
    }
  }
}
```

---

## Running the CLI

### Interactive Mode

```bash
node apps/cli/dist/index.js
```

### One-Shot Mode

```bash
node apps/cli/dist/index.js "list my clusters"
```

### CLI Options

```
-p, --provider <name>   LLM provider: anthropic, openai, google, ollama
-m, --model <model>     Model name
    --api-key <key>     API key for the LLM provider
-v, --verbose           Show tool details and token usage
    --max-tokens <n>    Max response tokens (default: 4096)
    --raw               Output raw markdown (disable rendering)
-h, --help              Show help
    --version           Show version
```

### Shell Commands

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/config` | Show current configuration |
| `/clear` | Clear conversation history |
| `/quit` | Exit the shell |

### Example Session

```
  ◉ orbit-ai v0.2.0
  anthropic/claude-sonnet-4-20250514

❯ list my projects
  ✦ manage_projects → list

  You have 3 projects:
  - production (64a1b2c3d4e5f6a7b8c9d0e1)
  - staging (64a1b2c3d4e5f6a7b8c9d0e2)
  - dev (64a1b2c3d4e5f6a7b8c9d0e3)

❯ summarize the mongoball database schema
  ✦ list-collections → unknown
  ✦ collection-schema → unknown

  The mongoball database contains 5 collections:
  - people: Player biographical information
  - teams: Yearly team statistics
  - batting: Player batting statistics by year
  ...

❯ /quit
```

---

## Development

### Build

```bash
# Build all packages
npm run build

# Build a single package
npm run build -w @orbit/core
npm run build -w @orbit/mcp-server
npm run build -w @orbit/cli
```

### Test

```bash
# Run all tests (228 tests)
npm test

# Run tests for a single package
npm test -w @orbit/core
```

### Clean

```bash
npm run clean
```

### Project Structure

```
orbit/
├── packages/
│   ├── core/              @orbit/core
│   │   └── src/
│   │       ├── auth/          Digest auth
│   │       ├── client/        AtlasClient
│   │       ├── config/        Unified config loader
│   │       ├── domains/       41 domain action maps
│   │       └── errors/        Error types
│   └── mcp-server/        @orbit/mcp-server
│       └── src/
│           ├── tools/         67 tools (Atlas + Database)
│           ├── transport/     HTTP and stdio transports
│           ├── resources.ts   15 resources
│           └── prompts.ts     5 prompts
├── apps/
│   └── cli/               @orbit/cli
│       └── src/
│           ├── agent/         Conversation loop
│           ├── config/        CLI config
│           ├── mcp/           MCP client wrapper
│           ├── providers/     LLM providers
│           └── ui/            Terminal UI
└── docs/                  Documentation
```

---

## Using Local LLMs

### Ollama

```bash
export ORBIT_LLM_PROVIDER="ollama"
export ORBIT_LLM_MODEL="llama3.1"
export ORBIT_LLM_BASE_URL="http://localhost:11434/v1"

node apps/cli/dist/index.js
```

### LM Studio (OpenAI-compatible)

```bash
export ORBIT_LLM_PROVIDER="openai"
export ORBIT_LLM_MODEL="qwen2.5-coder-14b"
export ORBIT_LLM_BASE_URL="http://localhost:1234/v1"
export ORBIT_LLM_API_KEY="lm-studio"

node apps/cli/dist/index.js
```

---

## License

MIT

## Author

[@corbtastik](https://github.com/corbtastik)
