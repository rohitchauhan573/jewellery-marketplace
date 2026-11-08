const API = 'http://localhost:5000';

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

const Cart = {
  get items() {
    try { return JSON.parse(localStorage.getItem('jh_cart') || '[]'); } catch (e) { return []; }
  },
  save(items) {
    try { localStorage.setItem('jh_cart', JSON.stringify(items)); } catch (e) { /* ignore */ }
  },
  get count() {
    return this.items.reduce((sum, i) => sum + i.quantity, 0);
  },
  // Ek order mein sirf ek shop ke items ho sakte hain
  add(product, quantity) {
    const items = this.items;
    if (items.length && items[0].shop_id !== product.shop_id) {
      return {
        ok: false,
        message: 'Your cart has items from ' + items[0].shop_name +
          '. Place that order or clear the cart before adding items from another shop.',
      };
    }
    const existing = items.find((i) => i.product_id === product.id);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, product.stock);
      existing.stock = product.stock;
      existing.price = product.price;
    } else {
      items.push({
        product_id: product.id,
        title: product.title,
        price: product.price,
        shop_id: product.shop_id,
        shop_name: product.shop_name,
        stock: product.stock,
        quantity: Math.min(quantity, product.stock),
      });
    }
    this.save(items);
    return { ok: true };
  },
  setQuantity(productId, quantity) {
    const items = this.items;
    const item = items.find((i) => i.product_id === productId);
    if (!item) return;
    item.quantity = Math.max(1, Math.min(quantity, item.stock));
    this.save(items);
  },
  remove(productId) {
    this.save(this.items.filter((i) => i.product_id !== productId));
  },
  clear() {
    this.save([]);
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

// Database ka time UTC mein hota hai, yahan local time mein dikhate hain
function fmtTime(value) {
  if (!value) return '';
  const d = new Date(String(value).replace(' ', 'T') + 'Z');
  return isNaN(d.getTime())
    ? String(value)
    : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function timelineEl(events) {
  const ol = document.createElement('ol');
  ol.className = 'timeline';
  events.forEach((e) => {
    const li = document.createElement('li');
    const label = document.createElement('strong');
    label.textContent = e.label;
    const time = document.createElement('span');
    time.textContent = ' \u00B7 ' + fmtTime(e.created_at);
    li.append(label, time);
    ol.appendChild(li);
  });
  return ol;
}

// Google Maps directions ka link (koi API key nahi chahiye)
function mapsLink(label, destination, origin) {
  const a = document.createElement('a');
  a.className = 'map-link';
  let url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(destination);
  if (origin) url += '&origin=' + encodeURIComponent(origin);
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = label;
  return a;
}

function telLink(phone) {
  const a = document.createElement('a');
  a.href = 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
  a.textContent = phone || '-';
  return a;
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

  if (user.role === 'customer') {
    add('Cart (' + Cart.count + ')', 'cart.html');
    add('My orders', 'orders.html');
  }
  if (user.role === 'shop_owner') {
    add('My shop', 'dashboard.html');
    add('Orders', 'shop-orders.html');
  }
  if (user.role === 'delivery') add('My deliveries', 'delivery.html');
  if (user.role === 'admin') {
    add('Admin', 'admin.html');
    add('Orders', 'shop-orders.html');
  }

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
    Cart.clear();
    location.href = 'index.html';
  });
  nav.appendChild(out);
}

renderNav();