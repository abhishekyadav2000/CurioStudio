#!/usr/bin/env bash
# Production-only launcher — stable, fast, no dev-mode flakiness.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

if [[ "$APP_DIR" == *" " ]]; then
  echo "⚠️  Project path has spaces/trailing space: $APP_DIR"
  echo "   Run once: bash scripts/migrate-and-install.sh"
  echo "   Then use: cd ~/CurioStudio && npm run start"
  echo ""
fi

# Kill anything on target port
bash "$(dirname "$0")/stop.sh" 2>/dev/null || true

# Clear corrupted cache (keep BUILD_ID if valid)
if [ -d ".next" ] && [ ! -f ".next/BUILD_ID" ]; then
  echo "Clearing invalid .next cache..."
  find .next -mindepth 1 -delete 2>/dev/null || rm -rf .next
fi

# Build if missing or --rebuild
if [ ! -f .next/BUILD_ID ] || [ "${1:-}" = "--rebuild" ]; then
  echo "Building production bundle..."
  npm run build
fi

if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
fi

echo "Starting CurioStudio (production) at ${URL}..."
exec npx next start -p "${PORT}"
