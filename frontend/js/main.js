const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const categorySelect = document.getElementById('category');
const chipsBox = document.getElementById('chips');
const titleEl = document.getElementById('page-title');

const FIELDS = ['q', 'category', 'purity', 'gender', 'min_price', 'max_price'];
let categories = [];

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function card(p) {
  const link = document.createElement('a');
  link.className = 'card';
  link.href = 'product.html?id=' + p.id;

  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const photo = p.image || (p.has_image ? API + '/products/' + p.id + '/image' : null);
  if (photo) {
    const img = document.createElement('img');
    img.src = photo;
    img.alt = p.title;
    img.loading = 'lazy';
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

  if (typeof p.stock === 'number' && p.stock > 0 && p.stock <= 3) {
    const low = document.createElement('p');
    low.className = 'stock-note';
    low.textContent = 'Only ' + p.stock + ' left';
    body.appendChild(low);
  }

  link.append(thumb, body);
  return link;
}

function categoryName(id) {
  const c = categories.find((x) => String(x.id) === String(id));
  return c ? c.name : null;
}

function markChips() {
  const current = categorySelect.value;
  chipsBox.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.id === current);
  });
}

function syncUrl() {
  const url = new URL(location.href);
  if (categorySelect.value) url.searchParams.set('category', categorySelect.value);
  else url.searchParams.delete('category');
  history.replaceState(null, '', url);
}

function addChip(label, id) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip';
  b.dataset.id = String(id);
  b.textContent = label;
  b.addEventListener('click', () => {
    categorySelect.value = String(id);
    loadProducts();
  });
  chipsBox.appendChild(b);
}

async function loadCategories() {
  try {
    categories = await apiFetch('/categories');
    addChip('All', '');
    categories.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      categorySelect.appendChild(opt);
      addChip(c.name, c.id);
    });

    const wanted = new URLSearchParams(location.search).get('category');
    if (wanted && categoryName(wanted)) categorySelect.value = wanted;
  } catch (err) {
    statusEl.textContent = 'Could not reach the server. Is the backend running?';
  }
}

async function loadProducts() {
  const params = new URLSearchParams();
  FIELDS.forEach((id) => {
    const value = document.getElementById(id).value.trim();
    if (!value) return;
    params.set(id === 'category' ? 'category_id' : id, value);
  });

  titleEl.textContent = categoryName(categorySelect.value) || 'All jewellery';
  markChips();
  syncUrl();

  statusEl.textContent = 'Loading...';
  grid.replaceChildren();

  try {
    const rows = await apiFetch('/products?' + params.toString());
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
  FIELDS.forEach((id) => { document.getElementById(id).value = ''; });
  loadProducts();
});
document.getElementById('q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadProducts();
});
categorySelect.addEventListener('change', loadProducts);

loadCategories().then(loadProducts);
// Gold rate board (home page ke hero mein)
async function loadRateBoard() {
  const rows = document.getElementById('rate-rows');
  const dateEl = document.getElementById('rate-date');
  if (!rows) return;
  try {
    const r = await apiFetch('/gold-rate');
    rows.replaceChildren();
    [['24K', r.rate_24k], ['22K', r.rate_22k], ['18K', r.rate_18k]].forEach(([label, value]) => {
      const row = document.createElement('div');
      row.className = 'rate-row';
      const name = document.createElement('span');
      name.textContent = label + ' gold';
      const amount = document.createElement('strong');
      amount.textContent = money(value);
      row.append(name, amount);
      rows.appendChild(row);
    });
    dateEl.textContent = 'Per gram, updated ' + r.rate_date;
  } catch (err) {
    rows.textContent = 'The gold rate has not been set yet.';
  }
}

loadRateBoard();