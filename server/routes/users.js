const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { listUsers, createUser, updateUser } = require('../controllers/userController');

router.use(requireAuth);
// User management is admin-only
router.use(requireAdmin);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

module.exports = router;
