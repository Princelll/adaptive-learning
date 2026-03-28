@echo off
echo ==========================================
echo   Adaptive Learning - Simulator Launcher
echo ==========================================
echo.

set GITBASH=C:\Program Files\Git\git-bash.exe
set SCRIPT=/c/Users/%USERNAME%/OneDrive/Desktop/adaptive-learning/run-simulator.sh

if not exist "%GITBASH%" (
  echo ERROR: Git Bash not found at:
  echo   %GITBASH%
  echo.
  echo Please install Git for Windows from https://git-scm.com
  pause
  exit /b 1
)

echo Launching...
start "Adaptive Learning Simulator" "%GITBASH%" --login -i "%SCRIPT%"
