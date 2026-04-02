#!/bin/bash
# ==========================================
#  Adaptive Learning — One-Click Simulator
# ==========================================

REPO_URL="https://github.com/Princelll/adaptive-learning.git"
EVEN_DEV="$HOME/even-dev"
BRANCH="claude/convert-bmp-to-png-Og4HR"
APP_NAME="adaptive-learning"
APP_DIR="$EVEN_DEV/apps/$APP_NAME"

echo "=========================================="
echo "  Adaptive Learning — Simulator Launcher"
echo "=========================================="
echo ""

if [ ! -d "$EVEN_DEV" ]; then
  echo "ERROR: even-dev not found at $EVEN_DEV"
  read -p "Press enter to exit..."
  exit 1
fi

# ── Step 1: Sync latest code directly into even-dev ──
# Clone/pull straight from GitHub into even-dev/apps — bypasses OneDrive
# sync issues where files may exist as cloud-only placeholders.
echo "[1/5] Syncing latest code from GitHub..."
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git fetch origin
  git checkout "$BRANCH" 2>/dev/null
  git reset --hard "origin/$BRANCH"
  git clean -fd 2>/dev/null || true
else
  rm -rf "$APP_DIR"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi

# Verify companion file made it (now in public/companion/)
if [ ! -f "$APP_DIR/public/companion/index.html" ]; then
  echo "ERROR: public/companion/index.html missing after sync — check network/git"
  read -p "Press enter to exit..."
  exit 1
fi
echo "  Done. Companion: OK"

# ── Step 2: Install dependencies ─────────────────────
echo ""
echo "[2/5] Installing dependencies..."
cd "$APP_DIR"
npm install --silent

# ── Step 3: Free port 5173 ────────────────────────────
echo ""
echo "[3/5] Freeing port 5173..."

# Kill any leftover even-dev process from a previous session
powershell.exe -NoProfile -Command "
  \$pids = (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
  foreach (\$p in \$pids) { Stop-Process -Id \$p -Force -ErrorAction SilentlyContinue }
" 2>/dev/null || true
sleep 1
echo "  Done."

# Open companion in browser 8 seconds after simulator starts (Vite needs a moment)
# The companion is in public/companion/index.html inside the app — Vite serves it
# at localhost:5173/companion/index.html automatically. Same origin = shared localStorage.
BUST=$(date +%s)
(sleep 8 && powershell.exe -NoProfile -Command "Start-Process 'http://localhost:5173/companion/index.html?v=$BUST'") &

# ── Step 4: Start simulator ───────────────────────────
echo ""
echo "[4/5] Starting Even Hub simulator..."
echo ""
echo "  G2 App:    http://localhost:5173"
echo "  Companion: http://localhost:5173/companion/index.html (opens in ~8s)"
echo ""
echo "  Both run on the same origin — localStorage is shared automatically."
echo "  Any deck saved in the companion instantly updates the glasses display."
echo ""
echo "  Press Ctrl+C to stop."
echo "=========================================="
echo ""

cd "$EVEN_DEV"
# NPM_CONFIG_PREFER_OFFLINE forces npx to use the cached simulator binary
# instead of downloading @latest from the registry (the latest may be broken).
# If no cache exists, it falls back to network automatically.
NPM_CONFIG_PREFER_OFFLINE=true ./start-even.sh "$APP_NAME"

echo ""
read -p "Simulator stopped. Press enter to close..."
