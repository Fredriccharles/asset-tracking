# Asset Tracking & Maintenance Management System

An offline-first desktop application for tracking company assets, check-in/check-out,
maintenance tickets, retirement/disposal, reporting, and backups — built with
**Electron + React (frontend)**, **Node.js/Express (backend API)**, and **SQLite (database)**.

The entire application runs **locally with no internet connection required**. The
Electron process hosts the Express API in-process and serves the built React UI on
a local port; SQLite stores everything on disk in the user's app-data folder.

---

## 1. Architecture

```
asset-tracker/
├── electron/           # Electron main process + preload (desktop shell)
│   ├── main.js
│   └── preload.js
├── server/              # Backend layer — Express REST API
│   ├── app.js            # Express app: routes + static file serving
│   ├── server.js          # Bootstraps the HTTP server + backup scheduler
│   ├── db/
│   │   ├── schema.sql      # Relational schema (portable SQL, not SQLite-only)
│   │   └── init.js          # Connection, schema init, admin/user seed
│   ├── controllers/        # Business logic per resource
│   ├── routes/              # Express routers (thin, map HTTP -> controllers)
│   ├── middleware/           # auth.js (JWT), audit.js (audit log writer)
│   └── services/              # backupService.js, reportService.js (PDF/Excel)
└── client/              # Frontend layer — React (Vite) single-page app
    └── src/
        ├── api/           # Axios client (one function per endpoint)
        ├── context/        # AuthContext (session state)
        ├── components/      # Reusable UI (Layout, Sidebar, Modal, etc.)
        └── pages/             # One file per screen
```

This is a deliberate 3-layer separation (**frontend / backend / database**) so that:

- The **database layer** (`server/db/schema.sql` + `init.js`) is the only place that
  knows about SQLite specifics. The schema uses only portable types
  (`INTEGER`, `TEXT`, `REAL`), explicit foreign keys, and ISO-8601 timestamps —
  no SQLite-only features are relied on semantically. Migrating to MySQL/PostgreSQL
  later means swapping this layer (e.g. for a `pg`/`mysql2` driver + equivalent
  schema) without touching controllers, routes, or the frontend, **as long as the
  same `db.prepare(...).run()/.get()/.all()` call shape is preserved** — the
  cleanest path is to introduce a thin query-adapter matching `better-sqlite3`'s
  synchronous API, or refactor controllers to `async/await` against a promise-based
  driver.
- The **backend layer** exposes a plain REST API (`/api/...`) — nothing about it is
  Electron-specific, so it could be redeployed as a normal web server if ever needed.
- The **frontend layer** talks to the backend only via `fetch`/`axios` over HTTP,
  so it doesn't care whether it's running inside Electron, a browser, or a future
  mobile shell.

---

## 2. Features implemented

- **Single admin login** — JWT-based session, password hashed with bcrypt, seeded
  automatically on first run (`admin` / `admin123` — change immediately).
- **Dashboard** — live counts by status, total active fleet value, open maintenance
  tickets, overdue check-outs, breakdown by category, recent activity feed.
- **Item management** — manual, unique asset codes (no auto-SKUs), full item detail
  (category, manufacturer, model, serial, purchase info, location, condition notes).
- **Check-in / check-out tracking** — full history per item, holder, department,
  expected vs. actual return dates, condition notes at both ends.
- **Maintenance ticketing** — opening a ticket **immediately marks the asset
  "Under Repair"**, which the checkout endpoint enforces server-side (not just in
  the UI) — an item under repair or retired cannot be checked out. Closing/cancelling
  the last open ticket on an item releases it back to "Available".
- **Retirement / disposal** — soft retirement only. Retiring an item never deletes
  its row; it flips `items.status = 'retired'` and inserts a permanent record in
  `retirements`. Retired items can't be edited, checked out, or have new tickets
  raised against them.
- **Advanced search & filtering** — free-text search plus status/category/location
  filters, sortable, paginated, on Items, Check-outs, Maintenance, Retirements, and
  the Audit Log.
- **PDF / Excel reports** — Inventory, Check-out history, Maintenance, Retirements,
  and Audit log, each exportable as PDF (`pdfkit`) or Excel (`exceljs`) with the
  same filters as the on-screen list.
- **Monthly automatic backups + manual restore** — `node-cron` runs a backup on the
  1st of every month (plus a catch-up backup on startup if one hasn't run yet this
  month); a "Create Backup Now" button exists for manual backups; restoring accepts
  either an uploaded `.db` file or a previous backup from the list, always taking a
  safety backup of the current state first.
- **Complete audit log** — every create/update/login/checkout/checkin/ticket/
  retirement/backup/restore/report action is written to an append-only `audit_log`
  table with user, timestamp, entity, and a JSON detail blob. Filterable and
  exportable to PDF.

---

## 3. Getting started (development)

**Requirements:** Node.js 18+ and npm.

```bash
# from the project root
npm install              # installs server deps + (via postinstall) client deps

npm run dev               # runs backend (nodemon), Vite dev server, and Electron together
```

`npm run dev` starts three processes concurrently:
1. `server:dev` — Express API on `http://127.0.0.1:4310` with live reload (nodemon)
2. `client:dev` — Vite dev server on `http://127.0.0.1:5173` with hot reload,
   proxying `/api/*` to the backend
3. `electron:dev` — waits for both, then opens the Electron window pointed at the
   Vite dev server

If you only want the API (e.g. to test with curl/Postman) or only the web UI in a
browser, you can run the pieces individually:

```bash
npm run server:dev     # backend only
npm run client:dev     # frontend only (visit http://localhost:5173 in a browser)
```

## 4. Building the desktop app (Windows installer)

```bash
npm run build
```

This single command now does everything needed to produce a working installer:

1. Builds the React app (`client:build`)
2. Rebuilds native modules (`better-sqlite3`) for **Electron's** Node ABI —
   this is required because Electron bundles its own Node.js runtime, which
   is not the same version as the Node.js used to `npm install`. Skipping
   this step is the most common cause of a packaged app crashing on launch
   with an `ERR_DLOPEN_FAILED` / native-module error on a different machine.
3. Runs `electron-builder`, which packages the app into an installer in
   `/release` (an `.exe` on Windows, via NSIS)
4. Rebuilds `better-sqlite3` back to the **plain Node.js** ABI, so `npm run
   dev` keeps working immediately afterward without any manual step

If you only need step 2 or 4 on their own (e.g. while debugging), they're
available directly as `npm run rebuild:electron` and `npm run rebuild:node`.

The build config also unpacks native `.node` binaries from the packaged
app's `asar` archive (`asarUnpack: ["**/*.node"]` in `package.json`) —
required because compiled native addons can't be loaded from inside an
`asar` archive at runtime. Both of these steps were verified end-to-end in
development: the packaged app was launched headlessly and confirmed to open
its database, seed the admin account, run its startup backup, and serve the
UI correctly from the packaged build.

`npm start` is a quicker way to run the packaged *behavior* without
producing an installer: it builds the client, then launches Electron in
production mode against your regular Node-ABI-compiled native modules
(skipping the Electron rebuild), which is fine for a local check but not
for a build you intend to hand to someone else.

## 5. Where your data lives

- **Development** (`npm run dev`): `server/data/assets.db`
- **Packaged app**: inside Electron's per-user app-data directory (e.g.
  `%APPDATA%/asset-tracker/data/assets.db` on Windows, `~/Library/Application
  Support/asset-tracker/data` on macOS, `~/.config/asset-tracker/data` on Linux),
  so your data survives app updates/reinstalls. Backups live in the sibling
  `backups/` folder in the same location.

## 6. Default admin account

On first run the system seeds one admin user:

- **Username:** `admin`
- **Password:** `admin123`

**Change this password immediately** via the in-app "Change Password" flow (exposed
through `POST /api/auth/change-password`; wire a Settings screen to it, or call it
directly, if you want a dedicated UI for this beyond the API). You can also override
the seeded credentials by setting `ADMIN_USERNAME` / `ADMIN_PASSWORD` environment
variables before the very first run.

For production, also set a strong `JWT_SECRET` environment variable (see `server/middleware/auth.js`) — the code ships with a
development fallback secret that must not be relied on for a real deployment.

## 7. Design notes & trade-offs

- **Offline by design.** No CDN fonts, no external API calls, no telemetry. All
  dependencies are bundled at build time.
- **Soft deletes everywhere that matters.** Items are never SQL-`DELETE`d once
  created; retirement is the only "removal" path, and it's reversible only by
  direct database intervention — by design, since the system exists partly to
  preserve historical asset records.
- **Server-side enforcement of business rules.** The "can't deploy an item under
  repair" rule (and similar rules like "can't retire a checked-out item") are
  enforced in the Express controllers, not just hidden in the UI — this matters
  because the same API could be scripted or called directly.
- **Single Express process serves both API and UI in production**, so the packaged
  app only needs one local port and has no cross-origin concerns.
