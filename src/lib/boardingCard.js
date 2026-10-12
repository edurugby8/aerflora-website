// "Tarjeta de embarque floral": the visitor's bouquet as a PNG they can keep.
// Drawn on a canvas with the page's own fonts and same-origin images, so the
// download never depends on anything external: if a font or the photograph is
// missing, fallbacks are drawn instead and every line is measured to fit.
import { FLOWERS, contextPrefix } from './bouquets.js';

export const CARD_W = 1080;
export const CARD_H = 1720;
const T = 40; // ticket inset
const TW = CARD_W - T * 2, TH = CARD_H - T * 2;
const PAD = 56;
const C = {
  frame: '#2c3525', paper: '#fbf8f2', band: '#efe6d6', ink: '#1f271b', soft: '#4a5441',
  olive: '#5e6a46', rose: '#9b4d63', line: 'rgba(31, 39, 27, 0.16)',
};
const SERIF = '"Instrument Serif", Georgia, "Times New Roman", serif';
const SANS = 'Archivo, "Helvetica Neue", Arial, sans-serif';
const MONO = '"IBM Plex Mono", "Courier New", monospace';

/** Waits (briefly) for the brand fonts; the canvas falls back to system fonts if they never arrive. */
async function fontsReady() {
  if (!document.fonts?.load) return;
  const faces = [`88px ${SERIF}`, `italic 56px ${SERIF}`, `500 16px ${MONO}`, `600 22px ${SANS}`];
  await Promise.race([
    Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// small deterministic numbers for the travel details
function hash(text) { let h = 2166136261; for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; }

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Largest font size (down to `min`) at which `text` fits in `maxWidth`. */
function fitFont(ctx, text, make, size, maxWidth, min) {
  let s = size;
  ctx.font = make(s);
  while (s > min && ctx.measureText(text).width > maxWidth) { s -= 1; ctx.font = make(s); }
  return s;
}

/** Shortens text with an ellipsis until it fits. */
function clip(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

/** Word wrap; words longer than a line are cut by characters. */
function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
    if (line) lines.push(line);
    line = word;
    while (ctx.measureText(line).width > maxWidth) {
      let cut = line.length - 1;
      while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxWidth) cut--;
      lines.push(line.slice(0, cut));
      line = line.slice(cut);
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** The same number of lines, as even as possible: no single word left alone on the last one. */
function balance(ctx, text, maxWidth, count) {
  let lo = maxWidth / count, hi = maxWidth;
  while (hi - lo > 2) {
    const mid = (lo + hi) / 2;
    if (wrap(ctx, text, mid).length <= count) hi = mid; else lo = mid;
  }
  return wrap(ctx, text, hi);
}

const label = (ctx, text, x, y, align = 'left') => {
  ctx.font = `500 15px ${MONO}`;
  ctx.fillStyle = C.olive;
  ctx.textAlign = align;
  ctx.letterSpacing = '3px';
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.letterSpacing = '0px';
  ctx.textAlign = 'left';
};

/**
 * Draws the card and resolves with a PNG blob.
 * @param {{ proposal: object, dedication: string, photoSrc: string, date?: Date }} o
 */
export async function renderBoardingCard({ proposal: p, dedication, photoSrc, date = new Date() }) {
  const [img] = await Promise.all([loadImage(photoSrc), fontsReady()]);
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W; canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'alphabetic';

  // frame and ticket
  ctx.fillStyle = C.frame; ctx.fillRect(0, 0, CARD_W, CARD_H);
  roundedRect(ctx, T, T, TW, TH, 36);
  ctx.fillStyle = C.paper; ctx.fill();
  ctx.save();
  roundedRect(ctx, T, T, TW, TH, 36); ctx.clip();
  const X = T + PAD, R = T + TW - PAD, CW = R - X; // content box

  // header band
  ctx.fillStyle = C.band; ctx.fillRect(T, T, TW, 118);
  ctx.fillStyle = C.ink; ctx.font = `66px ${SERIF}`; ctx.fillText('Aerflora', X, T + 82);
  const h = hash(p.key);
  const flight = `AF ${String(1000 + (h % 9000))}`;
  const gate = 1 + ((h >>> 4) % 12), seat = `${1 + ((h >>> 9) % 18)}${'ABCDEF'[(h >>> 14) % 6]}`;
  const day = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/\./g, '').toUpperCase();
  label(ctx, 'Tarjeta de embarque floral', R, T + 52, 'right');
  ctx.font = `500 15px ${MONO}`; ctx.fillStyle = C.soft; ctx.textAlign = 'right';
  ctx.fillText(`${flight} · ${day}`, R, T + 82);
  ctx.textAlign = 'left';

  // the bouquet
  const IY = T + 142, IH = 620;
  ctx.save();
  roundedRect(ctx, X, IY, CW, IH, 26); ctx.clip();
  if (img) {
    const s = Math.max(CW / img.naturalWidth, IH / img.naturalHeight);
    const w = img.naturalWidth * s, ih = img.naturalHeight * s;
    ctx.drawImage(img, X + (CW - w) / 2, IY - (ih - IH) * 0.1, w, ih); // keep the flowers, let the vase go
  } else {
    // no photograph: a soft wash of the bouquet's own palette
    const g = ctx.createLinearGradient(X, IY, R, IY + IH);
    p.palette.forEach((c, i) => g.addColorStop(i / Math.max(1, p.palette.length - 1), c.hex));
    ctx.fillStyle = g; ctx.fillRect(X, IY, CW, IH);
  }
  ctx.restore();
  if (p.context) {
    const chip = `${contextPrefix(p.context)}: ${p.context.label}`.toUpperCase();
    ctx.font = `500 15px ${MONO}`; ctx.letterSpacing = '2px';
    const cw = Math.min(ctx.measureText(chip).width + 36, CW - 40);
    roundedRect(ctx, X + 20, IY + IH - 62, cw, 42, 21);
    ctx.fillStyle = 'rgba(251, 248, 242, 0.92)'; ctx.fill();
    ctx.fillStyle = C.ink; ctx.fillText(clip(ctx, chip, cw - 36), X + 38, IY + IH - 35);
    ctx.letterSpacing = '0px';
  }

  // name and flowers
  let y = IY + IH + 90;
  ctx.fillStyle = C.ink;
  fitFont(ctx, p.name, (s) => `${s}px ${SERIF}`, 86, CW, 52);
  ctx.fillText(p.name, X, y);
  y += 44;
  ctx.font = `500 16px ${MONO}`; ctx.fillStyle = C.soft; ctx.letterSpacing = '1.5px';
  ctx.fillText(clip(ctx, p.flowers.map((f) => FLOWERS[f]).join(' · ').toUpperCase(), CW), X, y);
  ctx.letterSpacing = '0px';

  // perforation, with notches cut into both edges
  y += 42;
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = 'rgba(31, 39, 27, 0.28)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]);
  ctx.beginPath(); ctx.moveTo(T + 34, y); ctx.lineTo(T + TW - 34, y); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = C.frame;
  for (const cx of [T, T + TW]) { ctx.beginPath(); ctx.arc(cx, y, 24, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();

  // emotion · style · size
  y += 58;
  const col = CW / 3;
  const fields = [['Emoción', p.emotion.label, p.emotion.hint], ['Estilo', p.style.label, p.style.hint], ['Tamaño', p.size.label, p.size.hint]];
  fields.forEach(([k, v, sub], i) => {
    const x = X + i * col, w = col - 20;
    label(ctx, k, x, y);
    ctx.fillStyle = C.ink;
    fitFont(ctx, v, (s) => `${s}px ${SERIF}`, 44, w, 28);
    ctx.fillText(v, x, y + 52);
    if (sub) { ctx.font = `400 17px ${SANS}`; ctx.fillStyle = C.soft; ctx.fillText(clip(ctx, sub, w), x, y + 84); }
  });

  // travel details
  y += 128;
  ctx.fillStyle = C.line; ctx.fillRect(X, y - 30, CW, 1);
  ctx.font = `500 15px ${MONO}`; ctx.fillStyle = C.soft; ctx.letterSpacing = '2px';
  ctx.fillText(clip(ctx, `VUELO ${flight} · PUERTA ${gate} · ASIENTO ${seat} · AERFLORA → PARA TI`, CW), X, y);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = C.line; ctx.fillRect(X, y + 24, CW, 1);

  // palette
  y += 74;
  label(ctx, 'Paleta', X, y);
  const sw = CW / p.palette.length;
  p.palette.forEach((c, i) => {
    const cx = X + i * sw;
    ctx.beginPath(); ctx.arc(cx + 18, y + 40, 18, 0, Math.PI * 2);
    ctx.fillStyle = c.hex; ctx.fill();
    ctx.strokeStyle = 'rgba(31, 39, 27, 0.14)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.font = `400 19px ${SANS}`; ctx.fillStyle = C.ink;
    ctx.fillText(clip(ctx, c.name, sw - 54), cx + 46, y + 47);
  });

  // the dedication: as large as the space left allows, three lines at most
  const FY = T + TH - 58; // closing line
  y += 112;
  label(ctx, 'Dedicatoria', X, y);
  const words = dedication?.trim() ? `«${dedication.trim()}»` : '«Para ti, con flores.»';
  const top = y + 22, avail = FY - 64 - top;
  let size = 58, lines = [];
  for (; ; size -= 2) {
    ctx.font = `italic ${size}px ${SERIF}`;
    lines = wrap(ctx, words, CW);
    if (size <= 32 || (lines.length <= 3 && lines.length * size * 1.12 <= avail)) break;
  }
  const fitLines = Math.max(1, Math.min(3, Math.floor(avail / (size * 1.12))));
  if (lines.length > fitLines) { lines = lines.slice(0, fitLines); lines[fitLines - 1] = clip(ctx, `${lines[fitLines - 1]}…`, CW); }
  else if (lines.length > 1) lines = balance(ctx, words, CW, lines.length);
  ctx.fillStyle = C.ink;
  lines.forEach((l, i) => ctx.fillText(l, X, top + size * 0.95 + i * size * 1.12));

  // closing line and a decorative barcode
  ctx.fillStyle = C.line; ctx.fillRect(X, FY - 44, CW, 1);
  ctx.fillStyle = C.rose;
  fitFont(ctx, 'Hay cosas que se dicen mejor con flores', (s) => `italic ${s}px ${SERIF}`, 34, CW - 300, 24);
  ctx.fillText('Hay cosas que se dicen mejor con flores', X, FY + 10);
  let bx = R - 250, seed = h;
  ctx.fillStyle = C.ink;
  while (bx < R - 4) {
    seed = Math.imul(seed ^ (seed >>> 13), 1274126177) >>> 0;
    const w = 1 + (seed % 4);
    ctx.fillRect(bx, FY - 22, Math.min(w, R - bx), 40);
    bx += w + 2 + ((seed >>> 5) % 3);
  }

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}

/** Offers a blob as a file download. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename, rel: 'noopener' });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export const cardFilename = (p) => `aerflora-${p.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`;
