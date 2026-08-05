const { db } = require('../db/init');
const { logAction } = require('../middleware/audit');
const { recordHistory } = require('../middleware/assetHistory');

function listTickets(req, res) {
  const { status, item_id, priority, q, page = 1, pageSize = 25 } = req.query;
  const where = [];
  const params = {};

  if (status) { where.push('maintenance_tickets.status = @status'); params.status = status; }
  if (item_id) { where.push('maintenance_tickets.item_id = @item_id'); params.item_id = item_id; }
  if (priority) { where.push('maintenance_tickets.priority = @priority'); params.priority = priority; }
  if (q) {
    where.push('(items.name LIKE @q OR items.asset_code LIKE @q OR maintenance_tickets.issue_description LIKE @q)');
    params.q = `%${q}%`;
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(200, parseInt(pageSize, 10) || 25));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const total = db.prepare(`
    SELECT COUNT(*) AS c FROM maintenance_tickets JOIN items ON items.id = maintenance_tickets.item_id ${whereSql}
  `).get(params).c;

  const rows = db.prepare(`
    SELECT maintenance_tickets.*, items.name AS item_name, items.asset_code
    FROM maintenance_tickets
    JOIN items ON items.id = maintenance_tickets.item_id
    ${whereSql}
    ORDER BY maintenance_tickets.reported_date DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ data: rows, total, page: Number(page), pageSize: limit });
}

// POST /api/maintenance — open a new ticket
function createTicket(req, res) {
  const { item_id, issue_description, priority, reported_by, assigned_to } = req.body;
  if (!item_id || !issue_description || !issue_description.trim()) {
    return res.status(400).json({ error: 'item_id and issue_description are required.' });
  }

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(item_id);
  if (!item) return res.status(404).json({ error: 'Item not found.' });
  if (item.status === 'retired') {
    return res.status(400).json({ error: `"${item.name}" is retired and cannot have maintenance tickets raised against it.` });
  }
  if (item.status === 'checked_out') {
    return res.status(400).json({ error: `"${item.name}" is currently checked out. Check it in before opening a maintenance ticket, or contact the holder.` });
  }

  const trx = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO maintenance_tickets (item_id, issue_description, priority, reported_by, assigned_to, created_by)
      VALUES (@item_id, @issue_description, @priority, @reported_by, @assigned_to, @created_by)
    `).run({
      item_id,
      issue_description: issue_description.trim(),
      priority: priority || 'medium',
      reported_by: reported_by || null,
      assigned_to: assigned_to || null,
      created_by: req.user.id,
    });
    // --- Core business rule: item becomes unavailable for deployment while under repair ---
    db.prepare(`UPDATE items SET status = 'under_repair', updated_at = datetime('now') WHERE id = ?`).run(item_id);
    return info.lastInsertRowid;
  });

  const ticketId = trx();
  const ticket = db.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(ticketId);
  logAction(req, 'TICKET_CREATE', 'maintenance_ticket', ticketId, { item_id, priority: ticket.priority });
  recordHistory(req, item_id, 'maintenance_opened',
    `Maintenance ticket opened (${ticket.priority} priority): ${ticket.issue_description}`,
    { referenceType: 'maintenance_ticket', referenceId: ticketId });
  res.status(201).json(ticket);
}

// PUT /api/maintenance/:id — update status/progress
function updateTicket(req, res) {
  const ticket = db.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found.' });
  if (['completed', 'cancelled'].includes(ticket.status)) {
    return res.status(400).json({ error: 'This ticket is already closed and cannot be modified.' });
  }

  const { status, priority, assigned_to, resolution_notes, cost, issue_description } = req.body;
  const allowedStatuses = ['open', 'in_progress', 'completed', 'cancelled'];
  if (status && !allowedStatuses.includes(status)) {
    return res.status(400).json({ error: `Invalid status. Must be one of: ${allowedStatuses.join(', ')}` });
  }

  const trx = db.transaction(() => {
    const updates = {};
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to || null;
    if (resolution_notes !== undefined) updates.resolution_notes = resolution_notes || null;
    if (cost !== undefined) updates.cost = cost === '' ? null : Number(cost);
    if (issue_description) updates.issue_description = issue_description;

    if (status === 'in_progress' && !ticket.started_date) updates.started_date = new Date().toISOString();
    if (status === 'completed' || status === 'cancelled') updates.completed_date = new Date().toISOString();

    const setSql = Object.keys(updates).map((k) => `${k} = @${k}`).join(', ');
    if (setSql) {
      db.prepare(`UPDATE maintenance_tickets SET ${setSql}, updated_at = datetime('now') WHERE id = @id`)
        .run({ ...updates, id: ticket.id });
    }

    // --- Core business rule: releasing the item once repair is finished/cancelled ---
    if (status === 'completed' || status === 'cancelled') {
      const stillOpen = db.prepare(`
        SELECT id FROM maintenance_tickets WHERE item_id = ? AND status IN ('open','in_progress') AND id != ?
      `).get(ticket.item_id, ticket.id);
      if (!stillOpen) {
        const item = db.prepare('SELECT status FROM items WHERE id = ?').get(ticket.item_id);
        if (item && item.status === 'under_repair') {
          db.prepare(`UPDATE items SET status = 'available', updated_at = datetime('now') WHERE id = ?`).run(ticket.item_id);
        }
      }
    }
  });

  trx();
  const updated = db.prepare('SELECT * FROM maintenance_tickets WHERE id = ?').get(ticket.id);
  logAction(req, 'TICKET_UPDATE', 'maintenance_ticket', ticket.id, { status: updated.status });

  if (updated.status === 'completed') {
    recordHistory(req, ticket.item_id, 'maintenance_completed',
      `Maintenance completed${updated.resolution_notes ? `: ${updated.resolution_notes}` : '.'}${updated.cost != null ? ` (cost: ${updated.cost})` : ''}`,
      { referenceType: 'maintenance_ticket', referenceId: ticket.id });
  } else if (updated.status === 'cancelled') {
    recordHistory(req, ticket.item_id, 'maintenance_updated', 'Maintenance ticket cancelled.',
      { referenceType: 'maintenance_ticket', referenceId: ticket.id });
  } else if (status) {
    recordHistory(req, ticket.item_id, 'maintenance_updated', `Maintenance ticket updated: status set to "${updated.status}".`,
      { referenceType: 'maintenance_ticket', referenceId: ticket.id });
  }

  res.json(updated);
}

module.exports = { listTickets, createTicket, updateTicket };
