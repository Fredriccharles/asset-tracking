const bcrypt = require('bcryptjs');
const { db } = require('../db/init');
const { logAction } = require('../middleware/audit');

function ensureAdmin(req, res) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return false;
  }
  return true;
}

function listUsers(req, res) {
  if (!ensureAdmin(req, res)) return;
  const rows = db.prepare('SELECT id, username, full_name, role, is_active, last_login_at FROM users ORDER BY username').all();
  res.json({ data: rows, total: rows.length });
}

function createUser(req, res) {
  if (!ensureAdmin(req, res)) return;
  const { username, password, full_name, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(400).json({ error: 'Username already exists.' });
  const hash = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (username, password_hash, full_name, role, is_active) VALUES (?, ?, ?, ?, 1)');
  const info = stmt.run(username, hash, full_name || '', role === 'admin' ? 'admin' : 'user');
  logAction(req, 'USER_CREATE', 'user', info.lastInsertRowid, { username, role: role === 'admin' ? 'admin' : 'user' });
  res.json({ message: 'User created.' });
}

function updateUser(req, res) {
  if (!ensureAdmin(req, res)) return;
  const id = parseInt(req.params.id, 10);
  const { role, is_active } = req.body;
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  db.prepare('UPDATE users SET role = ?, is_active = ?, updated_at = datetime(\'now\') WHERE id = ?').run(role === 'admin' ? 'admin' : 'user', is_active ? 1 : 0, id);
  logAction(req, 'USER_UPDATE', 'user', id, { role: role === 'admin' ? 'admin' : 'user', is_active: !!is_active });
  res.json({ message: 'User updated.' });
}

module.exports = { listUsers, createUser, updateUser };
