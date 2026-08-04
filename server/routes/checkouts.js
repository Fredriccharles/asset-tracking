const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/checkoutController');

router.use(requireAuth);
router.get('/', ctrl.listCheckouts);

// Check-out / check-in actions are admin-only
router.post('/', requireAdmin, ctrl.checkOutItem);
router.post('/:id/checkin', requireAdmin, ctrl.checkInItem);

module.exports = router;
