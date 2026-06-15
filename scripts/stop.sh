#!/usr/bin/env bash
# Stop all CurioStudio / Next.js processes on ports 3000 and 3001.
set -euo pipefail

echo "Stopping CurioStudio..."

for PORT in 3000 3001; do
  PIDS=$(lsof -ti :"${PORT}" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "  Killing port ${PORT} (PID: ${PIDS})"
    echo "$PIDS" | xargs kill -9 2>/dev/null || true
  fi
done

# Zombie next-server / next dev processes for this app
pkill -f "next (dev|start)" 2>/dev/null || true
pkill -f "node.*CurioStudio" 2>/dev/null || true

sleep 1
echo "Done."
