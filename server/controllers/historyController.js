const { db } = require('../db/init');

// GET /api/history/categories
// Level 1 — only returns categories that actually have at least one asset
// registered against them, so the dropdown never leads to a dead end.
function listCategories(req, res) {
  const rows = db.prepare(`
    SELECT categories.id, categories.name, COUNT(items.id) AS asset_count
    FROM categories
    JOIN items ON items.category_id = categories.id
    GROUP BY categories.id
    ORDER BY categories.name ASC
  `).all();
  res.json(rows);
}

// GET /api/history/subcategories?category_id=
// Level 2 — subcategories under the chosen category that have at least one asset.
function listSubcategories(req, res) {
  const { category_id } = req.query;
  if (!category_id) return res.status(400).json({ error: 'category_id is required.' });

  const rows = db.prepare(`
    SELECT subcategories.id, subcategories.name, COUNT(items.id) AS asset_count
    FROM subcategories
    JOIN items ON items.subcategory_id = subcategories.id
    WHERE subcategories.category_id = ?
    GROUP BY subcategories.id
    ORDER BY subcategories.name ASC
  `).all(category_id);
  res.json(rows);
}

// GET /api/history/assets?category_id=&subcategory_id=&q=
// Level 3 — the specific asset/model list. subcategory_id is optional so a
// category with no subcategorized items can still be browsed directly.
function listAssets(req, res) {
  const { category_id, subcategory_id, q } = req.query;
  if (!category_id) return res.status(400).json({ error: 'category_id is required.' });

  const where = ['items.category_id = @category_id'];
  const params = { category_id };

  if (subcategory_id) {
    where.push('items.subcategory_id = @subcategory_id');
    params.subcategory_id = subcategory_id;
  }
  if (q) {
    where.push('(items.name LIKE @q OR items.model LIKE @q OR items.asset_code LIKE @q OR items.manufacturer LIKE @q)');
    params.q = `%${q}%`;
  }

  const rows = db.prepare(`
    SELECT items.id, items.asset_code, items.name, items.manufacturer, items.model, items.status
    FROM items
    WHERE ${where.join(' AND ')}
    ORDER BY items.name ASC, items.asset_code ASC
  `).all(params);

  res.json(rows);
}

// GET /api/history/timeline/:itemId?q=&event_type=
// Level 4 — the full, permanent, read-only chronological timeline for one asset.
function getTimeline(req, res) {
  const item = db.prepare(`
    SELECT items.*, categories.name AS category_name, subcategories.name AS subcategory_name
    FROM items
    LEFT JOIN categories ON categories.id = items.category_id
    LEFT JOIN subcategories ON subcategories.id = items.subcategory_id
    WHERE items.id = ?
  `).get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Asset not found.' });

  const { q, event_type } = req.query;
  const where = ['item_id = @item_id'];
  const params = { item_id: item.id };

  if (q) {
    where.push('description LIKE @q');
    params.q = `%${q}%`;
  }
  if (event_type) {
    where.push('event_type = @event_type');
    params.event_type = event_type;
  }

  // Chronological order, oldest first — a timeline reads top-to-bottom as a story.
  const timeline = db.prepare(`
    SELECT * FROM asset_history
    WHERE ${where.join(' AND ')}
    ORDER BY event_date ASC, id ASC
  `).all(params);

  res.json({ item, timeline });
}

module.exports = { listCategories, listSubcategories, listAssets, getTimeline };
