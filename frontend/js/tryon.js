import { FaceLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs';

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Fit tuning (chehre ki chaudai = 1.0). Jewellery thodi upar-neeche lage to yahan badlo.
const TUNE = {
  earAlong: 0.4,   // kaan se jabde ki taraf kitna neeche (0 = kaan, 1 = jabda)
  earOut: 0.02,    // kaan se bahar ki taraf
  earSize: 0.07,   // earring ka size
};

const SUPPORTED = ['Earrings', 'Necklaces', 'Chains', 'Pendants', 'Nose Pins', 'Maang Tikka'];

const STONE_COLORS = {
  diamond: '#eaf6ff',
  ruby: '#c1121f',
  emerald: '#0f8a5f',
  sapphire: '#1f4fbf',
  pearl: '#f6f1e6',
  kundan: '#f3e3a5',
};

const statusEl = document.getElementById('status');
const hintEl = document.getElementById('hint');
const video = document.getElementById('video');
const canvas = document.getElementById('overlay');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('start');
const snapBtn = document.getElementById('snap');
const placeholder = document.getElementById('placeholder');

let product = null;
let ready = false;
let landmarker = null;
let stream = null;
let running = false;
let starting = false;
let lastTime = -1;
let sprite = null;      // { src, pair, label } agar photo ya PNG mili
let pal = null;
let stoneColor = null;
let titleLower = '';
let weight = 8;

function setStatus(text) {
  statusEl.textContent = text || '';
}

function setHint(text) {
  hintEl.textContent = text || '';
  hintEl.hidden = !text;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

// Koi bhi bacha hua error screen par dikhao, taaki button chup-chaap na ruke
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  setStatus('Something went wrong: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});

// ---------- Product ke hisaab se rang ----------

function paletteFor(p) {
  const metal = String(p.metal || '').toLowerCase();
  const purity = String(p.purity || '').toUpperCase();
  if (metal === 'silver') return { stops: ['#ffffff', '#c9ced6', '#7d8590'], line: '#b8c0cc' };
  if (metal === 'platinum') return { stops: ['#f7f9fc', '#d3dae4', '#8f98a8'], line: '#c4ccd8' };
  if (purity === '24K') return { stops: ['#fff6b8', '#f2c200', '#a67c00'], line: '#e6b800' };
  if (purity === '18K') return { stops: ['#ffeccb', '#e2b565', '#a8742a'], line: '#d9a757' };
  return { stops: ['#fff1a8', '#d4a017', '#8c6519'], line: '#d4a017' };
}

function stoneColorFor(p) {
  const s = String(p.stone || '').toLowerCase().trim();
  if (!s) return null;
  for (const key of Object.keys(STONE_COLORS)) {
    if (s.includes(key)) return STONE_COLORS[key];
  }
  return '#eaf6ff';
}

// ---------- Geometry ----------

function mix(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// f = chehre ka frame. a = chaudai ki taraf, b = neeche ki taraf (chehre ki chaudai ke hisaab se)
function at(f, origin, a, b) {
  return {
    x: origin.x + f.ux.x * a * f.w + f.uy.x * b * f.w,
    y: origin.y + f.ux.y * a * f.w + f.uy.y * b * f.w,
  };
}

function quad(A, C, B, t) {
  const u = 1 - t;
  return {
    x: u * u * A.x + 2 * u * t * C.x + t * t * B.x,
    y: u * u * A.y + 2 * u * t * C.y + t * t * B.y,
  };
}

function metalGradient(size) {
  const g = ctx.createLinearGradient(-size, -size, size, size);
  g.addColorStop(0, pal.stops[0]);
  g.addColorStop(0.5, pal.stops[1]);
  g.addColorStop(1, pal.stops[2]);
  return g;
}

// ---------- Shapes ----------

function drawStone(p, r, color) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.45, color);
  g.addColorStop(1, color);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, r * 0.12);
  ctx.stroke();
  ctx.restore();
}

function drawBall(p, r, stone) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = metalGradient(r);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.arc(-r * 0.3, -r * 0.3, r * 0.26, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (stone) drawStone(p, r * 0.62, stone);
}

function drawDrop(p, angle, size, stone) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.fillStyle = metalGradient(size);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.55, size * 0.75, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.beginPath();
  ctx.ellipse(-size * 0.2, -size * 0.25, size * 0.12, size * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (stone) drawStone(p, size * 0.38, stone);
}

function drawEarringStyle(p, f) {
  const scale = clamp(Math.sqrt(weight / 8), 0.75, 1.35);
  const s = f.w * TUNE.earSize * scale;
  const t = titleLower;

  if (t.includes('stud')) {
    drawBall(p, s * 0.6, stoneColor);
    return;
  }

  if (t.includes('hoop')) {
    drawBall(p, s * 0.3, null);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.angle);
    ctx.strokeStyle = metalGradient(s);
    ctx.lineWidth = s * 0.2;
    ctx.beginPath();
    ctx.arc(0, s * 0.85, s * 0.75, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  }

  if (t.includes('jhumk')) {
    drawBall(p, s * 0.3, null);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = metalGradient(s);
    ctx.beginPath();
    ctx.arc(0, s * 1.1, s * 0.85, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(i * s * 0.35, s * 1.3, s * 0.14, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (stoneColor) drawStone(at(f, p, 0, (s * 0.8) / f.w), s * 0.25, stoneColor);
    return;
  }

  if (t.includes('chandbali')) {
    drawBall(p, s * 0.3, stoneColor);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.angle);
    ctx.strokeStyle = metalGradient(s);
    ctx.lineWidth = s * 0.28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, s * 0.7, s, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
    ctx.fillStyle = metalGradient(s);
    [0.3, 0.5, 0.7].forEach((frac) => {
      const ang = Math.PI * frac;
      ctx.beginPath();
      ctx.ellipse(Math.cos(ang) * s, s * 0.7 + Math.sin(ang) * s + s * 0.3, s * 0.16, s * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
    return;
  }

  // Default: kaan ka stud + latakta drop
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(f.angle);
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = s * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, s * 0.9);
  ctx.stroke();
  ctx.restore();
  drawBall(p, s * 0.32, null);
  drawDrop(at(f, p, 0, (s * 1.45) / f.w), f.angle, s * 0.5, stoneColor);
}

function drawPendantShape(p, f) {
  const s = f.w * 0.06 * clamp(Math.sqrt(weight / 6), 0.8, 1.4);
  const t = titleLower;

  if (t.includes('heart')) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = metalGradient(s);
    ctx.beginPath();
    ctx.moveTo(0, s * 0.8);
    ctx.bezierCurveTo(-s * 1.1, s * 0.1, -s * 0.7, -s * 0.8, 0, -s * 0.3);
    ctx.bezierCurveTo(s * 0.7, -s * 0.8, s * 1.1, s * 0.1, 0, s * 0.8);
    ctx.fill();
    ctx.restore();
    if (stoneColor) drawStone(at(f, p, 0, (s * 0.05) / f.w), s * 0.3, stoneColor);
    return;
  }

  if (/\bom\b/.test(t)) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = metalGradient(s);
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.9, 0, Math.PI * 2);
    ctx.fill();
    // Canvas screen par mirror hota hai, isliye text ko ulta karke likhte hain
    ctx.scale(-1, 1);
    ctx.fillStyle = '#5a3b00';
    ctx.font = 'bold ' + s * 1.3 + 'px "Nirmala UI", "Noto Sans Devanagari", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u0950', 0, s * 0.05);
    ctx.restore();
    return;
  }

  if (t.includes('diamond') || stoneColor) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(f.angle);
    ctx.fillStyle = metalGradient(s);
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.9);
    ctx.lineTo(s * 0.75, 0);
    ctx.lineTo(0, s * 0.9);
    ctx.lineTo(-s * 0.75, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    drawStone(p, s * 0.42, stoneColor || STONE_COLORS.diamond);
    return;
  }

  drawDrop(p, f.angle, s * 0.8, stoneColor);
}

function drawNecklaceLike(f, chin, kind) {
  const t = titleLower;
  const line = clamp(0.006 + weight * 0.00025, 0.007, 0.018);

  let cfg = { top: 0.28, depth: 0.45, spread: 0.58, beads: 'bead', pendant: false };
  if (kind === 'Necklaces' && t.includes('choker')) cfg = { top: 0.1, depth: 0.14, spread: 0.42, beads: 'bead', pendant: false };
  if (kind === 'Necklaces' && t.includes('temple')) cfg = { top: 0.28, depth: 0.5, spread: 0.6, beads: 'coin', pendant: false };
  if (kind === 'Necklaces' && t.includes('kundan')) cfg = { top: 0.1, depth: 0.18, spread: 0.45, beads: 'kundan', pendant: false };
  if (kind === 'Chains') cfg = { top: 0.2, depth: 0.32, spread: 0.5, beads: 'none', pendant: false };
  if (kind === 'Pendants') cfg = { top: 0.2, depth: 0.38, spread: 0.5, beads: 'none', pendant: true };

  const A = at(f, chin, -cfg.spread, cfg.top);
  const B = at(f, chin, cfg.spread, cfg.top);
  const C = at(f, chin, 0, cfg.top + cfg.depth * 2);
  const bottom = quad(A, C, B, 0.5);

  // Product ki photo mili ho to chain/necklace ki wahi photo lagao
  if (sprite && kind !== 'Pendants') {
    const width = kind === 'Chains' ? f.w * 1.0 : t.includes('choker') ? f.w * 0.95 : f.w * 1.2;
    drawSprite(sprite.src, at(f, chin, 0, cfg.top - 0.1), width, f.angle, true);
    return;
  }

  ctx.save();
  ctx.strokeStyle = pal.line;
  ctx.lineWidth = f.w * line;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(A.x, A.y);
  ctx.quadraticCurveTo(C.x, C.y, B.x, B.y);
  ctx.stroke();
  ctx.restore();

  if (cfg.beads === 'bead') {
    for (let k = 0.05; k < 1; k += 0.06) drawBall(quad(A, C, B, k), f.w * 0.014, null);
  } else if (cfg.beads === 'coin') {
    for (let k = 0.08; k < 1; k += 0.1) drawBall(quad(A, C, B, k), f.w * 0.024, stoneColor);
  } else if (cfg.beads === 'kundan') {
    let i = 0;
    for (let k = 0.06; k < 1; k += 0.08) {
      drawBall(quad(A, C, B, k), f.w * 0.02, i % 2 === 0 ? (stoneColor || STONE_COLORS.kundan) : null);
      i += 1;
    }
  }

  if (cfg.pendant) {
    drawBall(at(f, bottom, 0, 0.012), f.w * 0.011, null);
    if (sprite) {
      drawSprite(sprite.src, at(f, bottom, 0, 0.02), f.w * 0.26, f.angle, true);
    } else {
      drawPendantShape(at(f, bottom, 0, 0.065), f);
    }
  }
}

// ---------- Photo ko draw karna ----------

// Canvas screen par mirror hota hai, isliye photo ko pehle ulta karte hain taaki screen par seedhi dikhe
function drawSprite(src, p, width, angle, anchorTop, part) {
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  const srcW = part ? sw / 2 : sw;
  const h = width * (sh / srcW);
  const sx = part === 'right' ? sw / 2 : 0;

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(angle);
  ctx.scale(-1, 1);
  ctx.drawImage(src, sx, 0, srcW, sh, -width / 2, anchorTop ? 0 : -h / 2, width, h);
  ctx.restore();
}

function drawJewellery(lm) {
  const w = canvas.width;
  const h = canvas.height;
  const P = (i) => ({ x: lm[i].x * w, y: lm[i].y * h });

  const left = P(234);
  const right = P(454);
  const fw = dist(left, right);
  const angle = Math.atan2(right.y - left.y, right.x - left.x);
  const f = {
    w: fw,
    angle,
    ux: { x: Math.cos(angle), y: Math.sin(angle) },
    uy: { x: -Math.sin(angle), y: Math.cos(angle) },
  };

  const kind = product.category;

  if (kind === 'Earrings') {
    const lobeL = at(f, mix(left, P(132), TUNE.earAlong), -TUNE.earOut, 0);
    const lobeR = at(f, mix(right, P(361), TUNE.earAlong), TUNE.earOut, 0);
    if (sprite) {
      const ew = fw * 0.16 * clamp(Math.sqrt(weight / 8), 0.8, 1.3);
      if (sprite.pair) {
        // Screen mirror hoti hai: photo ka baayan hissa screen ke baayen kaan par
        drawSprite(sprite.src, lobeR, ew, angle, true, 'left');
        drawSprite(sprite.src, lobeL, ew, angle, true, 'right');
      } else {
        drawSprite(sprite.src, lobeL, ew, angle, true);
        drawSprite(sprite.src, lobeR, ew, angle, true);
      }
    } else {
      drawEarringStyle(lobeL, f);
      drawEarringStyle(lobeR, f);
    }
  } else if (['Necklaces', 'Chains', 'Pendants'].includes(kind)) {
    drawNecklaceLike(f, P(152), kind);
  } else if (kind === 'Nose Pins') {
    const nostril = P(129);
    if (sprite) drawSprite(sprite.src, nostril, fw * 0.05, angle, false);
    else drawBall(nostril, fw * 0.014, stoneColor);
  } else if (kind === 'Maang Tikka') {
    const top = at(f, P(10), 0, -0.06);
    const drop = P(151);
    if (sprite) {
      drawSprite(sprite.src, at(f, P(10), 0, 0.01), fw * 0.16, angle, true);
    } else {
      ctx.save();
      ctx.strokeStyle = pal.line;
      ctx.lineWidth = fw * 0.008;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(drop.x, drop.y);
      ctx.stroke();
      ctx.restore();
      drawBall(top, fw * 0.012, null);
      drawDrop(at(f, drop, 0, 0.035), angle, fw * 0.05, stoneColor);
    }
  }
}

// ---------- Photo load aur background hatana ----------

function loadImage(url, cors) {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 8000);
    if (cors) img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

async function loadAny(url) {
  if (url.startsWith('data:')) {
    const img = await loadImage(url, false);
    return img ? { img, readable: true } : null;
  }
  const withCors = await loadImage(url, true);
  if (withCors) return { img: withCors, readable: true };
  const plain = await loadImage(url, false);
  return plain ? { img: plain, readable: false } : null;
}

// Kone ke rang jaisa background kinaaron se hata deta hai. Fail ho to null deta hai.
function cutOut(img) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (!iw || !ih) return null;

  const scale = Math.min(1, 480 / Math.max(iw, ih));
  const w = Math.max(1, Math.round(iw * scale));
  const h = Math.max(1, Math.round(ih * scale));

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);

  let imageData;
  try {
    imageData = g.getImageData(0, 0, w, h);
  } catch (err) {
    return null;
  }
  const px = imageData.data;

  const corner = (x, y) => {
    const i = (y * w + x) * 4;
    return [px[i], px[i + 1], px[i + 2], px[i + 3]];
  };
  const corners = [corner(0, 0), corner(w - 1, 0), corner(0, h - 1), corner(w - 1, h - 1)];
  const transparentBg = corners.every((c4) => c4[3] < 10);
  const avg = [0, 1, 2].map((k) => corners.reduce((sum, c4) => sum + c4[k], 0) / 4);
  const TOL = 46;

  const isBg = (idx) => {
    const i = idx * 4;
    if (px[i + 3] < 10) return true;
    if (transparentBg) return false;
    const dr = px[i] - avg[0];
    const dg = px[i + 1] - avg[1];
    const db = px[i + 2] - avg[2];
    return Math.sqrt(dr * dr + dg * dg + db * db) < TOL;
  };

  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (x, y) => {
    const idx = y * w + x;
    if (!seen[idx] && isBg(idx)) {
      seen[idx] = 1;
      stack.push(idx);
    }
  };
  for (let x = 0; x < w; x += 1) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y += 1) { push(0, y); push(w - 1, y); }

  while (stack.length) {
    const idx = stack.pop();
    const x = idx % w;
    const y = (idx - x) / w;
    px[idx * 4 + 3] = 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  let opaque = 0;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (px[(y * w + x) * 4 + 3] > 10) {
        opaque += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const ratio = opaque / (w * h);
  if (maxX < 0 || ratio < 0.01 || ratio > 0.9) return null;

  g.putImageData(imageData, 0, 0);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
  return out;
}

function validImageUrl(v) {
  return typeof v === 'string' && (/^https?:\/\//i.test(v) || /^data:image\//i.test(v));
}

// Product ki apni photo ya try-on PNG se sprite banata hai. Kuch na mile to null.
async function prepareSprite() {
  const candidates = [];
  if (validImageUrl(product.try_on_png)) candidates.push({ url: product.try_on_png, label: 'try-on image' });
  if (product.images && validImageUrl(product.images[0])) {
    candidates.push({ url: product.images[0], label: 'product photo' });
  }

  for (const cand of candidates) {
    const loaded = await loadAny(cand.url);
    if (!loaded) continue;

    if (loaded.readable) {
      const cut = cutOut(loaded.img);
      if (cut) return { src: cut, pair: cut.width / cut.height > 1.3, label: cand.label };
      // Background nahi hata, par photo transparent PNG ho sakti hai
      if (cand.label === 'try-on image') {
        const w = loaded.img.naturalWidth;
        const h = loaded.img.naturalHeight;
        return { src: loaded.img, pair: w / h > 1.3, label: cand.label };
      }
      setStatus('The photo background could not be removed, so a style-matched preview is shown. Use a photo on a plain white background.');
    } else {
      setStatus('That photo link does not allow editing, so a style-matched preview is shown. Upload the photo from your device instead.');
    }
  }
  return null;
}

// ---------- Camera aur model ----------

async function loadModel() {
  const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: 'VIDEO',
    numFaces: 1,
  });
  try {
    return await FaceLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (err) {
    return await FaceLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  video.hidden = false;
  placeholder.hidden = true;
  await video.play();
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}

function loop() {
  if (!running) return;

  if (video.readyState >= 2 && video.currentTime !== lastTime) {
    lastTime = video.currentTime;
    try {
      const result = landmarker.detectForVideo(video, performance.now());
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (result.faceLandmarks && result.faceLandmarks.length) {
        drawJewellery(result.faceLandmarks[0]);
        setHint('');
      } else {
        setHint('No face found. Look at the camera and keep your face in the frame.');
      }
    } catch (err) {
      console.error(err);
    }
  }
  requestAnimationFrame(loop);
}

async function start() {
  if (!ready) {
    setStatus('Still loading this product. Please wait a moment and press Start camera again.');
    return;
  }
  if (starting || running) return;
  starting = true;
  startBtn.disabled = true;
  setStatus('Loading the face model (the first time can take a few seconds)...');

  try {
    if (!landmarker) landmarker = await loadModel();
    setStatus('Starting the camera...');
    await startCamera();
    setStatus('');
    snapBtn.disabled = false;
    startBtn.textContent = 'Camera on';
    running = true;
    loop();
  } catch (err) {
    console.error(err);
    startBtn.disabled = false;
    startBtn.textContent = 'Start camera';
    if (err && err.name === 'NotAllowedError') {
      setStatus('Camera permission was denied. Allow the camera in your browser and try again.');
    } else if (err && err.name === 'NotFoundError') {
      setStatus('No camera was found on this device.');
    } else {
      setStatus('Could not start the try-on: ' + (err && err.message ? err.message : err));
    }
  } finally {
    starting = false;
  }
}

function takePhoto() {
  const out = document.createElement('canvas');
  out.width = video.videoWidth;
  out.height = video.videoHeight;
  const c = out.getContext('2d');
  // Screen par mirror dikhta hai, isliye photo mein bhi mirror karte hain
  c.translate(out.width, 0);
  c.scale(-1, 1);
  c.drawImage(video, 0, 0, out.width, out.height);
  c.drawImage(canvas, 0, 0);

  try {
    out.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'tryon-' + product.id + '.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  } catch (err) {
    setStatus('Could not save the photo (the jewellery image does not allow it).');
  }
}

async function init() {
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    setStatus('No product selected.');
    return;
  }

  try {
    product = await apiFetch('/products/' + encodeURIComponent(id));
  } catch (err) {
    setStatus(err.message === 'Failed to fetch'
      ? 'Could not reach the server. Is the backend running?'
      : 'Could not load this product: ' + err.message);
    return;
  }

  document.getElementById('title').textContent = 'Try on: ' + product.title;
  document.getElementById('back').href = 'product.html?id=' + product.id;
  document.getElementById('back').textContent = '\u2190 Back to product';
  document.getElementById('view').href = 'product.html?id=' + product.id;
  document.title = 'Try on ' + product.title + ' - Jewellery Wala';

  if (!product.supports_try_on || !SUPPORTED.includes(product.category)) {
    setStatus('Virtual try-on is not available for this type of jewellery.');
    startBtn.disabled = true;
    return;
  }

  pal = paletteFor(product);
  stoneColor = stoneColorFor(product);
  titleLower = String(product.title || '').toLowerCase();
  weight = Number(product.weight_g) || 8;

  try {
    sprite = await prepareSprite();
  } catch (err) {
    console.error(err);
    sprite = null;
  }

  const mode = sprite ? 'Preview: ' + sprite.label : 'Preview: style-matched to this product';
  document.getElementById('subtitle').textContent =
    product.category + ' \u00B7 ' + product.shop_name + ' \u00B7 \u20B9' +
    Number(product.price).toLocaleString('en-IN') + ' \u00B7 ' + mode;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('This browser cannot use the camera. Try Chrome or Edge on localhost or https.');
    startBtn.disabled = true;
    return;
  }
  ready = true;
}

// Button ka listener sabse pehle lagta hai, taaki product load hone se pehle bhi dabane par jawab mile
startBtn.addEventListener('click', start);
snapBtn.addEventListener('click', takePhoto);
window.addEventListener('beforeunload', () => {
  if (stream) stream.getTracks().forEach((t) => t.stop());
});

init().catch((err) => {
  console.error(err);
  setStatus('Could not prepare the try-on: ' + (err && err.message ? err.message : err));
});