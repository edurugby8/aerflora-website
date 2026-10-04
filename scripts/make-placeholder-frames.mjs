// PROVISIONAL frame sequence generator.
//
// Renders a stand-in walk-through of the flower-filled cabin so the scroll
// engine, text sync, loading and deployment can be built and tested before the
// real photographic sequence exists. It is NOT the final art: replace it with
// `npm run frames:extract -- <video>` once the generated video is available
// (see ASSETS.md).
//
// Usage: node scripts/make-placeholder-frames.mjs [--frames 144]

import { createCanvas } from '@napi-rs/canvas';
import fs from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);

const N = Number(args.frames ?? 192);
// petal motion is authored against a 144-frame clock so timing is frame-count independent
const clock = (i) => (i * 144) / N;
const OUT = path.resolve('public/frames');
const PAD = 4;

// Timeline (frame indices) – also written to the manifest so the site syncs
// its texts to these visual moments.
const ARRIVE = Math.round(N * 0.66); // camera reaches the door
const OPEN_START = Math.round(N * 0.69);
const OPEN_END = Math.round(N * 0.92);

// ---------------------------------------------------------------- utilities
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(20261004);
const rand = (a = 0, b = 1) => a + (b - a) * R();
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * clamp(t, 0, 1));
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (c, d, t) => [lerp(c[0], d[0], t), lerp(c[1], d[1], t), lerp(c[2], d[2], t)];
const shade = (c, k) => (k >= 0 ? mix(c, [255, 255, 255], k) : mix(c, [20, 24, 16], -k));
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------------------------------------------------------------- world
// Units: metres-ish. x right, y up, z forward along the aisle.
const D = 19; // bulkhead / door plane
const FLOOR = -1.05;
const HAZE = hex('#f1e9dc');
const PROFILE = [ // half cross-section of the fuselage (x, y), floor to ceiling centre
  [1.72, FLOOR], [1.8, -0.5], [1.83, 0.1], [1.78, 0.55], [1.6, 0.9], [1.2, 1.12], [0.6, 1.2], [0, 1.22],
];
const DOOR_W = 0.56; // half width of the door opening
const DOOR_TOP = 0.8;
const ROW_PITCH = 0.95;
const ROWS = [];
for (let z = 1.2; z < D - 1.6; z += ROW_PITCH) ROWS.push(z);

// Camera keyframes
function camera(i) {
  const walkT = easeInOut(i / ARRIVE);
  let z = lerp(0, D - 2.1, walkT);
  if (i > ARRIVE) z = D - 2.1 + 0.75 * easeInOut((i - ARRIVE) / (N - 1 - ARRIVE));
  return { x: 0, y: 0.28, z };
}
const doorAngle = (i) => (Math.PI / 180) * 80 * easeInOut((i - OPEN_START) / (OPEN_END - OPEN_START));

// ---------------------------------------------------------------- palettes
const P = {
  wall: hex('#e7dfcf'), ceil: hex('#efe8dc'), floor: hex('#5d6552'), carpet: hex('#6e7a63'),
  seat: hex('#dcd1bb'), seatHi: hex('#efe6d4'), bulk: hex('#e3dccb'), door: hex('#9db39d'),
  rose: [hex('#e9a7b6'), hex('#f2c3cb'), hex('#d98aa0'), hex('#f6d9dc')],
  white: [hex('#f8f5ef'), hex('#f3efe6'), hex('#fbf8f3')],
  lilac: [hex('#d8c8e4'), hex('#e6dcef'), hex('#f2eef5')],
  leaf: [hex('#4c6a3a'), hex('#5f7f45'), hex('#3d5631'), hex('#718f50'), hex('#57733f')],
  hydra: [hex('#eef0dd'), hex('#e3e9cf'), hex('#f6f3e6')],
  blossom: [hex('#f3c7d2'), hex('#e9a9bc'), hex('#fbe2ea'), hex('#f6d3dc')],
};

// ---------------------------------------------------------------- scene items
const items = [];
const add = (o) => items.push(o);

function cluster(cx, cy, cz, spread, count, kinds) {
  for (let k = 0; k < count; k++) {
    add({
      kind: pick(kinds),
      x: cx + rand(-spread.x, spread.x),
      y: cy + rand(-spread.y, spread.y),
      z: cz + rand(-spread.z, spread.z),
      size: rand(0.055, 0.11),
      rot: rand(0, Math.PI * 2),
      tone: R(),
      seed: Math.floor(R() * 1e9),
    });
  }
}

for (const z of ROWS) {
  for (const side of [-1, 1]) {
    // 3+3 seats – stored as items so they are depth sorted
    add({ kind: 'seat', side, x0: 0.45, x1: 0.86, z, aisle: true });
    add({ kind: 'seat', side, x0: 0.88, x1: 1.29, z });
    add({ kind: 'seat', side, x0: 1.31, x1: 1.7, z });
    // flowers spilling over the seat backs
    cluster(side * 1.05, 0.2, z, { x: 0.6, y: 0.16, z: 0.22 }, 26, ['rose', 'rose', 'orchid', 'hydra', 'leaf', 'leaf', 'leaf', 'white']);
    // aisle edge ferns and low flowers
    cluster(side * 0.58, -0.75, z + 0.4, { x: 0.12, y: 0.3, z: 0.45 }, 12, ['fern', 'leaf', 'leaf', 'rose', 'white']);
    // overhead bins / upper wall
    cluster(side * 0.98, 0.84, z + 0.3, { x: 0.07, y: 0.17, z: 0.5 }, 18, ['rose', 'white', 'hydra', 'leaf', 'leaf', 'orchid']);
    // hanging wisteria
    for (let k = 0; k < 3; k++) add({ kind: 'wisteria', x: side * rand(0.5, 0.95), y: rand(1.05, 1.15), z: z + rand(0, ROW_PITCH), len: rand(0.25, 0.55), seed: Math.floor(R() * 1e9), tone: R() });
  }
  // ceiling garland across the aisle
  for (let k = 0; k < 14; k++) {
    const t = rand(-1, 1);
    add({ kind: pick(['rose', 'white', 'leaf', 'leaf', 'hydra']), x: t * 0.9, y: 1.12 - 0.05 * t * t + rand(-0.04, 0.04), z: z + rand(-0.15, 0.15), size: rand(0.05, 0.09), rot: rand(0, 6.3), tone: R(), seed: Math.floor(R() * 1e9) });
  }
  // face-height intrusions the camera brushes past: wisteria dangling over
  // the aisle, orchid sprays and loose blooms leaning in from the seats
  for (const side of [-1, 1]) {
    add({ kind: 'wisteria', x: side * rand(0.1, 0.4), y: 1.15, z: z + rand(0.1, 0.85), len: rand(0.5, 0.85), seed: Math.floor(R() * 1e9), tone: R() });
  }
  if (R() < 0.85) {
    const side = R() < 0.5 ? -1 : 1;
    add({ kind: 'spray', side, x: side * 0.6, y: rand(-0.05, 0.25), z: z + rand(0.2, 0.7), reach: rand(0.3, 0.5), lift: rand(0.08, 0.3), seed: Math.floor(R() * 1e9), tone: R() });
  }
  for (let k = 0; k < 4; k++) {
    const side = R() < 0.5 ? -1 : 1;
    add({ kind: pick(['rose', 'white', 'orchid', 'leaf', 'leaf']), x: side * rand(0.28, 0.5), y: rand(0.05, 0.6), z: z + rand(0, ROW_PITCH), size: rand(0.06, 0.1), rot: rand(0, 6.3), tone: R(), seed: Math.floor(R() * 1e9) });
  }
}
// near-camera foreground framing
for (let k = 0; k < 60; k++) {
  const side = R() < 0.5 ? -1 : 1;
  add({ kind: pick(['orchid', 'rose', 'leaf', 'white', 'leaf']), x: side * rand(0.7, 1.5), y: rand(-0.9, 0.9), z: rand(0.35, 1.4), size: rand(0.07, 0.12), rot: rand(0, 6.3), tone: R(), seed: Math.floor(R() * 1e9) });
}
// flower walls framing the door
for (const side of [-1, 1]) {
  cluster(side * 1.0, 0.0, D - 0.25, { x: 0.35, y: 1.05, z: 0.2 }, 260, ['rose', 'white', 'orchid', 'hydra', 'leaf', 'leaf', 'fern']);
  cluster(side * 0.7, -0.55, D - 0.5, { x: 0.12, y: 0.45, z: 0.35 }, 60, ['white', 'rose', 'leaf', 'fern']);
}
cluster(0, 1.12, D - 0.2, { x: 0.95, y: 0.08, z: 0.15 }, 90, ['rose', 'white', 'leaf', 'hydra']);

// petals (deterministic motion)
const petals = Array.from({ length: 380 }, (_, k) => ({
  z0: rand(0, 7), x: rand(-1.4, 1.4), y0: rand(0, 2.2), fall: rand(0.006, 0.014), sway: rand(0.03, 0.12),
  ph: rand(0, 6.3), size: rand(0.012, 0.026), col: pick(P.blossom.concat([P.white[0]])), gust: k > 130,
}));

// sky beyond the door
const sky = (() => {
  const clouds = [];
  for (let k = 0; k < 340; k++) clouds.push({ x: rand(-14, 14), y: rand(-3.4, -1.2) + rand(0, 0.4), z: D + rand(5, 40), r: rand(0.6, 2.4) });
  const tree = { x: 0, z: D + 10, base: -1.2 };
  const branches = [];
  const grow = (x, y, ang, len, w, depth) => {
    const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
    branches.push({ x, y, x2, y2, w });
    if (depth > 0) for (const da of [-0.5, 0.45, rand(-0.15, 0.15)]) if (R() > 0.15) grow(x2, y2, ang + da + rand(-0.2, 0.2), len * rand(0.55, 0.7), w * 0.62, depth - 1);
  };
  grow(0, -1.4, Math.PI / 2, 1.3, 0.34, 5);
  const blooms = [];
  for (let k = 0; k < 2600; k++) {
    const a = rand(0, Math.PI * 2), rr = Math.sqrt(R());
    blooms.push({ x: Math.cos(a) * rr * 3.6, y: 1.9 + Math.sin(a) * rr * 1.05 * (Math.sin(a) < 0 ? 1.3 : 1) + rand(-0.15, 0.15), dz: rand(-1, 1), r: rand(0.07, 0.19), col: pick(P.blossom) });
  }
  blooms.sort((a, b) => b.dz - a.dz);
  return { clouds: clouds.sort((a, b) => b.z - a.z), tree, branches, blooms };
})();

// ---------------------------------------------------------------- renderer
function renderFrame(ctx, W, H, i) {
  const cam = camera(i);
  const F = 0.5 * Math.max(W, H * 1.15) * 0.98; // focal length in px (portrait keeps vertical framing)
  const CX = W / 2, CY = H * 0.47;
  const proj = (x, y, z) => {
    const d = z - cam.z;
    if (d < 0.04) return null;
    const s = F / d;
    return { x: CX + (x - cam.x) * s, y: CY - (y - cam.y) * s, s, d };
  };
  const fog = (d) => 1 - Math.exp(-Math.max(0, d) * 0.055);
  const openA = i >= OPEN_START ? doorAngle(i) : 0;
  const open = openA / ((Math.PI / 180) * 80);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  // --- sky (only visible through the door / portholes)
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c9d8e6'); g.addColorStop(0.55, '#efe7e6'); g.addColorStop(1, '#fbf3ea');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawSky(ctx, proj, F, open);

  // --- door leaves, the deep door surround, then the bulkhead around it
  const fd = fog(D - cam.z);
  drawDoorLeaves(ctx, proj, openA, fd);
  drawDoorway(ctx, proj, fd, open);

  // --- fuselage shell, windows, overhead bins (far to near inside each)
  drawShell(ctx, proj, cam, fog);
  drawWindows(ctx, proj, cam, fog);
  drawBins(ctx, proj, cam, fog);
  if (open > 0) drawDoorSpill(ctx, proj, open);

  // --- interior items, painter's algorithm
  const list = [];
  for (const it of items) {
    const d = (it.z ?? 0) - cam.z;
    if (d < 0.08 || d > 26) continue;
    list.push([d, it]);
  }
  // window light shafts, depth-sorted with everything else so they read as
  // volumetric haze between the flowers
  for (const z of ROWS) for (const side of [-1, 1]) {
    const d = z + 0.35 - cam.z;
    if (d > 0.4 && d < 22) list.push([d, { kind: 'shaft', side, z: z + 0.35 }]);
  }
  list.sort((a, b) => b[0] - a[0]);
  for (const [d, it] of list) {
    if (it.kind === 'seat') drawSeat(ctx, proj, it, fog(d));
    else if (it.kind === 'shaft') drawShaft(ctx, proj, it, d);
    else drawPlant(ctx, proj, it, d, fog(d), F);
  }

  // --- petals
  drawPetals(ctx, proj, i, cam, open);

  // --- light bloom from the open door
  if (open > 0) {
    const c = proj(0, 0.1, D + 2);
    if (c) {
      const r = c.s * 4;
      const gl = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
      gl.addColorStop(0, `rgba(255,250,240,${0.18 * open})`); gl.addColorStop(1, 'rgba(255,250,240,0)');
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  // --- grade: warm lift, vignette, grain
  ctx.fillStyle = 'rgba(255,236,214,0.06)'; ctx.globalCompositeOperation = 'soft-light'; ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
  v.addColorStop(0, 'rgba(30,26,18,0)'); v.addColorStop(1, 'rgba(30,26,18,0.32)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  grain(ctx, W, H, i);
}

// ---------------------------------------------------------------- cabin
const OPEN_R = 0.14; // corner radius of the door opening
const SILL = FLOOR + 0.05;
const JAMB = 0.16; // depth of the door surround
const BIN = hex('#ebe4d6');

// rounded rectangle outline in a y-up plane, counter-clockwise from bottom-left
function roundRectPts(x0, y0, x1, y1, r, n = 6, corners = [1, 1, 1, 1]) {
  const out = [];
  const arc = (cx, cy, a0) => {
    for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * Math.PI / 2; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  };
  corners[0] ? arc(x0 + r, y0 + r, Math.PI) : out.push([x0, y0]);
  corners[1] ? arc(x1 - r, y0 + r, 1.5 * Math.PI) : out.push([x1, y0]);
  corners[2] ? arc(x1 - r, y1 - r, 0) : out.push([x1, y1]);
  corners[3] ? arc(x0 + r, y1 - r, 0.5 * Math.PI) : out.push([x0, y1]);
  return out;
}
const bez = (p0, c, p1, n = 6) => Array.from({ length: n + 1 }, (_, k) => {
  const t = k / n, a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, d = t * t;
  return [a * p0[0] + b * c[0] + d * p1[0], a * p0[1] + b * c[1] + d * p1[1]];
});
const projAll = (proj, pts) => { const out = pts.map((p) => proj(...p)); return out.every(Boolean) ? out : null; };

let panelNoise = null;
function noisePattern(ctx) {
  if (!panelNoise) {
    const c = createCanvas(192, 192), g = c.getContext('2d');
    const img = g.createImageData(192, 192), rr = rng(4242);
    for (let k = 0; k < img.data.length; k += 4) {
      const v = 128 + (rr() - 0.5) * 60 + Math.sin(k * 0.0007) * 10;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0); panelNoise = c;
  }
  return ctx.createPattern(panelNoise, 'repeat');
}

function drawDoorLeaves(ctx, proj, openA, fd) {
  const H0 = SILL + 0.01, H1 = DOOR_TOP - 0.01, LW = DOOR_W - 0.008, T = 0.05;
  const zH = D + JAMB;
  for (const side of [-1, 1]) {
    const hx = side * LW;
    const dx = -side * Math.cos(openA), dz = Math.sin(openA); // hinge → free edge
    const nx = side * Math.sin(openA), nz = Math.cos(openA); // outward normal
    // local (s across from the hinge, y up, w through the thickness)
    const L = (s, y, w = 0) => proj(hx + dx * s + nx * w * T, y, zH + dz * s + nz * w * T);
    const outline = roundRectPts(0, H0, LW, H1, OPEN_R, 6, side > 0 ? [0, 1, 1, 0] : [1, 0, 0, 1])
      .map(([s, y]) => [side > 0 ? LW - s : s, y]); // hinge side always rounded
    const front = outline.map(([s, y]) => L(s, y));
    if (front.some((p) => !p)) continue;
    const lit = 0.03 + 0.16 * Math.sin(openA);
    const col = mix(shade(P.door, lit), HAZE, fd * 0.6);
    // free edge (thickness) shows as the leaf swings
    const e = [L(LW, H0, 0), L(LW, H1, 0), L(LW, H1, 1), L(LW, H0, 1)];
    if (e.every(Boolean) && openA > 0.02) { ctx.fillStyle = rgba(shade(col, -0.22)); poly(ctx, e); ctx.fill(); }
    // face
    const top = L(LW / 2, H1), bot = L(LW / 2, H0);
    const gr = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
    gr.addColorStop(0, rgba(shade(col, 0.07))); gr.addColorStop(0.55, rgba(col)); gr.addColorStop(1, rgba(shade(col, -0.1)));
    ctx.fillStyle = gr; poly(ctx, front); ctx.fill();
    ctx.save(); poly(ctx, front); ctx.clip();
    ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.08;
    ctx.fillStyle = noisePattern(ctx); ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
    const s0 = front[0].s;
    // recessed lower panel with bevel
    const pan = roundRectPts(0.09, H0 + 0.12, LW - 0.09, lerp(H0, H1, 0.5), 0.05).map(([s, y]) => L(s, y));
    if (pan.every(Boolean)) {
      ctx.fillStyle = rgba(shade(col, -0.035)); poly(ctx, pan); ctx.fill();
      ctx.lineWidth = Math.max(1, s0 * 0.006);
      ctx.strokeStyle = rgba(shade(col, -0.25), 0.7); ctx.stroke();
      ctx.save(); ctx.translate(0, Math.max(1, s0 * 0.004));
      ctx.strokeStyle = rgba(shade(col, 0.3), 0.5); poly(ctx, pan); ctx.stroke(); ctx.restore();
    }
    // porthole: trim ring, rubber gasket, glass with sky and a reflection
    const pc = [LW / 2, lerp(H0, H1, 0.75)], pr = 0.12;
    const ring = (k) => Array.from({ length: 36 }, (_, j) => { const a = (j / 36) * Math.PI * 2; return L(pc[0] + Math.cos(a) * pr * k, pc[1] + Math.sin(a) * pr * k); });
    const r1 = ring(1.32), r2 = ring(1.1), r3 = ring(1);
    if (r1.every(Boolean) && r2.every(Boolean) && r3.every(Boolean)) {
      ctx.fillStyle = rgba(shade(col, 0.14)); poly(ctx, r1); ctx.fill();
      ctx.strokeStyle = rgba(shade(col, -0.3), 0.6); ctx.lineWidth = Math.max(1, s0 * 0.004); ctx.stroke();
      ctx.fillStyle = '#3a3f39'; poly(ctx, r2); ctx.fill();
      const gt = L(pc[0], pc[1] + pr), gb = L(pc[0], pc[1] - pr);
      const sg = ctx.createLinearGradient(gt.x, gt.y, gb.x, gb.y);
      sg.addColorStop(0, '#bcd3e7'); sg.addColorStop(0.55, '#e8eff4'); sg.addColorStop(1, '#fbfaf7');
      ctx.fillStyle = sg; poly(ctx, r3); ctx.fill();
      ctx.save(); poly(ctx, r3); ctx.clip();
      const a = L(pc[0] - pr, pc[1] + pr * 0.2), b = L(pc[0] + pr * 0.2, pc[1] + pr);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = s0 * 0.05;
      ctx.beginPath(); ctx.moveTo(a.x, a.y + s0 * 0.06); ctx.lineTo(b.x, b.y + s0 * 0.06); ctx.stroke();
      ctx.restore();
    }
    // handle plate + lever near the meeting edge, and a small instruction placard
    const hp = roundRectPts(LW - 0.13, -0.16, LW - 0.04, 0.02, 0.02).map(([s, y]) => L(s, y));
    if (hp.every(Boolean)) { ctx.fillStyle = rgba(shade(col, -0.18)); poly(ctx, hp); ctx.fill(); }
    const l1 = L(LW - 0.085, 0.0), l2 = L(LW - 0.085, -0.13);
    if (l1 && l2) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#5d625b'; ctx.lineWidth = Math.max(2, s0 * 0.024); ctx.beginPath(); ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.stroke();
      ctx.strokeStyle = '#d6d9d3'; ctx.lineWidth = Math.max(1, s0 * 0.012); ctx.beginPath(); ctx.moveTo(l1.x - 1, l1.y); ctx.lineTo(l2.x - 1, l2.y); ctx.stroke();
    }
    const pl = [[0.12, 0.02], [0.3, 0.02], [0.3, 0.12], [0.12, 0.12]].map(([s, y]) => L(s, y));
    if (pl.every(Boolean)) {
      ctx.fillStyle = rgba(mix(hex('#efe9da'), HAZE, fd * 0.5)); poly(ctx, pl); ctx.fill();
      ctx.strokeStyle = 'rgba(80,80,70,0.35)'; ctx.lineWidth = Math.max(0.5, s0 * 0.003);
      for (const v of [0.045, 0.07, 0.095]) { const p1 = L(0.14, v), p2 = L(0.27, v); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
    }
    // worn, slightly lighter edges
    ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = Math.max(1, s0 * 0.006);
    poly(ctx, front); ctx.stroke();
  }
}

function drawDoorway(ctx, proj, fd, open) {
  const ol = roundRectPts(-DOOR_W, SILL, DOOR_W, DOOR_TOP, OPEN_R);
  const front = ol.map(([x, y]) => proj(x, y, D));
  const back = ol.map(([x, y]) => proj(x, y, D + JAMB));
  if (front.some((p) => !p) || back.some((p) => !p)) return;
  // jamb: the deep inner faces of the surround, lit by daylight when open
  for (let k = 0; k < ol.length; k++) {
    const j = (k + 1) % ol.length;
    const [ax, ay] = ol[k], [bx, by] = ol[j];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ny = (bx - ax) / len; // inward normal's y (ccw outline)
    const lit = -0.16 + 0.1 * ny + 0.22 * open;
    ctx.fillStyle = rgba(mix(shade(P.bulk, lit), HAZE, fd * 0.6));
    poly(ctx, [front[k], front[j], back[j], back[k]]); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke();
  }
  // daylight leaking through the gaps of the closed door
  const leak = 1 - smooth(0, 0.35, open);
  if (leak > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = 'rgba(255,248,230,0.9)'; ctx.shadowBlur = back[0].s * 0.06;
    ctx.strokeStyle = `rgba(255,250,236,${0.75 * leak})`; ctx.lineWidth = Math.max(1, back[0].s * 0.006);
    const c0 = proj(0, SILL + 0.02, D + JAMB), c1 = proj(0, DOOR_TOP - 0.02, D + JAMB);
    ctx.beginPath(); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke();
    ctx.strokeStyle = `rgba(255,250,236,${0.35 * leak})`; poly(ctx, back); ctx.stroke();
    ctx.restore();
  }
  // bulkhead face around the opening
  const ring = fullProfile().map(([x, y]) => proj(x, y, D));
  if (ring.every(Boolean)) {
    const t = proj(0, 1.2, D), b = proj(0, FLOOR, D);
    const gr = ctx.createLinearGradient(0, t.y, 0, b.y);
    gr.addColorStop(0, rgba(mix(shade(P.bulk, 0.08), HAZE, fd * 0.7)));
    gr.addColorStop(1, rgba(mix(shade(P.bulk, -0.12), HAZE, fd * 0.7)));
    ctx.beginPath(); poly(ctx, ring, false); poly(ctx, front.slice().reverse(), false);
    ctx.fillStyle = gr; ctx.fill('evenodd');
    // panel seams
    ctx.strokeStyle = rgba(mix(shade(P.bulk, -0.2), HAZE, fd * 0.7), 0.6); ctx.lineWidth = Math.max(1, t.s * 0.004);
    for (const x of [-1.05, 1.05]) { const a = proj(x, FLOOR, D), c = proj(x, 1.0, D); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
  }
  // raised surround trim with a dark rubber seal inside it
  ctx.lineJoin = 'round';
  ctx.strokeStyle = rgba(mix(shade(P.bulk, 0.1), HAZE, fd * 0.6)); ctx.lineWidth = Math.max(2, front[0].s * 0.05);
  poly(ctx, front); ctx.stroke();
  ctx.strokeStyle = rgba(mix(shade(P.bulk, -0.25), HAZE, fd * 0.6)); ctx.lineWidth = Math.max(1, front[0].s * 0.008);
  poly(ctx, front); ctx.stroke();
  // illuminated EXIT sign
  const a = proj(-0.17, 1.02, D - 0.02), b = proj(0.17, 0.9, D - 0.02);
  if (a && b) {
    const w = b.x - a.x, h = b.y - a.y;
    ctx.fillStyle = '#2b2f2c'; roundRect(ctx, a.x, a.y, w, h, h * 0.15); ctx.fill();
    ctx.save();
    ctx.fillStyle = '#7ef0a6'; ctx.shadowColor = 'rgba(80,240,140,0.9)'; ctx.shadowBlur = h * 0.5;
    ctx.font = `700 ${(h * 0.62).toFixed(1)}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', a.x + w / 2, a.y + h * 0.54);
    ctx.restore();
  }
}

function drawShell(ctx, proj, cam, fog) {
  const prof = fullProfile();
  const zs = [];
  for (let z = D; z > cam.z + 0.05; z -= 0.5) zs.push(z);
  zs.push(cam.z + 0.05);
  for (let s = 0; s < zs.length - 1; s++) {
    const z0 = zs[s], z1 = zs[s + 1];
    const d = (z0 + z1) / 2 - cam.z;
    for (let k = 0; k < prof.length - 1; k++) {
      const [ax, ay] = prof[k], [bx, by] = prof[k + 1];
      const q = [proj(ax, ay, z0), proj(bx, by, z0), proj(bx, by, z1), proj(ax, ay, z1)];
      if (q.some((p) => !p)) continue;
      const ny = (ay + by) / 2, nx = Math.abs((ax + bx) / 2);
      const ceil = ny > 1.05;
      // ambient occlusion low on the sidewall, cove light on the ceiling
      let lit = ceil ? 0.06 + 0.1 * smooth(0.3, 0.95, nx) : ny < -0.6 ? -0.12 : ny < 0.6 ? -0.03 : -0.08;
      ctx.fillStyle = rgba(mix(shade(ceil ? P.ceil : P.wall, lit), HAZE, fog(d)));
      poly(ctx, q); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke();
    }
    // ceiling light strip
    const cl = [proj(-0.09, 1.215, z0), proj(0.09, 1.215, z0), proj(0.09, 1.215, z1), proj(-0.09, 1.215, z1)];
    if (cl.every(Boolean)) { ctx.fillStyle = rgba(mix(hex('#fffaf0'), HAZE, fog(d) * 0.4)); poly(ctx, cl); ctx.fill(); }
    // floor: carpet aisle, darker under the seats, floor path lights
    for (const [xa, xb, c] of [[-1.75, -0.43, P.floor], [-0.43, 0.43, P.carpet], [0.43, 1.75, P.floor]]) {
      const q = [proj(xa, FLOOR, z0), proj(xb, FLOOR, z0), proj(xb, FLOOR, z1), proj(xa, FLOOR, z1)];
      if (q.some((p) => !p)) continue;
      ctx.fillStyle = rgba(mix(c === P.floor ? shade(c, -0.15) : c, HAZE, fog(d) * 0.8));
      poly(ctx, q); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    }
    for (const x of [-0.44, 0.44]) {
      const q = [proj(x - 0.012, FLOOR + 0.002, z0), proj(x + 0.012, FLOOR + 0.002, z0), proj(x + 0.012, FLOOR + 0.002, z1), proj(x - 0.012, FLOOR + 0.002, z1)];
      if (q.every(Boolean)) { ctx.fillStyle = rgba(mix(hex('#f6ead0'), HAZE, fog(d) * 0.6), 0.85); poly(ctx, q); ctx.fill(); }
    }
  }
}

function drawWindows(ctx, proj, cam, fog) {
  ROWS.forEach((z, idx) => {
    for (const side of [-1, 1]) {
      const wx = side * 1.8, wz = z + 0.35, cy = 0.27;
      if (wz - cam.z < 0.25) continue;
      const ell = (k) => projAll(proj, Array.from({ length: 36 }, (_, j) => {
        const a = (j / 36) * Math.PI * 2;
        return [wx, cy + Math.sin(a) * 0.19 * k, wz + Math.cos(a) * 0.13 * k];
      }));
      const bezel = ell(1.5), reveal = ell(1.2), glass = ell(1);
      if (!bezel || !reveal || !glass) continue;
      const c = proj(wx, cy, wz), f = fog(c.d);
      const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.s * 0.6);
      glow.addColorStop(0, 'rgba(255,252,244,0.35)'); glow.addColorStop(1, 'rgba(255,252,244,0)');
      ctx.fillStyle = glow; ctx.fillRect(c.x - c.s, c.y - c.s, c.s * 2, c.s * 2);
      ctx.fillStyle = rgba(mix(shade(P.wall, 0.06), HAZE, f)); poly(ctx, bezel); ctx.fill();
      ctx.strokeStyle = rgba(mix(shade(P.wall, -0.12), HAZE, f), 0.7); ctx.lineWidth = Math.max(0.5, c.s * 0.006); ctx.stroke();
      ctx.fillStyle = rgba(mix(shade(P.wall, -0.14), HAZE, f)); poly(ctx, reveal); ctx.fill();
      const top = proj(wx, cy + 0.19, wz), bot = proj(wx, cy - 0.19, wz);
      const sg = ctx.createLinearGradient(0, top.y, 0, bot.y);
      sg.addColorStop(0, rgba(mix(hex('#b9d0e5'), HAZE, f * 0.5))); sg.addColorStop(0.6, rgba(mix(hex('#eaf0f3'), HAZE, f * 0.5))); sg.addColorStop(1, '#ffffff');
      ctx.fillStyle = sg; poly(ctx, glass); ctx.fill();
      // window shade, pulled down by a different amount on each window
      const frac = [0, 0.3, 0.55, 0.12, 0.4][(idx * 3 + (side > 0 ? 1 : 0)) % 5];
      if (frac > 0) {
        ctx.save(); poly(ctx, glass); ctx.clip();
        const yEdge = proj(wx, cy + 0.19 - 0.38 * frac, wz);
        ctx.fillStyle = rgba(mix(hex('#e6e0d3'), HAZE, f));
        ctx.fillRect(c.x - c.s, top.y - c.s * 0.1, c.s * 2, yEdge.y - top.y + c.s * 0.1);
        ctx.fillStyle = rgba(mix(hex('#b9b2a4'), HAZE, f)); ctx.fillRect(c.x - c.s, yEdge.y - c.s * 0.012, c.s * 2, c.s * 0.02);
        ctx.restore();
      }
      ctx.strokeStyle = rgba(mix(hex('#8f897c'), HAZE, f), 0.8); ctx.lineWidth = Math.max(0.5, c.s * 0.008);
      poly(ctx, glass); ctx.stroke();
    }
  });
}

function drawBins(ctx, proj, cam, fog) {
  const segs = [];
  for (let z = ROWS[0] - ROW_PITCH * 2 - 0.12; z < D - 0.3; z += ROW_PITCH) segs.push([z, Math.min(z + ROW_PITCH, D - 0.3)]);
  segs.reverse(); // far to near
  for (const [za, zbRaw] of segs) {
    const zb = Math.max(zbRaw, cam.z + 0.06), zaC = Math.max(za, cam.z + 0.06);
    if (zbRaw <= cam.z + 0.06) continue;
    const zm = (za + zbRaw) / 2, d = zm - cam.z, f = fog(Math.max(d, 0));
    for (const side of [-1, 1]) {
      const X = (x) => side * x;
      // underside with the passenger service unit
      const u = [proj(X(1.12), 0.66, zaC), proj(X(1.76), 0.6, zaC), proj(X(1.76), 0.6, zb), proj(X(1.12), 0.66, zb)];
      if (u.every(Boolean)) { ctx.fillStyle = rgba(mix(shade(BIN, -0.14), HAZE, f)); poly(ctx, u); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.stroke(); }
      const psu = [proj(X(1.14), 0.655, zaC), proj(X(1.44), 0.64, zaC), proj(X(1.44), 0.64, zb), proj(X(1.14), 0.655, zb)];
      if (psu.every(Boolean)) {
        ctx.fillStyle = rgba(mix(shade(BIN, -0.06), HAZE, f)); poly(ctx, psu); ctx.fill();
        if (d > 0.5) for (const [lx, lz] of [[1.2, zm - 0.1], [1.31, zm - 0.1], [1.38, zm + 0.18]]) {
          const lp = projAll(proj, Array.from({ length: 14 }, (_, j) => { const a = (j / 14) * Math.PI * 2; return [X(lx) + Math.cos(a) * 0.022, 0.652, lz + Math.sin(a) * 0.022]; }));
          if (lp) { ctx.fillStyle = rgba(mix(hex('#fbf6ea'), HAZE, f * 0.5)); poly(ctx, lp); ctx.fill(); ctx.strokeStyle = rgba(mix(hex('#8d877b'), HAZE, f), 0.7); ctx.lineWidth = 1; ctx.stroke(); }
        }
      }
      // bin door (front face): soft vertical gradient, seam, latch
      const fr = [proj(X(1.12), 0.66, zaC), proj(X(1.02), 1.03, zaC), proj(X(1.02), 1.03, zb), proj(X(1.12), 0.66, zb)];
      if (!fr.every(Boolean)) continue;
      const gy = ctx.createLinearGradient(0, fr[0].y, 0, fr[1].y);
      gy.addColorStop(0, rgba(mix(shade(BIN, -0.04), HAZE, f))); gy.addColorStop(1, rgba(mix(shade(BIN, 0.1), HAZE, f)));
      ctx.fillStyle = gy; poly(ctx, fr); ctx.fill();
      ctx.strokeStyle = rgba(mix(shade(BIN, -0.06), HAZE, f)); ctx.lineWidth = 1; ctx.stroke();
      if (za > cam.z + 0.06) {
        const s0 = proj(X(1.12), 0.66, za), s1 = proj(X(1.02), 1.03, za);
        ctx.strokeStyle = rgba(mix(shade(BIN, -0.35), HAZE, f), 0.7); ctx.lineWidth = Math.max(1, s0.s * 0.004);
        ctx.beginPath(); ctx.moveTo(s0.x, s0.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
      }
      const lt = projAll(proj, [[X(1.11), 0.69, zm - 0.09], [X(1.105), 0.72, zm - 0.09], [X(1.105), 0.72, zm + 0.09], [X(1.11), 0.69, zm + 0.09]]);
      if (lt && d > 0.4) { ctx.fillStyle = rgba(mix(shade(BIN, -0.4), HAZE, f)); poly(ctx, lt); ctx.fill(); }
      // bevelled lip and the cove light washing the ceiling above the bins
      const l0 = proj(X(1.02), 1.03, zaC), l1 = proj(X(1.02), 1.03, zb);
      ctx.strokeStyle = rgba(mix(shade(BIN, 0.3), HAZE, f)); ctx.lineWidth = Math.max(1, l0.s * 0.006);
      ctx.beginPath(); ctx.moveTo(l0.x, l0.y); ctx.lineTo(l1.x, l1.y); ctx.stroke();
      const cv = [proj(X(1.0), 1.05, zaC), proj(X(0.55), 1.19, zaC), proj(X(0.55), 1.19, zb), proj(X(1.0), 1.05, zb)];
      if (cv.every(Boolean)) {
        const cg = ctx.createLinearGradient(cv[0].x, cv[0].y, cv[1].x, cv[1].y);
        cg.addColorStop(0, `rgba(255,246,226,${0.4 * (1 - f)})`); cg.addColorStop(1, 'rgba(255,246,226,0)');
        ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = cg; poly(ctx, cv); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  }
}

function drawDoorSpill(ctx, proj, open) {
  const q = [proj(-DOOR_W, FLOOR, D), proj(DOOR_W, FLOOR, D), proj(1.4, FLOOR, D - 3.4), proj(-1.4, FLOOR, D - 3.4)];
  if (q.some((p) => !p)) return;
  const g = ctx.createLinearGradient(0, q[0].y, 0, q[2].y);
  g.addColorStop(0, `rgba(255,246,228,${0.45 * open})`); g.addColorStop(1, 'rgba(255,246,228,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'screen'; ctx.filter = `blur(${(q[0].s * 0.04).toFixed(1)}px)`;
  ctx.fillStyle = g; poly(ctx, q); ctx.fill();
  ctx.restore();
}

function fullProfile() {
  const right = PROFILE;
  const left = PROFILE.slice().reverse().map(([x, y]) => [-x, y]);
  return right.concat(left.slice(1));
}

function poly(ctx, pts, begin = true) {
  if (begin) ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.closePath();
}

function drawSky(ctx, proj, F, open) {
  // clouds
  for (const c of sky.clouds) {
    const p = proj(c.x, c.y, c.z);
    if (!p) continue;
    const r = c.r * p.s;
    const gr = ctx.createRadialGradient(p.x, p.y - r * 0.25, 0, p.x, p.y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(250,246,244,0.7)'); gr.addColorStop(1, 'rgba(240,236,240,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
  // tree
  const T = sky.tree;
  const halo = proj(T.x, 1.1, T.z);
  if (halo) {
    const gr = ctx.createRadialGradient(halo.x, halo.y, 0, halo.x, halo.y, halo.s * 4);
    gr.addColorStop(0, 'rgba(255,236,240,0.7)'); gr.addColorStop(1, 'rgba(255,236,240,0)');
    ctx.fillStyle = gr; ctx.fillRect(halo.x - halo.s * 4, halo.y - halo.s * 4, halo.s * 8, halo.s * 8);
  }
  ctx.lineCap = 'round';
  for (const b of sky.branches) {
    const a = proj(T.x + b.x, b.y, T.z), c = proj(T.x + b.x2, b.y2, T.z);
    if (!a || !c) continue;
    ctx.strokeStyle = '#5a463d'; ctx.lineWidth = Math.max(1, b.w * a.s);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(c.x, c.y); ctx.stroke();
  }
  for (const b of sky.blooms) {
    const p = proj(T.x + b.x, b.y, T.z + b.dz * 0.6);
    if (!p) continue;
    const r = b.r * p.s;
    const lit = clamp((b.y - 0.6) / 1.6, -0.3, 0.5);
    const c = shade(b.col, lit * 0.6);
    const gr = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
    gr.addColorStop(0, rgba(shade(c, 0.35), 0.95)); gr.addColorStop(0.7, rgba(c, 0.85)); gr.addColorStop(1, rgba(shade(c, -0.15), 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
  // cloud bed in front of the trunk base
  for (let k = 0; k < 40; k++) {
    const x = ((k * 7.31) % 9) - 4.5, z = T.z - 1 - ((k * 3.7) % 4);
    const p = proj(x, -2.1 + ((k * 1.3) % 0.4), z);
    if (!p) continue;
    const r = (1.0 + (k % 5) * 0.25) * p.s;
    const gr = ctx.createRadialGradient(p.x, p.y - r * 0.3, 0, p.x, p.y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(246,242,244,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
}

// Airline seat seen from behind: reclined, rounded backrest with a linen
// headrest cover, tray table, seat pocket and metal legs; the aisle seat
// also shows its side, cushion and armrest.
const SEAT_BOT = -0.62, SEAT_TOP = 0.14;
const SEAT_BACK = (() => {
  const pts = [[0, 0], [1, 0], [1, 0.68]];
  pts.push(...bez([1, 0.68], [0.99, 1.0], [0.74, 1.0]).slice(1));
  pts.push(...bez([0.26, 1.0], [0.01, 1.0], [0, 0.68]));
  return pts;
})();

function drawSeat(ctx, proj, s, f) {
  const sx = s.side;
  const zb = s.z + 0.04, zt = s.z - 0.07; // backrest reclined towards the camera
  const pt = (u, v, dz = 0) => proj(sx * lerp(s.x0, s.x1, u), lerp(SEAT_BOT, SEAT_TOP, v), lerp(zb, zt, v) + dz);
  const W3 = (x, y, z) => proj(sx * x, y, z);
  const fogc = (c) => rgba(mix(c, HAZE, f));
  const quad = (pts, c) => { const q = pts.map((p) => W3(...p)); if (q.every(Boolean)) { ctx.fillStyle = fogc(c); poly(ctx, q); ctx.fill(); } };

  // contact shadow on the floor
  const s0 = W3(s.x0, FLOOR, s.z + 0.25), s1 = W3(s.x1, FLOOR, s.z + 0.25);
  if (s0 && s1) {
    const cx = (s0.x + s1.x) / 2, rr = Math.abs(s1.x - s0.x) * 0.8;
    const gr = ctx.createRadialGradient(cx, s0.y, 0, cx, s0.y, rr);
    gr.addColorStop(0, 'rgba(25,30,20,0.32)'); gr.addColorStop(1, 'rgba(25,30,20,0)');
    ctx.fillStyle = gr; ctx.fillRect(cx - rr, s0.y - rr * 0.4, rr * 2, rr * 0.8);
  }
  // legs and frame under the cushion
  for (const u of [0.18, 0.82]) {
    const x = lerp(s.x0, s.x1, u);
    quad([[x - 0.015, FLOOR, s.z + 0.3], [x + 0.015, FLOOR, s.z + 0.3], [x + 0.015, SEAT_BOT - 0.1, s.z + 0.22], [x - 0.015, SEAT_BOT - 0.1, s.z + 0.22]], hex('#4a4d48'));
  }
  quad([[s.x0, SEAT_BOT - 0.08, s.z + 0.1], [s.x1, SEAT_BOT - 0.08, s.z + 0.1], [s.x1, SEAT_BOT - 0.13, s.z + 0.12], [s.x0, SEAT_BOT - 0.13, s.z + 0.12]], hex('#5b5d57'));

  if (s.aisle) {
    const x = s.x0;
    // seat cushion side and armrest
    quad([[x, SEAT_BOT + 0.02, s.z + 0.06], [x, SEAT_BOT + 0.02, s.z + 0.56], [x, SEAT_BOT - 0.1, s.z + 0.56], [x, SEAT_BOT - 0.1, s.z + 0.06]], shade(P.seat, -0.2));
    quad([[x - 0.02, -0.4, s.z + 0.12], [x + 0.045, -0.4, s.z + 0.12], [x + 0.045, -0.4, s.z + 0.5], [x - 0.02, -0.4, s.z + 0.5]], hex('#a59e8f'));
    quad([[x - 0.02, -0.4, s.z + 0.12], [x - 0.02, -0.4, s.z + 0.5], [x - 0.02, -0.47, s.z + 0.5], [x - 0.02, -0.47, s.z + 0.12]], hex('#7f796d'));
    quad([[x - 0.01, -0.47, s.z + 0.44], [x - 0.01, -0.47, s.z + 0.48], [x - 0.01, SEAT_BOT, s.z + 0.48], [x - 0.01, SEAT_BOT, s.z + 0.44]], hex('#6f6a60'));
    // backrest thickness on the aisle side
    const side = [pt(0, 0), pt(0, 0.68), pt(0, 0.68, 0.17), pt(0, 0, 0.17)];
    if (side.every(Boolean)) { ctx.fillStyle = fogc(shade(P.seat, -0.22)); poly(ctx, side); ctx.fill(); }
  }

  // backrest
  const back = SEAT_BACK.map(([u, v]) => pt(u, v));
  if (back.some((p) => !p)) return;
  const top = pt(0.5, 1), bot = pt(0.5, 0);
  const g = ctx.createLinearGradient(top.x, top.y, bot.x, bot.y);
  g.addColorStop(0, fogc(P.seatHi)); g.addColorStop(0.4, fogc(P.seat)); g.addColorStop(1, fogc(shade(P.seat, -0.3)));
  ctx.fillStyle = g; poly(ctx, back); ctx.fill();
  ctx.save(); poly(ctx, back); ctx.clip();
  // rounded form: darker flanks, soft highlight on the shoulders
  const l = pt(0, 0.6), r = pt(1, 0.6);
  const hg = ctx.createLinearGradient(l.x, l.y, r.x, r.y);
  hg.addColorStop(0, 'rgba(40,34,24,0.22)'); hg.addColorStop(0.18, 'rgba(40,34,24,0)'); hg.addColorStop(0.82, 'rgba(40,34,24,0)'); hg.addColorStop(1, 'rgba(40,34,24,0.22)');
  ctx.fillStyle = hg; ctx.fillRect(Math.min(l.x, r.x) - 2, top.y - 2, Math.abs(r.x - l.x) + 4, bot.y - top.y + 4);
  const sh = pt(0.5, 0.82), rad = Math.abs(r.x - l.x) * 0.55;
  const rg = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, rad);
  rg.addColorStop(0, 'rgba(255,252,244,0.28)'); rg.addColorStop(1, 'rgba(255,252,244,0)');
  ctx.fillStyle = rg; ctx.fillRect(sh.x - rad, sh.y - rad, rad * 2, rad * 2);
  ctx.restore();
  const lw = Math.max(0.6, top.s * 0.004);
  // headrest cover
  const hr = roundRectPts(0.14, 0.8, 0.86, 0.975, 0.05).map(([u, v]) => pt(u, v));
  if (hr.every(Boolean)) {
    ctx.save(); ctx.shadowColor = 'rgba(40,34,24,0.25)'; ctx.shadowBlur = top.s * 0.02; ctx.shadowOffsetY = top.s * 0.008;
    ctx.fillStyle = fogc(hex('#f3efe6')); poly(ctx, hr); ctx.fill(); ctx.restore();
  }
  // tray table with latch, seat pocket
  const tr = roundRectPts(0.12, 0.32, 0.88, 0.6, 0.04).map(([u, v]) => pt(u, v));
  if (tr.every(Boolean)) {
    ctx.fillStyle = fogc(hex('#d0c8b8')); poly(ctx, tr); ctx.fill();
    ctx.strokeStyle = fogc(shade(hex('#d0c8b8'), -0.3)); ctx.lineWidth = lw; ctx.stroke();
  }
  const la = [pt(0.45, 0.62), pt(0.55, 0.62), pt(0.55, 0.66), pt(0.45, 0.66)];
  if (la.every(Boolean)) { ctx.fillStyle = fogc(hex('#6f695e')); poly(ctx, la); ctx.fill(); }
  const pk = [pt(0.14, 0.08), pt(0.86, 0.08), pt(0.86, 0.26), pt(0.14, 0.26)];
  if (pk.every(Boolean)) {
    ctx.fillStyle = rgba(mix(shade(P.seat, -0.14), HAZE, f), 0.7); poly(ctx, pk); ctx.fill();
    ctx.strokeStyle = fogc(shade(P.seat, -0.35)); ctx.lineWidth = lw * 1.5;
    ctx.beginPath(); ctx.moveTo(pk[3].x, pk[3].y); ctx.lineTo(pk[2].x, pk[2].y); ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPlant(ctx, proj, it, d, f, F) {
  const p = proj(it.x, it.y, it.z);
  if (!p) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const r = it.kind === 'wisteria' || it.kind === 'spray' ? 0.05 * p.s : it.size * p.s;
  if (r < 0.7) return;
  const reach = it.kind === 'wisteria' || it.kind === 'spray' ? 22 : 3;
  if (p.x < -r * reach || p.x > W + r * reach || p.y < -r * reach || p.y > H + r * 3) return;
  // depth of field: things brushing the lens go very soft, the far end of
  // the cabin slightly soft; fade in from the near plane so nothing pops
  const k = F / 800;
  let blur = d < 1.6 ? Math.min(34, Math.pow(1.6 - d, 1.4) * 13) * k : d > 9 ? 0.7 * k : 0;
  ctx.filter = blur > 0.6 ? `blur(${blur.toFixed(1)}px)` : 'none';
  ctx.globalAlpha = smooth(0.08, 0.32, d);
  const rr = rng(it.seed);
  switch (it.kind) {
    case 'rose': drawRose(ctx, p.x, p.y, r * 1.1, mix(P.rose[Math.floor(it.tone * 4)], HAZE, f), rr, it.rot); break;
    case 'white': drawRose(ctx, p.x, p.y, r, mix(P.white[Math.floor(it.tone * 3)], HAZE, f * 0.6), rr, it.rot); break;
    case 'orchid': drawOrchid(ctx, p.x, p.y, r * 1.2, f, rr, it.rot); break;
    case 'hydra': drawHydrangea(ctx, p.x, p.y, r * 1.3, mix(P.hydra[Math.floor(it.tone * 3)], HAZE, f * 0.6), rr); break;
    case 'leaf': drawLeaf(ctx, p.x, p.y, r * 2.2, mix(P.leaf[Math.floor(it.tone * 5)], HAZE, f), it.rot); break;
    case 'fern': drawFern(ctx, p.x, p.y, r * 4, mix(P.leaf[Math.floor(it.tone * 5)], HAZE, f), it.rot, rr); break;
    case 'wisteria': drawWisteria(ctx, proj, it, f); break;
    case 'spray': drawSpray(ctx, proj, it, f, rr); break;
  }
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
}

// arching orchid stem leaning from the seats into the aisle
function drawSpray(ctx, proj, it, f, rr) {
  const n = 8, pts = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const p = proj(it.x - it.side * it.reach * t, it.y + it.lift * Math.sin(t * Math.PI * 0.85) - 0.12 * t * t, it.z + 0.18 * t);
    if (!p) return;
    pts.push(p);
  }
  ctx.strokeStyle = rgba(mix(shade(P.leaf[2], -0.1), HAZE, f));
  ctx.lineWidth = Math.max(1, 0.007 * pts[0].s);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
  ctx.stroke();
  drawLeaf(ctx, pts[1].x, pts[1].y, 0.12 * pts[1].s, mix(P.leaf[1], HAZE, f), it.side > 0 ? 2.6 : 0.5);
  for (let k = 2; k <= n; k++) {
    const t = k / n;
    drawOrchid(ctx, pts[k].x, pts[k].y + 0.02 * pts[k].s, 0.05 * pts[k].s * (1.05 - 0.35 * t), f, rr, rr() * 6.3);
  }
}

function drawShaft(ctx, proj, it, d) {
  const wx = it.side * 1.77, zc = it.z;
  const q = [
    proj(wx, 0.52, zc - 0.13), proj(wx, 0.52, zc + 0.13),
    proj(it.side * 0.1, FLOOR, zc + 1.0), proj(it.side * 0.25, FLOOR, zc + 0.55),
  ];
  if (q.some((p) => !p)) return;
  const a = 0.13 * smooth(0.4, 1.4, d) * (1 - smooth(10, 22, d));
  const g = ctx.createLinearGradient(q[0].x, q[0].y, (q[2].x + q[3].x) / 2, (q[2].y + q[3].y) / 2);
  g.addColorStop(0, `rgba(255,248,232,${a})`); g.addColorStop(1, 'rgba(255,248,232,0)');
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${Math.max(2, q[0].s * 0.02).toFixed(1)}px)`;
  ctx.fillStyle = g; poly(ctx, q); ctx.fill();
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
}

function petalPath(ctx, x, y, len, wid, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const P2 = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  ctx.beginPath();
  ctx.moveTo(...P2(0, 0));
  ctx.bezierCurveTo(...P2(len * 0.3, -wid), ...P2(len * 0.95, -wid * 0.9), ...P2(len, 0));
  ctx.bezierCurveTo(...P2(len * 0.95, wid * 0.9), ...P2(len * 0.3, wid), ...P2(0, 0));
}

function drawRose(ctx, x, y, r, col, rr, rot) {
  if (r < 2.5) { ctx.fillStyle = rgba(col); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); return; }
  // soft shadow beneath
  const sg = ctx.createRadialGradient(x, y + r * 0.25, 0, x, y + r * 0.25, r * 1.4);
  sg.addColorStop(0, 'rgba(30,30,20,0.25)'); sg.addColorStop(1, 'rgba(30,30,20,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(x, y + r * 0.25, r * 1.4, 0, 6.3); ctx.fill();
  const layers = r > 18 ? 5 : r > 10 ? 4 : 3;
  const LIGHT = -Math.PI * 0.6; // key light from the windows, upper left
  for (let L = 0; L < layers; L++) {
    const k = 1 - L / layers;
    const n = 5 + (layers - L);
    for (let j = 0; j < n; j++) {
      // inner layers cast soft shadows onto the outer petals (cupped bloom)
      if (r > 6) {
        ctx.shadowColor = `rgba(70,30,40,${L === 0 ? 0.22 : 0.3})`;
        ctx.shadowBlur = r * (L === 0 ? 0.35 : 0.18);
        ctx.shadowOffsetY = r * 0.06;
      }
      const a = rot + (j / n) * Math.PI * 2 + L * 0.6 + rr() * 0.3;
      const len = r * k * (0.95 + rr() * 0.15), wid = r * k * (0.5 + rr() * 0.12);
      const lit = 0.13 * Math.cos(a - LIGHT);
      const g = ctx.createLinearGradient(x, y, x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.addColorStop(0, rgba(shade(col, -0.32 + L * 0.05 + lit * 0.5)));
      g.addColorStop(0.6, rgba(shade(col, 0.02 + L * 0.03 + lit)));
      g.addColorStop(0.92, rgba(shade(col, 0.24 + lit)));
      g.addColorStop(1, rgba(shade(col, 0.1)));
      ctx.fillStyle = g;
      petalPath(ctx, x, y, len, wid, a); ctx.fill();
      // backlit rim on the petal edge
      if (r > 8 && lit > 0) {
        ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
        ctx.strokeStyle = `rgba(255,248,244,${(0.25 * lit / 0.13).toFixed(2)})`;
        ctx.lineWidth = Math.max(0.6, r * 0.018);
        ctx.stroke();
      }
    }
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
  const c = ctx.createRadialGradient(x, y, 0, x, y, r * 0.3);
  c.addColorStop(0, rgba(shade(col, -0.4))); c.addColorStop(1, rgba(shade(col, -0.05), 0));
  ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 6.3); ctx.fill();
}

function drawOrchid(ctx, x, y, r, f, rr, rot) {
  const base = mix(P.white[0], HAZE, f * 0.5);
  if (r < 2.5) { ctx.fillStyle = rgba(base); ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill(); return; }
  const tilt = rot * 0.15;
  const petals = [[-Math.PI / 2, 0.9, 0.32], [Math.PI / 2 + 0.6, 0.85, 0.3], [Math.PI / 2 - 0.6, 0.85, 0.3], [Math.PI + 0.15, 0.95, 0.62], [-0.15, 0.95, 0.62]];
  for (const [a, l, w] of petals) {
    const ang = a + tilt + (rr() - 0.5) * 0.15;
    const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * r * l, y + Math.sin(ang) * r * l);
    g.addColorStop(0, rgba(shade(base, -0.12))); g.addColorStop(0.5, rgba(base)); g.addColorStop(1, rgba(shade(base, -0.06)));
    if (r > 6) { ctx.shadowColor = 'rgba(60,50,40,0.22)'; ctx.shadowBlur = r * 0.25; ctx.shadowOffsetY = r * 0.06; }
    ctx.fillStyle = g; petalPath(ctx, x, y, r * l, r * w, ang); ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(160,150,140,0.18)'; ctx.lineWidth = Math.max(0.5, r * 0.015); ctx.stroke();
  }
  ctx.fillStyle = rgba(mix(hex('#b04a78'), HAZE, f * 0.5));
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.12, r * 0.14, r * 0.2, tilt, 0, 6.3); ctx.fill();
  ctx.fillStyle = rgba(mix(hex('#f0d36a'), HAZE, f * 0.5));
  ctx.beginPath(); ctx.arc(x, y - r * 0.02, r * 0.06, 0, 6.3); ctx.fill();
}

function drawHydrangea(ctx, x, y, r, col, rr) {
  const n = r > 8 ? 22 : 8;
  for (let k = 0; k < n; k++) {
    const a = rr() * 6.3, d = Math.sqrt(rr()) * r * 0.85;
    const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d * 0.85;
    const fr = r * 0.22;
    const lit = (y - fy) / r * 0.2;
    for (let p = 0; p < 4; p++) {
      const pa = p * Math.PI / 2 + a;
      ctx.fillStyle = rgba(shade(col, lit - 0.04 * (p % 2)));
      ctx.beginPath(); ctx.ellipse(fx + Math.cos(pa) * fr * 0.5, fy + Math.sin(pa) * fr * 0.5, fr * 0.55, fr * 0.4, pa, 0, 6.3); ctx.fill();
    }
  }
}

function drawLeaf(ctx, x, y, len, col, ang) {
  const g = ctx.createLinearGradient(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
  g.addColorStop(0, rgba(shade(col, -0.25))); g.addColorStop(0.6, rgba(col)); g.addColorStop(1, rgba(shade(col, 0.18)));
  ctx.fillStyle = g; petalPath(ctx, x, y, len, len * 0.24, ang); ctx.fill();
  if (len > 8) {
    ctx.strokeStyle = rgba(shade(col, 0.3), 0.5); ctx.lineWidth = Math.max(0.5, len * 0.015);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len * 0.95, y + Math.sin(ang) * len * 0.95); ctx.stroke();
  }
}

function drawFern(ctx, x, y, len, col, ang, rr) {
  const a0 = -Math.PI / 2 + Math.sin(ang) * 0.9;
  const steps = 12;
  let px = x, py = y, a = a0;
  for (let k = 0; k < steps; k++) {
    const seg = len / steps;
    const nx = px + Math.cos(a) * seg, ny = py + Math.sin(a) * seg;
    const lf = len * 0.22 * (1 - k / steps);
    if (lf > 1) {
      drawLeaf(ctx, nx, ny, lf, col, a - 1.2);
      drawLeaf(ctx, nx, ny, lf, shade(col, -0.08), a + 1.2);
    }
    px = nx; py = ny; a += 0.06 * Math.sign(Math.sin(ang) || 1) + (rr() - 0.5) * 0.05;
  }
}

function drawWisteria(ctx, proj, it, f) {
  const rr = rng(it.seed);
  const col = mix(P.lilac[Math.floor(it.tone * 3)], HAZE, f * 0.7);
  // a raceme: dense, tapering cascade of small two-lobed florets, fuller and
  // paler at the top, tighter and deeper-toned towards the tip
  const steps = 26;
  for (let k = 0; k < steps; k++) {
    const t = k / steps;
    const p = proj(it.x + Math.sin(t * 3 + it.tone * 6) * 0.02, it.y - t * it.len, it.z);
    if (!p) return;
    const width = 0.045 * (1 - t * 0.75) * p.s;
    const fr = 0.014 * (1 - t * 0.5) * p.s;
    if (fr < 0.5) continue;
    const per = t < 0.2 ? 6 : 4;
    for (let j = 0; j < per; j++) {
      const fx = p.x + (rr() - 0.5) * width * 2, fy = p.y + (rr() - 0.5) * fr * 1.4;
      const lit = -0.18 * t + (fx < p.x ? 0.08 : -0.06) + (rr() - 0.5) * 0.12;
      const c = shade(col, lit - (t > 0.8 ? 0.15 : 0));
      const a = rr() * 6.3;
      ctx.fillStyle = rgba(c);
      ctx.beginPath(); ctx.ellipse(fx - Math.cos(a) * fr * 0.35, fy, fr * 0.75, fr * 0.55, a, 0, 6.3); ctx.fill();
      ctx.fillStyle = rgba(shade(c, 0.18));
      ctx.beginPath(); ctx.ellipse(fx + Math.cos(a) * fr * 0.35, fy - fr * 0.1, fr * 0.6, fr * 0.45, a + 0.6, 0, 6.3); ctx.fill();
    }
  }
}

function drawPetals(ctx, proj, i, cam, open) {
  const gust = smooth(OPEN_START - 4, OPEN_END, i);
  for (const p of petals) {
    if (p.gust && gust <= 0) continue;
    const drift = p.gust ? gust * 6 : 0; // gust carries petals out of the door towards the camera
    const span = 7;
    const d = ((((p.z0 - cam.z * 0.35 - drift) % span) + span) % span) + 0.25;
    const y = ((((p.y0 - clock(i) * p.fall) % 2.2) + 2.2) % 2.2) - 1.05 + (p.gust ? 0.2 : 0);
    const x = p.x * (p.gust ? lerp(1, 0.35, 1 - gust) : 1) + Math.sin(clock(i) * 0.11 + p.ph) * p.sway;
    const q = proj(x, y, cam.z + d);
    if (!q) continue;
    const r = p.size * q.s;
    if (r < 0.6) continue;
    let a = smooth(0.25, 0.7, d) * smooth(span + 0.25, span - 0.8, d) * smooth(-1.05, -0.85, y) * smooth(1.15, 0.95, y);
    if (p.gust) a *= gust;
    ctx.filter = d < 1 ? `blur(${((1 - d) * 6).toFixed(1)}px)` : 'none';
    ctx.globalAlpha = a * 0.95;
    const ang = clock(i) * 0.09 + p.ph;
    const g = ctx.createLinearGradient(q.x - r, q.y, q.x + r, q.y);
    g.addColorStop(0, rgba(shade(p.col, -0.12))); g.addColorStop(1, rgba(shade(p.col, 0.2)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, r, r * (0.45 + 0.35 * Math.abs(Math.sin(ang))), ang, 0, 6.3); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.filter = 'none';
}

const grainTiles = [];
function grain(ctx, W, H, i) {
  if (!grainTiles.length) {
    for (let t = 0; t < 4; t++) {
      const c = createCanvas(256, 256), g = c.getContext('2d');
      const img = g.createImageData(256, 256), rr = rng(t + 99);
      for (let k = 0; k < img.data.length; k += 4) { const v = 128 + (rr() - 0.5) * 70; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; }
      g.putImageData(img, 0, 0); grainTiles.push(c);
    }
  }
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.07;
  ctx.fillStyle = ctx.createPattern(grainTiles[i % 4], 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- output
const SETS = [
  // rendered size, plus downscaled variants
  { name: 'lg', w: 1600, h: 900, from: 'landscape', quality: 78 },
  { name: 'sm', w: 960, h: 540, from: 'landscape', quality: 76 },
  { name: 'portrait', w: 720, h: 1280, from: 'portrait', quality: 76 },
];

async function main() {
  await fs.rm(OUT, { recursive: true, force: true });
  for (const s of SETS) await fs.mkdir(path.join(OUT, s.name), { recursive: true });
  const land = createCanvas(1600, 900), lctx = land.getContext('2d');
  const port = createCanvas(720, 1280), pctx = port.getContext('2d');
  const small = createCanvas(960, 540), sctx = small.getContext('2d');
  const t0 = Date.now();
  for (let i = 0; i < N; i++) {
    renderFrame(lctx, 1600, 900, i);
    renderFrame(pctx, 720, 1280, i);
    sctx.drawImage(land, 0, 0, 960, 540);
    const name = String(i + 1).padStart(PAD, '0') + '.webp';
    await fs.writeFile(path.join(OUT, 'lg', name), await land.encode('webp', 78));
    await fs.writeFile(path.join(OUT, 'sm', name), await small.encode('webp', 76));
    await fs.writeFile(path.join(OUT, 'portrait', name), await port.encode('webp', 76));
    if (i === 0) {
      await fs.writeFile(path.join(OUT, 'poster.webp'), await land.encode('webp', 82));
      await fs.writeFile(path.join(OUT, 'poster-portrait.webp'), await port.encode('webp', 80));
    }
    if (i === N - 1) {
      await fs.writeFile(path.join(OUT, 'poster-end.webp'), await land.encode('webp', 82));
      await fs.writeFile(path.join(OUT, 'poster-end-portrait.webp'), await port.encode('webp', 80));
    }
    process.stdout.write(`\rframe ${i + 1}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  const manifest = {
    provisional: true,
    note: 'Provisional procedural sequence. Replace with the photographic sequence (see ASSETS.md).',
    frameCount: N,
    pad: PAD,
    sets: SETS.map((s) => ({ name: s.name, width: s.w, height: s.h, path: `${s.name}/{i}.webp` })),
    posters: { start: 'poster.webp', end: 'poster-end.webp', startPortrait: 'poster-portrait.webp', endPortrait: 'poster-end-portrait.webp' },
    focus: { x: 0.5, y: 0.47 },
    markers: { arrive: ARRIVE, doorOpenStart: OPEN_START, doorOpenEnd: OPEN_END },
    rows: [32, 10],
  };
  await fs.writeFile(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\nwrote ${N} frames × ${SETS.length} sets to ${OUT}`);
}

const only = args.only !== undefined ? Number(args.only) : null;
if (only !== null) {
  // quick look at a single frame: --only 0 → scratch preview png
  const c = createCanvas(1600, 900);
  renderFrame(c.getContext('2d'), 1600, 900, only);
  const out = args.out ?? `frame-${only}.png`;
  await fs.writeFile(out, await c.encode('png'));
  const pc = createCanvas(720, 1280);
  renderFrame(pc.getContext('2d'), 720, 1280, only);
  await fs.writeFile(out.replace(/\.png$/, '-portrait.png'), await pc.encode('png'));
  console.log('wrote', out);
} else {
  await main();
}
