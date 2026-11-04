const base = 'http://localhost:5000';

async function send(path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  console.log(path, '->', res.status, data);
  return data;
}

async function run() {
  await send('/auth/register', {
    name: 'Test Customer',
    email: 'test@example.com',
    password: 'test1234',
    role: 'customer',
  });

  const login = await send('/auth/login', {
    email: 'test@example.com',
    password: 'test1234',
  });

  const me = await fetch(base + '/auth/me', {
    headers: { Authorization: 'Bearer ' + login.token },
  });
  console.log('/auth/me ->', me.status, await me.json());
}

run().catch((err) => console.error('Could not reach server:', err.message));