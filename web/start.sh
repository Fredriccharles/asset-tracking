#!/usr/bin/env bash
# Asset Tracker - Web version quick start (macOS / Linux)
set -e
cd "$(dirname "$0")"
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi
echo "Starting Asset Tracker web server on http://localhost:8080"
npm start
