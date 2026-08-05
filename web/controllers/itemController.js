const { db } = require('../db/init');
const { logAction } = require('../middleware/audit');
const { recordHistory } = require('../middleware/assetHistory');

function baseQuery() {
  return `
    SELECT items.*, categories.name AS category_name, subcategories.name AS subcategory_name
    FROM items
    LEFT JOIN categories categories ON categories.id = items.category_id
    LEFT JOIN subcategories subcategories ON subcategories.id = items.subcategory_id
  `;
}

// GET /api/items  — advanced search & filtering
function listItems(req, res) {
  const {
    q,               // free text search: name, asset_code, serial_number, model
    status,          // available|checked_out|under_repair|retired
    category_id,
    subcategory_id,
    location,
    sort = 'updated_at',
    order = 'desc',
    page = 1,
    pageSize = 25,
  } = req.query;

  const where = [];
  const params = {};

  if (q) {
    where.push(`(items.name LIKE @q OR items.asset_code LIKE @q OR items.serial_number LIKE @q OR items.model LIKE @q OR items.manufacturer LIKE @q)`);
    params.q = `%${q}%`;
  }
  if (status) {
    where.push('items.status = @status');
    params.status = status;
  }
  if (category_id) {
    where.push('items.category_id = @category_id');
    params.category_id = category_id;
  }
  if (subcategory_id) {
    where.push('items.subcategory_id = @subcategory_id');
    params.subcategory_id = subcategory_id;
  }
  if (location) {
    where.push('items.location LIKE @location');
    params.location = `%${location}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const allowedSort = ['name', 'asset_code', 'status', 'created_at', 'updated_at', 'purchase_date', 'purchase_cost'];
  const sortCol = allowedSort.includes(sort) ? sort : 'updated_at';
  const orderDir = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  const total = db.prepare(`SELECT COUNT(*) AS c FROM items ${whereSql}`).get(params).c;

  const limit = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 25));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const rows = db
    .prepare(`${baseQuery()} ${whereSql} ORDER BY items.${sortCol} ${orderDir} LIMIT @limit OFFSET @offset`)
    .all({ ...params, limit, offset });

  res.json({ data: rows, total, page: Number(page), pageSize: limit });
}

// GET /api/items/:id
function getItem(req, res) {
  const item = db.prepare(`${baseQuery()} WHERE items.id = ?`).get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  const checkouts = db.prepare('SELECT * FROM checkouts WHERE item_id = ? ORDER BY checkout_date DESC').all(item.id);
  const tickets = db.prepare('SELECT * FROM maintenance_tickets WHERE item_id = ? ORDER BY reported_date DESC').all(item.id);
  const retirement = db.prepare('SELECT * FROM retirements WHERE item_id = ?').get(item.id);

  res.json({ ...item, checkouts, maintenance_tickets: tickets, retirement: retirement || null });
}

// Ensures a subcategory_id, if provided, actually belongs to the given category_id.
// Returns an error message string if invalid, or null if OK / not applicable.
function validateSubcategory(category_id, subcategory_id) {
  if (!subcategory_id) return null;
  const sub = db.prepare('SELECT id, category_id FROM subcategories WHERE id = ?').get(subcategory_id);
  if (!sub) return 'Selected subcategory does not exist.';
  if (category_id && String(sub.category_id) !== String(category_id)) {
    return 'Selected subcategory does not belong to the selected category.';
  }
  return null;
}

// POST /api/items
function createItem(req, res) {
  const {
    asset_code, name, category_id, subcategory_id, description, manufacturer, model,
    serial_number, purchase_date, purchase_cost, supplier, location,
    condition_note, notes,
  } = req.body;

  if (!asset_code || !asset_code.trim()) return res.status(400).json({ error: 'Asset code is required.' });
  if (!name || !name.trim()) return res.status(400).json({ error: 'Item name is required.' });

  const existing = db.prepare('SELECT id FROM items WHERE asset_code = ?').get(asset_code.trim());
  if (existing) return res.status(409).json({ error: `Asset code "${asset_code}" is already in use.` });

  const subError = validateSubcategory(category_id, subcategory_id);
  if (subError) return res.status(400).json({ error: subError });

  const stmt = db.prepare(`
    INSERT INTO items (asset_code, name, category_id, subcategory_id, description, manufacturer, model,
      serial_number, purchase_date, purchase_cost, supplier, location, condition_note, notes)
    VALUES (@asset_code, @name, @category_id, @subcategory_id, @description, @manufacturer, @model,
      @serial_number, @purchase_date, @purchase_cost, @supplier, @location, @condition_note, @notes)
  `);

  const info = stmt.run({
    asset_code: asset_code.trim(),
    name: name.trim(),
    category_id: category_id || null,
    subcategory_id: subcategory_id || null,
    description: description || null,
    manufacturer: manufacturer || null,
    model: model || null,
    serial_number: serial_number || null,
    purchase_date: purchase_date || null,
    purchase_cost: purchase_cost != null && purchase_cost !== '' ? Number(purchase_cost) : null,
    supplier: supplier || null,
    location: location || null,
    condition_note: condition_note || null,
    notes: notes || null,
  });

  const item = db.prepare(`${baseQuery()} WHERE items.id = ?`).get(info.lastInsertRowid);
  logAction(req, 'ITEM_CREATE', 'item', item.id, { asset_code: item.asset_code, name: item.name });
  recordHistory(req, item.id, 'registration', `Asset registered as "${item.name}" (${item.asset_code}).`, {
    referenceType: 'item',
    referenceId: item.id,
    metadata: { category_id: item.category_id, subcategory_id: item.subcategory_id, location: item.location },
  });
  res.status(201).json(item);
}

// PUT /api/items/:id
function updateItem(req, res) {
  const existing = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Item not found.' });
  if (existing.status === 'retired') {
    return res.status(400).json({ error: 'Retired items cannot be edited. Reactivate is not supported by design — retirement is permanent history.' });
  }

  const fields = [
    'asset_code', 'name', 'category_id', 'subcategory_id', 'description', 'manufacturer', 'model',
    'serial_number', 'purchase_date', 'purchase_cost', 'supplier', 'location',
    'condition_note', 'notes',
  ];

  if (req.body.asset_code && req.body.asset_code.trim() !== existing.asset_code) {
    const dup = db.prepare('SELECT id FROM items WHERE asset_code = ? AND id != ?').get(req.body.asset_code.trim(), existing.id);
    if (dup) return res.status(409).json({ error: `Asset code "${req.body.asset_code}" is already in use.` });
  }

  const nextCategoryId = req.body.category_id !== undefined ? req.body.category_id : existing.category_id;
  const nextSubcategoryId = req.body.subcategory_id !== undefined ? req.body.subcategory_id : existing.subcategory_id;
  const subError = validateSubcategory(nextCategoryId, nextSubcategoryId);
  if (subError) return res.status(400).json({ error: subError });

  const updates = {};
  fields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f] === '' ? null : req.body[f];
  });

  const setSql = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
  if (setSql) {
    db.prepare(`UPDATE items SET ${setSql}, updated_at = datetime('now') WHERE id = @id`).run({ ...updates, id: existing.id });
  }

  const item = db.prepare(`${baseQuery()} WHERE items.id = ?`).get(existing.id);
  logAction(req, 'ITEM_UPDATE', 'item', item.id, { changes: updates });

  // A location change is recorded as its own 'transfer' event in addition to
  // the generic edit, since physically moving an asset is a distinct kind of
  // lifecycle event worth surfacing on its own in the timeline.
  if (Object.prototype.hasOwnProperty.call(updates, 'location') && updates.location !== existing.location) {
    recordHistory(req, item.id, 'transfer',
      `Location changed from "${existing.location || 'Unspecified'}" to "${updates.location || 'Unspecified'}".`,
      { metadata: { from: existing.location, to: updates.location } });
  }

  const changedFields = Object.keys(updates).filter((k) => k !== 'location');
  if (changedFields.length) {
    recordHistory(req, item.id, 'edit', `Asset details updated (${changedFields.join(', ')}).`, {
      metadata: updates,
    });
  }

  res.json(item);
}

// Categories
function listCategories(req, res) {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name ASC').all());
}

function createCategory(req, res) {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Category name is required.' });
  try {
    const info = db.prepare('INSERT INTO categories (name, description) VALUES (?, ?)').run(name.trim(), description || null);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
    logAction(req, 'CATEGORY_CREATE', 'category', cat.id, { name: cat.name });
    res.status(201).json(cat);
  } catch (err) {
    res.status(409).json({ error: 'A category with that name already exists.' });
  }
}

// Subcategories
function listSubcategories(req, res) {
  const { category_id } = req.query;
  if (category_id) {
    res.json(db.prepare('SELECT * FROM subcategories WHERE category_id = ? ORDER BY name ASC').all(category_id));
  } else {
    res.json(db.prepare('SELECT * FROM subcategories ORDER BY name ASC').all());
  }
}

function createSubcategory(req, res) {
  const { name, category_id } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Subcategory name is required.' });
  if (!category_id) return res.status(400).json({ error: 'A parent category is required.' });

  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(category_id);
  if (!cat) return res.status(404).json({ error: 'Selected category does not exist.' });

  try {
    const info = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(category_id, name.trim());
    const sub = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(info.lastInsertRowid);
    logAction(req, 'SUBCATEGORY_CREATE', 'subcategory', sub.id, { name: sub.name, category_id });
    res.status(201).json(sub);
  } catch (err) {
    res.status(409).json({ error: 'A subcategory with that name already exists under this category.' });
  }
}

module.exports = {
  listItems, getItem, createItem, updateItem,
  listCategories, createCategory,
  listSubcategories, createSubcategory,
};
