@echo off
set GITBASH=C:\Program Files\Git\git-bash.exe

if not exist "%GITBASH%" (
  echo ERROR: Git Bash not found at %GITBASH%
  echo Install Git for Windows from https://git-scm.com
  pause
  exit /b 1
)

start "Adaptive Learning Simulator" "%GITBASH%" -c "cd ~/OneDrive/Desktop/adaptive-learning && bash run-simulator.sh; echo ''; read -p 'Press enter to close...'"
