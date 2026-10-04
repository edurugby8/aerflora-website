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
  [1.75, FLOOR], [1.78, 0.2], [1.62, 0.7], [1.25, 1.02], [0.85, 1.16], [0, 1.2],
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
    // seats (two per side) – stored as items so they are depth sorted
    add({ kind: 'seat', side, x0: 0.5, x1: 1.08, z });
    add({ kind: 'seat', side, x0: 1.12, x1: 1.7, z });
    // flowers spilling over the seat backs
    cluster(side * 1.05, 0.2, z, { x: 0.6, y: 0.16, z: 0.22 }, 26, ['rose', 'rose', 'orchid', 'hydra', 'leaf', 'leaf', 'leaf', 'white']);
    // aisle edge ferns and low flowers
    cluster(side * 0.58, -0.75, z + 0.4, { x: 0.12, y: 0.3, z: 0.45 }, 12, ['fern', 'leaf', 'leaf', 'rose', 'white']);
    // overhead bins / upper wall
    cluster(side * 1.35, 0.85, z + 0.3, { x: 0.25, y: 0.16, z: 0.5 }, 20, ['rose', 'white', 'hydra', 'leaf', 'leaf', 'orchid']);
    // hanging wisteria
    for (let k = 0; k < 3; k++) add({ kind: 'wisteria', x: side * rand(0.55, 1.1), y: rand(0.98, 1.1), z: z + rand(0, ROW_PITCH), len: rand(0.25, 0.55), seed: Math.floor(R() * 1e9), tone: R() });
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
  cluster(side * 0.95, 0.0, D - 0.25, { x: 0.35, y: 1.05, z: 0.2 }, 260, ['rose', 'white', 'orchid', 'hydra', 'leaf', 'leaf', 'fern']);
  cluster(side * 0.7, -0.55, D - 0.5, { x: 0.12, y: 0.45, z: 0.35 }, 60, ['white', 'rose', 'leaf', 'fern']);
}
cluster(0, 1.0, D - 0.2, { x: 0.9, y: 0.14, z: 0.15 }, 110, ['rose', 'white', 'leaf', 'hydra']);

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

  // --- door leaves (behind the bulkhead plane)
  for (const side of [-1, 1]) {
    const hx = side * DOOR_W;
    const fx = hx - side * DOOR_W * Math.cos(openA);
    const fz = D + DOOR_W * Math.sin(openA);
    const pts = [[hx, FLOOR, D], [hx, DOOR_TOP, D], [fx, DOOR_TOP, fz], [fx, FLOOR, fz]].map((p) => proj(...p));
    if (pts.some((p) => !p)) continue;
    const lit = 0.06 + 0.12 * Math.sin(openA);
    let col = mix(shade(P.door, lit), HAZE, fog(D - cam.z) * 0.6);
    ctx.fillStyle = rgba(col);
    poly(ctx, pts); ctx.fill();
    // panel inset & porthole
    const inset = (u, v) => {
      const x = lerp(hx, fx, u), z = lerp(D, fz, u), y = lerp(FLOOR, DOOR_TOP, v);
      return proj(x, y, z);
    };
    ctx.strokeStyle = rgba(shade(col, -0.18), 0.6); ctx.lineWidth = Math.max(1, pts[0].s * 0.006);
    poly(ctx, [inset(0.12, 0.06), inset(0.12, 0.55), inset(0.88, 0.55), inset(0.88, 0.06)]); ctx.stroke();
    const port = [];
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * Math.PI * 2;
      port.push(inset(0.5 + Math.cos(a) * 0.3, 0.74 + Math.sin(a) * 0.092));
    }
    if (port.every(Boolean)) {
      ctx.fillStyle = rgba(shade(col, 0.55)); poly(ctx, port); ctx.fill();
      ctx.strokeStyle = rgba(shade(col, -0.25), 0.8); ctx.lineWidth = Math.max(1, pts[0].s * 0.012); ctx.stroke();
    }
    const h1 = inset(side > 0 ? 0.9 : 0.9, 0.48), h2 = inset(0.9, 0.53);
    if (h1 && h2) { ctx.strokeStyle = '#c8cbc4'; ctx.lineWidth = Math.max(1.5, pts[0].s * 0.02); ctx.beginPath(); ctx.moveTo(h1.x, h1.y); ctx.lineTo(h2.x, h2.y); ctx.stroke(); }
  }

  // --- bulkhead with door opening
  const ring = fullProfile().map(([x, y]) => proj(x, y, D));
  if (ring.every(Boolean)) {
    ctx.beginPath();
    poly(ctx, ring, false);
    const o = [[-DOOR_W, FLOOR], [-DOOR_W, DOOR_TOP - 0.08], [-DOOR_W + 0.08, DOOR_TOP], [DOOR_W - 0.08, DOOR_TOP], [DOOR_W, DOOR_TOP - 0.08], [DOOR_W, FLOOR]].map(([x, y]) => proj(x, y, D));
    poly(ctx, o.reverse(), false);
    ctx.fillStyle = rgba(mix(P.bulk, HAZE, fog(D - cam.z) * 0.7));
    ctx.fill('evenodd');
    // door frame trim
    ctx.strokeStyle = rgba(mix(shade(P.door, -0.1), HAZE, fog(D - cam.z) * 0.6));
    ctx.lineWidth = Math.max(2, o[0].s * 0.05);
    poly(ctx, o); ctx.stroke();
  }

  // --- fuselage shell (far to near)
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
      const ny = (ay + by) / 2;
      const base = ny > 0.95 ? P.ceil : P.wall;
      const lit = ny > 0.95 ? 0.08 : ny > 0.4 ? 0.0 : -0.06;
      ctx.fillStyle = rgba(mix(shade(base, lit), HAZE, fog(d)));
      poly(ctx, q); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke(); // hide seams
    }
    // floor: carpet aisle + darker sides
    for (const [xa, xb, c] of [[-1.75, -0.42, P.floor], [-0.42, 0.42, P.carpet], [0.42, 1.75, P.floor]]) {
      const q = [proj(xa, FLOOR, z0), proj(xb, FLOOR, z0), proj(xb, FLOOR, z1), proj(xa, FLOOR, z1)];
      if (q.some((p) => !p)) continue;
      ctx.fillStyle = rgba(mix(c, HAZE, fog(d) * 0.8));
      poly(ctx, q); ctx.fill(); ctx.strokeStyle = ctx.fillStyle; ctx.stroke();
    }
  }
  // windows + daylight spill on the walls
  for (const z of ROWS) {
    for (const side of [-1, 1]) {
      const wx = side * 1.77, wz = z + 0.35;
      if (wz - cam.z < 0.15) continue;
      const pts = [];
      for (let k = 0; k < 32; k++) {
        const a = (k / 32) * Math.PI * 2;
        pts.push(proj(wx, 0.32 + Math.sin(a) * 0.23, wz + Math.cos(a) * 0.16));
      }
      if (pts.some((p) => !p)) continue;
      const c = proj(wx, 0.32, wz);
      const glow = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.s * 0.75);
      glow.addColorStop(0, 'rgba(255,252,244,0.55)'); glow.addColorStop(1, 'rgba(255,252,244,0)');
      ctx.fillStyle = glow; ctx.fillRect(c.x - c.s, c.y - c.s, c.s * 2, c.s * 2);
      ctx.fillStyle = rgba(mix(hex('#e9eef0'), [255, 255, 255], 0.3));
      poly(ctx, pts); ctx.fill();
      ctx.strokeStyle = rgba(mix(hex('#d4cbb8'), HAZE, fog(c.d)));
      ctx.lineWidth = Math.max(1, c.s * 0.05); ctx.stroke();
    }
  }

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

function drawSeat(ctx, proj, s, f) {
  const sx = s.side;
  const xa = sx * s.x0, xb = sx * s.x1;
  const top = 0.14, bot = FLOOR + 0.25;
  const a = proj(Math.min(xa, xb), top, s.z), b = proj(Math.max(xa, xb), bot, s.z);
  if (!a || !b) return;
  const w = b.x - a.x, h = b.y - a.y, rad = Math.min(w, h) * 0.16;
  // aisle-side thickness
  const inner = sx > 0 ? Math.min(xa, xb) : Math.max(xa, xb);
  const t0 = proj(inner, top, s.z), t1 = proj(inner, top - 0.02, s.z + 0.22), t2 = proj(inner, bot, s.z + 0.22), t3 = proj(inner, bot, s.z);
  if (t0 && t1 && t2 && t3) {
    ctx.fillStyle = rgba(mix(shade(P.seat, -0.16), HAZE, f));
    poly(ctx, [t0, t1, t2, t3]); ctx.fill();
  }
  const g = ctx.createLinearGradient(0, a.y, 0, b.y);
  g.addColorStop(0, rgba(mix(P.seatHi, HAZE, f)));
  g.addColorStop(0.35, rgba(mix(P.seat, HAZE, f)));
  g.addColorStop(1, rgba(mix(shade(P.seat, -0.3), HAZE, f)));
  ctx.fillStyle = g;
  roundRect(ctx, a.x, a.y, w, h, rad); ctx.fill();
  // headrest cover and stitching
  ctx.fillStyle = rgba(mix(shade(P.seatHi, 0.25), HAZE, f), 0.9);
  roundRect(ctx, a.x + w * 0.12, a.y + h * 0.04, w * 0.76, h * 0.2, rad * 0.6); ctx.fill();
  ctx.strokeStyle = rgba(mix(shade(P.seat, -0.22), HAZE, f), 0.55);
  ctx.lineWidth = Math.max(0.6, a.s * 0.004);
  for (const u of [0.33, 0.66]) { ctx.beginPath(); ctx.moveTo(a.x + w * u, a.y + h * 0.3); ctx.lineTo(a.x + w * u, b.y); ctx.stroke(); }
  // contact shadow under the seat
  const sh = proj((xa + xb) / 2, FLOOR, s.z + 0.15);
  if (sh) {
    const r = Math.abs(w) * 0.7;
    const gr = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, r);
    gr.addColorStop(0, 'rgba(25,30,20,0.35)'); gr.addColorStop(1, 'rgba(25,30,20,0)');
    ctx.fillStyle = gr; ctx.fillRect(sh.x - r, sh.y - r * 0.4, r * 2, r * 0.8);
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
