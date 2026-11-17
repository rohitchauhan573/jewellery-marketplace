const statusEl = document.getElementById('status');
const infoBox = document.getElementById('shop-info');
const grid = document.getElementById('grid');
const listTitle = document.getElementById('list-title');

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

  const price = document.createElement('p');
  price.className = 'card-price';
  price.textContent = money(p.price);

  body.append(title, meta, price);
  link.append(thumb, body);
  return link;
}

function line(text) {
  const p = document.createElement('p');
  p.className = 'note';
  p.textContent = text;
  return p;
}

async function load() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    statusEl.textContent = 'No shop selected.';
    return;
  }

  try {
    const shop = await apiFetch('/shops/' + encodeURIComponent(id));
    document.title = shop.name + ' - Jewellery Wala';

    infoBox.replaceChildren();
    const h1 = document.createElement('h1');
    h1.textContent = shop.name;
    infoBox.appendChild(h1);
    if (shop.city) infoBox.appendChild(line(shop.city));
    if (shop.address) infoBox.appendChild(line(shop.address));
    if (shop.phone) {
      const p = document.createElement('p');
      p.className = 'note';
      p.append('Phone: ');
      p.appendChild(telLink(shop.phone));
      infoBox.appendChild(p);
    }
    infoBox.appendChild(line(shop.product_count + ' piece' + (shop.product_count === 1 ? '' : 's') + ' in stock'));
    infoBox.hidden = false;

    const rows = await apiFetch('/products?shop_id=' + encodeURIComponent(id));
    listTitle.hidden = false;
    statusEl.textContent = rows.length ? '' : 'This shop has no jewellery in stock right now.';
    rows.forEach((p) => grid.appendChild(card(p)));
  } catch (err) {
    statusEl.textContent = err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : err.message;
  }
}

load();