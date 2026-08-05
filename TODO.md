# Task Progress

## Goal: Fix Excel exports to show values (not codes) in packaged app + create a web-deployable version

### Part 1 — Rebuild packaged app (Excel fix)
- [x] Step 1: Build client bundle (`npm run client:build`)
- [x] Step 2: Rebuild Electron package (`npx electron-builder`) so bundled `app.asar` includes fixed `reportController.js`
- [x] Step 3: Verify new installer exists in `release/` (Asset Tracker Setup 1.0.0.exe, updated 8/5/2026)

### Part 2 — Create web version (internet deployable) in `web/` folder
- [x] Step 4: Create `web/` folder structure with web-optimized server (binds 0.0.0.0, configurable port)
- [x] Step 5: Add `.env.example`, `README.md`, `start.bat`, `start.sh`, `Dockerfile`, `.dockerignore`
- [x] Step 6: Build client into web bundle + copy server files to make `web/` self-contained
- [x] Step 7: Verify web bundle completeness
  - [x] `npm install` succeeds (277 packages)
  - [x] Server starts and binds to `0.0.0.0:8080`
  - [x] Health endpoint returns `{"status":"ok"}`
  - [x] Root serves React app (`id="root"`, "Asset Tracker" title, HTTP 200)
  - [x] Reports endpoint correctly requires auth (401 without token)

### Notes
- The label-conversion code already exists in `server/controllers/reportController.js` (maps all status/priority/action codes to readable labels for both PDF & Excel).
- Root cause of user seeing codes: packaged `release/` app.asar predates the fixes.

