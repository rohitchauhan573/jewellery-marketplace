const db = require('./config/db');

const COL = { '24K': 'rate_24k', '22K': 'rate_22k', '18K': 'rate_18k' };

const rate = db.prepare('SELECT * FROM gold_rates ORDER BY rate_date DESC LIMIT 1').get();
if (!rate) {
  console.log('Pehle gold rate set karo: node set-gold-rate.js 14312 13119 10734');
  process.exit(1);
}

const shop = db.prepare('SELECT id, status FROM shops ORDER BY id LIMIT 1').get();
if (!shop || shop.status !== 'approved') {
  console.log('Pehle ek approved shop chahiye (node test-shops.js ... chalao).');
  process.exit(1);
}

// [title, category_id, metal, purity, weight_g, making, gender, occasion, stone, attributes, factor]
// factor: gold ke liye estimated price ka multiplier, silver ke liye seedha price
const items = [
  ['Gold Stud Earrings', 1, 'gold', '22K', 3.2, 1800, 'women', 'daily', null, {}, 0.97],
  ['Gold Jhumka Earrings', 1, 'gold', '22K', 8.5, 4500, 'women', 'festive', null, {}, 1.02],
  ['Diamond Stud Earrings', 1, 'gold', '18K', 2.4, 2200, 'women', 'party', 'diamond', {}, 1.15],
  ['Chandbali Earrings', 1, 'gold', '22K', 10, 6000, 'women', 'bridal', null, {}, 0.92],
  ['Gold Hoop Earrings', 1, 'gold', '18K', 4.5, 2500, 'women', 'daily', null, {}, 1.04],
  ['Temple Necklace', 2, 'gold', '22K', 25, 12000, 'women', 'bridal', null, {}, 1.0],
  ['Light Gold Necklace', 2, 'gold', '22K', 12, 5000, 'women', 'festive', null, {}, 1.03],
  ['Kundan Choker', 2, 'gold', '22K', 30, 15000, 'women', 'bridal', 'kundan', {}, 1.18],
  ['Daily Wear Chain', 3, 'gold', '22K', 8, 3000, 'women', 'daily', null, { length_inch: 18 }, 0.98],
  ['Mens Rope Chain', 3, 'gold', '22K', 20, 6000, 'men', 'daily', null, { length_inch: 22 }, 1.05],
  ['Singapore Chain', 3, 'gold', '18K', 10, 3500, 'unisex', 'daily', null, { length_inch: 20 }, 0.94],
  ['Heart Pendant', 4, 'gold', '18K', 3, 1800, 'women', 'gift', null, {}, 1.02],
  ['Om Pendant', 4, 'gold', '22K', 4.5, 2000, 'unisex', 'daily', null, {}, 0.99],
  ['Diamond Pendant', 4, 'gold', '18K', 2.8, 2600, 'women', 'party', 'diamond', {}, 1.2],
  ['Gold Nose Pin', 5, 'gold', '22K', 0.8, 500, 'women', 'daily', null, {}, 1.0],
  ['Diamond Nose Pin', 5, 'gold', '18K', 0.6, 900, 'women', 'party', 'diamond', {}, 1.12],
  ['Bridal Maang Tikka', 6, 'gold', '22K', 9, 5000, 'women', 'bridal', 'kundan', {}, 0.96],
  ['Classic Mangalsutra', 7, 'gold', '22K', 14, 6000, 'women', 'bridal', null, {}, 1.01],
  ['Short Mangalsutra', 7, 'gold', '18K', 7, 3000, 'women', 'daily', null, {}, 0.95],
  ['Solitaire Ring', 8, 'gold', '18K', 4, 3000, 'women', 'engagement', 'diamond', { size: 14 }, 1.0],
  ['Plain Gold Band', 8, 'gold', '22K', 5, 2000, 'unisex', 'daily', null, { size: 16 }, 1.0],
  ['Mens Signet Ring', 8, 'gold', '22K', 9, 3500, 'men', 'daily', null, { size: 20 }, 1.08],
  ['Plain Gold Bangle', 9, 'gold', '22K', 18, 7000, 'women', 'daily', null, { inner_diameter_mm: 62 }, 0.97],
  ['Kada Bangle Pair', 9, 'gold', '22K', 40, 14000, 'women', 'bridal', null, { inner_diameter_mm: 64 }, 1.03],
  ['Gold Link Bracelet', 10, 'gold', '22K', 12, 4500, 'women', 'daily', null, {}, 1.0],
  ['Mens Heavy Bracelet', 10, 'gold', '22K', 25, 8000, 'men', 'daily', null, {}, 1.14],
  ['Silver Payal Anklets', 11, 'silver', '925', 40, 0, 'women', 'daily', null, {}, 4200],
  ['Silver Toe Rings Set', 11, 'silver', '925', 6, 0, 'women', 'bridal', null, {}, 900],
  ['Bridal Necklace Set', 12, 'gold', '22K', 60, 25000, 'women', 'bridal', 'ruby', {}, 0.97],
  ['Mens Kada', 13, 'gold', '22K', 30, 9000, 'men', 'festive', null, {}, 1.06],
];

db.prepare('DELETE FROM products WHERE shop_id = ?').run(shop.id);

const insert = db.prepare(
  `INSERT INTO products
   (shop_id, category_id, title, metal, purity, weight_g, making_charges, price,
    stock, gender, occasion, stone, attributes)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 5, ?, ?, ?, ?)`
);

for (const [title, cat, metal, purity, weight, making, gender, occasion, stone, attrs, factor] of items) {
  let price = factor;
  if (metal === 'gold') {
    const metalValue = rate[COL[purity]] * weight;
    const estimated = metalValue + making + metalValue * 0.03 + making * 0.05;
    price = Math.round((estimated * factor) / 100) * 100;
  }
  insert.run(shop.id, cat, title, metal, purity, weight, making, price,
    gender, occasion, stone, JSON.stringify(attrs));
}

console.log(`Done: ${items.length} products added to shop ${shop.id}.`);