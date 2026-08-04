const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/itemController');

router.use(requireAuth);
router.get('/categories', ctrl.listCategories);
router.post('/categories', ctrl.createCategory);
router.get('/subcategories', ctrl.listSubcategories);
router.post('/subcategories', ctrl.createSubcategory);
router.get('/', ctrl.listItems);
router.post('/', ctrl.createItem);
router.get('/:id', ctrl.getItem);
router.put('/:id', ctrl.updateItem);

module.exports = router;
