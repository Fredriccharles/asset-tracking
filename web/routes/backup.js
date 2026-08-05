const express = require('express');
const path = require('path');
const multer = require('multer');
const os = require('os');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/backupController');

const upload = multer({ dest: path.join(os.tmpdir(), 'asset-tracker-uploads') });

router.use(requireAuth);
// Backup & restore are admin-only
router.get('/', requireAdmin, ctrl.listBackups);
router.post('/', requireAdmin, ctrl.createBackup);
router.get('/download/:filename', requireAdmin, ctrl.downloadBackup);
router.post('/restore', requireAdmin, upload.single('backupFile'), ctrl.restoreBackup);

module.exports = router;
