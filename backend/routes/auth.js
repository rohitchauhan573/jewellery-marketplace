const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

function cleanPhone(raw) {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? text : null;
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const phone = cleanPhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'A valid phone number (10 to 15 digits) is required' });
    }

    const cleanEmail = email.trim().toLowerCase();
    // Admin kabhi register se nahi banta
    const safeRole = ['shop_owner', 'delivery'].includes(role) ? role : 'customer';

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = db
      .prepare('INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
      .run(name.trim(), cleanEmail, hash, safeRole, phone);

    res.status(201).json({
      message: 'Registered successfully',
      userId: Number(result.lastInsertRowid),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db
      .prepare('SELECT * FROM users WHERE email = ?')
      .get(email.trim().toLowerCase());

    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, phone: user.phone },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', verifyToken, (req, res) => {
  const user = db
    .prepare('SELECT id, name, email, role, phone FROM users WHERE id = ?')
    .get(req.user.id);
  res.json(user);
});

module.exports = router;