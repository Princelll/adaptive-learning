#!/bin/bash
# ==========================================
#  Adaptive Learning — One-Click Simulator
# ==========================================

REPO_URL="https://github.com/Princelll/adaptive-learning.git"
EVEN_DEV="$HOME/even-dev"
BRANCH="claude/add-bioloop-ml-system-nLfSa"
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

# Verify companion file made it
if [ ! -f "$APP_DIR/companion/index.html" ]; then
  echo "ERROR: companion/index.html missing after sync — check network/git"
  read -p "Press enter to exit..."
  exit 1
fi
echo "  Done. Companion: OK"

# ── Step 2: Install dependencies ─────────────────────
echo ""
echo "[2/5] Installing dependencies..."
cd "$APP_DIR"
npm install --silent

# ── Step 3: Serve companion via localhost (same origin as G2 app) ────
echo ""
echo "[3/5] Deploying companion to localhost:5173..."

# Free port 5173 — kill any leftover even-dev process from a previous session
powershell.exe -NoProfile -Command "
  \$pids = (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
  foreach (\$p in \$pids) { Stop-Process -Id \$p -Force -ErrorAction SilentlyContinue }
" 2>/dev/null || true
sleep 1

# Copy companion into even-dev's public/ so Vite serves it at
# localhost:5173/companion/index.html — same origin as the G2 app,
# meaning they share localStorage with NO bridge needed.
rm -rf "$EVEN_DEV/public/companion"
mkdir -p "$EVEN_DEV/public/companion"
cp "$APP_DIR/companion/index.html" "$EVEN_DEV/public/companion/index.html"
LINES=$(wc -l < "$EVEN_DEV/public/companion/index.html")
echo "  Copied companion ($LINES lines) → even-dev/public/companion/"

# Open companion in browser 8 seconds after simulator starts (Vite needs a moment)
# Use PowerShell Start-Process — more reliable than cmd.exe start in bash
(sleep 8 && powershell.exe -NoProfile -Command "Start-Process 'http://localhost:5173/companion/index.html'") &

# ── Step 4: Start simulator ───────────────────────────
echo ""
echo "[4/5] Starting Even Hub simulator..."
echo ""
echo "  G2 App:    http://localhost:5173"
echo "  Companion: http://localhost:5173/companion/index.html (opens in ~6s)"
echo ""
echo "  IMPORTANT: Use the localhost companion tab, NOT any file:// tab."
echo "  If an old file:// companion opens, close it and use the localhost one."
echo ""
echo "  Windows will auto-arrange in ~10 seconds."
echo "  Press Ctrl+C to stop."
echo "=========================================="
echo ""

# Arrange windows 10s after simulator starts (all windows need time to open)
ARRANGE="$(cygpath -w "$APP_DIR/arrange-windows.ps1" 2>/dev/null || echo "")"
if [ -n "$ARRANGE" ]; then
  # -NonInteractive removed so the window stays open showing debug output
  (sleep 10 && powershell.exe -ExecutionPolicy Bypass -File "$ARRANGE") &
fi

cd "$EVEN_DEV"
./start-even.sh "$APP_NAME"

echo ""
read -p "Simulator stopped. Press enter to close..."
