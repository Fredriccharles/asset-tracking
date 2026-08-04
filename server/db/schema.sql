-- =====================================================================
-- Asset Tracking & Maintenance Management System — SQLite Schema
-- Designed to be portable to MySQL / PostgreSQL:
--   - No SQLite-only types are relied upon semantically (TEXT/INTEGER/REAL only)
--   - All PKs are INTEGER PRIMARY KEY (maps to AUTO_INCREMENT / SERIAL)
--   - Timestamps stored as ISO-8601 TEXT (maps cleanly to DATETIME/TIMESTAMP)
--   - Booleans stored as INTEGER 0/1
--   - Foreign keys declared explicitly with ON DELETE behavior
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- users: single-admin (or multi-admin capable) authentication table
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','user')),
    is_active       INTEGER NOT NULL DEFAULT 1,
    last_login_at   TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- categories: asset categories/types (e.g. Laptop, Vehicle, Tool)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- subcategories: second hierarchy level under a category (e.g. category
-- "IT Equipment" -> subcategories "Laptop", "Desktop", "Monitor"). Used
-- to drive the Asset History module's cascading dropdown navigation.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subcategories (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (category_id, name)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category ON subcategories(category_id);

-- ---------------------------------------------------------------------
-- items: the core asset registry. asset_code is manually assigned
-- and must be unique. status is derived/maintained by business rules
-- in the service layer (see itemController / maintenanceController).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_code          TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id      INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
    description         TEXT,
    manufacturer        TEXT,
    model               TEXT,
    serial_number       TEXT,
    purchase_date       TEXT,
    purchase_cost       REAL,
    supplier            TEXT,
    location            TEXT,
    condition_note      TEXT,
    status              TEXT NOT NULL DEFAULT 'available'
                          CHECK (status IN ('available','checked_out','under_repair','retired')),
    image_path          TEXT,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_subcategory ON items(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_items_asset_code ON items(asset_code);

-- ---------------------------------------------------------------------
-- checkouts: check-in / check-out history. An item has at most ONE
-- active (status='active') checkout row at a time — enforced in code.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkouts (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id                 INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    checked_out_to          TEXT NOT NULL,
    department              TEXT,
    checked_out_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    checkout_date           TEXT NOT NULL DEFAULT (datetime('now')),
    expected_return_date    TEXT,
    return_date             TEXT,
    checked_in_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
    checkout_condition_note TEXT,
    return_condition_note   TEXT,
    status                  TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','returned')),
    notes                   TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_checkouts_item ON checkouts(item_id);
CREATE INDEX IF NOT EXISTS idx_checkouts_status ON checkouts(status);

-- ---------------------------------------------------------------------
-- maintenance_tickets: repair/service tickets. Opening a ticket with
-- status open/in_progress forces the parent item to 'under_repair',
-- which blocks checkout (enforced in checkoutController).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id             INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    issue_description   TEXT NOT NULL,
    priority            TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
    reported_by         TEXT,
    assigned_to         TEXT,
    reported_date       TEXT NOT NULL DEFAULT (datetime('now')),
    started_date        TEXT,
    completed_date       TEXT,
    status              TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','completed','cancelled')),
    resolution_notes    TEXT,
    cost                REAL,
    created_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_maintenance_item ON maintenance_tickets(item_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_tickets(status);

-- ---------------------------------------------------------------------
-- retirements: retirement/disposal records. Items are NEVER deleted —
-- retiring an item sets items.status='retired' and inserts a row here.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS retirements (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id             INTEGER NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
    retired_date        TEXT NOT NULL DEFAULT (datetime('now')),
    reason              TEXT NOT NULL,
    disposal_method     TEXT,
    disposal_value      REAL,
    retired_by          INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes               TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- asset_history: permanent, read-only, chronological lifecycle timeline
-- for a single asset — registration, edits, checkouts, returns, transfers,
-- maintenance, status changes, retirement. Written to by the relevant
-- controller at the moment each event happens (see middleware/assetHistory.js)
-- and never edited or deleted afterward. Powers the Asset History module's
-- level-4 "Asset Timeline" view. This is distinct from audit_log: audit_log
-- is an admin-action compliance trail across every entity in the system;
-- asset_history is a human-readable life story for one specific asset.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asset_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id         INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    event_type      TEXT NOT NULL CHECK (event_type IN (
                        'registration', 'edit', 'checkout', 'return', 'transfer',
                        'maintenance_opened', 'maintenance_updated', 'maintenance_completed',
                        'status_change', 'retirement'
                    )),
    event_date      TEXT NOT NULL DEFAULT (datetime('now')),
    description     TEXT NOT NULL,
    performed_by    TEXT,
    reference_type  TEXT,      -- e.g. 'checkout', 'maintenance_ticket', 'retirement'
    reference_id    INTEGER,   -- id of the row in that reference table, if applicable
    metadata        TEXT,      -- JSON string of any extra structured detail
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_asset_history_item ON asset_history(item_id);
CREATE INDEX IF NOT EXISTS idx_asset_history_event_type ON asset_history(event_type);
CREATE INDEX IF NOT EXISTS idx_asset_history_event_date ON asset_history(event_date);

-- ---------------------------------------------------------------------
-- audit_log: append-only log of every admin action taken in the app.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username        TEXT,
    action          TEXT NOT NULL,        -- e.g. 'ITEM_CREATE', 'CHECKOUT', 'TICKET_CLOSE'
    entity_type     TEXT,                 -- e.g. 'item', 'checkout', 'maintenance_ticket'
    entity_id       INTEGER,
    details         TEXT,                 -- JSON string of relevant before/after data
    ip_address      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- ---------------------------------------------------------------------
-- backups: metadata of backup files created (auto/manual)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS backups (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    filename        TEXT NOT NULL,
    type            TEXT NOT NULL DEFAULT 'auto' CHECK (type IN ('auto','manual')),
    size_bytes      INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- settings: simple key/value store (backup schedule, company name, etc)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
    key             TEXT PRIMARY KEY,
    value           TEXT
);
