const API = ['localhost', '127.0.0.1'].includes(location.hostname)
  ? 'http://localhost:5000'
  : 'https://YOUR-SERVICE.onrender.com';

const Auth = {
  get token() {
    try { return localStorage.getItem('jh_token'); } catch (e) { return null; }
  },
  get user() {
    try { return JSON.parse(localStorage.getItem('jh_user') || 'null'); } catch (e) { return null; }
  },
  save(token, user) {
    try {
      localStorage.setItem('jh_token', token);
      localStorage.setItem('jh_user', JSON.stringify(user));
    } catch (e) { /* storage band ho to bhi page chalta rahe */ }
  },
  clear() {
    try {
      localStorage.removeItem('jh_token');
      localStorage.removeItem('jh_user');
    } catch (e) { /* ignore */ }
  },
};

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (Auth.token) headers.Authorization = 'Bearer ' + Auth.token;

  const res = await fetch(API + path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  try { data = await res.json(); } catch (e) { /* khali jawab */ }

  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed');
    err.status = res.status;
    throw err;
  }
  return data;
}

function renderNav() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.replaceChildren();

  const add = (text, href) => {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = text;
    nav.appendChild(a);
  };

  add('Home', 'index.html');

  const user = Auth.user;
  if (!user) {
    add('Login', 'login.html');
    add('Register', 'register.html');
    return;
  }

  if (user.role === 'shop_owner') add('My shop', 'dashboard.html');
  if (user.role === 'admin') add('Admin', 'admin.html');

  const who = document.createElement('span');
  who.className = 'nav-user';
  who.textContent = user.name;
  nav.appendChild(who);

  const out = document.createElement('button');
  out.type = 'button';
  out.className = 'link-btn';
  out.textContent = 'Logout';
  out.addEventListener('click', () => {
    Auth.clear();
    location.href = 'index.html';
  });
  nav.appendChild(out);
}

renderNav();