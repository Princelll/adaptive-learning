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
# Pre-remove directories git will try to delete (Windows locks them during pull)
rm -rf "$REPO/companion" "$REPO/public" 2>/dev/null || true
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
  read -p "Press enter to exit..."
  exit 1
fi
rm -rf "$EVEN_DEV/apps/$APP_NAME"
cp -r "$REPO" "$EVEN_DEV/apps/"

# Copy companion into even-dev root so the simulator's server can find it
# (even-dev's server may serve from ~/even-dev/ not ~/even-dev/apps/<app>/)
COMP_SRC="$EVEN_DEV/apps/$APP_NAME/companion/index.html"
COMP_CFG="$EVEN_DEV/apps/$APP_NAME/companion/config.json"
mkdir -p "$EVEN_DEV/companion"
cp "$COMP_SRC" "$EVEN_DEV/companion/index.html" 2>/dev/null || true
cp "$COMP_CFG" "$EVEN_DEV/companion/config.json" 2>/dev/null || true
# Also try even-dev's public/ directory
mkdir -p "$EVEN_DEV/public/companion"
cp "$COMP_SRC" "$EVEN_DEV/public/companion/index.html" 2>/dev/null || true
cp "$COMP_CFG" "$EVEN_DEV/public/companion/config.json" 2>/dev/null || true
echo "  Synced."

# ── Step 3: Install dependencies ─────────────
echo ""
echo "[3/5] Installing dependencies..."
cd "$EVEN_DEV/apps/$APP_NAME"
npm install --silent

# ── Step 4: Open companion ───────────────────
echo ""
echo "[4/5] Opening companion app..."
# Open as file:// — works regardless of how even-dev serves files.
# Decks are synced to the G2 app via the ?import= bridge (localhost:5173).
COMPANION_FILE="$EVEN_DEV/apps/$APP_NAME/companion/index.html"
if command -v explorer.exe &>/dev/null; then
  explorer.exe "$(cygpath -w "$COMPANION_FILE")" 2>/dev/null || true
elif command -v xdg-open &>/dev/null; then
  xdg-open "$COMPANION_FILE" 2>/dev/null || true
elif command -v open &>/dev/null; then
  open "$COMPANION_FILE" 2>/dev/null || true
fi

# ── Step 5: Start simulator ──────────────────
echo ""
echo "[5/5] Starting Even Hub simulator..."
echo ""
echo "  G2 App:    http://localhost:5173"
echo "  Companion: opened as file (decks sync via browser tab)"
echo ""
echo "  Press Ctrl+C to stop."
echo "=========================================="
echo ""
cd "$EVEN_DEV"
./start-even.sh "$APP_NAME"

echo ""
read -p "Simulator stopped. Press enter to close..."
