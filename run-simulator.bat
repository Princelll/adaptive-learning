@echo off
echo ==========================================
echo   Adaptive Learning - Simulator Launcher
echo ==========================================
echo.

set SCRIPT=%USERPROFILE%\OneDrive\Desktop\adaptive-learning\run-simulator.sh

if not exist "%SCRIPT%" (
  echo ERROR: run-simulator.sh not found at:
  echo   %SCRIPT%
  echo.
  echo Make sure the repo is at Desktop\adaptive-learning\
  pause
  exit /b 1
)

echo Launching Git Bash...
"C:\Program Files\Git\git-bash.exe" --login -i "%SCRIPT%"
