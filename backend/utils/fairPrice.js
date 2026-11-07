const db = require('../config/db');

const COLUMN = { '24K': 'rate_24k', '22K': 'rate_22k', '18K': 'rate_18k' };

function latestRate() {
  return db.prepare('SELECT * FROM gold_rates ORDER BY rate_date DESC LIMIT 1').get();
}

function computeFairPrice(product) {
  const rate = latestRate();
  const column = COLUMN[String(product.purity || '').toUpperCase()];
  const isGold = String(product.metal || '').toLowerCase() === 'gold';
  if (!rate || !column || !isGold || !product.weight_g) return null;

  const perGram = rate[column];
  if (!perGram) return null;

  const metalValue = perGram * product.weight_g;
  const making = product.making_charges || 0;
  const gst = metalValue * 0.03 + making * 0.05;
  const estimated = Math.round(metalValue + making + gst);

  const ratio = product.price / estimated;
  let verdict = 'Fair';
  if (ratio <= 0.95) verdict = 'Good deal';
  else if (ratio > 1.1) verdict = 'Overpriced';

  return {
    rate_date: rate.rate_date,
    rate_per_gram: perGram,
    estimated_price: estimated,
    asking_price: product.price,
    difference_percent: Math.round((ratio - 1) * 1000) / 10,
    verdict,
  };
}

module.exports = { computeFairPrice };