const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/itemController');

router.use(requireAuth);
router.get('/categories', ctrl.listCategories);
router.get('/subcategories', ctrl.listSubcategories);
router.get('/', ctrl.listItems);
router.get('/:id', ctrl.getItem);

// Write operations are admin-only
router.post('/categories', requireAdmin, ctrl.createCategory);
router.post('/subcategories', requireAdmin, ctrl.createSubcategory);
router.post('/', requireAdmin, ctrl.createItem);
router.put('/:id', requireAdmin, ctrl.updateItem);

module.exports = router;
