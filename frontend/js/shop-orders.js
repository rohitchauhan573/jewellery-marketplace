const statusEl = document.getElementById('status');
const box = document.getElementById('orders');
const me = Auth.user;
const isAdmin = !!me && me.role === 'admin';
let partners = [];

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function badgeClass(status) {
  if (status === 'cancelled') return 'status-rejected';
  if (status === 'pending') return 'status-pending';
  return 'status-approved';
}

function authFailed(err) {
  if (err.status === 401 || err.status === 403) {
    Auth.clear();
    location.replace('login.html');
    return true;
  }
  return false;
}

function noteLine(text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

function actionButton(label, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

async function act(path, body, confirmText) {
  if (confirmText && !confirm(confirmText)) return;
  try {
    await apiFetch(path, { method: 'PATCH', body });
    await load();
  } catch (err) {
    if (!authFailed(err)) alert(err.message);
  }
}

function assignForm(o) {
  const form = document.createElement('div');
  form.className = 'inline-form';

  if (!partners.length) {
    form.appendChild(noteLine('No delivery partners yet. Ask them to register as "Delivery partner".'));
    return form;
  }

  const select = document.createElement('select');
  const first = document.createElement('option');
  first.value = '';
  first.textContent = 'Choose delivery partner';
  select.appendChild(first);
  partners.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name + ' (' + p.phone + ')';
    if (o.delivery_partner_id === p.id) opt.selected = true;
    select.appendChild(opt);
  });

  const btn = actionButton(o.delivery_partner_id ? 'Change partner' : 'Assign', 'small', () => {
    if (!select.value) {
      alert('Choose a delivery partner first.');
      return;
    }
    act('/orders/' + o.id + '/assign', { delivery_partner_id: Number(select.value) });
  });

  form.append(select, btn);
  return form;
}

function orderPanel(o) {
  const panel = document.createElement('section');
  panel.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = 'Order #' + o.id + ' ';
  const badge = document.createElement('span');
  badge.className = 'status-badge ' + badgeClass(o.status);
  badge.textContent = o.status;
  title.appendChild(badge);
  panel.appendChild(title);

  panel.appendChild(noteLine(fmtTime(o.created_at) + ' \u00B7 Total ' + money(o.total) + ' \u00B7 Cash on delivery'));

  const customer = document.createElement('p');
  customer.className = 'note';
  customer.append('Customer: ' + o.customer_name + ' \u00B7 ');
  customer.appendChild(telLink(o.contact_phone));
  customer.append(' \u00B7 ' + o.customer_email);
  panel.appendChild(customer);
  panel.appendChild(noteLine('Deliver to: ' + o.address));

  const table = document.createElement('table');
  table.className = 'list';
  const head = document.createElement('tr');
  (isAdmin ? ['Item', 'Shop', 'Qty', 'Price'] : ['Item', 'Qty', 'Price']).forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  });
  table.appendChild(head);
  o.items.forEach((i) => {
    const tr = document.createElement('tr');
    const values = isAdmin
      ? [i.title, i.shop_name, i.quantity, money(i.price)]
      : [i.title, i.quantity, money(i.price)];
    values.forEach((v) => {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  wrap.appendChild(table);
  panel.appendChild(wrap);

  if (o.partner_name) {
    const line = document.createElement('p');
    line.className = 'note';
    line.append('Delivery partner: ' + o.partner_name + ' \u00B7 ');
    line.appendChild(telLink(o.partner_phone));
    panel.appendChild(line);
  }

  const trackTitle = document.createElement('h3');
  trackTitle.textContent = 'Tracking';
  panel.append(trackTitle, timelineEl(o.events));

  const packed = o.events.some((e) => e.label === 'Packed');

  if (o.status === 'pending') {
    panel.appendChild(actionButton('Confirm', 'small', () => act('/orders/' + o.id + '/status', { action: 'confirm' })));
  }
  if (o.status === 'confirmed') {
    if (!packed) {
      panel.appendChild(actionButton('Mark packed', 'small', () => act('/orders/' + o.id + '/status', { action: 'packed' })));
    }
    panel.appendChild(assignForm(o));
  }
  if (['pending', 'confirmed'].includes(o.status)) {
    panel.appendChild(actionButton('Cancel order', 'danger small', () =>
      act('/orders/' + o.id + '/status', { action: 'cancel' }, 'Cancel order #' + o.id + '? The stock will be returned.')));
  }

  return panel;
}

async function load() {
  box.replaceChildren();
  statusEl.textContent = 'Loading...';
  try {
    const orders = await apiFetch(isAdmin ? '/orders/all' : '/orders/shop');
    try { partners = await apiFetch('/orders/partners'); } catch (e) { partners = []; }
    statusEl.textContent = orders.length ? '' : 'No orders yet.';
    orders.forEach((o) => box.appendChild(orderPanel(o)));
  } catch (err) {
    if (authFailed(err)) return;
    statusEl.textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : 'Could not load orders: ' + err.message;
  }
}

if (!Auth.token || !me || !['shop_owner', 'admin'].includes(me.role)) {
  location.replace('login.html');
} else {
  if (isAdmin) document.querySelector('h1').textContent = 'All orders';
  load();
}