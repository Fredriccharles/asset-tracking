const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/checkoutController');

router.use(requireAuth);
router.get('/', ctrl.listCheckouts);
router.post('/', ctrl.checkOutItem);
router.post('/:id/checkin', ctrl.checkInItem);

module.exports = router;
