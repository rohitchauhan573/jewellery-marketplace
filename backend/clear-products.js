const db = require('./config/db');

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;

console.log('Products:', count('products'));
console.log('Orders (test orders that point to products):', count('orders'));

if (!process.argv.includes('--yes')) {
  console.log('');
  console.log('Nothing was deleted yet.');
  console.log('Run again with --yes to delete all products, their photos and all orders.');
  console.log('Categories, shops, users and the gold rate are kept.');
  process.exit(0);
}

db.exec('BEGIN');
try {
  db.exec('DELETE FROM order_events');
  db.exec('DELETE FROM order_items');
  db.exec('DELETE FROM orders');
  db.exec('DELETE FROM cart_items');
  db.exec('DELETE FROM product_images');
  db.exec('DELETE FROM products');
  db.exec(
    "DELETE FROM sqlite_sequence WHERE name IN ('products', 'product_images', 'orders', 'order_items', 'order_events')"
  );
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

console.log('');
console.log('Done. Products left:', count('products'), '| Categories kept:', count('categories'));