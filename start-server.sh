#!/usr/bin/env bash
#
# Start the OrbitAI MCP server in HTTP mode (Terminal 1).
#
# Usage:
#   ./start-server.sh                    Start on 127.0.0.1:3600
#   ./start-server.sh --port 4000        Start on a different port
#   ./start-server.sh --cors-origin http://localhost:5173
#   ./start-server.sh --build            Force a rebuild first
#
# Any other flags are passed straight through to orbit-mcp-server
# (see `node packages/mcp-server/dist/index.js --help`).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

SERVER_DIST="packages/mcp-server/dist/index.js"

# --- Strip our own --build flag out of the pass-through args -----------------
FORCE_BUILD=false
if [ "${1:-}" = "--build" ]; then
  FORCE_BUILD=true
  shift
fi

# --- Build if needed --------------------------------------------------------
if [ "$FORCE_BUILD" = true ] || [ ! -f "$SERVER_DIST" ]; then
  echo "▸ Building @orbit/mcp-server..."
  npm run build --workspace=@orbit/mcp-server
fi

# --- Work out which port we will land on, for the pre-flight check ----------
PORT="${ORBIT_MCP_PORT:-3600}"
PREV=""
for ARG in "$@"; do
  [ "$PREV" = "--port" ] && PORT="$ARG"
  PREV="$ARG"
done

# --- Refuse to start on top of a server that is already running -------------
if curl -s -m 1 -o /dev/null "http://127.0.0.1:${PORT}/health" 2>/dev/null; then
  echo "✘ Something is already serving http://127.0.0.1:${PORT}/health"
  echo "  Stop it first, or start this one on another port: ./start-server.sh --port 4000"
  exit 1
fi

echo "▸ Starting MCP server on port ${PORT} (Ctrl-C to stop)"

# --env-file is what loads MONGODB_CONN_* and the Atlas keys from .env.
# Without it the server sees only ~/.orbit-ai/config.json.
if [ -f "$ROOT/.env" ]; then
  exec node --env-file=.env "$SERVER_DIST" --http "$@"
else
  echo "  (no .env found — using ~/.orbit-ai/config.json only)"
  exec node "$SERVER_DIST" --http "$@"
fi
