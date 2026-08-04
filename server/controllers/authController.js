const bcrypt = require('bcryptjs');
const { db } = require('../db/init');
const { signToken } = require('../middleware/auth');
const { logAction } = require('../middleware/audit');

function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
  if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password.' });

  db.prepare('UPDATE users SET last_login_at = datetime(\'now\') WHERE id = ?').run(user.id);

  const token = signToken(user);
  req.user = { id: user.id, username: user.username, role: user.role };
  logAction(req, 'LOGIN', 'user', user.id, { username: user.username });

  res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role },
  });
}

function me(req, res) {
  const user = db.prepare('SELECT id, username, full_name, role, last_login_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
}

function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime(\'now\') WHERE id = ?').run(hash, user.id);
  logAction(req, 'PASSWORD_CHANGE', 'user', user.id, {});
  res.json({ message: 'Password updated successfully.' });
}

module.exports = { login, me, changePassword };
