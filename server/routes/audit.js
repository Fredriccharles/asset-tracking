const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { listAudit } = require('../controllers/auditController');

router.use(requireAuth);
router.get('/', listAudit);

module.exports = router;
