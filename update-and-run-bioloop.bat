@echo off
echo ==========================================
echo   Adaptive Learning Updater ^& Launcher
echo ==========================================
echo.

:: Step 1: Update adaptive-learning app
cd /d C:\Users\maria\OneDrive\Desktop\adaptive-learning\adaptive-learning
if errorlevel 1 (
    echo ERROR: Could not find adaptive-learning folder on Desktop.
    echo Clone it first with:
    echo   git clone https://github.com/Princelll/adaptive-learning.git
    pause
    exit /b 1
)

echo [1/5] Pulling latest app changes...
git pull origin main
if errorlevel 1 (
    echo WARNING: Git pull failed for adaptive-learning. Continuing...
)

echo.
echo [2/5] Installing app dependencies...
call npm install

:: Step 2: Copy app into even-dev
echo.
echo [3/5] Copying app into even-dev simulator...
xcopy /E /Y /I "C:\Users\maria\OneDrive\Desktop\adaptive-learning\adaptive-learning" "C:\Users\maria\OneDrive\Desktop\even-dev\apps\adaptive-learning"

:: Step 3: Update even-dev
cd /d C:\Users\maria\OneDrive\Desktop\even-dev
if errorlevel 1 (
    echo ERROR: Could not find even-dev folder on Desktop.
    echo Clone it first with:
    echo   git clone https://github.com/BxNxM/even-dev.git
    pause
    exit /b 1
)

echo.
echo [4/5] Updating even-dev dependencies...
call npm install

:: Step 4: Launch the simulator with adaptive-learning
echo.
echo [5/5] Starting Even Hub simulator with Adaptive Learning...
call ./start-even.sh adaptive-learning

pause
