const base = 'http://localhost:5000';

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: 'Server did not send JSON', preview: text.slice(0, 80) };
  }
  console.log(method, path, '->', res.status, JSON.stringify(data).slice(0, 160));
  return data;
}

async function run() {
  const owner = await call('POST', '/auth/login', {
    email: 'jeweller@example.com', password: 'jeweller123',
  });

  const items = [
    { category_id: 1, title: 'Gold Jhumka Earrings', metal: 'gold', purity: '22K', weight_g: 8.5, making_charges: 4500, price: 62000, gender: 'women', occasion: 'festive' },
    { category_id: 2, title: 'Temple Necklace', metal: 'gold', purity: '22K', weight_g: 25, making_charges: 12000, price: 185000, gender: 'women', occasion: 'bridal' },
    { category_id: 8, title: 'Solitaire Ring', metal: 'gold', purity: '18K', weight_g: 4, making_charges: 3000, price: 48000, gender: 'women', stone: 'diamond', attributes: { size: 14 } },
    { category_id: 9, title: 'Plain Gold Bangle', metal: 'gold', purity: '22K', weight_g: 18, making_charges: 7000, price: 118000, gender: 'women', attributes: { inner_diameter_mm: 62 } },
    { category_id: 3, title: 'Mens Rope Chain', metal: 'gold', purity: '22K', weight_g: 20, making_charges: 6000, price: 135000, gender: 'men', attributes: { length_inch: 22 } },
  ];

  for (const item of items) {
    await call('POST', '/products', item, owner.token);
  }

  console.log('--- Sab products ---');
  await call('GET', '/products');
  console.log('--- Filter: rings (category 8) ---');
  await call('GET', '/products?category_id=8');
  console.log('--- Filter: price 50000 se 130000 ---');
  await call('GET', '/products?min_price=50000&max_price=130000');
  console.log('--- Ek product ki detail ---');
  await call('GET', '/products/1');

  console.log('--- Customer product add kare (403 aana chahiye) ---');
  const customer = await call('POST', '/auth/login', {
    email: 'test@example.com', password: 'test1234',
  });
  await call('POST', '/products', items[0], customer.token);

  console.log('--- Dusra shop owner doosre ka product badle (403 aana chahiye) ---');
  await call('POST', '/auth/register', {
    name: 'Other Owner', email: 'other@example.com', password: 'other1234', role: 'shop_owner',
  });
  const other = await call('POST', '/auth/login', {
    email: 'other@example.com', password: 'other1234',
  });
  await call('PUT', '/products/1', { price: 1 }, other.token);
}

run().catch((err) => console.error('Error:', err.message));