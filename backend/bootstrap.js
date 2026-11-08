const bcrypt = require('bcrypt');
const db = require('./config/db');

async function createUser(name, email, password, role) {
  const hash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email.trim().toLowerCase(), hash, role);
  return Number(result.lastInsertRowid);
}

async function bootstrap() {
  // 1. Admin (sirf tab jab environment variables set hon)
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const existing = db
      .prepare('SELECT id FROM users WHERE email = ?')
      .get(adminEmail.trim().toLowerCase());
    if (!existing) {
      await createUser('Admin', adminEmail, adminPassword, 'admin');
      console.log('Bootstrap: admin created');
    }
  }

  // 2. Demo shop aur products (sirf jab database mein koi shop na ho)
  const demoPassword = process.env.DEMO_PASSWORD;
  if (!demoPassword) return;

  const shopCount = db.prepare('SELECT COUNT(*) AS total FROM shops').get().total;
  if (shopCount > 0) return;

  const ownerId = await createUser('Friend Jeweller', 'jeweller@example.com', demoPassword, 'shop_owner');
  db.prepare(
    "INSERT INTO shops (owner_id, name, city, licence_no, status) VALUES (?, 'Friend Jewellers', 'Mumbai', 'DEMO-123', 'approved')"
  ).run(ownerId);

  const r24 = Number(process.env.GOLD_24K) || 14312;
  const r22 = Number(process.env.GOLD_22K) || 13119;
  const r18 = Number(process.env.GOLD_18K) || 10734;
  const today = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO gold_rates (rate_date, rate_24k, rate_22k, rate_18k) VALUES (?, ?, ?, ?)
     ON CONFLICT(rate_date) DO UPDATE SET
       rate_24k = excluded.rate_24k, rate_22k = excluded.rate_22k, rate_18k = excluded.rate_18k`
  ).run(today, r24, r22, r18);

  // 30 demo products (seed-products.js import hote hi chal jati hai)
  require('./seed-products');
  console.log('Bootstrap: demo shop and products created');
}

module.exports = bootstrap;