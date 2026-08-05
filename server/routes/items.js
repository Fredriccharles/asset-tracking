const express = require('express');
const path = require('path');
const os = require('os');
const multer = require('multer');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/itemController');

const upload = multer({ dest: path.join(os.tmpdir(), 'asset-tracker-imports') });

router.use(requireAuth);
router.get('/categories', ctrl.listCategories);
router.get('/subcategories', ctrl.listSubcategories);
router.get('/', ctrl.listItems);
router.get('/import/template', requireAdmin, ctrl.downloadTemplate);
router.get('/:id', ctrl.getItem);

// Write operations are admin-only
router.post('/categories', requireAdmin, ctrl.createCategory);
router.post('/subcategories', requireAdmin, ctrl.createSubcategory);
router.post('/', requireAdmin, ctrl.createItem);
router.post('/import', requireAdmin, upload.single('file'), ctrl.importItems);
router.put('/:id', requireAdmin, ctrl.updateItem);

module.exports = router;
