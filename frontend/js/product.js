const statusEl = document.getElementById('status');
const detail = document.getElementById('detail');

function money(n) {
  return '\u20B9' + Number(n).toLocaleString('en-IN');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function specRow(label, value) {
  if (value === null || value === undefined || value === '') return null;
  const tr = document.createElement('tr');
  tr.append(el('td', null, label), el('td', null, String(value)));
  return tr;
}

function stockText(stock) {
  if (stock <= 0) return 'Out of stock';
  if (stock <= 3) return 'Only ' + stock + ' left';
  return stock + ' in stock';
}

function meterBox(f) {
  const box = el('div', 'meter');
  box.appendChild(el('h3', null, 'Fair price check'));

  if (!f) {
    box.appendChild(el('p', null, 'No estimate available for this item (needs gold, purity and weight).'));
    return box;
  }

  const cls = f.verdict === 'Good deal' ? 'good' : f.verdict === 'Overpriced' ? 'bad' : 'fair';
  box.appendChild(el('span', 'verdict ' + cls, f.verdict));

  const sign = f.difference_percent > 0 ? '+' : '';
  box.appendChild(el('p', null,
    'Asking price ' + money(f.asking_price) + ' vs estimated ' + money(f.estimated_price) +
    ' (' + sign + f.difference_percent + '%).'));
  box.appendChild(el('p', null,
    'Based on the gold rate of ' + f.rate_date + ': ' + money(f.rate_per_gram) +
    ' per gram. GST is assumed at 3% on gold and 5% on making charges.'));
  return box;
}

function render(p) {
  document.title = p.title + ' - JewelHub';

  const left = el('div');
  const thumb = el('div', 'thumb');
  if (p.images && p.images.length) {
    const img = document.createElement('img');
    img.src = p.images[0];
    img.alt = p.title;
    thumb.appendChild(img);
  } else {
    thumb.textContent = '\uD83D\uDC8E';
  }
  left.appendChild(thumb);

  const right = el('div');
  const h1 = el('h1', null, p.title);
  if (p.is_verified) h1.appendChild(el('span', 'badge', 'Verified'));
  right.appendChild(h1);
  right.appendChild(el('p', 'card-meta', p.shop_name + (p.city ? ', ' + p.city : '')));
  right.appendChild(el('div', 'price', money(p.price)));

  const table = el('table', 'specs');
  const rows = [
    specRow('Category', p.category),
    specRow('Metal', p.metal),
    specRow('Purity', p.purity),
    specRow('Weight', p.weight_g ? p.weight_g + ' g' : null),
    specRow('Making charges', p.making_charges ? money(p.making_charges) : null),
    specRow('Stone', p.stone),
    specRow('Occasion', p.occasion),
    specRow('For', p.gender),
    specRow('Availability', stockText(p.stock)),
  ];
  Object.entries(p.attributes || {}).forEach(([k, v]) => rows.push(specRow(k.replace(/_/g, ' '), v)));
  rows.filter(Boolean).forEach((r) => table.appendChild(r));
  right.appendChild(table);

  if (p.description) right.appendChild(el('p', null, p.description));

  right.appendChild(meterBox(p.fair_price));

  const tryOn = el('button', null, p.supports_try_on ? 'Virtual try-on (coming soon)' : 'Try-on not available');
  tryOn.disabled = true;
  tryOn.style.marginTop = '16px';
  right.appendChild(tryOn);

  detail.append(left, right);
}

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    statusEl.textContent = 'No product selected.';
    return;
  }

  try {
    const data = await apiFetch('/products/' + encodeURIComponent(id));
    render(data);
  } catch (err) {
    statusEl.textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : 'Could not load this product: ' + err.message;
  }
}

load();