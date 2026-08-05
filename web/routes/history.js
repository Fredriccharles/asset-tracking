const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const ctrl = require('../controllers/historyController');

router.use(requireAuth);
router.get('/categories', ctrl.listCategories);
router.get('/subcategories', ctrl.listSubcategories);
router.get('/assets', ctrl.listAssets);
router.get('/timeline/:itemId', ctrl.getTimeline);

module.exports = router;
