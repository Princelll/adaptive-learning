@echo off
echo ==========================================
echo   Adaptive Learning - Simulator Launcher
echo ==========================================
echo.

:: Find git-bash.exe (check common install locations)
set GITBASH=
if exist "C:\Program Files\Git\git-bash.exe"           set GITBASH=C:\Program Files\Git\git-bash.exe
if exist "C:\Program Files (x86)\Git\git-bash.exe"     set GITBASH=C:\Program Files (x86)\Git\git-bash.exe
if exist "%LOCALAPPDATA%\Programs\Git\git-bash.exe"    set GITBASH=%LOCALAPPDATA%\Programs\Git\git-bash.exe

if "%GITBASH%"=="" (
  echo ERROR: Git Bash not found. Please install Git for Windows.
  echo Download: https://git-scm.com
  pause
  exit /b 1
)

echo Found Git Bash at: %GITBASH%
echo.

:: Run everything inside Git Bash as a single inline script
"%GITBASH%" --login -i -c "
REPO=\"$HOME/OneDrive/Desktop/adaptive-learning\"
EVEN_DEV=\"$HOME/even-dev\"
BRANCH=\"claude/add-bioloop-ml-system-nLfSa\"
APP_NAME=\"adaptive-learning\"

echo ''
echo '=========================================='
echo '  Adaptive Learning - Simulator Launcher'
echo '=========================================='

echo ''
echo '[1/5] Pulling latest code...'
cd \"\$REPO\" || { echo 'ERROR: Repo not found at '\$REPO; read -p 'Press enter...'; exit 1; }
git fetch origin
git checkout \"\$BRANCH\" 2>/dev/null
git pull origin \"\$BRANCH\"

echo ''
echo '[2/5] Syncing to even-dev...'
rm -rf \"\$EVEN_DEV/apps/\$APP_NAME\"
cp -r \"\$REPO\" \"\$EVEN_DEV/apps/\"
echo '  Done.'

echo ''
echo '[3/5] Installing dependencies...'
cd \"\$EVEN_DEV/apps/\$APP_NAME\"
npm install --silent

echo ''
echo '[4/5] Opening companion app...'
COMPANION_WIN=\$(cygpath -w \"\$EVEN_DEV/apps/\$APP_NAME/companion/index.html\")
explorer.exe \"\$COMPANION_WIN\" 2>/dev/null || true

echo ''
echo '[5/5] Starting simulator...'
echo '  G2 app:    http://localhost:5173'
echo '  Companion: opened in browser'
echo '  Press Ctrl+C to stop.'
echo '=========================================='
cd \"\$EVEN_DEV\"
./start-even.sh \"\$APP_NAME\"

read -p 'Simulator stopped. Press enter to close...'
"
