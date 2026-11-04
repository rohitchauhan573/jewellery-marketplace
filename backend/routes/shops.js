const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: sirf approved shops
router.get('/', (req, res) => {
  const rows = db
    .prepare("SELECT id, name, city, logo FROM shops WHERE status = 'approved' ORDER BY id DESC")
    .all();
  res.json(rows);
});

// Shop owner: apni shop dekhna
router.get('/mine', verifyToken, requireRole('shop_owner'), (req, res) => {
  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
  if (!shop) return res.status(404).json({ error: 'You have not created a shop yet' });
  res.json(shop);
});

// Shop owner: nayi shop banana (status pending se shuru)
router.post('/', verifyToken, requireRole('shop_owner'), (req, res) => {
  try {
    const { name, city, licence_no, logo } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Shop name is required' });
    }

    const existing = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'You already have a shop' });
    }

    const result = db
      .prepare('INSERT INTO shops (owner_id, name, city, licence_no, logo) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, name.trim(), city || null, licence_no || null, logo || null);

    res.status(201).json({
      message: 'Shop submitted. Waiting for admin approval.',
      shopId: Number(result.lastInsertRowid),
      status: 'pending',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;