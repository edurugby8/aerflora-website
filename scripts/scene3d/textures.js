// Procedural textures (drawn on 2D canvases in the browser) for the 3D cabin.
// Nothing here is photographic: these are stand-ins until scanned materials
// or real footage are available (see ASSETS.md).
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function toTex(c, { srgb = true, repeat = null, clamp = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  if (clamp) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  t.needsUpdate = true;
  return t;
}

// height field → tangent-space normal map
function normalFromHeight(hf, w, h, strength) {
  const [c, g] = canvas(w, h);
  const img = g.createImageData(w, h);
  const at = (x, y) => hf[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const k = (y * w + x) * 4;
    img.data[k] = ((-dx / l) * 0.5 + 0.5) * 255;
    img.data[k + 1] = ((dy / l) * 0.5 + 0.5) * 255;
    img.data[k + 2] = ((1 / l) * 0.5 + 0.5) * 255;
    img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/** Woven upholstery: colour + normal map, tileable. */
export function fabric(base = '#d9cdb5', seed = 1) {
  const S = 256, r = rng(seed);
  const hf = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const warp = Math.sin((x / S) * Math.PI * 2 * 64) * 0.5 + 0.5;
    const weft = Math.sin((y / S) * Math.PI * 2 * 64) * 0.5 + 0.5;
    hf[y * S + x] = ((x >> 2) + (y >> 2)) % 2 ? warp : weft;
    hf[y * S + x] += (r() - 0.5) * 0.35;
  }
  const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let k = 0; k < S * S; k++) {
    const v = (hf[k] - 0.5) * 18;
    img.data[k * 4] += v; img.data[k * 4 + 1] += v; img.data[k * 4 + 2] += v;
  }
  g.putImageData(img, 0, 0);
  return { map: toTex(c, { repeat: [1, 1] }), normalMap: toTex(normalFromHeight(hf, S, S, 2.2), { srgb: false, repeat: [1, 1] }) };
}

/**
 * Seat-back upholstery for the extruded backrest cap. UVs are the backrest
 * shape in metres (x −0.25…0.25, y 0…0.82): we draw panels, channel seams and
 * top-stitching into that frame.
 */
export function seatBack(base = '#d6c9af') {
  const W = 512, H = 840;
  const [c, g] = canvas(W, H);
  g.fillStyle = base; g.fillRect(0, 0, W, H);
  const r = rng(7);
  for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '40,30,20'},0.035)`; g.fillRect(r() * W, r() * H, 2, 2); }
  const X = (m) => ((m + 0.25) / 0.5) * W, Y = (m) => H - (m / 0.82) * H;
  // padded channels: soft shading towards the seams
  for (const [x0, x1] of [[-0.25, -0.07], [-0.07, 0.07], [0.07, 0.25]]) {
    const gr = g.createLinearGradient(X(x0), 0, X(x1), 0);
    gr.addColorStop(0, 'rgba(40,30,20,0.16)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.05)');
    gr.addColorStop(0.75, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(40,30,20,0.16)');
    g.fillStyle = gr; g.fillRect(X(x0), Y(0.6), X(x1) - X(x0), Y(0.12) - Y(0.6));
  }
  const seam = (x0, y0, x1, y1) => {
    g.strokeStyle = 'rgba(60,46,30,0.55)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
    g.strokeStyle = 'rgba(250,244,230,0.55)'; g.lineWidth = 1.5; g.setLineDash([7, 6]);
    g.beginPath(); g.moveTo(x0 + 5, y0 + 5); g.lineTo(x1 + 5, y1 + 5); g.stroke(); g.setLineDash([]);
  };
  seam(X(-0.07), Y(0.6), X(-0.07), Y(0.12));
  seam(X(0.07), Y(0.6), X(0.07), Y(0.12));
  seam(X(-0.25), Y(0.6), X(0.25), Y(0.6));
  seam(X(-0.25), Y(0.12), X(0.25), Y(0.12));
  const t = toTex(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / 0.5, 1 / 0.82);
  t.offset.set(0.5, 0);
  return t;
}

export function linen() {
  const S = 256, r = rng(3);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#f2eee5'; g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 2) { g.fillStyle = `rgba(120,110,90,${0.03 + r() * 0.03})`; g.fillRect(0, y, S, 1); }
  for (let x = 0; x < S; x += 2) { g.fillStyle = `rgba(120,110,90,${0.02 + r() * 0.03})`; g.fillRect(x, 0, 1, S); }
  return toTex(c, { repeat: [3, 3] });
}

/** Low-pile aircraft carpet with a faint repeating motif. */
export function carpet(base = '#65705b', motif = '#59634f') {
  const S = 512, r = rng(11);
  const hf = new Float32Array(S * S);
  for (let k = 0; k < S * S; k++) hf[k] = r();
  const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  g.strokeStyle = motif; g.lineWidth = 6;
  for (let y = 0; y < S; y += 64) for (let x = 0; x < S; x += 64) {
    g.beginPath(); g.moveTo(x + 32, y + 8); g.lineTo(x + 56, y + 32); g.lineTo(x + 32, y + 56); g.lineTo(x + 8, y + 32); g.closePath(); g.stroke();
  }
  const img = g.getImageData(0, 0, S, S);
  for (let k = 0; k < S * S; k++) { const v = (hf[k] - 0.5) * 26; img.data[k * 4] += v; img.data[k * 4 + 1] += v; img.data[k * 4 + 2] += v; }
  g.putImageData(img, 0, 0);
  return { map: toTex(c, { repeat: [1, 1] }), normalMap: toTex(normalFromHeight(hf, S, S, 0.8), { srgb: false, repeat: [1, 1] }) };
}

/** Fine orange-peel texture for moulded cabin panels. */
export function panel(base = '#ebe5d8') {
  const S = 256, r = rng(21);
  const hf = new Float32Array(S * S);
  for (let k = 0; k < S * S; k++) hf[k] = r();
  // blur a little
  const b = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += hf[((y + dy + S) % S) * S + ((x + dx + S) % S)];
    b[y * S + x] = s / 9;
  }
  const [c, g] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  const img = g.getImageData(0, 0, S, S);
  for (let k = 0; k < S * S; k++) { const v = (b[k] - 0.5) * 10; img.data[k * 4] += v; img.data[k * 4 + 1] += v; img.data[k * 4 + 2] += v; }
  g.putImageData(img, 0, 0);
  return { map: toTex(c, { repeat: [2, 2] }), normalMap: toTex(normalFromHeight(b, S, S, 1.2), { srgb: false, repeat: [2, 2] }) };
}

/** Neutral petal: fine veins fanning from the base, paler margin. Tinted by instance colour. */
export function petal(seed = 1) {
  const W = 128, H = 256, r = rng(seed);
  const [c, g] = canvas(W, H);
  const gr = g.createLinearGradient(0, H, 0, 0);
  gr.addColorStop(0, '#c9c2c0'); gr.addColorStop(0.35, '#f1eeec'); gr.addColorStop(1, '#ffffff');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 26; k++) {
    const a = (k / 25 - 0.5) * 1.3;
    g.strokeStyle = `rgba(150,120,125,${0.08 + r() * 0.08})`; g.lineWidth = 0.8 + r();
    g.beginPath(); g.moveTo(W / 2, H);
    g.quadraticCurveTo(W / 2 + Math.sin(a) * W * 0.4, H * 0.5, W / 2 + Math.sin(a) * W * 0.62, H * (0.04 + r() * 0.1));
    g.stroke();
  }
  const edge = g.createRadialGradient(W / 2, H, H * 0.6, W / 2, H, H * 1.05);
  edge.addColorStop(0, 'rgba(255,255,255,0)'); edge.addColorStop(1, 'rgba(255,255,255,0.35)');
  g.fillStyle = edge; g.fillRect(0, 0, W, H);
  return toTex(c, { clamp: true });
}

/** Leaf with midrib and secondary veins. */
export function leaf(base = '#4f6e3b', seed = 2) {
  const W = 128, H = 256, r = rng(seed);
  const [c, g] = canvas(W, H);
  const gr = g.createLinearGradient(0, 0, W, 0);
  gr.addColorStop(0, base); gr.addColorStop(0.5, '#6a8a4c'); gr.addColorStop(1, base);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 1500; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,230' : '20,30,10'},0.05)`; g.fillRect(r() * W, r() * H, 2, 2); }
  g.strokeStyle = 'rgba(210,225,170,0.75)'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(W / 2, H); g.lineTo(W / 2, 0); g.stroke();
  g.lineWidth = 1.2; g.strokeStyle = 'rgba(200,220,160,0.45)';
  for (let y = H * 0.9; y > H * 0.08; y -= 16) {
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(W / 2, y); g.quadraticCurveTo(W / 2 + s * W * 0.25, y - 12, W / 2 + s * W * 0.48, y - 30); g.stroke(); }
  }
  return toTex(c, { clamp: true });
}

export function bark() {
  const W = 256, H = 512, r = rng(5);
  const [c, g] = canvas(W, H);
  g.fillStyle = '#4e3d34'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 220; k++) {
    g.strokeStyle = `rgba(${r() < 0.5 ? '25,18,14' : '120,100,88'},${0.25 + r() * 0.3})`; g.lineWidth = 1 + r() * 3;
    const x = r() * W; g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y < H; y += 32) g.lineTo(x + (r() - 0.5) * 10, y);
    g.stroke();
  }
  return toTex(c, { repeat: [1, 2] });
}

export function cloud(seed = 9) {
  const S = 256, r = rng(seed);
  const [c, g] = canvas(S, S);
  for (let k = 0; k < 40; k++) {
    const x = S / 2 + (r() - 0.5) * S * 0.5, y = S / 2 + (r() - 0.4) * S * 0.35, rad = S * (0.12 + r() * 0.18);
    const gr = g.createRadialGradient(x, y - rad * 0.3, 0, x, y, rad);
    gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(0.55, 'rgba(236,236,244,0.3)'); gr.addColorStop(1, 'rgba(214,218,232,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  }
  // shade the underside so puffs read as volumes against the bright sky
  g.globalCompositeOperation = 'source-atop';
  const sh = g.createLinearGradient(0, S * 0.35, 0, S * 0.8);
  sh.addColorStop(0, 'rgba(150,165,192,0)'); sh.addColorStop(1, 'rgba(150,165,192,0.55)');
  g.fillStyle = sh; g.fillRect(0, 0, S, S);
  return toTex(c, { clamp: true });
}

export function skyDome() {
  const [c, g] = canvas(16, 512);
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#7fa6cf'); gr.addColorStop(0.3, '#a9c4df'); gr.addColorStop(0.46, '#dfe7ef'); gr.addColorStop(0.5, '#f7eee7'); gr.addColorStop(0.54, '#d9dfe8'); gr.addColorStop(1, '#b9c6d6');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
  return toTex(c, { clamp: true });
}

/** The view through a cabin window: sky over a cloud deck. */
export function windowView(seed = 1) {
  const W = 256, H = 256, r = rng(seed);
  const [c, g] = canvas(W, H);
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#a9c6e2'); gr.addColorStop(0.55, '#e3ecf3'); gr.addColorStop(0.62, '#ffffff'); gr.addColorStop(1, '#f4f2f0');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 30; k++) {
    const x = r() * W, y = H * (0.6 + r() * 0.3), rad = 20 + r() * 40;
    const cg = g.createRadialGradient(x, y, 0, x, y, rad);
    cg.addColorStop(0, 'rgba(255,255,255,0.8)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.fillRect(0, 0, W, H);
  }
  return toTex(c, { clamp: true });
}

export function exitSign() {
  const W = 256, H = 96;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#202422'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#86f5ae'; g.shadowColor = '#4fe38a'; g.shadowBlur = 18;
  g.font = '700 64px Arial, Helvetica, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('EXIT', W / 2, H / 2 + 3);
  return toTex(c, { clamp: true });
}

export function placard() {
  const W = 128, H = 72;
  const [c, g] = canvas(W, H);
  g.fillStyle = '#eee8d8'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#c23b2e'; g.fillRect(0, 0, W, 10);
  g.fillStyle = 'rgba(70,70,60,0.6)';
  for (let y = 20; y < H - 6; y += 10) g.fillRect(8, y, W - 16 - (y % 20), 3);
  return toTex(c, { clamp: true });
}
