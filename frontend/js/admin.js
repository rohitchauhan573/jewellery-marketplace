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
    loadShopReport();
    loadStats();
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

// Upar ke numbers
async function loadStats() {
  const box = document.getElementById('stats');
  if (!box) return;
  try {
    const s = await apiFetch('/admin/stats');
    box.replaceChildren();
    const count = (rows, key) => (rows.find((r) => r.status === key) || { n: 0 }).n;
    const items = [
      ['Shops approved', count(s.shops, 'approved')],
      ['Shops waiting', count(s.shops, 'pending')],
      ['Jewellery listed', s.products],
      ['Customers', s.customers],
      ['Orders placed', s.orders.reduce((sum, r) => sum + r.n, 0)],
      ['Orders delivered', count(s.orders, 'delivered')],
      ['Sales (not cancelled)', money(s.sales)],
    ];
    items.forEach(([label, value]) => {
      const card = document.createElement('div');
      card.className = 'stat';
      const big = document.createElement('strong');
      big.textContent = String(value);
      const small = document.createElement('span');
      small.textContent = label;
      card.append(big, small);
      box.appendChild(card);
    });
    if (s.top.length) {
      const top = document.createElement('div');
      top.className = 'stat stat-wide';
      const title = document.createElement('span');
      title.textContent = 'Best sellers';
      top.appendChild(title);
      s.top.forEach((t) => {
        const p = document.createElement('p');
        p.textContent = t.title + ': ' + t.sold + ' sold';
        top.appendChild(p);
      });
      box.appendChild(top);
    }
  } catch (err) {
    /* numbers optional, baaki page chalta rahe */
  }
}

// Har shop ka hisaab
async function loadShopReport() {
  const box = document.getElementById('shop-report');
  if (!box) return;
  box.replaceChildren();

  try {
    const rows = await apiFetch('/admin/shop-stats');
    if (!rows.length) {
      box.textContent = 'No shops yet.';
      return;
    }

    const table = document.createElement('table');
    table.className = 'list';
    table.appendChild(headRow([
      'Shop', 'City', 'Status', 'Jewellery', 'In stock', 'Orders', 'Delivered', 'Cancelled', 'Units sold', 'Sales',
    ]));

    const total = { products: 0, stock: 0, orders: 0, delivered: 0, cancelled: 0, sold: 0, sales: 0 };

    rows.forEach((r) => {
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      if (r.status === 'approved') {
        const link = document.createElement('a');
        link.href = 'shop.html?id=' + r.id;
        link.textContent = r.name;
        nameCell.appendChild(link);
      } else {
        nameCell.textContent = r.name;
      }
      tr.appendChild(nameCell);

      [r.city, r.status, r.products, r.units_in_stock, r.orders_total, r.orders_delivered,
        r.orders_cancelled, r.units_sold, money(r.sales)].forEach((v) => tr.appendChild(cell(v)));
      table.appendChild(tr);

      total.products += r.products;
      total.stock += r.units_in_stock;
      total.orders += r.orders_total;
      total.delivered += r.orders_delivered;
      total.cancelled += r.orders_cancelled;
      total.sold += r.units_sold;
      total.sales += r.sales;
    });

    const sum = document.createElement('tr');
    sum.className = 'total-row';
    ['All shops', '', '', total.products, total.stock, total.orders, total.delivered,
      total.cancelled, total.sold, money(total.sales)].forEach((v) => sum.appendChild(cell(v)));
    table.appendChild(sum);

    box.appendChild(table);
  } catch (err) {
    if (!authFailed(err)) box.textContent = 'Could not load the shop report: ' + err.message;
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
  loadStats();
  loadShopReport();
  loadShops();
  loadRate();
  loadProducts();
}