const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
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

// ---------------------------------------------------------------------
// Excel bulk import
// ---------------------------------------------------------------------

// Maps a friendly header name (case & whitespace-insensitive) to an item
// database column. Multiple synonyms are supported so users can use
// whatever spreadsheet headers they already have.
const HEADER_ALIASES = {
  asset_code: ['asset code', 'assetcode', 'code', 'asset #', 'asset no', 'asset id'],
  name: ['name', 'asset name', 'item name', 'item', 'description of asset'],
  category: ['category', 'type', 'asset category'],
  subcategory: ['subcategory', 'sub category', 'sub-category', 'subtype'],
  description: ['description', 'details', 'asset description'],
  manufacturer: ['manufacturer', 'brand', 'make'],
  model: ['model', 'model number', 'model #'],
  serial_number: ['serial number', 'serial', 'serial no', 'serial #', 'sn'],
  purchase_date: ['purchase date', 'date purchased', 'date of purchase', 'purchase-date'],
  purchase_cost: ['purchase cost', 'cost', 'price', 'value', 'purchase price', 'amount'],
  supplier: ['supplier', 'vendor', 'purchased from'],
  location: ['location', 'site', 'room', 'department location'],
  condition_note: ['condition', 'condition note', 'condition notes', 'state'],
  notes: ['notes', 'remarks', 'comments', 'additional notes'],
};

function normalizeHeader(header) {
  return String(header || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

// Returns the item DB column a spreadsheet header maps to, or null.
function mapHeader(header) {
  const key = normalizeHeader(header);
  if (!key) return null;
  for (const [col, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((a) => normalizeHeader(a) === key) || col === key) return col;
  }
  return null;
}

// Resolve a category id from a friendly name, creating it if missing.
function resolveCategory(name) {
  if (!name) return null;
  const clean = String(name).trim();
  if (!clean) return null;
  let cat = db.prepare('SELECT * FROM categories WHERE name = ? COLLATE NOCASE').get(clean);
  if (!cat) {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(clean);
    cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid);
  }
  return cat.id;
}

// Resolve a subcategory id within a category, creating it if missing.
function resolveSubcategory(name, categoryId) {
  if (!name || !categoryId) return null;
  const clean = String(name).trim();
  if (!clean) return null;
  let sub = db
    .prepare('SELECT * FROM subcategories WHERE category_id = ? AND name = ? COLLATE NOCASE')
    .get(categoryId, clean);
  if (!sub) {
    const info = db.prepare('INSERT INTO subcategories (category_id, name) VALUES (?, ?)').run(categoryId, clean);
    sub = db.prepare('SELECT * FROM subcategories WHERE id = ?').get(info.lastInsertRowid);
  }
  return sub.id;
}

// Coerce a raw cell value to a string or null.
function cellText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v instanceof Date ? v.toISOString().slice(0, 10) : v).trim();
  return s === '' ? null : s;
}

// POST /api/items/import  — bulk-create assets from an uploaded .xlsx file
function importItems(req, res) {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded. Please choose an Excel (.xlsx) file.' });

  const filePath = req.file.path;
  const workbook = new ExcelJS.Workbook();

  workbook.xlsx.readFile(filePath)
    .then(() => {
      const worksheet = workbook.worksheets[0];
      if (!worksheet) throw new Error('The uploaded file contains no worksheet.');

      // Read the header row.
      const headerRow = worksheet.getRow(1);
      const headers = [];
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers[colNumber] = mapHeader(cell.value);
      });

      const headerCount = worksheet.columnCount;
      const mappedCount = headers.filter(Boolean).length;
      if (mappedCount === 0) {
        throw new Error('No recognized columns found. Please use the provided template or check the header row.');
      }

      const results = { total: 0, imported: 0, skipped: 0, failed: 0, errors: [] };

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // skip header
        results.total += 1;

        // Build a row map: column -> text value.
        const rowData = {};
        for (let c = 1; c <= headerCount; c++) {
          const col = headers[c];
          if (!col) continue;
          const cell = row.getCell(c);
          rowData[col] = cellText(cell.value);
        }

        const asset_code = rowData.asset_code;
        const name = rowData.name;
        if (!asset_code || !name) {
          results.skipped += 1;
          results.errors.push(`Row ${rowNumber}: skipped (asset code and name are required).`);
          return;
        }

        const categoryId = resolveCategory(rowData.category);
        const subcategoryId = resolveSubcategory(rowData.subcategory, categoryId);

        const subError = validateSubcategory(categoryId, subcategoryId);
        if (subError) {
          results.failed += 1;
          results.errors.push(`Row ${rowNumber}: ${subError}`);
          return;
        }

        const existing = db.prepare('SELECT id FROM items WHERE asset_code = ? COLLATE NOCASE').get(asset_code);
        if (existing) {
          results.skipped += 1;
          results.errors.push(`Row ${rowNumber}: skipped (asset code "${asset_code}" already exists).`);
          return;
        }

        const stmt = db.prepare(`
          INSERT INTO items (asset_code, name, category_id, subcategory_id, description, manufacturer, model,
            serial_number, purchase_date, purchase_cost, supplier, location, condition_note, notes)
          VALUES (@asset_code, @name, @category_id, @subcategory_id, @description, @manufacturer, @model,
            @serial_number, @purchase_date, @purchase_cost, @supplier, @location, @condition_note, @notes)
        `);

        const info = stmt.run({
          asset_code,
          name,
          category_id: categoryId,
          subcategory_id: subcategoryId,
          description: rowData.description || null,
          manufacturer: rowData.manufacturer || null,
          model: rowData.model || null,
          serial_number: rowData.serial_number || null,
          purchase_date: rowData.purchase_date || null,
          purchase_cost: rowData.purchase_cost != null && rowData.purchase_cost !== ''
            ? Number(rowData.purchase_cost) : null,
          supplier: rowData.supplier || null,
          location: rowData.location || null,
          condition_note: rowData.condition_note || null,
          notes: rowData.notes || null,
        });

        const item = db.prepare(`${baseQuery()} WHERE items.id = ?`).get(info.lastInsertRowid);
        logAction(req, 'ITEM_CREATE', 'item', item.id, { asset_code: item.asset_code, name: item.name, source: 'import' });
        recordHistory(req, item.id, 'registration',
          `Asset registered via Excel import as "${item.name}" (${item.asset_code}).`, {
            referenceType: 'item',
            referenceId: item.id,
            metadata: { category_id: item.category_id, subcategory_id: item.subcategory_id, location: item.location, source: 'import' },
          });

        results.imported += 1;
      });

      res.json({ message: 'Import complete.', ...results });
    })
    .catch((err) => {
      console.error('Import error:', err);
      res.status(400).json({ error: err.message || 'Failed to parse the uploaded Excel file.' });
    });
}

// GET /api/items/import/template  — download a blank .xlsx template
function downloadTemplate(req, res) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Assets');

  const cols = [
    ['asset_code', 'Asset Code *'],
    ['name', 'Name *'],
    ['category', 'Category'],
    ['subcategory', 'Subcategory'],
    ['manufacturer', 'Manufacturer'],
    ['model', 'Model'],
    ['serial_number', 'Serial Number'],
    ['purchase_date', 'Purchase Date (YYYY-MM-DD)'],
    ['purchase_cost', 'Purchase Cost'],
    ['supplier', 'Supplier'],
    ['location', 'Location'],
    ['condition_note', 'Condition'],
    ['description', 'Description'],
    ['notes', 'Notes'],
  ];

  sheet.columns = cols.map(([key, header], i) => ({
    header,
    key,
    width: Math.max(18, header.length + 4),
  }));

  // Example row to guide the user.
  sheet.addRow({
    asset_code: 'IT-1001',
    name: 'Dell Latitude 5420',
    category: 'IT Equipment',
    subcategory: 'Laptop',
    manufacturer: 'Dell',
    model: 'Latitude 5420',
    serial_number: 'SN123456',
    purchase_date: '2024-01-15',
    purchase_cost: 1250,
    supplier: 'Tech Supplier Co.',
    location: 'Head Office',
    condition_note: 'Good',
    description: 'Standard issue laptop',
    notes: 'Imported via template',
  });

  // Style the header row.
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  headerRow.alignment = { vertical: 'middle' };
  headerRow.height = 22;

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="asset-import-template.xlsx"');
  workbook.xlsx.write(res).then(() => res.end());
}

module.exports = {
  listItems, getItem, createItem, updateItem,
  listCategories, createCategory,
  listSubcategories, createSubcategory,
  importItems, downloadTemplate,
};
