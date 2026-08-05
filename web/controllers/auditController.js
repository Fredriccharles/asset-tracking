const { db } = require('../db/init');

function listAudit(req, res) {
  const { q, action, entity_type, from, to, page = 1, pageSize = 50 } = req.query;
  const where = [];
  const params = {};

  if (q) { where.push('(username LIKE @q OR action LIKE @q OR details LIKE @q)'); params.q = `%${q}%`; }
  if (action) { where.push('action = @action'); params.action = action; }
  if (entity_type) { where.push('entity_type = @entity_type'); params.entity_type = entity_type; }
  if (from) { where.push('created_at >= @from'); params.from = from; }
  if (to) { where.push('created_at <= @to'); params.to = to; }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.max(1, Math.min(500, parseInt(pageSize, 10) || 50));
  const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * limit;

  const total = db.prepare(`SELECT COUNT(*) AS c FROM audit_log ${whereSql}`).get(params).c;
  const rows = db.prepare(`
    SELECT * FROM audit_log ${whereSql} ORDER BY created_at DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset });

  res.json({ data: rows, total, page: Number(page), pageSize: limit });
}

module.exports = { listAudit };
