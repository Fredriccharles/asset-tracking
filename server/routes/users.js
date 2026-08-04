const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { listUsers, createUser, updateUser } = require('../controllers/userController');

router.use(requireAuth);

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

module.exports = router;
