const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { listAudit } = require('../controllers/auditController');

router.use(requireAuth);
// Audit log is admin-only
router.get('/', requireAdmin, listAudit);

module.exports = router;
