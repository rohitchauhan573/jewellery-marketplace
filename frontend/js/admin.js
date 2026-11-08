const statusEl = document.getElementById('status');
let currentTab = 'pending';

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text === null || text === undefined || text === '' ? '-' : String(text);
  return td;
}

function headRow(labels) {
  const tr = document.createElement('tr');
  labels.forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    tr.appendChild(th);
  });
  return tr;
}

function authFailed(err) {
  if (err.status === 401 || err.status === 403) {
    Auth.clear();
    location.replace('login.html');
    return true;
  }
  return false;
}

function actionButton(label, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function setShopStatus(id, status) {
  try {
    await apiFetch('/admin/shops/' + id + '/status', { method: 'PATCH', body: { status } });
    await loadShops();
  } catch (err) {
    if (!authFailed(err)) alert(err.message);
  }
}

async function loadShops() {
  document.querySelectorAll('[data-tab]').forEach((b) => {
    b.className = b.dataset.tab === currentTab ? '' : 'secondary';
  });

  const box = document.getElementById('shop-list');
  box.replaceChildren();

  try {
    const rows = await apiFetch('/admin/shops?status=' + currentTab);
    if (!rows.length) {
      box.textContent = 'No ' + currentTab + ' shops.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'list';
    table.appendChild(headRow(['Shop', 'City', 'Licence', 'Owner', 'Email', 'Created', '']));

    rows.forEach((s) => {
      const tr = document.createElement('tr');
      [s.name, s.city, s.licence_no, s.owner_name, s.owner_email, s.created_at].forEach((v) => tr.appendChild(cell(v)));

      const actions = document.createElement('td');
      if (s.status !== 'approved') {
        actions.appendChild(actionButton('Approve', 'small', () => setShopStatus(s.id, 'approved')));
      }
      if (s.status !== 'rejected') {
        actions.appendChild(actionButton('Reject', 'danger small', () => setShopStatus(s.id, 'rejected')));
      }
      tr.appendChild(actions);
      table.appendChild(tr);
    });
    box.appendChild(table);
  } catch (err) {
    if (!authFailed(err)) statusEl.textContent = 'Could not load shops: ' + err.message;
  }
}

async function loadProducts() {
  const box = document.getElementById('product-list');
  box.replaceChildren();

  try {
    const rows = await apiFetch('/products');
    document.getElementById('product-count').textContent = '(' + rows.length + ')';
    if (!rows.length) {
      box.textContent = 'No jewellery yet.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'list';
    table.appendChild(headRow(['Title', 'Shop', 'Category', 'Price', 'Verified', '']));

    rows.forEach((p) => {
      const tr = document.createElement('tr');
      [p.title, p.shop_name, p.category, money(p.price), p.is_verified ? 'Yes' : 'No'].forEach((v) => tr.appendChild(cell(v)));

      const actions = document.createElement('td');
      actions.appendChild(actionButton(
        p.is_verified ? 'Remove badge' : 'Verify',
        p.is_verified ? 'secondary small' : 'small',
        async () => {
          try {
            await apiFetch('/admin/products/' + p.id + '/verify', {
              method: 'PATCH',
              body: { is_verified: !p.is_verified },
            });
            await loadProducts();
          } catch (err) {
            if (!authFailed(err)) alert(err.message);
          }
        }
      ));
      tr.appendChild(actions);
      table.appendChild(tr);
    });
    box.appendChild(table);
  } catch (err) {
    statusEl.textContent = 'Could not load jewellery: ' + err.message;
  }
}

async function loadRate() {
  const note = document.getElementById('rate-current');
  try {
    const r = await apiFetch('/gold-rate');
    note.textContent = 'Current rate (' + r.rate_date + '): 24K ' + money(r.rate_24k) +
      ', 22K ' + money(r.rate_22k) + ', 18K ' + money(r.rate_18k) + ' per gram.';
    document.getElementById('r24').value = r.rate_24k;
    document.getElementById('r22').value = r.rate_22k;
    document.getElementById('r18').value = r.rate_18k;
  } catch (err) {
    note.textContent = 'No gold rate saved yet.';
  }
}

document.querySelectorAll('[data-tab]').forEach((b) => {
  b.addEventListener('click', () => {
    currentTab = b.dataset.tab;
    loadShops();
  });
});

document.getElementById('rate-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('rate-msg');
  try {
    await apiFetch('/gold-rate', {
      method: 'PUT',
      body: {
        rate_24k: Number(document.getElementById('r24').value),
        rate_22k: Number(document.getElementById('r22').value),
        rate_18k: Number(document.getElementById('r18').value),
      },
    });
    msg.textContent = 'Gold rate saved.';
    msg.className = 'notice ok';
    msg.hidden = false;
    await loadRate();
  } catch (err) {
    if (authFailed(err)) return;
    msg.textContent = err.message;
    msg.className = 'notice error';
    msg.hidden = false;
  }
});

const me = Auth.user;
if (!Auth.token || !me || me.role !== 'admin') {
  location.replace('login.html');
} else {
  loadShops();
  loadRate();
  loadProducts();
}