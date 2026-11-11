const express = require('express');
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { computeFairPrice } = require('../utils/fairPrice');

const router = express.Router();

function getMyShop(userId) {
  return db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(userId);
}

// Photo: https link ya PNG/JPG/WEBP data. Galat ho to false, khali ho to null
function cleanImage(value) {
  if (value === undefined || value === null || value === '') return null;
  const v = String(value).trim();
  if (v.length > 1500000) return false;
  if (/^https?:\/\/\S+$/i.test(v)) return v;
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v)) return v;
  return false;
}

const IMAGE_ERROR = 'Photos must be an https link, or a PNG, JPG or WEBP image under about 1 MB';

// Data wali photos list mein nahi bhejte (bahut bhaari), unke liye /:id/image use hota hai
const LIST_SQL = `
  SELECT p.id, p.title, p.metal, p.purity, p.weight_g, p.making_charges, p.price, p.stock,
         p.gender, p.occasion, p.stone, p.is_verified,
         c.name AS category, c.supports_try_on,
         s.id AS shop_id, s.name AS shop_name, s.city,
         (SELECT CASE WHEN url LIKE 'http%' THEN url ELSE NULL END
            FROM product_images WHERE product_id = p.id ORDER BY id LIMIT 1) AS image,
         EXISTS (SELECT 1 FROM product_images WHERE product_id = p.id) AS has_image
  FROM products p
  JOIN shops s ON s.id = p.shop_id
  JOIN categories c ON c.id = p.category_id
`;

// Public: approved shops ke products, filters ke saath
router.get('/', (req, res) => {
  try {
    const { category_id, metal, purity, gender, occasion, min_price, max_price, q, shop_id } = req.query;
    const where = ["s.status = 'approved'", 'p.stock > 0'];
    const params = [];

    if (category_id) { where.push('p.category_id = ?'); params.push(Number(category_id)); }
    if (metal)       { where.push('p.metal = ?');       params.push(metal); }
    if (purity)      { where.push('p.purity = ?');      params.push(purity); }
    if (gender)      { where.push('p.gender = ?');      params.push(gender); }
    if (occasion)    { where.push('p.occasion = ?');    params.push(occasion); }
    if (shop_id)     { where.push('p.shop_id = ?');     params.push(Number(shop_id)); }
    if (min_price)   { where.push('p.price >= ?');      params.push(Number(min_price)); }
    if (max_price)   { where.push('p.price <= ?');      params.push(Number(max_price)); }
    if (q)           { where.push('p.title LIKE ?');    params.push(`%${q}%`); }

    const rows = db
      .prepare(`${LIST_SQL} WHERE ${where.join(' AND ')} ORDER BY p.id DESC`)
      .all(...params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Shop owner: apne saare products
router.get('/mine', verifyToken, requireRole('shop_owner'), (req, res) => {
  const shop = getMyShop(req.user.id);
  if (!shop) return res.status(404).json({ error: 'Create your shop first' });
  const rows = db
    .prepare(`${LIST_SQL} WHERE p.shop_id = ? ORDER BY p.id DESC`)
    .all(shop.id);
  res.json(rows);
});

// Public: product ki pehli photo (data wali photo yahin se aati hai)
router.get('/:id/image', (req, res) => {
  const row = db
    .prepare(
      `SELECT pi.url FROM product_images pi
       JOIN products p ON p.id = pi.product_id
       JOIN shops s ON s.id = p.shop_id
       WHERE pi.product_id = ? AND s.status = 'approved'
       ORDER BY pi.id LIMIT 1`
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'No photo' });

  if (/^https?:\/\//i.test(row.url)) return res.redirect(row.url);

  const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(row.url);
  if (!m) return res.status(404).json({ error: 'No photo' });

  res.set('Content-Type', m[1]);
  res.set('Cache-Control', 'public, max-age=300');
  res.send(Buffer.from(m[2], 'base64'));
});

// Public: ek product ki poori detail (fair price ke saath)
router.get('/:id', (req, res) => {
  const product = db
    .prepare(
      `SELECT p.*, c.name AS category, c.supports_try_on,
              s.name AS shop_name, s.city
       FROM products p
       JOIN shops s ON s.id = p.shop_id
       JOIN categories c ON c.id = p.category_id
       WHERE p.id = ? AND s.status = 'approved'`
    )
    .get(req.params.id);

  if (!product) return res.status(404).json({ error: 'Product not found' });

  product.attributes = JSON.parse(product.attributes || '{}');
  product.images = db
    .prepare('SELECT url FROM product_images WHERE product_id = ? ORDER BY id')
    .all(product.id)
    .map((r) => r.url);
  product.fair_price = computeFairPrice(product);
  res.json(product);
});

// Shop owner: product add karna (shop approved honi chahiye)
router.post('/', verifyToken, requireRole('shop_owner'), (req, res) => {
  try {
    const shop = getMyShop(req.user.id);
    if (!shop) return res.status(400).json({ error: 'Create your shop first' });
    if (shop.status !== 'approved') {
      return res.status(403).json({ error: 'Your shop is not approved yet' });
    }

    const b = req.body;
    const price = Number(b.price);
    if (!b.title || !b.title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!b.category_id) return res.status(400).json({ error: 'category_id is required' });
    if (!(price > 0)) return res.status(400).json({ error: 'Price must be more than 0' });

    const category = db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(b.category_id));
    if (!category) return res.status(400).json({ error: 'Unknown category' });

    const images = (Array.isArray(b.images) ? b.images : []).map(cleanImage);
    if (images.some((v) => v === false)) return res.status(400).json({ error: IMAGE_ERROR });

    const tryOn = cleanImage(b.try_on_png);
    if (tryOn === false) return res.status(400).json({ error: IMAGE_ERROR });

    const result = db
      .prepare(
        `INSERT INTO products
         (shop_id, category_id, title, description, metal, purity, weight_g, making_charges,
          price, stock, gender, occasion, stone, attributes, try_on_png)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        shop.id,
        Number(b.category_id),
        b.title.trim(),
        b.description || null,
        b.metal || null,
        b.purity || null,
        b.weight_g != null ? Number(b.weight_g) : null,
        Number(b.making_charges || 0),
        price,
        b.stock != null ? Number(b.stock) : 1,
        b.gender || 'women',
        b.occasion || null,
        b.stone || null,
        JSON.stringify(b.attributes || {}),
        tryOn
      );

    const productId = Number(result.lastInsertRowid);
    const insertImage = db.prepare('INSERT INTO product_images (product_id, url) VALUES (?, ?)');
    images.filter(Boolean).forEach((url) => insertImage.run(productId, url));

    res.status(201).json({ message: 'Product added', productId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Shop owner: apna product edit karna
router.put('/:id', verifyToken, requireRole('shop_owner'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    const shop = getMyShop(req.user.id);
    if (!shop || existing.shop_id !== shop.id) {
      return res.status(403).json({ error: 'This is not your product' });
    }

    const b = { ...existing, ...req.body };
    const price = Number(b.price);
    if (!(price > 0)) return res.status(400).json({ error: 'Price must be more than 0' });

    const attributes =
      req.body.attributes !== undefined ? JSON.stringify(req.body.attributes) : existing.attributes;

    let tryOn = existing.try_on_png;
    if (req.body.try_on_png !== undefined) {
      tryOn = cleanImage(req.body.try_on_png);
      if (tryOn === false) return res.status(400).json({ error: IMAGE_ERROR });
    }

    let images = null;
    if (Array.isArray(req.body.images)) {
      images = req.body.images.map(cleanImage);
      if (images.some((v) => v === false)) return res.status(400).json({ error: IMAGE_ERROR });
    }

    db.prepare(
      `UPDATE products SET category_id = ?, title = ?, description = ?, metal = ?, purity = ?,
         weight_g = ?, making_charges = ?, price = ?, stock = ?, gender = ?, occasion = ?,
         stone = ?, attributes = ?, try_on_png = ? WHERE id = ?`
    ).run(
      Number(b.category_id), String(b.title), b.description ?? null, b.metal ?? null,
      b.purity ?? null, b.weight_g != null ? Number(b.weight_g) : null,
      Number(b.making_charges || 0), price, Number(b.stock), b.gender ?? 'women',
      b.occasion ?? null, b.stone ?? null, attributes, tryOn ?? null, existing.id
    );

    if (images) {
      db.prepare('DELETE FROM product_images WHERE product_id = ?').run(existing.id);
      const insertImage = db.prepare('INSERT INTO product_images (product_id, url) VALUES (?, ?)');
      images.filter(Boolean).forEach((url) => insertImage.run(existing.id, url));
    }

    res.json({ message: 'Product updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Shop owner: apna product delete karna
router.delete('/:id', verifyToken, requireRole('shop_owner'), (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const shop = getMyShop(req.user.id);
  if (!shop || existing.shop_id !== shop.id) {
    return res.status(403).json({ error: 'This is not your product' });
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  res.json({ message: 'Product deleted' });
});

module.exports = router;