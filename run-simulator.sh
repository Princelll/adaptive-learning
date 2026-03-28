#!/bin/bash
# ==========================================
#  Adaptive Learning — One-Click Simulator
#  Pulls latest code, syncs to even-dev,
#  opens companion app, starts G2 simulator
# ==========================================

REPO="$HOME/OneDrive/Desktop/adaptive-learning"
EVEN_DEV="$HOME/even-dev"
BRANCH="claude/add-bioloop-ml-system-nLfSa"
APP_NAME="adaptive-learning"

echo "=========================================="
echo "  Adaptive Learning — Simulator Launcher"
echo "=========================================="
echo ""

# ── Step 1: Pull latest ──────────────────────
echo "[1/5] Pulling latest from $BRANCH..."
cd "$REPO" || {
  echo "ERROR: Repo not found at $REPO"
  echo "Clone it first:"
  echo "  git clone https://github.com/Princelll/adaptive-learning.git \"$REPO\""
  read -p "Press enter to exit..."
  exit 1
}
git fetch origin
git checkout "$BRANCH" 2>/dev/null
git pull origin "$BRANCH"
if [ $? -ne 0 ]; then
  echo "WARNING: Git pull failed. Continuing with local copy..."
fi

# ── Step 2: Sync to even-dev ─────────────────
echo ""
echo "[2/5] Syncing to even-dev..."
if [ ! -d "$EVEN_DEV" ]; then
  echo "ERROR: even-dev not found at $EVEN_DEV"
  echo "Clone it first:"
  echo "  git clone https://github.com/BxNxM/even-dev.git \"$EVEN_DEV\""
  echo "  cd \"$EVEN_DEV\" && npm install"
  echo "  npm install @evenrealities/evenhub-simulator"
  echo "  npm rebuild @evenrealities/evenhub-simulator"
  read -p "Press enter to exit..."
  exit 1
fi
rm -rf "$EVEN_DEV/apps/$APP_NAME"
cp -r "$REPO" "$EVEN_DEV/apps/"
echo "  Synced."

# ── Step 3: Install dependencies ─────────────
echo ""
echo "[3/5] Installing dependencies..."
cd "$EVEN_DEV/apps/$APP_NAME"
npm install --silent

# ── Step 4: Open companion in browser (file://) ──────────────
echo ""
echo "[4/5] Opening companion app in browser..."
COMPANION="$EVEN_DEV/apps/$APP_NAME/companion/index.html"
# Open as file:// — companion HTML is self-contained and works this way.
# Deck saves are bridged to localhost:5173 via the ?import= URL mechanism.
if command -v explorer.exe &>/dev/null; then
  explorer.exe "$(cygpath -w "$COMPANION")" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
  xdg-open "$COMPANION" 2>/dev/null || true
elif command -v open &>/dev/null; then
  open "$COMPANION" 2>/dev/null || true
fi

# ── Step 5: Start simulator ──────────────────
echo ""
echo "[5/5] Starting Even Hub simulator..."
echo ""
echo "  Browser:  http://localhost:5173"
echo "  Companion: already opened in browser"
echo ""
echo "  Press Ctrl+C to stop."
echo "=========================================="
echo ""
cd "$EVEN_DEV"
./start-even.sh "$APP_NAME"

echo ""
read -p "Simulator stopped. Press enter to close..."
