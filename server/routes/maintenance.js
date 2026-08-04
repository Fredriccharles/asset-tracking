const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/maintenanceController');

router.use(requireAuth);
router.get('/', ctrl.listTickets);
router.post('/', ctrl.createTicket);
router.put('/:id', ctrl.updateTicket);

module.exports = router;
