const statusEl = document.getElementById('status');

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function show(id, visible) {
  document.getElementById(id).hidden = !visible;
}

function setNotice(id, text, ok) {
  const node = document.getElementById(id);
  node.textContent = text || '';
  node.className = 'notice ' + (ok ? 'ok' : 'error');
  node.hidden = !text;
}

function txt(id) {
  return document.getElementById(id).value.trim();
}

function num(id) {
  const v = txt(id);
  return v === '' ? undefined : Number(v);
}

function handleAuthError(err) {
  if (err.status === 401) {
    Auth.clear();
    location.replace('login.html');
    return true;
  }
  return false;
}

async function loadCategories() {
  const select = document.getElementById('p-category');
  if (select.options.length > 1) return;
  const rows = await apiFetch('/categories');
  rows.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });
}

async function editProduct(p) {
  const priceInput = prompt('New selling price (Rs):', p.price);
  if (priceInput === null) return;
  const stockInput = prompt('Stock quantity:', p.stock);
  if (stockInput === null) return;

  const price = Number(priceInput);
  const stock = Number(stockInput);
  if (!(price > 0) || !Number.isInteger(stock) || stock < 0) {
    alert('Price must be above 0 and stock must be a whole number (0 or more).');
    return;
  }

  try {
    await apiFetch('/products/' + p.id, { method: 'PUT', body: { price, stock } });
    await loadProducts();
  } catch (err) {
    if (!handleAuthError(err)) alert(err.message);
  }
}

async function loadProducts() {
  const rows = await apiFetch('/products/mine');
  const box = document.getElementById('product-list');
  box.replaceChildren();
  document.getElementById('product-count').textContent = '(' + rows.length + ')';

  if (!rows.length) {
    box.textContent = 'No jewellery added yet.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'list';

  const head = document.createElement('tr');
  ['Title', 'Category', 'Purity', 'Weight', 'Price', 'Stock', 'Verified', ''].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  });
  table.appendChild(head);

  rows.forEach((p) => {
    const tr = document.createElement('tr');
    const cells = [
      p.title,
      p.category,
      p.purity || '-',
      p.weight_g ? p.weight_g + ' g' : '-',
      money(p.price),
      p.stock === 0 ? '0 (hidden)' : p.stock,
      p.is_verified ? 'Yes' : 'No',
    ];
    cells.forEach((value) => {
      const td = document.createElement('td');
      td.textContent = value;
      tr.appendChild(td);
    });

    const actions = document.createElement('td');
    const view = document.createElement('a');
    view.href = 'product.html?id=' + p.id;
    view.textContent = 'View';
    actions.appendChild(view);

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary small';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => editProduct(p));
    actions.appendChild(edit);

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'danger small';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (!confirm('Delete "' + p.title + '"?')) return;
      try {
        await apiFetch('/products/' + p.id, { method: 'DELETE' });
        await loadProducts();
      } catch (err) {
        if (!handleAuthError(err)) alert(err.message);
      }
    });
    actions.appendChild(del);
    tr.appendChild(actions);
    table.appendChild(tr);
  });

  box.appendChild(table);
}

function renderShop(shop) {
  show('create-shop', false);
  show('shop-info', true);

  document.getElementById('shop-title').textContent = shop.name;
  document.getElementById('shop-meta').textContent =
    [shop.city, shop.licence_no ? 'Licence: ' + shop.licence_no : null].filter(Boolean).join(' \u00B7 ');

  const badge = document.getElementById('shop-badge');
  badge.textContent = shop.status;
  badge.className = 'status-badge status-' + shop.status;

  const note = document.getElementById('shop-note');
  if (shop.status === 'pending') {
    note.textContent = 'Waiting for admin approval. You can add jewellery once your shop is approved.';
  } else if (shop.status === 'rejected') {
    note.textContent = 'Your shop was rejected. Please contact the admin.';
  } else {
    note.textContent = 'Your shop is live. Customers can see your jewellery.';
  }

  const approved = shop.status === 'approved';
  show('add-product', approved);
  show('my-products', approved);

  if (approved) {
    loadCategories().catch(() => {});
    loadProducts().catch((err) => {
      if (!handleAuthError(err)) statusEl.textContent = 'Could not load your jewellery: ' + err.message;
    });
  }
}

async function init() {
  statusEl.textContent = 'Loading...';
  let shop = null;
  try {
    shop = await apiFetch('/shops/mine');
  } catch (err) {
    if (handleAuthError(err)) return;
    if (err.status !== 404) {
      statusEl.textContent = err.message === 'Failed to fetch'
        ? 'Could not reach the server. Is the backend running?'
        : 'Could not load your shop: ' + err.message;
      return;
    }
  }

  statusEl.textContent = '';
  if (!shop) {
    show('create-shop', true);
    show('shop-info', false);
    show('add-product', false);
    show('my-products', false);
    return;
  }
  renderShop(shop);
}

document.getElementById('shop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice('shop-msg', '');
  try {
    await apiFetch('/shops', {
      method: 'POST',
      body: {
        name: txt('shop-name'),
        city: txt('shop-city') || undefined,
        licence_no: txt('shop-licence') || undefined,
      },
    });
    await init();
  } catch (err) {
    if (!handleAuthError(err)) setNotice('shop-msg', err.message, false);
  }
});

document.getElementById('product-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setNotice('product-msg', '');

  const image = txt('p-image');
  if (image && !/^https?:\/\//i.test(image)) {
    setNotice('product-msg', 'Photo link must start with http:// or https://', false);
    return;
  }

  const size = txt('p-size');
  const body = {
    title: txt('p-title'),
    category_id: Number(document.getElementById('p-category').value),
    metal: txt('p-metal') || undefined,
    purity: txt('p-purity') || undefined,
    weight_g: num('p-weight'),
    making_charges: num('p-making'),
    price: num('p-price'),
    stock: num('p-stock'),
    gender: txt('p-gender') || undefined,
    occasion: txt('p-occasion') || undefined,
    stone: txt('p-stone') || undefined,
    description: txt('p-desc') || undefined,
    attributes: size ? { size_or_length: size } : {},
    images: image ? [image] : [],
  };

  const btn = document.getElementById('product-submit');
  btn.disabled = true;
  try {
    await apiFetch('/products', { method: 'POST', body });
    document.getElementById('product-form').reset();
    setNotice('product-msg', 'Jewellery added. It is now visible on the home page.', true);
    await loadProducts();
  } catch (err) {
    if (!handleAuthError(err)) setNotice('product-msg', err.message, false);
  } finally {
    btn.disabled = false;
  }
});

const currentUser = Auth.user;
if (!Auth.token || !currentUser || currentUser.role !== 'shop_owner') {
  location.replace('login.html');
} else {
  init();
}