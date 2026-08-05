const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

// The DB file lives outside the app bundle so it survives updates.
// In Electron this path is overridden to app.getPath('userData').
const DB_DIR = process.env.APP_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'assets.db');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// SQLite's "CREATE TABLE IF NOT EXISTS" only creates a table the first time
// it's seen — it never adds new columns to a table that already exists on
// an existing installation. Every time a column is added to schema.sql after
// the app has already been released, it must also be listed here, or people
// upgrading from an older database will hit "no such column" errors even
// though a brand-new database works fine. This runs on every startup and is
// a cheap no-op once a given column already exists.
function ensureColumn(table, column, definition) {
  const existingCols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!existingCols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[db] Migrated existing database: added ${table}.${column}`);
  }
}

function runMigrations() {
  // Added when the Category -> Subcategory hierarchy was introduced.
  ensureColumn('items', 'subcategory_id', 'INTEGER REFERENCES subcategories(id) ON DELETE SET NULL');
  // Added when the Asset History module was introduced.
  ensureColumn('asset_history', 'performed_by', 'TEXT');
  ensureColumn('asset_history', 'reference_type', 'TEXT');
  ensureColumn('asset_history', 'reference_id', 'INTEGER');
  ensureColumn('asset_history', 'metadata', 'TEXT');

// --- Role-based access control ---
  // The original schema declared role CHECK (role IN ('admin')) which in SQLite
  // can only be changed by rebuilding the table. Existing databases created
  // before viewers were introduced need this one-time rebuild so non-admin
  // 'user' accounts can be saved.
  //
  // IMPORTANT: By default SQLite REWRITES foreign-key references in OTHER
  // tables when you RENAME a table. If we rename `users` -> `users_old`, every
  // table that references users (audit_log.user_id, checkouts.checked_out_by,
  // maintenance_tickets.created_by, retirements.retired_by) would be rewritten
  // to point at `users_old`, and dropping it would corrupt the database.
  // `PRAGMA legacy_alter_table=ON` prevents that rewrite, so the references
  // keep pointing at `users` and the rebuilt table satisfies them.
  try {
    const check = db.prepare(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='users'`
    ).get();
    if (check && check.sql && !/role IN \('admin','user'\)/.test(check.sql)) {
      db.pragma('foreign_keys = OFF');
      db.pragma('legacy_alter_table = ON');
      db.exec(`
        BEGIN;
        CREATE TABLE users_new (
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
        INSERT INTO users_new (id, username, password_hash, full_name, role, is_active, last_login_at, created_at, updated_at)
          SELECT id, username, password_hash, full_name, role, is_active, last_login_at, created_at, updated_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
        COMMIT;
      `);
      db.pragma('legacy_alter_table = OFF');
      db.pragma('foreign_keys = ON');
      console.log('[db] Migrated users table to support the "user" role.');
    }
  } catch (err) {
    // If the migration already ran or the table is in an unexpected state, roll back safely.
    try { db.exec('ROLLBACK;'); } catch (_) {}
    db.pragma('legacy_alter_table = OFF');
    db.pragma('foreign_keys = ON');
    console.warn('[db] users table role migration skipped:', err.message);
  }
}

function initSchema() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    db.exec(schema);
  } catch (err) {
    // An existing database from before a schema change can fail partway
    // through this script — e.g. a new index on a column that doesn't exist
    // yet on an older installation. Patch in whatever columns are missing,
    // then re-apply the full schema. Safe to run twice: every statement is
    // IF NOT EXISTS.
    console.warn('[db] Schema mismatch on existing database, migrating:', err.message);
    runMigrations();
    db.exec(schema);
  }

  // Unconditional safety net: covers columns that schema.sql itself never
  // errors on (CREATE TABLE IF NOT EXISTS silently ignores an outdated
  // existing table) but that application code elsewhere still depends on.
  runMigrations();

  // Seed the single admin account on first run only.
  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount === 0) {
    const defaultUsername = process.env.ADMIN_USERNAME || 'admin';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(defaultPassword, 10);
    db.prepare(
      `INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, 'admin')`
    ).run(defaultUsername, hash, 'System Administrator');
    console.log(`[db] Seeded default admin user "${defaultUsername}". Please change the password after first login.`);
  }

  // Seed a few starter categories if none exist.
  const catCount = db.prepare('SELECT COUNT(*) AS c FROM categories').get().c;
  if (catCount === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)');
    const starter = [
      ['IT Equipment', 'Computers, monitors, peripherals'],
      ['Furniture', 'Desks, chairs, cabinets'],
      ['Vehicles', 'Company-owned vehicles'],
      ['Tools & Machinery', 'Hand tools, power tools, heavy equipment'],
    ];
    const insertMany = db.transaction((rows) => rows.forEach((r) => insertCat.run(...r)));
    insertMany(starter);
  }

  // Default settings
  const setDefault = db.prepare(`INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`);
  setDefault.run('company_name', 'My Company');
  setDefault.run('backup_schedule', 'monthly');
  setDefault.run('backup_retention', '12');
}

initSchema();

module.exports = { db, DB_PATH, DB_DIR };
