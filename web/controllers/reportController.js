const { db } = require('../db/init');
const { streamPdfTable, streamExcelTable } = require('../services/reportService');
const { logAction } = require('../middleware/audit');

// --- Human-readable labels for stored "codes" used in exported reports ---
const ITEM_STATUS_LABELS = {
  available: 'Available',
  checked_out: 'Checked Out',
  under_repair: 'Under Repair',
  retired: 'Retired',
};

const CHECKOUT_STATUS_LABELS = {
  active: 'Active',
  returned: 'Returned',
};

const TICKET_STATUS_LABELS = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

const ACTION_LABELS = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  PASSWORD_CHANGE: 'Password Change',
  USER_CREATE: 'User Created',
  USER_UPDATE: 'User Updated',
  ITEM_CREATE: 'Item Created',
  ITEM_UPDATE: 'Item Updated',
  ITEM_RETIRE: 'Item Retired',
  CATEGORY_CREATE: 'Category Created',
  SUBCATEGORY_CREATE: 'Subcategory Created',
  CHECKOUT: 'Check-Out',
  CHECKIN: 'Check-In',
  TICKET_CREATE: 'Maintenance Ticket Opened',
  TICKET_UPDATE: 'Maintenance Ticket Updated',
  BACKUP_CREATE: 'Backup Created',
  RESTORE: 'Database Restored',
  REPORT_GENERATE: 'Report Generated',
};

const ENTITY_LABELS = {
  item: 'Item',
  checkout: 'Check-Out',
  maintenance_ticket: 'Maintenance Ticket',
  retirement: 'Retirement',
  category: 'Category',
  subcategory: 'Subcategory',
  user: 'User',
  backup: 'Backup',
  report: 'Report',
};

function label(value, map) {
  if (value === null || value === undefined || value === '') return '';
  const mapped = map[value];
  if (mapped !== undefined) return mapped;
  // Fallback: convert snake_case / UPPER_CASE codes to title case
  return String(value)
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function buildWhere(filters) {
  const where = [];
  const params = {};
  Object.entries(filters).forEach(([col, val]) => {
    if (val !== undefined && val !== null && val !== '') {
      where.push(`${col} = @${col.replace(/\./g, '_')}`);
      params[col.replace(/\./g, '_')] = val;
    }
  });
  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

async function output(req, res, { title, columns, rows, filenameBase }) {
  const format = (req.query.format || 'pdf').toLowerCase();
  logAction(req, 'REPORT_GENERATE', 'report', null, { report: filenameBase, format });
  if (format === 'excel' || format === 'xlsx') {
    await streamExcelTable(res, { title, columns, rows, filename: `${filenameBase}.xlsx` });
  } else {
    streamPdfTable(res, { title, columns, rows, filename: `${filenameBase}.pdf` });
  }
}

// GET /api/reports/items?status=&category_id=&format=pdf|excel
async function itemsReport(req, res) {
  const { status, category_id } = req.query;
  const { whereSql, params } = buildWhere({ 'items.status': status, 'items.category_id': category_id });

  const rows = db.prepare(`
    SELECT items.asset_code, items.name, categories.name AS category, items.status,
           items.location, items.purchase_date, items.purchase_cost, items.serial_number
    FROM items LEFT JOIN categories ON categories.id = items.category_id
    ${whereSql}
    ORDER BY items.asset_code
  `).all(params);

await output(req, res, {
    title: 'Asset Inventory Report',
    columns: ['Asset Code', 'Name', 'Category', 'Status', 'Location', 'Purchase Date', 'Cost', 'Serial No.'],
    rows: rows.map((r) => [r.asset_code, r.name, r.category || '—', label(r.status, ITEM_STATUS_LABELS), r.location || '—', r.purchase_date || '—', r.purchase_cost != null ? r.purchase_cost.toFixed(2) : '—', r.serial_number || '—']),
    filenameBase: 'asset-inventory-report',
  });
}

// GET /api/reports/checkouts?status=&format=
async function checkoutsReport(req, res) {
  const { status } = req.query;
  const { whereSql, params } = buildWhere({ 'checkouts.status': status });

  const rows = db.prepare(`
    SELECT items.asset_code, items.name, checkouts.checked_out_to, checkouts.department,
           checkouts.checkout_date, checkouts.expected_return_date, checkouts.return_date, checkouts.status
    FROM checkouts JOIN items ON items.id = checkouts.item_id
    ${whereSql}
    ORDER BY checkouts.checkout_date DESC
  `).all(params);

  await output(req, res, {
    title: 'Check-Out / Check-In History Report',
    columns: ['Asset Code', 'Item', 'Checked Out To', 'Department', 'Checkout Date', 'Expected Return', 'Return Date', 'Status'],
    rows: rows.map((r) => [r.asset_code, r.name, r.checked_out_to, r.department || '—', r.checkout_date, r.expected_return_date || '—', r.return_date || '—', label(r.status, CHECKOUT_STATUS_LABELS)]),
    filenameBase: 'checkout-history-report',
  });
}

// GET /api/reports/maintenance?status=&format=
async function maintenanceReport(req, res) {
  const { status } = req.query;
  const { whereSql, params } = buildWhere({ 'maintenance_tickets.status': status });

  const rows = db.prepare(`
    SELECT items.asset_code, items.name, maintenance_tickets.issue_description, maintenance_tickets.priority,
           maintenance_tickets.status, maintenance_tickets.reported_date, maintenance_tickets.completed_date, maintenance_tickets.cost
    FROM maintenance_tickets JOIN items ON items.id = maintenance_tickets.item_id
    ${whereSql}
    ORDER BY maintenance_tickets.reported_date DESC
  `).all(params);

  await output(req, res, {
    title: 'Maintenance Tickets Report',
    columns: ['Asset Code', 'Item', 'Issue', 'Priority', 'Status', 'Reported', 'Completed', 'Cost'],
rows: rows.map((r) => [r.asset_code, r.name, r.issue_description, label(r.priority, PRIORITY_LABELS), label(r.status, TICKET_STATUS_LABELS), r.reported_date, r.completed_date || '—', r.cost != null ? r.cost.toFixed(2) : '—']),
    filenameBase: 'maintenance-report',
  });
}

// GET /api/reports/retirements?format=
async function retirementsReport(req, res) {
  const rows = db.prepare(`
    SELECT items.asset_code, items.name, retirements.retired_date, retirements.reason,
           retirements.disposal_method, retirements.disposal_value
    FROM retirements JOIN items ON items.id = retirements.item_id
    ORDER BY retirements.retired_date DESC
  `).all();

  await output(req, res, {
    title: 'Retired / Disposed Assets Report',
    columns: ['Asset Code', 'Item', 'Retired Date', 'Reason', 'Disposal Method', 'Disposal Value'],
    rows: rows.map((r) => [r.asset_code, r.name, r.retired_date, r.reason, r.disposal_method || '—', r.disposal_value != null ? r.disposal_value.toFixed(2) : '—']),
    filenameBase: 'retirement-report',
  });
}

// GET /api/reports/audit?format=
async function auditReport(req, res) {
  const rows = db.prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5000`).all();
  await output(req, res, {
    title: 'Admin Audit Log Report',
    columns: ['Date/Time', 'User', 'Action', 'Entity Type', 'Entity ID', 'Details'],
    rows: rows.map((r) => [
      r.created_at,
      r.username,
      label(r.action, ACTION_LABELS),
      r.entity_type ? label(r.entity_type, ENTITY_LABELS) : '—',
      r.entity_id ?? '—',
      r.details,
    ]),
    filenameBase: 'audit-log-report',
  });
}

module.exports = { itemsReport, checkoutsReport, maintenanceReport, retirementsReport, auditReport };
