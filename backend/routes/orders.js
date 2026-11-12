const express = require('express');
const crypto = require('crypto');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();

const MAX_OTP_TRIES = 5;
const ADVANCE_OPTIONS = [10, 25, 50];

// SQL ka tukda: payment ki jaankari (purane orders ke liye bhi chalta hai)
const PAY_COLS = `COALESCE(o.payment_method, 'cod') AS payment_method,
  COALESCE(o.amount_paid, 0) AS amount_paid,
  o.payment_ref,
  (o.total - COALESCE(o.amount_paid, 0)) AS amount_due`;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function sendError(res, err) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  return res.status(500).json({ error: 'Server error' });
}

// Saare steps ek saath hon ya koi nahi
function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function cleanPhone(raw) {
  const text = String(raw || '').trim();
  const digits = text.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15 ? text : null;
}

function newOtp() {
  return String(crypto.randomInt(1000, 10000));
}

function getMyShop(userId) {
  return db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(userId);
}

function addEvent(orderId, label) {
  db.prepare('INSERT INTO order_events (order_id, label) VALUES (?, ?)').run(orderId, label);
}

// Cancel hone par agar paisa diya tha to refund ka note
function cancelLabel(order, who) {
  const paid = Number(order.amount_paid) || 0;
  return paid > 0 ? `${who}. Refund of Rs ${paid} will be returned (demo)` : who;
}

function loadEvents(order) {
  const rows = db
    .prepare('SELECT label, created_at FROM order_events WHERE order_id = ? ORDER BY id')
    .all(order.id);
  return rows.length ? rows : [{ label: 'Placed', created_at: order.created_at }];
}

function loadItems(orderId) {
  return db
    .prepare(
      `SELECT oi.product_id, oi.quantity, oi.price, p.title, s.name AS shop_name
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN shops s ON s.id = oi.shop_id
       WHERE oi.order_id = ?`
    )
    .all(orderId);
}

function restock(orderId) {
  const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(orderId);
  const update = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
  items.forEach((i) => update.run(i.quantity, i.product_id));
}

// Shop owner ke liye sirf apna order, admin ke liye koi bhi
function staffOrder(req, orderId) {
  if (req.user.role === 'admin') {
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  }
  const shop = getMyShop(req.user.id);
  if (!shop) return null;
  return db
    .prepare(
      `SELECT o.* FROM orders o
       WHERE o.id = ? AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.shop_id = ?)`
    )
    .get(orderId, shop.id);
}

function staffList(where, params) {
  const orders = db
    .prepare(
      `SELECT o.id, o.total, o.status, o.address, o.contact_phone, o.created_at,
              ${PAY_COLS},
              u.name AS customer_name, u.email AS customer_email,
              o.delivery_partner_id, d.name AS partner_name, d.phone AS partner_phone
       FROM orders o
       JOIN users u ON u.id = o.user_id
       LEFT JOIN users d ON d.id = o.delivery_partner_id
       ${where}
       ORDER BY o.id DESC`
    )
    .all(...params);
  orders.forEach((o) => {
    o.items = loadItems(o.id);
    o.events = loadEvents(o);
  });
  return orders;
}

// ---------- Customer ----------

// Order place karna (stock apne aap kam hota hai, payment demo hai)
router.post('/', verifyToken, requireRole('customer'), (req, res) => {
  try {
    const { items, address } = req.body;
    const phone = cleanPhone(req.body.phone);

    if (!address || !String(address).trim()) {
      return res.status(400).json({ error: 'Delivery address is required' });
    }
    if (!phone) {
      return res.status(400).json({ error: 'A valid phone number is required so the delivery partner can reach you' });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items in the order' });
    }

    const method = ['cod', 'advance', 'online'].includes(req.body.payment_method)
      ? req.body.payment_method
      : 'cod';
    const percent = Number(req.body.advance_percent);
    if (method === 'advance' && !ADVANCE_OPTIONS.includes(percent)) {
      return res.status(400).json({ error: 'Choose an advance of 10%, 25% or 50%' });
    }

    const result = transaction(() => {
      let total = 0;
      let shopId = null;
      const lines = [];

      for (const item of items) {
        const productId = Number(item.product_id);
        const qty = Number(item.quantity);
        if (!Number.isInteger(productId) || !Number.isInteger(qty) || qty < 1) {
          throw httpError(400, 'Each item needs a product_id and a whole-number quantity of at least 1');
        }

        const product = db
          .prepare(
            `SELECT p.id, p.title, p.price, p.stock, p.shop_id, s.status AS shop_status
             FROM products p JOIN shops s ON s.id = p.shop_id
             WHERE p.id = ?`
          )
          .get(productId);

        if (!product || product.shop_status !== 'approved') throw httpError(404, 'Product not found');

        if (shopId === null) shopId = product.shop_id;
        else if (shopId !== product.shop_id) throw httpError(400, 'Order items from one shop at a time');

        const update = db
          .prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
          .run(qty, productId, qty);
        if (update.changes === 0) {
          const left = db.prepare('SELECT stock FROM products WHERE id = ?').get(productId).stock;
          throw httpError(409, left > 0 ? `Only ${left} left of "${product.title}"` : `"${product.title}" is out of stock`);
        }

        total += product.price * qty;
        lines.push({ productId, shopId: product.shop_id, qty, price: product.price });
      }

      // Demo payment: koi asli paisa nahi katta
      let paid = 0;
      if (method === 'online') paid = Math.round(total);
      if (method === 'advance') paid = Math.round((total * percent) / 100);
      const ref = paid > 0 ? 'DEMO-' + crypto.randomBytes(4).toString('hex').toUpperCase() : null;

      const order = db
        .prepare(
          `INSERT INTO orders
             (user_id, total, status, address, contact_phone, delivery_otp, payment_method, amount_paid, payment_ref)
           VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?)`
        )
        .run(req.user.id, total, String(address).trim(), phone, newOtp(), method, paid, ref);
      const orderId = Number(order.lastInsertRowid);

      const insertItem = db.prepare(
        'INSERT INTO order_items (order_id, product_id, shop_id, quantity, price) VALUES (?, ?, ?, ?, ?)'
      );
      lines.forEach((l) => insertItem.run(orderId, l.productId, l.shopId, l.qty, l.price));

      addEvent(orderId, 'Placed');
      if (paid > 0) {
        addEvent(orderId, (method === 'online' ? 'Paid online (demo): Rs ' : 'Advance paid (demo): Rs ') + paid);
      }

      return { orderId, total, amount_paid: paid, amount_due: total - paid };
    });

    res.status(201).json({ message: 'Order placed', ...result });
  } catch (err) {
    sendError(res, err);
  }
});

// Customer: apne orders (delivery code sirf yahin dikhta hai)
router.get('/mine', verifyToken, requireRole('customer'), (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.id, o.total, o.status, o.address, o.contact_phone, o.created_at,
              ${PAY_COLS},
              d.name AS partner_name, d.phone AS partner_phone,
              CASE WHEN o.status IN ('delivered', 'cancelled') THEN NULL ELSE o.delivery_otp END AS delivery_otp
       FROM orders o
       LEFT JOIN users d ON d.id = o.delivery_partner_id
       WHERE o.user_id = ?
       ORDER BY o.id DESC`
    )
    .all(req.user.id);
  orders.forEach((o) => {
    o.items = loadItems(o.id);
    o.events = loadEvents(o);
  });
  res.json(orders);
});

// Customer: apna pending order cancel karna (stock wapas aa jata hai)
router.patch('/:id/cancel', verifyToken, requireRole('customer'), (req, res) => {
  try {
    const order = db
      .prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending orders can be cancelled' });
    }

    transaction(() => {
      db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
      restock(order.id);
      addEvent(order.id, cancelLabel(order, 'Cancelled by customer'));
    });

    res.json({ message: 'Order cancelled' });
  } catch (err) {
    sendError(res, err);
  }
});

// ---------- Invoice (customer, uski shop ka owner, ya admin) ----------

router.get('/:id/invoice', verifyToken, (req, res) => {
  const order = db
    .prepare(
      `SELECT o.id, o.user_id, o.total, o.status, o.address, o.contact_phone, o.created_at,
              ${PAY_COLS},
              u.name AS customer_name, u.email AS customer_email
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`
    )
    .get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  let allowed = false;
  if (req.user.role === 'admin') allowed = true;
  else if (req.user.role === 'customer') allowed = order.user_id === req.user.id;
  else if (req.user.role === 'shop_owner') allowed = !!staffOrder(req, order.id);
  if (!allowed) return res.status(404).json({ error: 'Order not found' });

  const shop = db
    .prepare(
      `SELECT s.name, s.address, s.phone, s.city
       FROM order_items oi JOIN shops s ON s.id = oi.shop_id
       WHERE oi.order_id = ? LIMIT 1`
    )
    .get(order.id);

  const { user_id, ...safeOrder } = order;
  res.json({ order: safeOrder, shop: shop || null, items: loadItems(order.id) });
});

// ---------- Shop owner aur Admin ----------

router.get('/shop', verifyToken, requireRole('shop_owner'), (req, res) => {
  const shop = getMyShop(req.user.id);
  if (!shop) return res.json([]);
  res.json(
    staffList(
      'WHERE EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.shop_id = ?)',
      [shop.id]
    )
  );
});

router.get('/all', verifyToken, requireRole('admin'), (req, res) => {
  res.json(staffList('', []));
});

// Delivery partners ki list (assign karne ke liye)
router.get('/partners', verifyToken, requireRole('shop_owner', 'admin'), (req, res) => {
  const rows = db
    .prepare("SELECT id, name, phone FROM users WHERE role = 'delivery' ORDER BY name")
    .all();
  res.json(rows);
});

// Confirm, packed ya cancel
router.patch('/:id/status', verifyToken, requireRole('shop_owner', 'admin'), (req, res) => {
  try {
    const action = req.body.action;
    if (!['confirm', 'packed', 'cancel'].includes(action)) {
      return res.status(400).json({ error: 'Action must be confirm, packed or cancel' });
    }

    const order = staffOrder(req, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    transaction(() => {
      if (action === 'confirm') {
        if (order.status !== 'pending') throw httpError(409, 'Only pending orders can be confirmed');
        db.prepare("UPDATE orders SET status = 'confirmed' WHERE id = ?").run(order.id);
        addEvent(order.id, 'Confirmed');
      } else if (action === 'packed') {
        if (order.status !== 'confirmed') throw httpError(409, 'Confirm the order first');
        const done = db
          .prepare("SELECT 1 FROM order_events WHERE order_id = ? AND label = 'Packed'")
          .get(order.id);
        if (done) throw httpError(409, 'Order is already marked as packed');
        addEvent(order.id, 'Packed');
      } else {
        if (!['pending', 'confirmed'].includes(order.status)) {
          throw httpError(409, 'Only orders that have not been picked up can be cancelled');
        }
        db.prepare("UPDATE orders SET status = 'cancelled' WHERE id = ?").run(order.id);
        restock(order.id);
        addEvent(order.id, cancelLabel(order, 'Cancelled by shop'));
      }
    });

    res.json({ message: 'Order updated' });
  } catch (err) {
    sendError(res, err);
  }
});

// Delivery partner assign karna
router.patch('/:id/assign', verifyToken, requireRole('shop_owner', 'admin'), (req, res) => {
  try {
    const order = staffOrder(req, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status !== 'confirmed') {
      return res.status(409).json({ error: 'Confirm the order before assigning a delivery partner' });
    }

    const partner = db
      .prepare("SELECT id, name FROM users WHERE id = ? AND role = 'delivery'")
      .get(Number(req.body.delivery_partner_id));
    if (!partner) return res.status(400).json({ error: 'Choose a valid delivery partner' });

    transaction(() => {
      db.prepare(
        'UPDATE orders SET delivery_partner_id = ?, otp_attempts = 0, delivery_otp = COALESCE(delivery_otp, ?) WHERE id = ?'
      ).run(partner.id, newOtp(), order.id);
      addEvent(order.id, 'Delivery partner assigned: ' + partner.name);
    });

    res.json({ message: 'Delivery partner assigned' });
  } catch (err) {
    sendError(res, err);
  }
});

// ---------- Delivery partner ----------

router.get('/delivery', verifyToken, requireRole('delivery'), (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.id, o.total, o.status, o.address AS drop_address, o.contact_phone AS customer_phone,
              o.created_at, ${PAY_COLS}, u.name AS customer_name
       FROM orders o
       JOIN users u ON u.id = o.user_id
       WHERE o.delivery_partner_id = ? AND o.status != 'cancelled'
       ORDER BY CASE o.status WHEN 'shipped' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, o.id DESC`
    )
    .all(req.user.id);

  orders.forEach((o) => {
    o.items = loadItems(o.id);
    o.events = loadEvents(o);
    o.shop = db
      .prepare(
        `SELECT s.name, s.address, s.phone, s.city
         FROM order_items oi JOIN shops s ON s.id = oi.shop_id
         WHERE oi.order_id = ? LIMIT 1`
      )
      .get(o.id);
  });
  res.json(orders);
});

router.patch('/:id/delivery', verifyToken, requireRole('delivery'), (req, res) => {
  try {
    const order = db
      .prepare('SELECT * FROM orders WHERE id = ? AND delivery_partner_id = ?')
      .get(req.params.id, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const action = req.body.action;

    if (action === 'picked_up') {
      if (order.status !== 'confirmed') return res.status(409).json({ error: 'This order is not ready for pickup' });
      transaction(() => {
        db.prepare("UPDATE orders SET status = 'shipped' WHERE id = ?").run(order.id);
        addEvent(order.id, 'Picked up');
      });
      return res.json({ message: 'Marked as picked up' });
    }

    if (action === 'out_for_delivery') {
      if (order.status !== 'shipped') return res.status(409).json({ error: 'Pick up the order first' });
      const done = db
        .prepare("SELECT 1 FROM order_events WHERE order_id = ? AND label = 'Out for delivery'")
        .get(order.id);
      if (done) return res.status(409).json({ error: 'Already marked as out for delivery' });
      addEvent(order.id, 'Out for delivery');
      return res.json({ message: 'Marked as out for delivery' });
    }

    if (action === 'delivered') {
      if (order.status !== 'shipped') return res.status(409).json({ error: 'Pick up the order first' });
      if ((order.otp_attempts || 0) >= MAX_OTP_TRIES) {
        return res.status(429).json({ error: 'Too many wrong codes. Ask the shop or admin to assign this order again.' });
      }

      const given = String(req.body.otp || '').trim();
      const expected = String(order.delivery_otp || '');
      const ok =
        given.length === expected.length &&
        expected.length > 0 &&
        crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));

      if (!ok) {
        const attempts = (order.otp_attempts || 0) + 1;
        db.prepare('UPDATE orders SET otp_attempts = ? WHERE id = ?').run(attempts, order.id);
        const left = MAX_OTP_TRIES - attempts;
        return res.status(400).json({
          error: left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. This order is now locked.',
        });
      }

      const due = order.total - (Number(order.amount_paid) || 0);
      transaction(() => {
        db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ?").run(order.id);
        addEvent(order.id, 'Delivered');
        if (due > 0) addEvent(order.id, 'Cash collected: Rs ' + due);
      });
      return res.json({ message: 'Delivered. Thank you!' });
    }

    res.status(400).json({ error: 'Action must be picked_up, out_for_delivery or delivered' });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;