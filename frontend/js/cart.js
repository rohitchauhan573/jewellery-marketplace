const statusEl = document.getElementById('status');
const listBox = document.getElementById('cart-list');
const panel = document.getElementById('cart-panel');
const checkout = document.getElementById('checkout');
const msg = document.getElementById('msg');

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function setMsg(text, ok) {
  msg.textContent = text || '';
  msg.className = 'notice ' + (ok ? 'ok' : 'error');
  msg.hidden = !text;
}

function render() {
  const items = Cart.items;
  listBox.replaceChildren();
  renderNav();

  if (!items.length) {
    panel.hidden = true;
    checkout.hidden = true;
    statusEl.textContent = 'Your cart is empty.';
    return;
  }

  statusEl.textContent = 'Items from ' + items[0].shop_name;
  panel.hidden = false;
  checkout.hidden = false;

  const table = document.createElement('table');
  table.className = 'list';
  const head = document.createElement('tr');
  ['Item', 'Price', 'Qty', 'Subtotal', ''].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    head.appendChild(th);
  });
  table.appendChild(head);

  let total = 0;
  items.forEach((i) => {
    total += i.price * i.quantity;
    const tr = document.createElement('tr');

    const title = document.createElement('td');
    const link = document.createElement('a');
    link.href = 'product.html?id=' + i.product_id;
    link.textContent = i.title;
    title.appendChild(link);
    tr.appendChild(title);

    const price = document.createElement('td');
    price.textContent = money(i.price);
    tr.appendChild(price);

    const qtyCell = document.createElement('td');
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.className = 'cart-qty';
    qty.min = '1';
    qty.max = String(i.stock);
    qty.value = String(i.quantity);
    qty.addEventListener('change', () => {
      Cart.setQuantity(i.product_id, Math.floor(Number(qty.value)) || 1);
      render();
    });
    qtyCell.appendChild(qty);
    tr.appendChild(qtyCell);

    const sub = document.createElement('td');
    sub.textContent = money(i.price * i.quantity);
    tr.appendChild(sub);

    const actions = document.createElement('td');
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger small';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      Cart.remove(i.product_id);
      render();
    });
    actions.appendChild(remove);
    tr.appendChild(actions);

    table.appendChild(tr);
  });

  listBox.appendChild(table);
  document.getElementById('total').textContent = money(total);
}

document.getElementById('clear').addEventListener('click', () => {
  if (!confirm('Remove all items from the cart?')) return;
  Cart.clear();
  render();
});

document.getElementById('checkout-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  setMsg('');

  const items = Cart.items;
  if (!items.length) return;

  const btn = document.getElementById('place');
  btn.disabled = true;
  try {
    await apiFetch('/orders', {
      method: 'POST',
      body: {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        address: document.getElementById('address').value.trim(),
        phone: document.getElementById('phone').value.trim(),
      },
    });
    Cart.clear();
    location.href = 'orders.html';
  } catch (err) {
    if (err.status === 401) {
      Auth.clear();
      location.href = 'login.html';
      return;
    }
    setMsg(err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : err.message, false);
    btn.disabled = false;
  }
});

const me = Auth.user;
if (!Auth.token || !me || me.role !== 'customer') {
  location.replace('login.html');
} else {
  if (me.phone) document.getElementById('phone').value = me.phone;
  render();
}