const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const [id, source, mode] = process.argv.slice(2);

function usage() {
  console.log('Usage:');
  console.log('  node set-product-image.js <product id> "<photo link ya file ka path>"');
  console.log('  node set-product-image.js <product id> "<transparent png link ya file ka path>" tryon');
  console.log('Example:');
  console.log('  node set-product-image.js 37 "C:\\photos\\jhumka.png"');
  process.exit(1);
}

function toValue(src) {
  if (/^https?:\/\//i.test(src)) return src;
  if (!fs.existsSync(src)) {
    console.log('File not found: ' + src);
    process.exit(1);
  }
  const ext = path.extname(src).toLowerCase();
  const type = ext === '.png' ? 'image/png'
    : ext === '.webp' ? 'image/webp'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : null;
  if (!type) {
    console.log('Only PNG, JPG or WEBP files are allowed.');
    process.exit(1);
  }
  const buf = fs.readFileSync(src);
  if (buf.length > 1000000) {
    console.log('This file is over 1 MB. Resize it first (around 700 pixels wide is enough).');
    process.exit(1);
  }
  return 'data:' + type + ';base64,' + buf.toString('base64');
}

if (!id || !source) usage();

const product = db.prepare('SELECT id, title FROM products WHERE id = ?').get(Number(id));
if (!product) {
  console.log('No product with id ' + id);
  process.exit(1);
}

const value = toValue(source);

if (mode === 'tryon') {
  db.prepare('UPDATE products SET try_on_png = ? WHERE id = ?').run(value, product.id);
  console.log('Try-on image saved for "' + product.title + '".');
} else {
  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(product.id);
  db.prepare('INSERT INTO product_images (product_id, url) VALUES (?, ?)').run(product.id, value);
  console.log('Photo saved for "' + product.title + '".');
}