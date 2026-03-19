@echo off
echo ==========================================
echo   Adaptive Learning Updater ^& Launcher
echo ==========================================
echo.

cd /d C:\Users\maria\OneDrive\Desktop\adaptive-learning
if errorlevel 1 (
    echo ERROR: Could not find adaptive-learning folder on Desktop.
    echo Clone it first with:
    echo   git clone https://github.com/Princelll/adaptive-learning.git
    pause
    exit /b 1
)

echo [1/3] Pulling latest changes...
git pull origin main
if errorlevel 1 (
    echo ERROR: Git pull failed. Check your internet connection.
    pause
    exit /b 1
)

echo.
echo [2/3] Installing dependencies...
call npm install

echo.
echo [3/3] Starting Adaptive Learning emulator...
call npm run dev

pause
