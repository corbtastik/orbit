# Changelog

All notable changes to OrbitAI are documented in this file.

---

## [Unreleased] - 2026-02-05

### Added: MCP HTTP Transport + CLI as MCP Client

This release adds HTTP transport to the OrbitAI MCP server and converts the CLI to an MCP client, enabling a cleaner architecture where the CLI calls tools through MCP rather than embedding them directly.

#### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                       MCP Server                                │
│                                                                 │
│  ┌─────────────────┐      ┌─────────────────────────────────┐  │
│  │ StdioTransport  │      │ HTTP Server (Express :3600)     │  │
│  │ (Claude Desktop)│      │ StreamableHTTPServerTransport   │  │
│  └────────┬────────┘      └──────────────┬──────────────────┘  │
│           │                              │                      │
│           │    ┌─────────────────────────┘                      │
│           │    │                                                │
│           │    │    ┌──────────────────┐                        │
│           │    └───►│ SessionManager   │ (per-session isolation)│
│           │         └────────┬─────────┘                        │
│           │                  │                                  │
│           └──────────┬───────┘                                  │
│                      ▼                                          │
│               ┌─────────────┐                                   │
│               │   Server    │                                   │
│               │ (65 tools)  │                                   │
│               └─────────────┘                                   │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│                           CLI                                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  McpClientWrapper                                         │  │
│  │  ├─ Try: HTTP (http://127.0.0.1:3600/mcp)                │  │
│  │  └─ Fallback: Stdio (spawn orbit-mcp-server)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          │                                      │
│                          ▼                                      │
│                 ┌────────────────┐                              │
│                 │   Agent Loop   │                              │
│                 │  listTools()   │                              │
│                 │  callTool()    │                              │
│                 └────────────────┘                              │
└────────────────────────────────────────────────────────────────┘
```

#### New Files Created

**MCP Server Transport (`packages/mcp-server/src/transport/`):**

| File | Description |
|------|-------------|
| `session-manager.ts` | Per-session ConnectionManager isolation with idle timeout cleanup (30 min default) |
| `http-server.ts` | Express + StreamableHTTPServerTransport with stateful sessions and DNS rebinding protection |
| `index.ts` | Barrel export for transport modules |

**CLI MCP Client (`apps/cli/src/mcp/`):**

| File | Description |
|------|-------------|
| `transport.ts` | Transport selection with HTTP primary / stdio fallback |
| `client.ts` | McpClientWrapper class for tool listing and execution |
| `index.ts` | Barrel export for MCP client modules |

#### Modified Files

**MCP Server:**

| File | Changes |
|------|---------|
| `packages/mcp-server/src/index.ts` | Added `--http` flag and HTTP mode startup |
| `packages/mcp-server/package.json` | Added `@types/express` devDependency |

**CLI:**

| File | Changes |
|------|---------|
| `apps/cli/src/index.ts` | Initialize MCP client at startup, pass to agent loop |
| `apps/cli/src/agent/loop.ts` | Use `mcpClient.listTools()` and `callTool()` instead of local tools |
| `apps/cli/src/agent/system-prompt.ts` | Simplified (tool list now comes from MCP) |
| `apps/cli/src/agent/system-prompt.test.ts` | Updated tests for new prompt |
| `apps/cli/package.json` | Added `@modelcontextprotocol/sdk` dependency |

#### Key Features

1. **HTTP Transport** (port 3600):
   - DNS rebinding protection via `createMcpExpressApp()`
   - Per-session MongoDB connection isolation
   - Idle session cleanup (30 min timeout)
   - Health check endpoint at `/health`
   - Session cleanup via `DELETE /mcp/:sessionId`

2. **CLI MCP Client**:
   - Automatic transport selection (HTTP → stdio fallback)
   - Tool caching for performance
   - Environment variable configuration
   - Graceful disconnect on exit

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ORBIT_MCP_HTTP` | Start MCP server in HTTP mode | `false` |
| `ORBIT_MCP_PORT` | HTTP port | `3600` |
| `ORBIT_MCP_HOST` | HTTP host | `127.0.0.1` |
| `ORBIT_MCP_URL` | HTTP endpoint URL for CLI | `http://127.0.0.1:3600/mcp` |
| `ORBIT_MCP_STDIO` | Force CLI to use stdio (skip HTTP) | `false` |
| `ORBIT_MCP_HTTP_TIMEOUT` | HTTP connection timeout (ms) | `2000` |

#### Usage

**Start MCP Server in HTTP mode:**

```bash
cd packages/mcp-server
ORBIT_MCP_HTTP=true npm start
# Or: npm start -- --http
# Or: npm start -- --http --port 4000
```

**Run CLI (auto-connects via HTTP if server running, falls back to stdio):**

```bash
cd apps/cli
npm start
```

**Force stdio transport:**

```bash
ORBIT_MCP_STDIO=true npm start
```

---

### Added: Unified Configuration System

Implemented a shared configuration loader in `@orbit/core` that provides consistent configuration handling across all packages.

#### Configuration Priority

```
CLI flags > Environment variables > Config file > Defaults
```

#### Config File Location

```
~/.orbit-ai/config.json
```

#### New Files Created

**Core Config Module (`packages/core/src/config/`):**

| File | Description |
|------|-------------|
| `types.ts` | All config types, ENV constants, DEFAULTS |
| `loader.ts` | `loadConfig()` function merging config file + env vars |
| `index.ts` | Barrel export |

#### Modified Files

| File | Changes |
|------|---------|
| `packages/core/src/index.ts` | Added config exports |
| `packages/mcp-server/src/index.ts` | Uses `loadConfig()` and `hasAtlasCredentials()` |
| `apps/cli/src/config/config.ts` | Uses shared `loadConfig()` from core |
| `apps/cli/src/config/defaults.ts` | Re-exports from `@orbit/core` |

#### Configuration Options

**Atlas Configuration:**

| Config Key | Environment Variable | Default | Description |
|------------|---------------------|---------|-------------|
| `atlas.publicKey` | `ATLAS_PUBLIC_KEY` | — | MongoDB Atlas public API key |
| `atlas.privateKey` | `ATLAS_PRIVATE_KEY` | — | MongoDB Atlas private API key |
| `atlas.orgId` | `ATLAS_ORG_ID` | — | Default organization ID |
| `atlas.groupId` | `ATLAS_GROUP_ID` | — | Default project/group ID |
| `atlas.baseUrl` | `ATLAS_BASE_URL` | `https://cloud.mongodb.com` | Atlas API base URL |

**LLM Configuration:**

| Config Key | Environment Variable | Default | Description |
|------------|---------------------|---------|-------------|
| `llm.provider` | `ORBIT_LLM_PROVIDER` | `anthropic` | LLM provider |
| `llm.model` | `ORBIT_LLM_MODEL` | (per provider) | Model name |
| `llm.apiKey` | `ORBIT_LLM_API_KEY` | — | API key (overrides provider-specific) |
| `llm.baseUrl` | `ORBIT_LLM_BASE_URL` | — | Custom API base URL |
| `llm.maxTokens` | `ORBIT_LLM_MAX_TOKENS` | `4096` | Max response tokens |
| `llm.temperature` | `ORBIT_LLM_TEMPERATURE` | `0` | Temperature |

**Provider-Specific API Keys:**

| Provider | Environment Variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google | `GOOGLE_API_KEY` |
| Ollama | (none required) |

**MCP Configuration:**

| Config Key | Environment Variable | Default | Description |
|------------|---------------------|---------|-------------|
| `mcp.url` | `ORBIT_MCP_URL` | `http://127.0.0.1:3600/mcp` | MCP server URL |
| `mcp.forceStdio` | `ORBIT_MCP_STDIO` | `false` | Force stdio transport |
| `mcp.httpTimeout` | `ORBIT_MCP_HTTP_TIMEOUT` | `2000` | HTTP timeout (ms) |

**Defaults Configuration:**

| Config Key | Environment Variable | Default | Description |
|------------|---------------------|---------|-------------|
| `defaults.outputFormat` | — | `text` | Output format |
| `defaults.maxToolTurns` | — | `10` | Max tool turns per request |
| `defaults.verbose` | — | `false` | Verbose output |

#### Example Config File

```json
{
  "atlas": {
    "publicKey": "your-public-key",
    "privateKey": "your-private-key",
    "orgId": "optional-default-org",
    "groupId": "optional-default-project"
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  },
  "mcp": {
    "url": "http://127.0.0.1:3600/mcp"
  }
}
```

#### Key Benefits

1. **Single Source of Truth**: Both MCP server and CLI read from the same config file
2. **Environment Override**: Environment variables always override config file values
3. **Clear Error Messages**: MCP server provides helpful error when credentials are missing
4. **Type Safety**: Full TypeScript types for all configuration options

---

#### Verification

The implementation includes:
- All existing tests pass (228 tests)
- TypeScript compilation successful across all packages
- Backward compatibility with stdio transport for Claude Desktop
