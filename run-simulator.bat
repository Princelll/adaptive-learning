@echo off
echo ==========================================
echo   Adaptive Learning - Simulator Launcher
echo ==========================================
echo.

:: Find git-bash.exe
set GITBASH=
if exist "C:\Program Files\Git\git-bash.exe"           set GITBASH=C:\Program Files\Git\git-bash.exe
if exist "C:\Program Files (x86)\Git\git-bash.exe"     set GITBASH=C:\Program Files (x86)\Git\git-bash.exe
if exist "%LOCALAPPDATA%\Programs\Git\git-bash.exe"    set GITBASH=%LOCALAPPDATA%\Programs\Git\git-bash.exe

if "%GITBASH%"=="" (
  echo ERROR: Git Bash not found.
  pause
  exit /b 1
)

echo Found: %GITBASH%
echo.
echo Starting Git Bash... (a new window will open)
echo.

:: Write the script to a temp file so we can see errors
set TMPSCRIPT=%TEMP%\adaptive-learning-launch.sh
(
echo REPO="$HOME/OneDrive/Desktop/adaptive-learning"
echo EVEN_DEV="$HOME/even-dev"
echo BRANCH="claude/add-bioloop-ml-system-nLfSa"
echo APP_NAME="adaptive-learning"
echo.
echo echo ""
echo echo "=== [1/5] Pulling latest code ==="
echo cd "$REPO" ^|^| { echo "ERROR: Repo not found at $REPO"; read -p "Press enter..."; exit 1; }
echo git fetch origin
echo git checkout "$BRANCH" 2^>/dev/null
echo git pull origin "$BRANCH"
echo.
echo echo ""
echo echo "=== [2/5] Syncing to even-dev ==="
echo rm -rf "$EVEN_DEV/apps/$APP_NAME"
echo cp -r "$REPO" "$EVEN_DEV/apps/"
echo echo "Done."
echo.
echo echo ""
echo echo "=== [3/5] Installing dependencies ==="
echo cd "$EVEN_DEV/apps/$APP_NAME"
echo npm install --silent
echo.
echo echo ""
echo echo "=== [4/5] Opening companion ==="
echo explorer.exe "$(cygpath -w "$EVEN_DEV/apps/$APP_NAME/companion/index.html")" 2^>/dev/null ^|^| true
echo.
echo echo ""
echo echo "=== [5/5] Starting simulator ==="
echo echo "  Open browser at: http://localhost:5173"
echo echo "  Press Ctrl+C to stop"
echo echo "==========================================="
echo cd "$EVEN_DEV"
echo ./start-even.sh "$APP_NAME"
echo.
echo read -p "Simulator stopped. Press enter to close..."
) > "%TMPSCRIPT%"

:: Launch git-bash with the temp script (keeps window open)
start "Adaptive Learning Simulator" "%GITBASH%" --login -i "%TMPSCRIPT%"

echo Git Bash launched. Check the new window.
pause
