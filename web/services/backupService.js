const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { db, DB_PATH, DB_DIR } = require('../db/init');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(DB_DIR, '..', 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Creates a consistent backup of the live SQLite database using the
 * native `VACUUM INTO` mechanism (safe even while the app is running,
 * unlike a raw file copy which could catch a mid-write WAL state).
 */
function createBackup(type = 'auto') {
  const filename = `assets-backup-${timestamp()}.db`;
  const destPath = path.join(BACKUP_DIR, filename);

  db.exec(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);

  const size = fs.statSync(destPath).size;
  db.prepare('INSERT INTO backups (filename, type, size_bytes) VALUES (?, ?, ?)').run(filename, type, size);

  applyRetention();
  return { filename, path: destPath, size, type, created_at: new Date().toISOString() };
}

/** Deletes old auto backups beyond the retention count set in `settings`. */
function applyRetention() {
  const retentionRow = db.prepare(`SELECT value FROM settings WHERE key = 'backup_retention'`).get();
  const retention = parseInt(retentionRow ? retentionRow.value : '12', 10) || 12;

  const autos = db.prepare(`SELECT * FROM backups WHERE type = 'auto' ORDER BY created_at DESC`).all();
  if (autos.length > retention) {
    const toDelete = autos.slice(retention);
    toDelete.forEach((b) => {
      const p = path.join(BACKUP_DIR, b.filename);
      if (fs.existsSync(p)) fs.unlinkSync(p);
      db.prepare('DELETE FROM backups WHERE id = ?').run(b.id);
    });
  }
}

function listBackups() {
  return db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all().map((b) => {
    const p = path.join(BACKUP_DIR, b.filename);
    return { ...b, exists: fs.existsSync(p) };
  });
}

/**
 * Restores the database from a backup file. The safest approach for
 * a single-process SQLite app is: copy the chosen backup over the live
 * DB file, then require the caller (server bootstrap / Electron main)
 * to restart the process so a fresh `better-sqlite3` handle is opened.
 */
function restoreFromFile(sourcePath) {
  if (!fs.existsSync(sourcePath)) throw new Error('Backup file not found.');

  // Safety net: back up current state before overwriting, in case of a mistake.
  createBackup('auto');

  // Close the current handle cleanly before overwriting the file on disk.
  db.pragma('wal_checkpoint(TRUNCATE)');
  fs.copyFileSync(sourcePath, DB_PATH);
  // Remove stale WAL/SHM files so the restored file is read cleanly on restart.
  ['-wal', '-shm'].forEach((suffix) => {
    const p = DB_PATH + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  });

  return true;
}

function scheduleMonthlyBackup() {
  // Runs at 02:00 on the 1st of every month.
  cron.schedule('0 2 1 * *', () => {
    try {
      createBackup('auto');
      console.log('[backup] Monthly automatic backup completed.');
    } catch (err) {
      console.error('[backup] Automatic backup failed:', err.message);
    }
  });

  // Also perform a startup safety backup if none exists yet this month, so
  // a machine that's never left running overnight still gets covered.
  const lastAuto = db.prepare(`SELECT created_at FROM backups WHERE type='auto' ORDER BY created_at DESC LIMIT 1`).get();
  const thisMonth = new Date().toISOString().slice(0, 7);
  if (!lastAuto || !lastAuto.created_at.startsWith(thisMonth)) {
    try {
      createBackup('auto');
      console.log('[backup] Startup catch-up backup created for this month.');
    } catch (err) {
      console.error('[backup] Startup backup failed:', err.message);
    }
  }
}

module.exports = { createBackup, listBackups, restoreFromFile, scheduleMonthlyBackup, BACKUP_DIR };
