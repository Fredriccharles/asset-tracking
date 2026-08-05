const { db } = require('../db/init');

function getSummary(req, res) {
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) AS count FROM items GROUP BY status
  `).all();

  const counts = { available: 0, checked_out: 0, under_repair: 0, retired: 0 };
  statusCounts.forEach((r) => { counts[r.status] = r.count; });

  const totalValue = db.prepare(`
    SELECT COALESCE(SUM(purchase_cost), 0) AS total FROM items WHERE status != 'retired'
  `).get().total;

  const openTickets = db.prepare(`
    SELECT COUNT(*) AS c FROM maintenance_tickets WHERE status IN ('open','in_progress')
  `).get().c;

  const overdueCheckouts = db.prepare(`
    SELECT COUNT(*) AS c FROM checkouts
    WHERE status = 'active' AND expected_return_date IS NOT NULL AND expected_return_date < date('now')
  `).get().c;

  const byCategory = db.prepare(`
    SELECT COALESCE(categories.name, 'Uncategorized') AS category, COUNT(*) AS count
    FROM items LEFT JOIN categories ON categories.id = items.category_id
    WHERE items.status != 'retired'
    GROUP BY category ORDER BY count DESC
  `).all();

  // Free / available assets grouped by category (the main "available" view).
  const availableByCategory = db.prepare(`
    SELECT COALESCE(categories.name, 'Uncategorized') AS category, COUNT(*) AS count
    FROM items LEFT JOIN categories ON categories.id = items.category_id
    WHERE items.status = 'available'
    GROUP BY category ORDER BY count DESC
  `).all();

  // A short list of the most recently updated available assets for quick access.
  const availableAssets = db.prepare(`
    SELECT items.id, items.asset_code, items.name, items.model, items.location,
           categories.name AS category_name, subcategories.name AS subcategory_name
    FROM items
    LEFT JOIN categories ON categories.id = items.category_id
    LEFT JOIN subcategories ON subcategories.id = items.subcategory_id
    WHERE items.status = 'available'
    ORDER BY items.updated_at DESC
    LIMIT 10
  `).all();

  const recentActivity = db.prepare(`
    SELECT action, entity_type, entity_id, username, created_at
    FROM audit_log ORDER BY created_at DESC LIMIT 10
  `).all();

  const totalItems = counts.available + counts.checked_out + counts.under_repair + counts.retired;

  res.json({
    totalItems,
    statusCounts: counts,
    totalValue,
    openTickets,
    overdueCheckouts,
    byCategory,
    availableByCategory,
    availableAssets,
    recentActivity,
  });
}

module.exports = { getSummary };
