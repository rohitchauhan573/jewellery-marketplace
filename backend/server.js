const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shops');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/products');
const rateRoutes = require('./routes/rates');
const orderRoutes = require('./routes/orders');

const app = express();
app.use(cors());
// Photos base64 mein aati hain, isliye limit badhayi hai
app.use(express.json({ limit: '4mb' }));

app.get('/', (req, res) => {
  res.json({ message: 'Jewellery marketplace API is running' });
});

app.use('/auth', authRoutes);
app.use('/shops', shopRoutes);
app.use('/admin', adminRoutes);
app.use('/products', productRoutes);
app.use('/gold-rate', rateRoutes);
app.use('/orders', orderRoutes);

app.get('/categories', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY id').all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Koi route na mile to HTML ki jagah JSON jawab do
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Koi bhi bacha hua error yahan aayega
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'The photo is too large. Choose a smaller photo.' });
  }
  if (/FOREIGN KEY/i.test(String(err && err.message))) {
    return res.status(409).json({
      error: 'This item is part of an order, so it cannot be deleted. Set its stock to 0 instead.',
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, (err) => {
  if (err) {
    console.error('Could not start server:', err.message);
    process.exit(1);
  }
  console.log(`Server running on port ${PORT}`);
});