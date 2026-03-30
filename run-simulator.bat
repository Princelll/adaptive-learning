@echo off
set GITBASH=C:\Program Files\Git\git-bash.exe
set BRANCH=claude/add-bioloop-ml-system-nLfSa

if not exist "%GITBASH%" (
  echo ERROR: Git Bash not found at %GITBASH%
  echo Install Git for Windows from https://git-scm.com
  pause
  exit /b 1
)

start "Adaptive Learning Simulator" "%GITBASH%" -c "cd ~/OneDrive/Desktop/adaptive-learning && echo '[0/5] Updating local scripts...' && git fetch origin %BRANCH% 2>/dev/null && git reset --hard origin/%BRANCH% 2>/dev/null || true; bash run-simulator.sh; echo ''; read -p 'Press enter to close...'"
