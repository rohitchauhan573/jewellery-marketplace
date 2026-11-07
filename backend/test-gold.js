const base = 'http://localhost:5000';

async function run() {
  const rate = await (await fetch(base + '/gold-rate')).json();
  console.log('Gold rate:', JSON.stringify(rate));

  for (let id = 1; id <= 5; id++) {
    const res = await fetch(`${base}/products/${id}`);
    const p = await res.json();
    if (!res.ok) { console.log(id, '->', res.status, p.error); continue; }
    const f = p.fair_price;
    console.log(
      `${p.title}: asking ${p.price}`,
      f ? `| estimated ${f.estimated_price} | ${f.difference_percent}% | ${f.verdict}` : '| no estimate'
    );
  }
}

run().catch((err) => console.error('Error:', err.message));