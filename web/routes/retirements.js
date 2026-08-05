const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/retirementController');

router.use(requireAuth);
router.get('/', ctrl.listRetirements);
router.post('/', requireAdmin, ctrl.retireItem);

module.exports = router;
