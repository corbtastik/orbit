#!/usr/bin/env bash
#
# Start the orbit-ai CLI (Terminal 2).
#
# Usage:
#   ./start-cli.sh                       Interactive shell
#   ./start-cli.sh "list my clusters"    One-shot question
#   ./start-cli.sh -v                    Show tool calls and token usage
#   ./start-cli.sh --provider google     Override the LLM provider
#   ./start-cli.sh --build               Force a rebuild first
#
# Connects over HTTP to a server started by ./start-server.sh. If no server
# is running it falls back to spawning one over stdio, so this works on its
# own too.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

CLI_DIST="apps/cli/dist/index.js"
SERVER_DIST="packages/mcp-server/dist/index.js"

# --- Strip our own --build flag out of the pass-through args -----------------
FORCE_BUILD=false
if [ "${1:-}" = "--build" ]; then
  FORCE_BUILD=true
  shift
fi

if [ "$FORCE_BUILD" = true ] || [ ! -f "$CLI_DIST" ] || [ ! -f "$SERVER_DIST" ]; then
  echo "▸ Building..."
  npm run build --workspace=@orbit/mcp-server
  npm run build --workspace=@orbit/cli
fi

# The stdio fallback spawns the bare command `orbit-mcp-server`, which only
# resolves when node_modules/.bin is on PATH. npm adds it; a plain shell does
# not, which is why `node apps/cli/dist/index.js` fails with ENOENT.
export PATH="$ROOT/node_modules/.bin:$PATH"

# --- Tell the user which transport they are about to get --------------------
MCP_URL="${ORBIT_MCP_URL:-http://127.0.0.1:3600/mcp}"
HEALTH_URL="${MCP_URL%/mcp}/health"

if [ "${ORBIT_MCP_STDIO:-}" = "true" ]; then
  echo "▸ ORBIT_MCP_STDIO=true — using stdio transport"
elif curl -s -m 1 -o /dev/null "$HEALTH_URL" 2>/dev/null; then
  echo "▸ Server found at ${MCP_URL} — connecting over HTTP"
else
  echo "▸ No server at ${MCP_URL} — falling back to stdio (start ./start-server.sh for HTTP)"
fi

if [ -f "$ROOT/.env" ]; then
  exec node --env-file=.env "$CLI_DIST" "$@"
else
  echo "  (no .env found — using ~/.orbit-ai/config.json only)"
  exec node "$CLI_DIST" "$@"
fi
