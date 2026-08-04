const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/retirementController');

router.use(requireAuth);
router.get('/', ctrl.listRetirements);
router.post('/', ctrl.retireItem);

module.exports = router;
