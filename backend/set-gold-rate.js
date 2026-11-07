const db = require('./config/db');

const [r24, r22, r18] = process.argv.slice(2).map(Number);

if (!(r24 > 0) || !(r22 > 0) || !(r18 > 0)) {
  console.log('Usage: node set-gold-rate.js <24K per gram> <22K per gram> <18K per gram>');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
db.prepare(
  `INSERT INTO gold_rates (rate_date, rate_24k, rate_22k, rate_18k) VALUES (?, ?, ?, ?)
   ON CONFLICT(rate_date) DO UPDATE SET
     rate_24k = excluded.rate_24k, rate_22k = excluded.rate_22k, rate_18k = excluded.rate_18k`
).run(today, r24, r22, r18);

console.log(`Saved gold rate for ${today}: 24K=${r24}, 22K=${r22}, 18K=${r18} (per gram)`);