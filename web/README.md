# Asset Tracker — Web Version

A web-deployable build of the Asset Tracking & Maintenance Management System.
This is the same app as the desktop version, but it runs as a normal web server
(binds `0.0.0.0`, configurable port) so it can be hosted on a VPS, a cloud
platform, or your own network — reachable over the internet.

## What's included

- `server.js` — web server entry point (binds to `0.0.0.0`, port from `PORT`)
- `app.js` + `controllers/`, `routes/`, `services/`, `db/`, `middleware/` — the
  backend (identical to the desktop build)
- `client/dist/` — the pre-built React front end (served by the same server)
- `package.json` — dependencies for the web server
- `Dockerfile` — containerized deployment
- `start.bat` / `start.sh` — quick start scripts
- `.env.example` — environment variable reference

## Quick start (local / LAN)

```bash
# 1. Install dependencies
npm install

# 2. (Optional) create a .env based on .env.example
copy .env.example .env        # Windows
cp .env.example .env          # macOS / Linux

# 3. Start the server
npm start
```

Then open `http://localhost:8080` (or your machine's LAN IP, e.g.
`http://192.168.1.50:8080`) in a browser.

Default login (first run only): `admin` / `admin123`. **Change it immediately.**

## Deploying over the internet

### Option A — Cloud platform (easiest)

Deploy to a platform that supports Node.js apps, e.g. Render, Railway, Fly.io,
or Heroku.

1. Push this `web/` folder to a Git repository.
2. Create a new Web Service pointing at that repo.
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Environment variables:** set `PORT` (most platforms inject it), and
     override `ADMIN_USERNAME` / `ADMIN_PASSWORD` before first boot.
3. The platform gives you a public HTTPS URL.

> Note: These platforms often use an **ephemeral filesystem**. Use a persistent
> disk/database, or set `APP_DATA_DIR` / `DB_PATH` to a mounted volume, so your
> data survives restarts.

### Option B — VPS / cloud VM

1. Copy the `web/` folder to your server.
2. Install Node.js 18+.
3. `npm install && npm start`
4. Open your server's firewall for port `8080`.
5. Point your domain at the server and (recommended) put it behind a reverse
   proxy like Nginx plus HTTPS via Let's Encrypt.

### Option C — Docker

```bash
docker build -t asset-tracker .
docker run -d --name asset-tracker -p 8080:8080 \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD=change-me \
  -v asset-data:/app/data \
  asset-tracker
```

## Security notes for public deployment

- **Always change the default admin password** right after first login.
- Set `ADMIN_USERNAME` / `ADMIN_PASSWORD` env vars before first run so the
  seeded account uses strong credentials.
- Put the app behind HTTPS (reverse proxy or platform-provided TLS).
- The app is a single-admin/multi-user system with role-based access
  (`admin` / `user`). Manage accounts from **Settings**.
- Backups are stored on the server filesystem in `data/backups`.
