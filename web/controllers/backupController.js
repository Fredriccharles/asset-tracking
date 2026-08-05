const path = require('path');
const backupService = require('../services/backupService');
const { logAction } = require('../middleware/audit');

function listBackups(req, res) {
  res.json(backupService.listBackups());
}

function createBackup(req, res) {
  try {
    const result = backupService.createBackup('manual');
    logAction(req, 'BACKUP_CREATE', 'backup', null, { filename: result.filename });
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: `Backup failed: ${err.message}` });
  }
}

function downloadBackup(req, res) {
  const backups = backupService.listBackups();
  const match = backups.find((b) => b.filename === req.params.filename);
  if (!match) return res.status(404).json({ error: 'Backup not found.' });
  res.download(path.join(backupService.BACKUP_DIR, match.filename));
}

// Restore from an uploaded .db file (via multer) OR an existing backup filename.
function restoreBackup(req, res) {
  try {
    let sourcePath;
    if (req.file) {
      sourcePath = req.file.path;
    } else if (req.body.filename) {
      sourcePath = path.join(backupService.BACKUP_DIR, req.body.filename);
    } else {
      return res.status(400).json({ error: 'Provide either an uploaded file or a filename of an existing backup.' });
    }

    backupService.restoreFromFile(sourcePath);
    logAction(req, 'RESTORE', 'backup', null, { source: sourcePath });

    res.json({
      message: 'Database restored successfully. The application must be restarted for the changes to take effect.',
      requiresRestart: true,
    });
  } catch (err) {
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
}

module.exports = { listBackups, createBackup, downloadBackup, restoreBackup };
