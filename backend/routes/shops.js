const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

function cleanPhone(raw) {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? text : null;
}

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
    const address = String(req.body.address || '').trim();
    const phone = cleanPhone(req.body.phone);

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Shop name is required' });
    }
    if (!address) {
      return res.status(400).json({ error: 'Shop address is required (delivery partners pick up from here)' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'A valid shop phone number is required' });
    }

    const existing = db.prepare('SELECT id FROM shops WHERE owner_id = ?').get(req.user.id);
    if (existing) {
      return res.status(409).json({ error: 'You already have a shop' });
    }

    const result = db
      .prepare(
        'INSERT INTO shops (owner_id, name, city, licence_no, logo, address, phone) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      .run(req.user.id, name.trim(), city || null, licence_no || null, logo || null, address, phone);

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

// Shop owner: shop ka address, phone aur city badalna
router.patch('/mine', verifyToken, requireRole('shop_owner'), (req, res) => {
  try {
    const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(req.user.id);
    if (!shop) return res.status(404).json({ error: 'You have not created a shop yet' });

    const address = req.body.address !== undefined ? String(req.body.address).trim() : shop.address;
    const phone = cleanPhone(req.body.phone !== undefined ? req.body.phone : shop.phone);
    const city = req.body.city !== undefined ? String(req.body.city).trim() || null : shop.city;

    if (!address) return res.status(400).json({ error: 'Shop address is required' });
    if (!phone) return res.status(400).json({ error: 'A valid shop phone number is required' });

    db.prepare('UPDATE shops SET address = ?, phone = ?, city = ? WHERE id = ?').run(
      address, phone, city, shop.id
    );
    res.json({ message: 'Shop details saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;