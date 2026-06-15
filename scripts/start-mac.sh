#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PORT="${PORT:-3000}"
URL="http://localhost:${PORT}"

echo "🎬 CurioStudio — Local Mac Content Production OS"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found. Install: brew install node"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

echo "🗄️  Syncing database..."
if ! npm run db:push 2>&1; then
  echo "❌ Database push failed. Check DATABASE_URL in .env"
  exit 1
fi

OLLAMA_OK=false
if curl -sf http://localhost:11434/api/tags >/dev/null 2>&1; then
  echo "✓ Ollama is running"
  OLLAMA_OK=true
  MODELS=$(curl -sf http://localhost:11434/api/tags | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);console.log((j.models||[]).slice(0,3).map(m=>m.name).join(', ')||'no models')}catch{console.log('unknown')}})" 2>/dev/null || echo "")
  if [ -n "$MODELS" ]; then
    echo "  Models: $MODELS"
  else
    echo "  ⚠ No models pulled. Run: ollama pull llama3.3"
  fi
else
  echo "⚠ Ollama not detected — start with: ollama serve"
  echo "  Content will use OpenAI/Claude if API keys are set, else template fallback."
fi

if [ -n "${OPENAI_API_KEY:-}" ]; then echo "✓ OpenAI API key configured"; fi
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then echo "✓ Anthropic API key configured"; fi
if [ -n "${KAGGLE_USERNAME:-}" ] && [ -n "${KAGGLE_KEY:-}" ]; then echo "✓ Kaggle API credentials configured"; fi

# Kill anything on target port (3000 and 3001 if default)
for P in "$PORT" 3001; do
  EXISTING=$(lsof -ti :"${P}" 2>/dev/null || true)
  if [ -n "$EXISTING" ]; then
    echo "⚠ Port ${P} in use (PID: $EXISTING). Stopping..."
    kill -9 $EXISTING 2>/dev/null || true
    sleep 1
  fi
done

clear_next_cache() {
  if [ ! -d ".next" ]; then
    return 0
  fi
  echo "🧹 Clearing stale .next cache..."
  chmod -R u+w .next 2>/dev/null || true
  find .next -mindepth 1 -delete 2>/dev/null || true
  rm -rf .next 2>/dev/null || true
  sleep 1
  rm -rf .next 2>/dev/null || true
}

# Clear stale Next cache when health check fails
if [ -d ".next" ]; then
  HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}/api/health" 2>/dev/null || echo "000")
  if [ "$HEALTH_CODE" != "200" ]; then
    clear_next_cache
  fi
fi

echo ""
echo "Starting Next.js dev server on port ${PORT}..."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

npm run dev -- --port "${PORT}" &
SERVER_PID=$!

cleanup() {
  echo ""
  echo "Stopping dev server (PID $SERVER_PID)..."
  kill "$SERVER_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "Waiting for ${URL}..."
READY=false
for i in $(seq 1 60); do
  HEALTH=$(curl -sf "${URL}/api/health" 2>/dev/null || echo "")
  if echo "$HEALTH" | grep -q '"ok":true'; then
    READY=true
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "❌ Dev server exited unexpectedly. Run: npm run dev"
    exit 1
  fi
  sleep 1
done

if [ "$READY" = false ]; then
  echo "❌ Server did not become healthy in 60s."
  echo "   Check logs above. Try: rm -rf .next && npm run dev"
  kill "$SERVER_PID" 2>/dev/null || true
  exit 1
fi

HOME_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${URL}/" 2>/dev/null || echo "000")
echo ""
echo "✓ Server ready at ${URL}"
echo "  Health: ${URL}/api/health (ok)"
echo "  Home:   ${URL}/ (${HOME_CODE})"

open "${URL}" 2>/dev/null || echo "  Open manually: ${URL}"
echo ""
echo "  Press Ctrl+C to stop (PID $SERVER_PID)"
echo ""

wait "$SERVER_PID"
