const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const dbFolder = path.join(__dirname, '..', '..', 'database');
const dbFile = path.join(dbFolder, 'jewellery.db');
const db = new DatabaseSync(dbFile);

// Lock hone par error dene ki jagah 5 second intezaar karo
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec(fs.readFileSync(path.join(dbFolder, 'schema.sql'), 'utf8'));

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function addColumn(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`Migration: added ${table}.${column}`);
  }
}

// users table mein 'delivery' role chahiye. SQLite CHECK badal nahi sakta,
// isliye table dobara banate hain (data copy hota hai).
function allowDeliveryRole() {
  const row = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  if (row && row.sql.includes("'delivery'")) return;

  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    db.exec('BEGIN');
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'customer'
          CHECK (role IN ('customer', 'shop_owner', 'admin', 'delivery')),
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        phone TEXT
      );
      INSERT INTO users_new (id, name, email, password_hash, role, created_at)
        SELECT id, name, email, password_hash, role, created_at FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
    db.exec('COMMIT');
    console.log('Migration: users table now allows the delivery role');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (e) { /* ignore */ }
    throw err;
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
}

allowDeliveryRole();
addColumn('users', 'phone', 'TEXT');
addColumn('shops', 'address', 'TEXT');
addColumn('shops', 'phone', 'TEXT');
addColumn('orders', 'contact_phone', 'TEXT');
addColumn('orders', 'delivery_partner_id', 'INTEGER');
addColumn('orders', 'delivery_otp', 'TEXT');
addColumn('orders', 'otp_attempts', 'INTEGER DEFAULT 0');
addColumn('orders', 'payment_method', "TEXT DEFAULT 'cod'");
addColumn('orders', 'amount_paid', 'REAL DEFAULT 0');
addColumn('orders', 'payment_ref', 'TEXT');

db.exec(`
  CREATE TABLE IF NOT EXISTS order_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(fs.readFileSync(path.join(dbFolder, 'seed.sql'), 'utf8'));

const count = db.prepare('SELECT COUNT(*) AS total FROM categories').get();
console.log(`Database ready: ${dbFile}`);
console.log(`Categories loaded: ${count.total}`);

module.exports = db;