const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const bootstrap = require('./bootstrap');
const authRoutes = require('./routes/auth');
const shopRoutes = require('./routes/shops');
const adminRoutes = require('./routes/admin');
const productRoutes = require('./routes/products');
const rateRoutes = require('./routes/rates');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Jewellery marketplace API is running' });
});

app.use('/auth', authRoutes);
app.use('/shops', shopRoutes);
app.use('/admin', adminRoutes);
app.use('/products', productRoutes);
app.use('/gold-rate', rateRoutes);

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

const PORT = process.env.PORT || 5000;

bootstrap()
  .catch((err) => console.error('Bootstrap failed:', err.message))
  .then(() => {
    app.listen(PORT, (err) => {
      if (err) {
        console.error('Could not start server:', err.message);
        process.exit(1);
      }
      console.log(`Server running on port ${PORT}`);
    });
  });