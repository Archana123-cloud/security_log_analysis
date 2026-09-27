const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../config/database');

exports.login = async (req, res, next) => {
  try {
    const db = getDb();
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password required', errorCode: 'VALIDATION' });

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    const ok = user && await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials', errorCode: 'AUTH_FAILED' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ success: true, data: { token, user: { id: user.id, username: user.username, role: user.role } }, message: 'Login successful' });
  } catch (e) { next(e); }
};

exports.me = (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
};
