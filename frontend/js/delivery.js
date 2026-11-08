const statusEl = document.getElementById('status');
const box = document.getElementById('orders');

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function badgeClass(status) {
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

function actionButton(label, className, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = className;
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function block(titleText) {
  const div = document.createElement('div');
  div.className = 'party';
  const h = document.createElement('h3');
  h.textContent = titleText;
  div.appendChild(h);
  return div;
}

function line(text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

async function send(order, action, otp) {
  try {
    await apiFetch('/orders/' + order.id + '/delivery', { method: 'PATCH', body: { action, otp } });
    await load();
  } catch (err) {
    if (!authFailed(err)) alert(err.message);
  }
}

function orderPanel(o) {
  const panel = document.createElement('section');
  panel.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = 'Order #' + o.id + ' ';
  const badge = document.createElement('span');
  badge.className = 'status-badge ' + badgeClass(o.status);
  badge.textContent = o.status === 'confirmed' ? 'ready for pickup' : o.status === 'shipped' ? 'on the way' : o.status;
  title.appendChild(badge);
  panel.appendChild(title);

  panel.appendChild(line(o.items.map((i) => i.quantity + ' x ' + i.title).join(', ') + ' \u00B7 Collect ' + money(o.total) + ' (cash on delivery)'));

  const shopAddr = o.shop && o.shop.address ? o.shop.address : '';
  const shopBox = block('Pick up from');
  if (o.shop) {
    shopBox.appendChild(line(o.shop.name));
    shopBox.appendChild(line(shopAddr || 'The shop has not added an address yet. Call the shop.'));
    const call = document.createElement('p');
    call.className = 'note';
    call.append('Phone: ');
    call.appendChild(telLink(o.shop.phone));
    shopBox.appendChild(call);
  }

  const dropBox = block('Deliver to');
  dropBox.appendChild(line(o.customer_name));
  dropBox.appendChild(line(o.drop_address));
  const callCustomer = document.createElement('p');
  callCustomer.className = 'note';
  callCustomer.append('Phone: ');
  callCustomer.appendChild(telLink(o.customer_phone));
  dropBox.appendChild(callCustomer);

  panel.append(shopBox, dropBox);

  const maps = document.createElement('div');
  maps.className = 'map-links';
  if (shopAddr) maps.appendChild(mapsLink('Directions to shop', shopAddr));
  maps.appendChild(mapsLink('Directions to customer', o.drop_address));
  if (shopAddr) maps.appendChild(mapsLink('Shop to customer route', o.drop_address, shopAddr));
  panel.appendChild(maps);

  const trackTitle = document.createElement('h3');
  trackTitle.textContent = 'Progress';
  panel.append(trackTitle, timelineEl(o.events));

  if (o.status === 'confirmed') {
    panel.appendChild(actionButton('Picked up from shop', 'small', () => send(o, 'picked_up')));
  }

  if (o.status === 'shipped') {
    const outDone = o.events.some((e) => e.label === 'Out for delivery');
    if (!outDone) {
      panel.appendChild(actionButton('Out for delivery', 'secondary small', () => send(o, 'out_for_delivery')));
    }

    const form = document.createElement('div');
    form.className = 'inline-form';
    const otp = document.createElement('input');
    otp.type = 'text';
    otp.inputMode = 'numeric';
    otp.maxLength = 4;
    otp.placeholder = 'Customer code';
    otp.setAttribute('aria-label', 'Customer delivery code');
    form.append(otp, actionButton('Mark delivered', 'small', () => {
      if (!/^\d{4}$/.test(otp.value.trim())) {
        alert('Enter the 4-digit code the customer gives you.');
        return;
      }
      send(o, 'delivered', otp.value.trim());
    }));
    panel.appendChild(form);
  }

  return panel;
}

async function load() {
  box.replaceChildren();
  statusEl.textContent = 'Loading...';
  try {
    const orders = await apiFetch('/orders/delivery');
    statusEl.textContent = orders.length ? '' : 'No deliveries assigned to you yet.';
    orders.forEach((o) => box.appendChild(orderPanel(o)));
  } catch (err) {
    if (authFailed(err)) return;
    statusEl.textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : 'Could not load deliveries: ' + err.message;
  }
}

const me = Auth.user;
if (!Auth.token || !me || me.role !== 'delivery') {
  location.replace('login.html');
} else {
  load();
}