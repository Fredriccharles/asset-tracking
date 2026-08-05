const { db } = require('../db/init');
const { logAction } = require('../middleware/audit');
const { recordHistory } = require('../middleware/assetHistory');

// GET /api/checkouts?status=active&item_id=&q=
function listCheckouts(req, res) {
  const { status, item_id, q, page = 1, pageSize = 25 } = req.query;
  const where = [];
  const params = {};

  if (status) { where.push('checkouts.status = @status'); params.status = status; }
  if (item_id) { where.push('checkouts.item_id = @item_id'); params.item_id = item_id; }
  if (q) {
    where.push('(checkouts.checked_out_to LIKE @q OR items.name LIKE @q OR items.asset_code LIKE @q)');
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const limit = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 25));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM checkouts JOIN items ON items.id = checkouts.item_id ${whereSql}
  `).get(params).c;

  const rows = db.prepare(`
    SELECT checkouts.*, items.name AS item_name, items.asset_code
    FROM checkouts
    JOIN items ON items.id = checkouts.item_id
    ${whereSql}
    ORDER BY checkouts.checkout_date DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ data: rows, total, page: Number(page), pageSize: limit });
}

// POST /api/checkouts — check an item OUT
function checkOutItem(req, res) {
  const { item_id, checked_out_to, department, expected_return_date, checkout_condition_note, notes } = req.body;
  if (!item_id || !checked_out_to || !checked_out_to.trim()) {
    return res.status(400).json({ error: 'item_id and checked_out_to are required.' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });

  // --- Core business rule enforcement ---
  if (item.status === 'under_repair') {
    return res.status(400).json({ error: `"${item.name}" (${item.asset_code}) is currently under repair and cannot be checked out until maintenance is completed.` });
  }
  if (item.status === 'retired') {
    return res.status(400).json({ error: `"${item.name}" (${item.asset_code}) is retired and can no longer be deployed.` });
  }
  if (item.status === 'checked_out') {
    return res.status(400).json({ error: `"${item.name}" (${item.asset_code}) is already checked out.` });
  }

  const trx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO checkouts (item_id, checked_out_to, department, checked_out_by, expected_return_date, checkout_condition_note, notes)
      VALUES (@item_id, @checked_out_to, @department, @checked_out_by, @expected_return_date, @checkout_condition_note, @notes)
    `).run({
      item_id,
      checked_out_to: checked_out_to.trim(),
      department: department || null,
      checked_out_by: req.user.id,
      expected_return_date: expected_return_date || null,
      checkout_condition_note: checkout_condition_note || null,
      notes: notes || null,
    });
    db.prepare(`UPDATE items SET status = 'checked_out', updated_at = datetime('now') WHERE id = ?`).run(item_id);
    return info.lastInsertRowid;
  });

  const checkoutId = trx();
  const record = db.prepare('SELECT * FROM checkouts WHERE id = ?').get(checkoutId);
  logAction(req, 'CHECKOUT', 'checkout', checkoutId, { item_id, checked_out_to });
  recordHistory(req, item_id, 'checkout',
    `Checked out to ${checked_out_to.trim()}${department ? ` (${department})` : ''}${expected_return_date ? `, expected return ${expected_return_date}` : ''}.`,
    { referenceType: 'checkout', referenceId: checkoutId });
  res.status(201).json(record);
}

// POST /api/checkouts/:id/checkin — check an item IN
function checkInItem(req, res) {
  const { return_condition_note, notes } = req.body;
  const checkout = db.prepare('SELECT * FROM checkouts WHERE id = ?').get(req.params.id);
  if (!checkout) return res.status(404).json({ error: 'Checkout record not found.' });
  if (checkout.status === 'returned') return res.status(400).json({ error: 'This item has already been checked in.' });

  const trx = db.transaction(() => {
    db.prepare(`
      UPDATE checkouts SET status = 'returned', return_date = datetime('now'),
        checked_in_by = @checked_in_by, return_condition_note = @return_condition_note,
        notes = COALESCE(@notes, notes)
      WHERE id = @id
    `).run({
      id: checkout.id,
      checked_in_by: req.user.id,
      return_condition_note: return_condition_note || null,
      notes: notes || null,
    });
    // Item goes back to 'available' unless it has an open maintenance ticket (edge case: repair reported while out).
    const openTicket = db.prepare(`
      SELECT id FROM maintenance_tickets WHERE item_id = ? AND status IN ('open','in_progress') LIMIT 1
    `).get(checkout.item_id);
    const newStatus = openTicket ? 'under_repair' : 'available';
    db.prepare(`UPDATE items SET status = ?, updated_at = datetime('now') WHERE id = ?`).run(newStatus, checkout.item_id);
  });

  trx();
  const record = db.prepare('SELECT * FROM checkouts WHERE id = ?').get(checkout.id);
  logAction(req, 'CHECKIN', 'checkout', checkout.id, { item_id: checkout.item_id });
  recordHistory(req, checkout.item_id, 'return',
    `Returned by ${checkout.checked_out_to}${return_condition_note ? ` — condition noted: ${return_condition_note}` : ''}.`,
    { referenceType: 'checkout', referenceId: checkout.id });
  res.json(record);
}

module.exports = { listCheckouts, checkOutItem, checkInItem };
