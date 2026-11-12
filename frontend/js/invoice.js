const statusEl = document.getElementById('status');
const box = document.getElementById('invoice');
const banner = document.getElementById('banner');
const actions = document.getElementById('actions');

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function party(title, lines) {
  const div = el('div', 'party');
  div.appendChild(el('h3', null, title));
  lines.filter(Boolean).forEach((l) => div.appendChild(el('p', 'note', l)));
  return div;
}

function payLabel(o) {
  if (o.payment_method === 'online') return 'Paid online (demo)';
  if (o.payment_method === 'advance') return 'Advance paid (demo), rest on delivery';
  return 'Cash on delivery';
}

function sumRow(label, value, strong) {
  const tr = document.createElement('tr');
  const a = el('td', null, label);
  const b = el('td', null, value);
  b.style.textAlign = 'right';
  if (strong) { a.style.fontWeight = '700'; b.style.fontWeight = '700'; }
  tr.append(a, b);
  return tr;
}

function render(data) {
  const o = data.order;
  box.replaceChildren();

  box.appendChild(el('h1', null, 'Invoice #' + o.id));
  box.appendChild(el('p', 'note', 'Date: ' + fmtTime(o.created_at) + ' \u00B7 Status: ' + o.status));

  const parties = el('div', 'parties');
  parties.appendChild(party('Sold by', data.shop
    ? [data.shop.name, data.shop.address, data.shop.city, data.shop.phone ? 'Phone: ' + data.shop.phone : null]
    : ['Shop details not available']));
  parties.appendChild(party('Deliver to', [
    o.customer_name,
    o.address,
    o.contact_phone ? 'Phone: ' + o.contact_phone : null,
  ]));
  box.appendChild(parties);

  const table = el('table', 'list');
  const head = document.createElement('tr');
  ['Item', 'Price', 'Qty', 'Amount'].forEach((h) => head.appendChild(el('th', null, h)));
  table.appendChild(head);
  data.items.forEach((i) => {
    const tr = document.createElement('tr');
    [i.title, money(i.price), i.quantity, money(i.price * i.quantity)].forEach((v) => {
      tr.appendChild(el('td', null, String(v)));
    });
    table.appendChild(tr);
  });
  const wrap = el('div', 'table-wrap');
  wrap.appendChild(table);
  box.appendChild(wrap);

  const sum = el('table', 'sum');
  sum.style.marginLeft = 'auto';
  sum.appendChild(sumRow('Total', money(o.total), true));
  sum.appendChild(sumRow('Paid now (demo)', money(o.amount_paid)));
  sum.appendChild(sumRow('To pay on delivery', money(o.amount_due), true));
  box.appendChild(sum);

  box.appendChild(el('p', 'note', 'Payment: ' + payLabel(o) + (o.payment_ref ? ' \u00B7 Ref ' + o.payment_ref : '')));
  box.appendChild(el('p', 'note demo-note', 'Demo project: no real payment was made. Prices are set by the shop.'));

  box.hidden = false;
  actions.hidden = false;
}

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    statusEl.textContent = 'No order selected.';
    return;
  }

  try {
    const data = await apiFetch('/orders/' + encodeURIComponent(id) + '/invoice');
    statusEl.textContent = '';
    render(data);

    if (new URLSearchParams(location.search).get('new') === '1') {
      banner.textContent = 'Order placed! Thank you. Your delivery code is on the My orders page.';
      banner.hidden = false;
    }

    const role = Auth.user && Auth.user.role;
    const back = document.getElementById('back');
    if (role === 'shop_owner' || role === 'admin') {
      back.href = 'shop-orders.html';
      back.textContent = 'Back to orders';
    }
  } catch (err) {
    if (err.status === 401) {
      Auth.clear();
      location.replace('login.html');
      return;
    }
    statusEl.textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : 'Could not load this invoice: ' + err.message;
  }
}

document.getElementById('print').addEventListener('click', () => window.print());

if (!Auth.token) {
  location.replace('login.html');
} else {
  load();
}