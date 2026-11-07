const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public: sabse naya rate
router.get('/', (req, res) => {
  const rate = db.prepare('SELECT * FROM gold_rates ORDER BY rate_date DESC LIMIT 1').get();
  if (!rate) return res.status(404).json({ error: 'No gold rate set yet' });
  res.json(rate);
});

// Admin: aaj ka rate set karna
router.put('/', verifyToken, requireRole('admin'), (req, res) => {
  const r24 = Number(req.body.rate_24k);
  const r22 = Number(req.body.rate_22k);
  const r18 = Number(req.body.rate_18k);
  if (!(r24 > 0) || !(r22 > 0) || !(r18 > 0)) {
    return res.status(400).json({ error: 'rate_24k, rate_22k and rate_18k must be numbers above 0' });
  }

  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO gold_rates (rate_date, rate_24k, rate_22k, rate_18k) VALUES (?, ?, ?, ?)
     ON CONFLICT(rate_date) DO UPDATE SET
       rate_24k = excluded.rate_24k, rate_22k = excluded.rate_22k, rate_18k = excluded.rate_18k`
  ).run(today, r24, r22, r18);

  res.json({ message: 'Gold rate saved', rate_date: today });
});

module.exports = router;