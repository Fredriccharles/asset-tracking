const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/maintenanceController');

router.use(requireAuth);
router.get('/', ctrl.listTickets);

// Ticket creation/update is admin-only
router.post('/', requireAdmin, ctrl.createTicket);
router.put('/:id', requireAdmin, ctrl.updateTicket);

module.exports = router;
