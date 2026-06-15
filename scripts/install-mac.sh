#!/usr/bin/env bash
# One-time install: migrate to ~/CurioStudio, build, start production server.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${CURIOSTUDIO_HOME:-$HOME/CurioStudio}"

echo "🎬 Installing CurioStudio..."
echo ""

# Always migrate to canonical path (fixes trailing-space folder issues)
bash "$ROOT/scripts/migrate-and-install.sh"

cd "$TARGET"
PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

bash scripts/stop.sh 2>/dev/null || true

echo "🚀 Starting CurioStudio (production)..."
./scripts/run.sh &
SERVER_PID=$!

echo "Waiting for ${URL}..."
READY=false
for _ in $(seq 1 45); do
  if curl -sf "${URL}/api/health" 2>/dev/null | grep -q '"ok":true'; then
    READY=true
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "❌ Server exited unexpectedly."
    exit 1
  fi
  sleep 1
done

if [ "$READY" = false ]; then
  echo "❌ Server did not become healthy in 45s."
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

open "${URL}" 2>/dev/null || true

echo ""
echo "✅ CurioStudio running at ${URL}"
echo ""
echo "   cd $TARGET"
echo "   npm run start     # daily"
echo "   npm run restart   # if broken"
echo ""

wait "$SERVER_PID"
