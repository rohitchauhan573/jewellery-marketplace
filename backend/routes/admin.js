const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Is file ke saare routes sirf admin ke liye
router.use(verifyToken, requireRole('admin'));

// Shops ki list (default: pending). ?status=approved ya rejected bhi chalega
router.get('/shops', (req, res) => {
  const status = req.query.status || 'pending';
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.city, s.licence_no, s.status, s.created_at,
              u.name AS owner_name, u.email AS owner_email
       FROM shops s JOIN users u ON u.id = s.owner_id
       WHERE s.status = ? ORDER BY s.id DESC`
    )
    .all(status);
  res.json(rows);
});

// Shop approve ya reject karna
router.patch('/shops/:id/status', (req, res) => {
  const { status } = req.body;
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected or pending' });
  }

  const result = db.prepare('UPDATE shops SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Shop not found' });
  }
  res.json({ message: `Shop ${status}` });
});

// Product ko Verified mark karna
router.patch('/products/:id/verify', (req, res) => {
  const verified = req.body.is_verified ? 1 : 0;
  const result = db.prepare('UPDATE products SET is_verified = ? WHERE id = ?').run(verified, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
  res.json({ message: verified ? 'Product verified' : 'Verification removed' });
});

module.exports = router;