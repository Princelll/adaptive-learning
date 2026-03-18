#!/bin/bash
echo "=========================================="
echo "  Bioloop Updater & Launcher"
echo "=========================================="
echo ""

POLYCYPHER_DIR="$HOME/polycypher-challenge"
EVENDEV_DIR="$HOME/even-dev"

# Step 1: Pull latest from polycypher-challenge
echo "[1/4] Pulling latest changes from polycypher-challenge..."
cd "$POLYCYPHER_DIR" || { echo "ERROR: $POLYCYPHER_DIR not found. Clone it first with:"; echo "  git clone https://github.com/Princelll/polycypher-challenge.git ~/polycypher-challenge"; exit 1; }
git checkout claude/frame-web-bluetooth-integration-wGvmo 2>/dev/null
git pull origin claude/frame-web-bluetooth-integration-wGvmo
if [ $? -ne 0 ]; then
    echo "ERROR: Git pull failed."
    read -p "Press enter to exit..."
    exit 1
fi

# Step 2: Copy updated files into even-dev/apps/bioloop
echo ""
echo "[2/4] Copying updated files to even-dev/apps/bioloop..."
cp -r "$POLYCYPHER_DIR/src/"* "$EVENDEV_DIR/apps/bioloop/src/"
cp "$POLYCYPHER_DIR/index.html" "$EVENDEV_DIR/apps/bioloop/index.html"
cp "$POLYCYPHER_DIR/vite.config.ts" "$EVENDEV_DIR/apps/bioloop/vite.config.ts"
echo "Files copied successfully!"

# Step 3: Install dependencies
echo ""
echo "[3/4] Installing dependencies..."
cd "$EVENDEV_DIR/apps/bioloop"
npm install

# Step 4: Start the app
echo ""
echo "[4/4] Starting Bioloop..."
cd "$EVENDEV_DIR"
./start-even.sh bioloop
