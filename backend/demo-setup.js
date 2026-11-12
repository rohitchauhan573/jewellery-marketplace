const bcrypt = require('bcrypt');
const db = require('./config/db');

async function ensureUser(name, email, password, role, phone) {
  const existing = db.prepare('SELECT id, phone FROM users WHERE email = ?').get(email);
  if (existing) {
    if (!existing.phone) db.prepare('UPDATE users SET phone = ? WHERE id = ?').run(phone, existing.id);
    return existing.id;
  }
  const hash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)')
    .run(name, email, hash, role, phone);
  return Number(result.lastInsertRowid);
}

(async () => {
  await ensureUser('Demo Customer', 'test@example.com', 'test1234', 'customer', '9000000001');
  const ownerId = await ensureUser('Friend Jeweller', 'jeweller@example.com', 'jeweller123', 'shop_owner', '9000000002');
  await ensureUser('Demo Rider', 'rider@example.com', 'rider1234', 'delivery', '9000000003');

  const shop = db.prepare('SELECT * FROM shops WHERE owner_id = ?').get(ownerId);
  if (!shop) {
    db.prepare(
      `INSERT INTO shops (owner_id, name, city, licence_no, status, address, phone)
       VALUES (?, 'Friend Jewellers', 'Mumbai', 'DEMO-123', 'approved', 'Shop 4, Station Road, Thane West, Mumbai', '9000000002')`
    ).run(ownerId);
  } else {
    db.prepare(
      `UPDATE shops SET status = 'approved',
         address = COALESCE(address, 'Shop 4, Station Road, Thane West, Mumbai'),
         phone = COALESCE(phone, '9000000002')
       WHERE id = ?`
    ).run(shop.id);
  }

  const rate = db.prepare('SELECT id FROM gold_rates LIMIT 1').get();
  if (!rate) {
    const today = new Date().toISOString().slice(0, 10);
    db.prepare('INSERT INTO gold_rates (rate_date, rate_24k, rate_22k, rate_18k) VALUES (?, 14312, 13119, 10734)').run(today);
    console.log('Gold rate set to example values. Use set-gold-rate.js to enter the real rate.');
  }

 

  console.log('');
  console.log('Demo accounts ready:');
  console.log('  Customer      test@example.com      test1234');
  console.log('  Shop owner    jeweller@example.com  jeweller123');
  console.log('  Delivery      rider@example.com     rider1234');
  console.log('Admin: create one with create-admin.js (do not share its password).');
})();