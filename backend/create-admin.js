const bcrypt = require('bcrypt');
const db = require('./config/db');

const [name, email, password] = process.argv.slice(2);

if (!name || !email || !password) {
  console.log('Usage: node create-admin.js "Your Name" your@email.com yourPassword');
  process.exit(1);
}

(async () => {
  const cleanEmail = email.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);

  if (existing) {
    db.prepare("UPDATE users SET role = 'admin', password_hash = ? WHERE id = ?").run(hash, existing.id);
    console.log('Existing user is now an admin.');
  } else {
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')")
      .run(name.trim(), cleanEmail, hash);
    console.log('Admin created.');
  }
})();