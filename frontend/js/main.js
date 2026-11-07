const API = 'http://localhost:5000';

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const categorySelect = document.getElementById('category');

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function card(p) {
  const link = document.createElement('a');
  link.className = 'card';
  link.href = 'product.html?id=' + p.id;

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  if (p.image) {
    const img = document.createElement('img');
    img.src = p.image;
    img.alt = p.title;
    thumb.appendChild(img);
  } else {
    thumb.textContent = '\uD83D\uDC8E';
  }

  const body = document.createElement('div');
  body.className = 'card-body';

  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = p.title;
  if (p.is_verified) {
    const badge = document.createElement('span');
    badge.className = 'badge';
    badge.textContent = 'Verified';
    title.appendChild(badge);
  }

  const meta = document.createElement('p');
  meta.className = 'card-meta';
  meta.textContent = [p.category, p.purity, p.weight_g ? p.weight_g + ' g' : null]
    .filter(Boolean).join(' \u00B7 ');

  const shop = document.createElement('p');
  shop.className = 'card-meta';
  shop.textContent = p.shop_name + (p.city ? ', ' + p.city : '');

  const price = document.createElement('p');
  price.className = 'card-price';
  price.textContent = money(p.price);

  body.append(title, meta, shop, price);
  link.append(thumb, body);
  return link;
}

async function loadCategories() {
  try {
    const res = await fetch(API + '/categories');
    const rows = await res.json();
    rows.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      categorySelect.appendChild(opt);
    });
  } catch (err) {
    statusEl.textContent = 'Could not reach the server. Is the backend running?';
  }
}

async function loadProducts() {
  const params = new URLSearchParams();
  const fields = ['q', 'category', 'purity', 'gender', 'min_price', 'max_price'];
  fields.forEach((id) => {
    const value = document.getElementById(id).value.trim();
    if (!value) return;
    params.set(id === 'category' ? 'category_id' : id, value);
  });

  statusEl.textContent = 'Loading...';
  grid.replaceChildren();

  try {
    const res = await fetch(API + '/products?' + params.toString());
    const rows = await res.json();
    if (!res.ok) throw new Error(rows.error || 'Request failed');

    statusEl.textContent = rows.length
      ? rows.length + ' item' + (rows.length === 1 ? '' : 's') + ' found'
      : 'No jewellery found. Try changing the filters.';
    rows.forEach((p) => grid.appendChild(card(p)));
  } catch (err) {
    statusEl.textContent = 'Could not load products: ' + err.message;
  }
}

document.getElementById('apply').addEventListener('click', loadProducts);
document.getElementById('reset').addEventListener('click', () => {
  ['q', 'category', 'purity', 'gender', 'min_price', 'max_price'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  loadProducts();
});
document.getElementById('q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadProducts();
});

loadCategories();
loadProducts();