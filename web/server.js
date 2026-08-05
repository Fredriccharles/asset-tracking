/**
 * Asset Tracker — Web Server Entry Point
 * --------------------------------------
 * A web-deployable variant of the Asset Tracking System.
 *
 * Differences from the desktop/Electron build:
 *   - Binds to 0.0.0.0 so it is reachable over the LAN / internet
 *   - Uses an externally-configurable PORT (default 8080)
 *   - Expects the built React client in `client/dist`
 *   - Data lives in `data/` (override with APP_DATA_DIR / DB_PATH env vars)
 *
 * Deployment examples:
 *   - Local / LAN:        node server.js
 *   - With env overrides: PORT=3000 ADMIN_USERNAME=admin ADMIN_PASSWORD=secret node server.js
 *   - Docker:             docker build -t asset-tracker . && docker run -p 8080:8080 asset-tracker
 *
 * For a public internet deployment, host this on a VPS / platform such as
 * Render, Railway, Fly.io, or a cloud VM and point your domain at it.
 */
const path = require('path');
// Load .env vars (PORT, HOST, ADMIN_*, DB paths) if a .env file is present.
try { require('dotenv').config(); } catch (_) {}
const { createApp } = require('./app');
const { scheduleMonthlyBackup } = require('./services/backupService');

// Bind to all interfaces so the app is reachable beyond localhost.
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '8080', 10);

function start() {
  const app = createApp();
  const server = app.listen(PORT, HOST, () => {
    console.log(`[asset-tracker] Web app running on http://${HOST}:${PORT}`);
    console.log(`[asset-tracker] Data directory: ${process.env.APP_DATA_DIR || path.join(__dirname, 'data')}`);
    // Schedule automatic monthly backups (safe to run in a long-lived server).
    scheduleMonthlyBackup();
  });
  return server;
}

if (require.main === module) {
  start();
}

module.exports = { start, PORT, HOST };
