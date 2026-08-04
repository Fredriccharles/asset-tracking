const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/backupController');

const upload = multer({ dest: path.join(os.tmpdir(), 'asset-tracker-uploads') });

router.use(requireAuth);
router.get('/', ctrl.listBackups);
router.post('/', ctrl.createBackup);
router.get('/download/:filename', ctrl.downloadBackup);
router.post('/restore', upload.single('backupFile'), ctrl.restoreBackup);

module.exports = router;
