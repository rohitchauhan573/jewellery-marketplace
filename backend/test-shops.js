const base = 'http://localhost:5000';
const [adminEmail, adminPassword] = process.argv.slice(2);

async function call(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  console.log(method, path, '->', res.status, JSON.stringify(data));
  return data;
}

async function run() {
  if (!adminEmail || !adminPassword) {
    console.log('Usage: node test-shops.js admin@email.com adminPassword');
    return;
  }

  await call('POST', '/auth/register', {
    name: 'Friend Jeweller', email: 'jeweller@example.com',
    password: 'jeweller123', role: 'shop_owner',
  });
  const owner = await call('POST', '/auth/login', {
    email: 'jeweller@example.com', password: 'jeweller123',
  });

  const shop = await call('POST', '/shops', {
    name: 'Friend Jewellers', city: 'Mumbai', licence_no: 'TEST-123',
  }, owner.token);

  console.log('--- Public list (abhi khali hona chahiye) ---');
  await call('GET', '/shops');

  const admin = await call('POST', '/auth/login', { email: adminEmail, password: adminPassword });
  console.log('--- Admin pending list ---');
  await call('GET', '/admin/shops', null, admin.token);

  if (shop.shopId) {
    console.log('--- Admin approve ---');
    await call('PATCH', `/admin/shops/${shop.shopId}/status`, { status: 'approved' }, admin.token);
  }

  console.log('--- Public list (ab shop dikhni chahiye) ---');
  await call('GET', '/shops');

  console.log('--- Customer admin route try kare (403 aana chahiye) ---');
  const customer = await call('POST', '/auth/login', {
    email: 'test@example.com', password: 'test1234',
  });
  await call('GET', '/admin/shops', null, customer.token);
}

run().catch((err) => console.error('Error:', err.message));