@echo off
REM Asset Tracker - Web version quick start (Windows)
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo Starting Asset Tracker web server on http://localhost:8080
call npm start
