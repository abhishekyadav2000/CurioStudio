#!/usr/bin/env bash
# Stable dev server — avoids Turbopack cache corruption and stale ports.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-3000}"
LOG_FILE="${LOG_FILE:-$ROOT/.dev-server.log}"

echo "🎬 CurioStudio — stable dev mode"
echo "   Log: $LOG_FILE"
echo ""

if [[ "$ROOT" == *" " ]]; then
  echo "⚠️  WARNING: Project path contains trailing/embedded spaces:"
  echo "   $ROOT"
  echo "   Recommend renaming to: curiostudio"
  echo ""
fi

# Kill stale port
EXISTING=$(lsof -ti :"${PORT}" 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
  echo "Stopping process on port ${PORT} (PID: $EXISTING)..."
  kill $EXISTING 2>/dev/null || true
  sleep 1
fi

# Clear corrupted .next cache
if [ -d ".next" ]; then
  if [ ! -f ".next/BUILD_ID" ] || find .next -name "*.json" -empty 2>/dev/null | grep -q .; then
    echo "🧹 Clearing corrupted .next cache..."
    rm -rf .next
  fi
fi

echo "🗄️  Syncing database..."
npm run db:push 2>&1 | tee -a "$LOG_FILE"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

echo ""
echo "Starting next dev (webpack, no turbopack) on port ${PORT}..."
echo "   Health: http://localhost:${PORT}/api/health"
echo ""

# Explicitly disable turbopack — use webpack for stability
exec npm run dev -- --port "${PORT}" 2>&1 | tee -a "$LOG_FILE"
