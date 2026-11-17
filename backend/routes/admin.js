const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Is file ke saare routes sirf admin ke liye
router.use(verifyToken, requireRole('admin'));

// Site ke numbers
router.get('/stats', (req, res) => {
  const one = (sql) => db.prepare(sql).get();
  res.json({
    shops: db.prepare('SELECT status, COUNT(*) AS n FROM shops GROUP BY status').all(),
    products: one('SELECT COUNT(*) AS n FROM products').n,
    customers: one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").n,
    orders: db.prepare('SELECT status, COUNT(*) AS n FROM orders GROUP BY status').all(),
    sales: one("SELECT COALESCE(SUM(total), 0) AS s FROM orders WHERE status != 'cancelled'").s,
    top: db
      .prepare(
        `SELECT p.title, SUM(oi.quantity) AS sold
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         JOIN orders o ON o.id = oi.order_id
         WHERE o.status != 'cancelled'
         GROUP BY oi.product_id
         ORDER BY sold DESC
         LIMIT 5`
      )
      .all(),
  });
});

// Har shop ka hisaab: products, orders, bikri
router.get('/shop-stats', (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.city, s.status,
         (SELECT COUNT(*) FROM products p WHERE p.shop_id = s.id) AS products,
         (SELECT COALESCE(SUM(p.stock), 0) FROM products p WHERE p.shop_id = s.id) AS units_in_stock,
         (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi
            WHERE oi.shop_id = s.id) AS orders_total,
         (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.shop_id = s.id AND o.status = 'delivered') AS orders_delivered,
         (SELECT COUNT(DISTINCT oi.order_id) FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.shop_id = s.id AND o.status = 'cancelled') AS orders_cancelled,
         (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.shop_id = s.id AND o.status != 'cancelled') AS units_sold,
         (SELECT COALESCE(SUM(oi.price * oi.quantity), 0) FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE oi.shop_id = s.id AND o.status != 'cancelled') AS sales
       FROM shops s
       ORDER BY sales DESC, s.id`
    )
    .all();
  res.json(rows);
});

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