#!/usr/bin/env bash
# Migrate CurioStudio to ~/CurioStudio (no trailing spaces) — permanent stability fix.
set -euo pipefail

SOURCE="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="${CURIOSTUDIO_HOME:-$HOME/CurioStudio}"

echo "🎬 CurioStudio migration"
echo "   From: $SOURCE"
echo "   To:   $TARGET"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js not found. Install: brew install node"
  exit 1
fi

if ! command -v rsync >/dev/null 2>&1; then
  echo "❌ rsync not found."
  exit 1
fi

# Stop any running servers first
bash "$(dirname "$0")/stop.sh" 2>/dev/null || true

mkdir -p "$TARGET"

echo "📦 Syncing project files..."
rsync -a --delete \
  --exclude node_modules \
  --exclude .next \
  --exclude .git \
  --exclude '*.db' \
  --exclude '*.db-journal' \
  --exclude 'public/uploads/*' \
  --exclude '.DS_Store' \
  "$SOURCE/" "$TARGET/"

# Preserve local config and data
for f in .env prisma/dev.db prisma/dev.db-journal; do
  if [ -f "$SOURCE/$f" ]; then
    mkdir -p "$TARGET/$(dirname "$f")"
    cp -f "$SOURCE/$f" "$TARGET/$f"
  fi
done

if [ ! -f "$TARGET/.env" ] && [ -f "$TARGET/.env.example" ]; then
  cp "$TARGET/.env.example" "$TARGET/.env"
fi

cd "$TARGET"
chmod +x scripts/*.sh 2>/dev/null || true

echo "📦 Installing dependencies..."
npm install

echo "🗄️  Syncing database..."
npm run db:push

echo "🔨 Building production bundle..."
rm -rf .next
npm run build

# Desktop launcher
DESKTOP_LAUNCHER="${HOME}/Desktop/CurioStudio.command"
cat > "$DESKTOP_LAUNCHER" <<LAUNCHER
#!/usr/bin/env bash
cd "$TARGET"
./scripts/run.sh
LAUNCHER
chmod +x "$DESKTOP_LAUNCHER"

echo ""
echo "✅ CurioStudio installed at: $TARGET"
echo ""
echo "   Daily use:  cd $TARGET && npm run start"
echo "   If broken:  npm run restart"
echo "   Desktop:    double-click CurioStudio.command"
echo ""
echo "   Open: http://localhost:3000"
echo ""
