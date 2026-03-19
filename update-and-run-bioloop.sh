#!/bin/bash
echo "=========================================="
echo "  Adaptive Learning Updater & Launcher"
echo "=========================================="
echo ""

REPO_DIR="$HOME/OneDrive/Desktop/adaptive-learning"

# Step 1: Pull latest changes
echo "[1/3] Pulling latest changes..."
cd "$REPO_DIR" || { echo "ERROR: $REPO_DIR not found."; echo "Clone it first with:"; echo "  git clone https://github.com/Princelll/adaptive-learning.git \"$REPO_DIR\""; exit 1; }
git pull origin main
if [ $? -ne 0 ]; then
    echo "ERROR: Git pull failed. Check your internet connection."
    read -p "Press enter to exit..."
    exit 1
fi

# Step 2: Install dependencies
echo ""
echo "[2/3] Installing dependencies..."
npm install

# Step 3: Start the emulator
echo ""
echo "[3/3] Starting Adaptive Learning emulator..."
npm run dev
