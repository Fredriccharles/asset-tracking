const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.use(requireAuth);
// Report generation is admin-only
router.get('/items', requireAdmin, ctrl.itemsReport);
router.get('/checkouts', requireAdmin, ctrl.checkoutsReport);
router.get('/maintenance', requireAdmin, ctrl.maintenanceReport);
router.get('/retirements', requireAdmin, ctrl.retirementsReport);
router.get('/audit', requireAdmin, ctrl.auditReport);

module.exports = router;
