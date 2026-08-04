const { db } = require('../db/init');
const { logAction } = require('../middleware/audit');
const { recordHistory } = require('../middleware/assetHistory');

function listRetirements(req, res) {
  const { q, page = 1, pageSize = 25 } = req.query;
  const where = [];
  const params = {};
  if (q) {
    where.push('(items.name LIKE @q OR items.asset_code LIKE @q OR retirements.reason LIKE @q)');
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 25));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM retirements JOIN items ON items.id = retirements.item_id ${whereSql}`).get(params).c;
  const rows = db.prepare(`
    SELECT retirements.*, items.name AS item_name, items.asset_code, items.purchase_cost
    FROM retirements
    JOIN items ON items.id = retirements.item_id
    ${whereSql}
    ORDER BY retirements.retired_date DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ data: rows, total, page: Number(page), pageSize: limit });
}

// POST /api/retirements — retire an item (soft: record kept, status flipped)
function retireItem(req, res) {
  const { item_id, reason, disposal_method, disposal_value, notes } = req.body;
  if (!item_id || !reason || !reason.trim()) {
    return res.status(400).json({ error: 'item_id and reason are required.' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.status === 'retired') return res.status(400).json({ error: 'This item is already retired.' });
  if (item.status === 'checked_out') {
    return res.status(400).json({ error: `"${item.name}" is currently checked out. It must be checked in before it can be retired.` });
  }
  if (item.status === 'under_repair') {
    return res.status(400).json({ error: `"${item.name}" has an open maintenance ticket. Close or cancel it before retiring the item.` });
  }

  const trx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO retirements (item_id, reason, disposal_method, disposal_value, retired_by, notes)
      VALUES (@item_id, @reason, @disposal_method, @disposal_value, @retired_by, @notes)
    `).run({
      item_id,
      reason: reason.trim(),
      disposal_method: disposal_method || null,
      disposal_value: disposal_value != null && disposal_value !== '' ? Number(disposal_value) : null,
      retired_by: req.user.id,
      notes: notes || null,
    });
    // Record preserved forever; only status flips. No DELETE is ever issued against `items`.
    db.prepare(`UPDATE items SET status = 'retired', updated_at = datetime('now') WHERE id = ?`).run(item_id);
    return info.lastInsertRowid;
  });

  const id = trx();
  const record = db.prepare('SELECT * FROM retirements WHERE id = ?').get(id);
  logAction(req, 'ITEM_RETIRE', 'item', item_id, { reason });
  recordHistory(req, item_id, 'retirement',
    `Retired: ${reason.trim()}${disposal_method ? ` (disposal: ${disposal_method})` : ''}`,
    { referenceType: 'retirement', referenceId: id });
  res.status(201).json(record);
}

module.exports = { listRetirements, retireItem };
