const statusEl = document.getElementById('status');
const box = document.getElementById('orders');

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

  const table = document.createElement('table');
  table.className = 'list';
  const head = document.createElement('tr');
  ['Item', 'Shop', 'Qty', 'Price'].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  });
  table.appendChild(head);
  o.items.forEach((i) => {
    const tr = document.createElement('tr');
    [i.title, i.shop_name, i.quantity, money(i.price)].forEach((v) => {
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

  panel.appendChild(noteLine('Deliver to: ' + o.address + (o.contact_phone ? ' \u00B7 ' + o.contact_phone : '')));

  if (o.partner_name) {
    const line = document.createElement('p');
    line.className = 'note';
    line.append('Delivery partner: ' + o.partner_name + ' \u00B7 ');
    line.appendChild(telLink(o.partner_phone));
    panel.appendChild(line);
  }

  if (o.delivery_otp) {
    const otp = document.createElement('div');
    otp.className = 'otp-box';
    const label = document.createElement('div');
    label.textContent = 'Your delivery code';
    const code = document.createElement('div');
    code.className = 'otp-code';
    code.textContent = o.delivery_otp;
    const hint = document.createElement('div');
    hint.className = 'note';
    hint.textContent = 'Tell this code to the delivery person only when you have received your jewellery.';
    otp.append(label, code, hint);
    panel.appendChild(otp);
  }

  const trackTitle = document.createElement('h3');
  trackTitle.textContent = 'Tracking';
  panel.append(trackTitle, timelineEl(o.events));

  if (o.status === 'pending') {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'danger small';
    cancel.textContent = 'Cancel order';
    cancel.addEventListener('click', async () => {
      if (!confirm('Cancel order #' + o.id + '?')) return;
      try {
        await apiFetch('/orders/' + o.id + '/cancel', { method: 'PATCH' });
        await load();
      } catch (err) {
        if (!authFailed(err)) alert(err.message);
      }
    });
    panel.appendChild(cancel);
  }

  return panel;
}

async function load() {
  box.replaceChildren();
  statusEl.textContent = 'Loading...';
  try {
    const orders = await apiFetch('/orders/mine');
    statusEl.textContent = orders.length ? '' : 'You have not placed any orders yet.';
    orders.forEach((o) => box.appendChild(orderPanel(o)));
  } catch (err) {
    if (authFailed(err)) return;
    statusEl.textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : 'Could not load orders: ' + err.message;
  }
}

const me = Auth.user;
if (!Auth.token || !me || me.role !== 'customer') {
  location.replace('login.html');
} else {
  load();
}