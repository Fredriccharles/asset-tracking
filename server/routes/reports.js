const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/reportController');

router.use(requireAuth);
router.get('/items', ctrl.itemsReport);
router.get('/checkouts', ctrl.checkoutsReport);
router.get('/maintenance', ctrl.maintenanceReport);
router.get('/retirements', ctrl.retirementsReport);
router.get('/audit', ctrl.auditReport);

module.exports = router;
