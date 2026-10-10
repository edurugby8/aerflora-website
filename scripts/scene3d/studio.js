// Bouquet "photo studio", path traced with three-gpu-pathtracer.
// A seamless paper sweep, a large softbox key light, a white bounce card for
// fill and a small back light for rim and petal translucency; a physical
// camera with real depth of field; then AgX tone mapping, lens vignette and
// fine grain. Everything is built at real scale, in metres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { WebGLPathTracer, PhysicalCamera, ProceduralEquirectTexture } from 'three-gpu-pathtracer';
import { BLOOMS, FILLERS } from './botany.js';
import * as TX from './textures.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

// bloom radius (m) and stem radius/colour per flower
const RADIUS = { rosa: 0.045, peonia: 0.058, ranunculo: 0.033, tulipan: 0.03, anemona: 0.038, cosmos: 0.036, gerbera: 0.05, margarita: 0.03, cala: 0.04 };
const STEM = {
  rosa: [0.0032, '#3f5a2f'], peonia: [0.0038, '#4f6338'], ranunculo: [0.0028, '#536b37'], tulipan: [0.0038, '#6f8a52'],
  anemona: [0.0027, '#4f6338'], cosmos: [0.0017, '#4f6b35'], gerbera: [0.0033, '#5d7541'], margarita: [0.002, '#4a6533'], cala: [0.0048, '#5d7d40'],
};

// ------------------------------------------------------------------ textures
const TEX = {};
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makeTextures() {
  TEX.petal = TX.petal(3);
  TEX.fan = TEX.petal;
  // nearly even petals with faint veins, for flowers made of many nested petals
  TEX.soft = canvasTex(128, 256, (g, W, H) => {
    const r = TX.rng(13);
    const gr = g.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, '#f1ece8'); gr.addColorStop(0.3, '#fbf9f7'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 24; k++) {
      const a = (k / 23 - 0.5) * 1.2;
      g.strokeStyle = `rgba(170,150,150,${0.025 + r() * 0.03})`; g.lineWidth = 0.6 + r() * 0.5;
      g.beginPath(); g.moveTo(W / 2, H); g.quadraticCurveTo(W / 2 + Math.sin(a) * W * 0.4, H * 0.5, W / 2 + Math.sin(a) * W * 0.6, H * 0.08); g.stroke();
    }
  });
  // fine parallel veins (tulip, calla, daisy, gerbera, cosmos)
  TEX.parallel = canvasTex(128, 256, (g, W, H) => {
    const r = TX.rng(21);
    const gr = g.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, '#e6e0dc'); gr.addColorStop(0.25, '#f7f4f2'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let k = 0; k < 46; k++) {
      const x = (k / 45) * W, w = (r() - 0.5) * 6;
      g.strokeStyle = `rgba(150,128,130,${0.04 + r() * 0.05})`; g.lineWidth = 0.5 + r() * 0.8;
      g.beginPath(); g.moveTo(W / 2 + (x - W / 2) * 0.35, H); g.quadraticCurveTo(x + w, H * 0.5, x + w * 1.5, 0); g.stroke();
    }
  });
  TEX.leaf = TX.leaf('#5d7444', 4);
  TEX.kraft = canvasTex(512, 512, (g, S) => {
    const r = TX.rng(77);
    g.fillStyle = '#c9a77b'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 14000; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '96,66,38' : '238,218,186'},${0.04 + r() * 0.06})`; g.fillRect(r() * S, r() * S, 1 + r() * 7, 1); }
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(120,86,52,${0.03 + r() * 0.04})`; g.fillRect(0, r() * S, S, 1 + r() * 3); }
  });
  TEX.paper = canvasTex(512, 512, (g, S) => {
    const r = TX.rng(5);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 30; k++) {
      const x = r() * S, y = r() * S, rad = 40 + r() * 160;
      const m = g.createRadialGradient(x, y, 0, x, y, rad);
      m.addColorStop(0, `rgba(120,110,100,${0.02 + r() * 0.025})`); m.addColorStop(1, 'rgba(120,110,100,0)');
      g.fillStyle = m; g.fillRect(0, 0, S, S);
    }
  });
  // crumpled paper: creases as a height field, turned into a normal map
  TEX.crinkle = (() => {
    const S = 512, r = TX.rng(31);
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d');
    g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
    g.filter = 'blur(2px)';
    for (let k = 0; k < 160; k++) {
      const x = r() * S, y = r() * S, a = r() * Math.PI, l = 40 + r() * 220;
      g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${0.06 + r() * 0.12})`; g.lineWidth = 2 + r() * 8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    g.filter = 'none';
    const src = g.getImageData(0, 0, S, S).data, out = g.createImageData(S, S);
    const h = (x, y) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 6, dy = (h(x, y + 1) - h(x, y - 1)) * 6, l = Math.hypot(dx, dy, 1), k = (y * S + x) * 4;
      out.data[k] = (-dx / l * 0.5 + 0.5) * 255; out.data[k + 1] = (dy / l * 0.5 + 0.5) * 255; out.data[k + 2] = (1 / l * 0.5 + 0.5) * 255; out.data[k + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    return new THREE.CanvasTexture(c);
  })();
  TEX.wood = canvasTex(512, 512, (g, S) => {
    const r = TX.rng(9);
    g.fillStyle = '#8a6646'; g.fillRect(0, 0, S, S);
    for (let k = 0; k < 220; k++) {
      const y = r() * S; g.strokeStyle = `rgba(${r() < 0.5 ? '60,40,24' : '170,130,92'},${0.08 + r() * 0.12})`; g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= S; x += 32) g.lineTo(x, y + Math.sin(x * 0.012 + k) * 4 + (r() - 0.5) * 2);
      g.stroke();
    }
  });
}

// ------------------------------------------------------------------ materials
const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
// real surfaces never reflect all the light: keep albedo under ~0.82
function albedo(hex) {
  const c = new THREE.Color(hex);
  const m = Math.max(c.r, c.g, c.b);
  if (m > 0.82) c.multiplyScalar(0.82 / m);
  return c;
}
function jitter(hex, rand, amt = 1) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h + (rand() - 0.5) * 0.024 * amt, clamp(hsl.s + (rand() - 0.5) * 0.12 * amt, 0, 1), clamp(hsl.l + (rand() - 0.5) * 0.07 * amt, 0, 0.97));
  return '#' + c.getHexString();
}
// small flowers drawn as one colour (lavender, gypsophila)
function petalMat(hex) {
  return once('petal' + hex, () => {
    const c = albedo(hex);
    return new THREE.MeshPhysicalMaterial({
      color: c, map: TEX.petal, vertexColors: true, side: THREE.DoubleSide,
      roughness: 0.6, specularIntensity: 0.3, ior: 1.4,
      sheen: 0.45, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.55),
      transmission: 0.3, thickness: 0,
    });
  });
}
const leafMat = (hex, map = null, k = {}) => once(`leaf${hex}${map ? 1 : 0}${JSON.stringify(k)}`, () => new THREE.MeshPhysicalMaterial({
  color: albedo(hex), map, side: THREE.DoubleSide, roughness: 0.5, specularIntensity: 0.45, ior: 1.4,
  transmission: 0.12, thickness: 0, ...k,
}));
const solid = (hex, roughness = 0.6, k = {}) => once(`solid${hex}${roughness}${JSON.stringify(k)}`, () => new THREE.MeshStandardMaterial({ color: albedo(hex), roughness, ...k }));
const glassMat = () => once('glass', () => new THREE.MeshPhysicalMaterial({
  color: '#ffffff', metalness: 0, roughness: 0.015, ior: 1.5, transmission: 1, thickness: 0.006,
  attenuationColor: new THREE.Color('#d9ebe1'), attenuationDistance: 0.18, specularIntensity: 1,
}));
const thinGlassMat = () => once('thinglass', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.01, ior: 1.5, transmission: 1, thickness: 0, side: THREE.DoubleSide }));
const waterMat = () => once('water', () => new THREE.MeshPhysicalMaterial({
  color: '#ffffff', roughness: 0.0, ior: 1.333, transmission: 1, thickness: 0.05,
  attenuationColor: new THREE.Color('#e9f2ec'), attenuationDistance: 0.6,
}));
const satinMat = (hex) => once('satin' + hex, () => new THREE.MeshPhysicalMaterial({
  color: albedo(hex), roughness: 0.32, specularIntensity: 0.7, sheen: 0.8, sheenRoughness: 0.3, sheenColor: new THREE.Color('#ffffff'), side: THREE.DoubleSide,
}));
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);

// ------------------------------------------------------------------ flower heads
// petals carry their colour in the vertices; the material only describes the surface
const PETAL_KIND = {
  velvet: { roughness: 0.62, sheen: 0.45, sheenRoughness: 0.5, transmission: 0.22, specularIntensity: 0.22, tex: 'fan' },
  satin: { roughness: 0.46, sheen: 0.3, sheenRoughness: 0.45, transmission: 0.3, specularIntensity: 0.32, tex: 'fan' },
  // many thin nested petals: light has to get through them, as it does in a real ranunculus or peony
  // (kept only slightly translucent: deep, many-layered blooms would otherwise lose light inside)
  layered: { roughness: 0.52, sheen: 0.22, sheenRoughness: 0.5, transmission: 0.16, specularIntensity: 0.28, tex: 'soft' },
  wax: { roughness: 0.32, sheen: 0.1, sheenRoughness: 0.5, transmission: 0.2, specularIntensity: 0.5, tex: 'parallel' },
  thin: { roughness: 0.55, sheen: 0.2, sheenRoughness: 0.55, transmission: 0.4, specularIntensity: 0.28, tex: 'parallel' },
  matte: { roughness: 0.66, sheen: 0.22, sheenRoughness: 0.6, transmission: 0.25, specularIntensity: 0.2, tex: 'parallel' },
};
const petalKindMat = (kind) => once('pk' + kind, () => {
  const k = PETAL_KIND[kind] ?? PETAL_KIND.satin;
  return new THREE.MeshPhysicalMaterial({
    color: '#ffffff', map: TEX[k.tex], vertexColors: true, side: THREE.DoubleSide, roughness: k.roughness, specularIntensity: k.specularIntensity, ior: 1.4,
    sheen: k.sheen, sheenRoughness: k.sheenRoughness, sheenColor: new THREE.Color(0.6, 0.6, 0.6), transmission: k.transmission, thickness: 0,
  });
});
const plantMat = () => once('plant', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: 0.62, specularIntensity: 0.3, side: THREE.DoubleSide }));

function buildHead(h, rand, seed) {
  const g = new THREE.Group();
  const b = (BLOOMS[h.type] ?? BLOOMS.rosa)(seed, h.open, h.color);
  g.add(mesh(b.petals, petalKindMat(b.mat)));
  for (const p of b.parts ?? []) g.add(mesh(p.geo, plantMat()));
  // green receptacle and sepals under the bloom
  const sc = (STEM[h.type] ?? STEM.rosa)[1];
  const rr = RADIUS[h.type] ?? 0.04;
  g.add(mesh(new THREE.SphereGeometry(rr * 0.17, 14, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58).translate(0, rr * 0.05, 0), solid(sc, 0.55)));
  if (h.type === 'rosa' || h.type === 'peonia' || h.type === 'ranunculo') {
    const sep = [];
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + rand();
      sep.push(new THREE.ConeGeometry(rr * 0.07, rr * 0.55, 4, 1).translate(0, rr * 0.27, 0).rotateX(Math.PI * 0.62 + rand() * 0.25).rotateY(a).translate(0, -rr * 0.02, 0));
    }
    g.add(mesh(mergeGeometries(sep), solid(sc, 0.6)));
  }
  g.scale.setScalar(h.s);
  g.position.copy(h.pos);
  g.quaternion.setFromUnitVectors(UP, h.dir.clone().normalize());
  // callas show their open side to the camera; everything else turns freely
  g.rotateY(b.facing ? (rand() - 0.5) * 0.8 : rand() * Math.PI * 2);
  return g;
}

// ------------------------------------------------------------------ layouts
// Every layout returns heads { type, pos, dir, s, open } around the binding point B.
function pickTypes(recipe, n, rand) {
  const types = recipe.flowers.length ? recipe.flowers : ['rosa'];
  const out = [];
  for (let k = 0; k < n; k++) out.push(types[k % types.length]);
  for (let k = out.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [out[k], out[j]] = [out[j], out[k]]; }
  return out;
}
const FLAT = new Set(['margarita', 'gerbera', 'cosmos', 'anemona']);
const avgRadius = (types) => types.reduce((a, t) => a + (RADIUS[t] ?? 0.04), 0) / types.length;

function layout(recipe, rand, B) {
  const n = recipe.count;
  const types = pickTypes(recipe, n, rand);
  const r0 = avgRadius(types);
  const heads = [];
  const open = () => 0.35 + rand() * 0.55;
  const add = (type, pos, dir, s = 1, o = open()) => heads.push({ type, pos, dir: dir.normalize(), s, open: o });
  switch (recipe.arrangement) {
    case 'dome':
    case 'cascade':
    case 'cloche': {
      const R = r0 * Math.sqrt(0.95 * n) * (recipe.arrangement === 'cloche' ? 0.95 : 1.06);
      const C = B.clone().add(V(0, (recipe.stemLength ?? 0.27) - R, 0));
      const maxPolar = recipe.arrangement === 'cloche' ? 1.05 : 1.2;
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n;
        const polar = Math.acos(1 - t * (1 - Math.cos(maxPolar)));
        const az = k * 2.39996 + rand() * 0.3;
        const dir = V(Math.sin(polar) * Math.cos(az), Math.cos(polar), Math.sin(polar) * Math.sin(az));
        const size = (RADIUS[types[k]] ?? r0) / r0;
        add(types[k], C.clone().add(dir.clone().multiplyScalar(R * (0.96 + rand() * 0.08))), dir.clone().add(V((rand() - 0.5) * 0.15, 0, (rand() - 0.5) * 0.15)), (0.9 + rand() * 0.2) * Math.pow(size, 0.15));
      }
      // (a bridal cascade trails greenery, added with the fillers)
      heads.dome = { C, R };
      break;
    }
    case 'wild': {
      // a loose cluster: upright in the middle, leaning out at the edges, some heads higher
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        const az = k * 2.39996 + (rand() - 0.5) * 0.5;
        const elev = 0.1 + 0.62 * Math.sqrt(f) + (rand() - 0.5) * 0.08;
        let L = (recipe.stemLength ?? 0.21) * (0.86 + rand() * 0.3) * (1 - 0.18 * f);
        if (Math.sin(az) < 0) L *= 1.06; // taller at the back
        const d = V(Math.sin(elev) * Math.cos(az), Math.cos(elev), Math.sin(elev) * Math.sin(az));
        add(types[k], B.clone().add(d.clone().multiplyScalar(L)), d.clone().multiplyScalar(0.7).add(V(0, 0.55, 0.3)), 0.92 + rand() * 0.2);
      }
      break;
    }
    case 'line': {
      for (let k = 0; k < n; k++) {
        const f = n === 1 ? 0 : k / (n - 1) - 0.5;
        const lean = f * 0.62 + (rand() - 0.5) * 0.1;
        const L = (recipe.stemLength ?? 0.36) * (0.72 + ((k * 0.618) % 1) * 0.42);
        const d = V(Math.sin(lean), Math.cos(lean), (rand() - 0.5) * 0.18).normalize();
        add(types[k], B.clone().add(d.clone().multiplyScalar(L)), d.clone().add(V(0, 0.15, 0.45)), 1 + rand() * 0.08);
      }
      break;
    }
    case 'low': {
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        const x = (f - 0.5) * 0.62 + (rand() - 0.5) * 0.03, z = (rand() - 0.5) * 0.16 + (k % 2 ? 0.04 : -0.04);
        const y = 0.085 + 0.07 * (1 - Math.pow(x / 0.34, 2)) + rand() * 0.02;
        add(types[k], B.clone().add(V(x, y, z)), V(x * 2.2, 1, z * 2 + 0.35), 0.92 + rand() * 0.18);
      }
      break;
    }
    case 'single': {
      const [first, second = first] = recipe.flowers;
      add(first, B.clone().add(V(-0.012, 0.26, 0.01)), V(-0.15, 1, 0.5), 1.12, 0.55);
      if (n > 1) add(second, B.clone().add(V(0.035, 0.19, 0.02)), V(0.5, 1, 0.5), 0.9, 0.5);
      break;
    }
    case 'specimen': {
      types.forEach((t, k) => add(t, V((k - (n - 1) / 2) * 0.11, B.y, 0), V(...(recipe.face ?? [0, 0.55, 1])), 1, 0.65));
      break;
    }
  }
  // flat flowers (daisies, gerberas, cosmos, anemones) turn their faces towards the camera, as a florist would
  // (round flowers on loose stems are turned a little too, so they don't show only their backs)
  const toCam = V(0, 0.38, 0.92).normalize();
  heads.forEach((h) => {
    if (recipe.arrangement === 'specimen') return;
    if (FLAT.has(h.type)) h.dir.lerp(toCam, 0.55).normalize();
    else if (['wild', 'line'].includes(recipe.arrangement) && ['ranunculo', 'rosa', 'peonia'].includes(h.type)) h.dir.lerp(toCam, 0.35).normalize();
  });
  // some roses, peonies and ranunculus are still in bud
  heads.forEach((h) => { if (['rosa', 'peonia', 'ranunculo'].includes(h.type) && recipe.arrangement !== 'specimen' && rand() < 0.16) { h.open = 0.08; h.s *= 0.78; } });
  // colours: per flower type when given, otherwise from the palette
  heads.forEach((h, i) => {
    const list = recipe.tints?.[h.type] ?? recipe.colors;
    h.color = jitter(list[(i * 7 + Math.floor(rand() * 3)) % list.length], rand);
  });
  return heads;
}

// ------------------------------------------------------------------ vessels and wraps
const lathe = (profile, mat, segs = 72) => mesh(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), segs), mat);

// closed glass wall: up the outside, over the rim, down the inside
function glassVessel({ r, h, wall = 0.0035, base = 0.012, round = 0.008, lip = 0, neck = null }) {
  const p = [[0, 0]];
  for (let k = 0; k <= 6; k++) { const a = (k / 6) * Math.PI / 2; p.push([r - round + Math.sin(a) * round, round - Math.cos(a) * round]); }
  if (neck) { // bud vase: bulb, then a narrow neck
    p.push([r, h * 0.42], [r * 0.82, h * 0.62], [neck, h * 0.8], [neck, h - 0.004], [neck + lip, h]);
    p.push([neck - wall * 0.5, h + 0.0015], [neck - wall, h - 0.002], [neck - wall, h * 0.8], [r * 0.82 - wall, h * 0.62], [r - wall, h * 0.42], [r - wall, base + round * 0.6]);
  } else {
    p.push([r, h - 0.004 - lip * 2], [r + lip, h - 0.002], [r - wall * 0.5, h + 0.0012], [r - wall, h - 0.002], [r - wall, base + round * 0.7]);
  }
  const rr = round * 0.7;
  for (let k = 0; k <= 5; k++) { const a = (k / 5) * Math.PI / 2; p.push([r - wall - rr + Math.cos(a) * rr, base + rr - Math.sin(a) * rr]); }
  p.push([0, base]);
  return lathe(p, glassMat());
}
const water = (r, y0, y1) => mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 64, 1).translate(0, (y0 + y1) / 2, 0), waterMat());

/** Paper cone around the stems, sized to the flowers: three tissue sheets or two kraft sheets. */
function wrapSheets(B, kind, colour, rand, hb) {
  const group = new THREE.Group();
  const isK = kind === 'kraft';
  const mat = isK
    ? once('kraft', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', map: TEX.kraft, normalMap: TEX.crinkle, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.88, side: THREE.DoubleSide, specularIntensity: 0.3 }))
    : once('tissue' + colour, () => new THREE.MeshPhysicalMaterial({
      color: albedo(colour), normalMap: TEX.crinkle, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 1, side: THREE.DoubleSide, specularIntensity: 0.12,
      transmission: 0.12, thickness: 0,
    }));
  // the collar reaches half way up the flowers at the back and stays low in front
  const rTop = ((hb.max.x - hb.min.x) / 2) * 0.82 + 0.03;
  const backY = hb.min.y + (hb.max.y - hb.min.y) * 0.3, frontY = hb.min.y - 0.015;
  const sheets = isK ? [[-0.2, 3.6, 0], [2.9, 3.0, 1]] : [[-1.0, 2.6, 0], [1.2, 2.6, 1], [3.3, 2.5, 2]];
  sheets.forEach(([start, span, i]) => {
    const SU = 90, SV = 40;
    const pos = [], uv = [], idx = [];
    const phase = rand() * 10, phase2 = rand() * 10;
    const tri = (x) => Math.abs(((x / Math.PI) % 2 + 2) % 2 - 1) * 2 - 1; // crisp crease profile for kraft
    const yB = B.y - 0.22, yN = B.y - 0.005;
    for (let j = 0; j <= SV; j++) {
      const v = j / SV;
      for (let u = 0; u <= SU; u++) {
        const t = u / SU, th = start + t * span; // th = 0 faces the camera (+z)
        const front = 0.5 + 0.5 * Math.cos(th); // lower in front so the flowers show
        // a square sheet folded round the bouquet: its corner rises to a point mid-sheet
        const corner = Math.pow(1 - Math.abs(2 * t - 1), 1.6);
        const topY = lerp(backY, frontY, front) + i * 0.012 + corner * (isK ? 0.05 : 0.07) - (1 - corner) * 0.01 + Math.sin(t * 5 + phase) * 0.004;
        // below the neck: a tight cone to the stem ends; above: a flaring collar
        const y = v < 0.3 ? lerp(yB, yN, v / 0.3) : lerp(yN, topY, (v - 0.3) / 0.7);
        const above = Math.max(0, (v - 0.3) / 0.7);
        let r = v < 0.3 ? lerp(0.028, 0.022, v / 0.3) : 0.022 + Math.pow(above, 0.8) * (rTop - 0.022 + i * 0.01) + Math.pow(above, 5) * 0.015;
        // gathered into tight pleats at the tie, relaxing towards the top
        r += Math.sin(th * (isK ? 14 : 18) + phase) * 0.004 * Math.pow(1 - above, 2.2);
        // a few broad, soft folds across the open collar (crisper creases for kraft)
        const broad = isK ? tri(th * 2.6 + phase2) * 0.01 : Math.sin(th * 2.6 + phase2 + above * 1.5) * 0.012 + Math.sin(th * 5.3 + phase * 0.7) * 0.005;
        r += broad * Math.pow(above, 1.3);
        r += Math.sin(th * 41 + y * 60 + i) * 0.0012 + Math.sin(th * 97 - y * 140) * 0.0006;
        r += i * 0.004;
        pos.push(Math.sin(th) * r, y, Math.cos(th) * r);
        uv.push(t, v);
      }
    }
    for (let j = 0; j < SV; j++) for (let u = 0; u < SU; u++) {
      const a = j * (SU + 1) + u, b = a + 1, c = a + SU + 1, d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    group.add(mesh(g, mat));
  });
  return group;
}

function tie(B, bundle, kind, colour, rand) {
  const group = new THREE.Group();
  if (kind === 'twine') {
    const m = solid('#ad8a5c', 0.95);
    for (let k = 0; k < 5; k++) {
      const t = mesh(new THREE.TorusGeometry(bundle + 0.0022, 0.0016, 8, 48), m);
      t.rotation.set(Math.PI / 2 + (rand() - 0.5) * 0.12, 0, (rand() - 0.5) * 0.12);
      t.position.set(0, B.y + (k - 2) * 0.0034, 0);
      group.add(t);
    }
    const tails = [[V(bundle, B.y, 0.006), V(bundle + 0.018, B.y - 0.03, 0.02), V(bundle + 0.012, B.y - 0.075, 0.03)], [V(bundle, B.y, 0.004), V(bundle + 0.006, B.y - 0.04, 0.026), V(bundle - 0.004, B.y - 0.09, 0.034)]];
    tails.forEach((p) => group.add(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p), 24, 0.0016, 6), m)));
  } else {
    // satin ribbon as flat bands: a wrap round the neck, a bow with two loops and two tails
    const m = satinMat(colour);
    const W = 0.016, z0 = bundle + 0.005, k = V(0, B.y, z0);
    group.add(mesh(new THREE.CylinderGeometry(bundle + 0.003, bundle + 0.003, W, 48, 1, true).translate(0, B.y, 0), m));
    for (const s of [-1, 1]) {
      const j = (rand() - 0.5) * 0.004;
      const loop = [k, k.clone().add(V(s * 0.012, 0.012 + j, 0.004)), k.clone().add(V(s * 0.03, 0.015, 0.008)), k.clone().add(V(s * 0.04, 0.002, 0.008)), k.clone().add(V(s * 0.03, -0.01, 0.006)), k.clone().add(V(s * 0.012, -0.006, 0.003)), k.clone().add(V(0, -0.001, 0))];
      group.add(mesh(strip(loop, W * 0.9, V(0, 0, 1), 0, 48), m));
      const tail = [k.clone().add(V(s * 0.003, -0.004, 0.002)), k.clone().add(V(s * 0.012, -0.04, 0.008)), k.clone().add(V(s * 0.016 + j, -0.08, 0.012)), k.clone().add(V(s * 0.012, -0.12, 0.016))];
      group.add(mesh(strip(tail, W * 0.9, V(1, 0, 0), s * 0.6, 40), m));
    }
    group.add(mesh(new THREE.CylinderGeometry(0.0075, 0.0075, W * 0.75, 24, 1, false).rotateX(Math.PI / 2).scale(1, 0.85, 0.5).translate(0, B.y, z0 + 0.002), m));
  }
  return group;
}

/** A flat band of given width swept along points; `across` sets the band's width direction. */
function strip(points, width, across, twist = 0, segs = 40) {
  const curve = new THREE.CatmullRomCurve3(points);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const w = across.clone().addScaledVector(tan, -across.dot(tan)).normalize().applyAxisAngle(tan, twist * t);
    for (const s of [-0.5, 0.5]) { const q = p.clone().addScaledVector(w, s * width); pos.push(q.x, q.y, q.z); uv.push(s + 0.5, t); }
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ bouquet
const VESSELS = {
  jar: { r: 0.058, h: 0.15, wall: 0.0038, base: 0.014, round: 0.01, lip: 0.0015, waterTo: 0.105, above: 0.025 },
  cylinder: { r: 0.044, h: 0.25, wall: 0.0035, base: 0.02, round: 0.006, lip: 0, waterTo: 0.17, above: 0.012 },
  bud: { r: 0.046, h: 0.15, wall: 0.003, base: 0.012, round: 0.012, lip: 0.0015, neck: 0.011, waterTo: 0.07, above: 0.006 },
};

function buildBouquet(recipe) {
  const rand = TX.rng(recipe.seed);
  const group = new THREE.Group();
  const vessel = VESSELS[recipe.vessel];
  const wrapped = ['tissue', 'kraft', 'ribbon'].includes(recipe.vessel);
  const B = vessel ? V(0, vessel.h + vessel.above, 0)
    : wrapped ? V(0, 0.8, 0)
      : recipe.vessel === 'tray' ? V(0, 0.03, 0)
        : recipe.vessel === 'cloche' ? V(0, 0.05, 0)
          : V(0, recipe.y ?? 0.35, 0);
  const heads = layout(recipe, rand, B);
  const hb = new THREE.Box3();
  heads.forEach((h) => { const r = (RADIUS[h.type] ?? 0.04) * h.s; hb.expandByPoint(h.pos.clone().addScalar(r)); hb.expandByPoint(h.pos.clone().addScalar(-r)); });
  group.userData = { heads: hb, B };
  const stemsBy = new Map(); // colour → geometries
  const addStem = (colour, geo) => { if (!stemsBy.has(colour)) stemsBy.set(colour, []); stemsBy.get(colour).push(geo); };
  const nStems = heads.length + (recipe.fillers?.length ? 6 : 0);
  const bundle = Math.max(0.008, Math.sqrt(nStems) * 0.0036);
  let slot = 0;
  const slotAt = () => { const k = slot++; const rr = bundle * 0.85 * Math.sqrt((k + 0.5) / nStems); return V(Math.cos(k * 2.4) * rr, 0, Math.sin(k * 2.4) * rr); };
  // where a stem ends below the binding: straight on through the tie, splayed inside the vessel
  const below = (through, dirUp) => {
    if (recipe.arrangement === 'specimen' || ['tray', 'cloche'].includes(recipe.vessel)) return null;
    const d = dirUp.clone().negate();
    if (vessel) {
      const yEnd = vessel.base + 0.004, t = (through.y - yEnd) / Math.max(0.2, -d.y);
      const end = through.clone().add(d.multiplyScalar(t)); end.y = yEnd;
      const lim = (vessel.neck ? vessel.r * 0.8 : vessel.r - vessel.wall) - 0.006;
      const hr = Math.hypot(end.x, end.z); if (hr > lim) { end.x *= lim / hr; end.z *= lim / hr; }
      return [end];
    }
    if (recipe.vessel === 'ribbon') { const e = through.clone().add(d.multiplyScalar(0.15)); e.y = B.y - 0.15; e.x *= 0.6; e.z *= 0.6; return [e]; }
    // inside a paper cone: the stems stay bundled
    const e = through.clone().add(d.multiplyScalar(0.2)); e.y = B.y - 0.2;
    const hr = Math.hypot(e.x, e.z); if (hr > 0.012) { e.x *= 0.012 / hr; e.z *= 0.012 / hr; }
    return [e];
  };

  heads.forEach((h, i) => {
    group.add(buildHead(h, rand, recipe.seed * 7 + i * 13));
    if (recipe.arrangement === 'specimen') return;
    const [sr, sc] = STEM[h.type] ?? STEM.rosa;
    const base = h.pos.clone().sub(h.dir.clone().multiplyScalar((RADIUS[h.type] ?? 0.04) * 0.06 * h.s));
    const through = B.clone().add(slotAt());
    const dist = base.distanceTo(through);
    // stems are never ruler-straight: a gentle sideways bow between head and tie
    const p1 = base.clone().sub(h.dir.clone().multiplyScalar(dist * 0.3));
    const mid = p1.clone().lerp(through, 0.5).add(V((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.02));
    const pts = [base, p1, mid, through, ...(below(through, mid.clone().sub(through).normalize()) ?? [])];
    if (recipe.vessel === 'tray') pts.splice(2, 1, base.clone().lerp(B, 0.8).setY(B.y + 0.02));
    addStem(sc, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, sr * h.s, 8, false));
  });

  // foliage and fillers, fanning out from the binding point
  const fillers = recipe.fillers ?? [];
  const nF = fillers.length ? (recipe.fillerCount ?? Math.round(3 + heads.length * 0.6)) : 0;
  for (let k = 0; k < nF; k++) {
    const type = fillers[k % fillers.length];
    const tall = type === 'espigas' || type === 'lavanda' || type === 'paniculata';
    const base = recipe.stemLength ?? 0.3;
    let len = (type === 'espigas' ? base * 1.25 : tall ? base * 1.05 : base * 0.95) * (0.82 + rand() * 0.3);
    const az = (k / nF) * Math.PI * 2 + rand() * 0.7;
    let spread = tall ? 0.18 + rand() * 0.3 : 0.45 + rand() * 0.45;
    if (recipe.arrangement === 'line') spread *= 0.55;
    if (recipe.arrangement === 'low') { spread = 1.15 + rand() * 0.3; len *= 0.75; }
    if (recipe.arrangement === 'cascade' && k % 3 === 0) { spread = 2.0 + rand() * 0.4; len *= 1.25; }
    if (recipe.vessel === 'cloche') len *= 0.5;
    let d = V(Math.sin(spread) * Math.cos(az), Math.cos(spread), Math.sin(spread) * Math.sin(az));
    // a dome is framed by foliage: from the tie up through the bouquet and out past its rim
    if (heads.dome && !tall && !(recipe.arrangement === 'cascade' && k % 3 === 0)) {
      const { C, R } = heads.dome, polar = 1.0 + rand() * 0.35;
      const rim = C.clone().add(V(Math.sin(polar) * Math.cos(az), Math.cos(polar), Math.sin(polar) * Math.sin(az)).multiplyScalar(R));
      d = rim.clone().sub(B).normalize();
      len = rim.distanceTo(B) + 0.05 + rand() * 0.04;
    }
    const f = FILLERS[type](recipe.seed * 31 + k, len);
    const sprig = new THREE.Group();
    sprig.add(mesh(f.stem, solid(f.stemColor, 0.6)));
    const leafM = type === 'paniculata' ? petalMat('#f4f2ea') : type === 'lavanda' ? petalMat(f.leafColor)
      : type === 'espigas' ? leafMat(f.leafColor, null, { transmission: 0.2, roughness: 0.65 })
        : type === 'eucalipto' ? leafMat(f.leafColor, null, { roughness: 0.66, sheen: 0.35, sheenRoughness: 0.7, sheenColor: new THREE.Color('#c8d2cd') })
          : leafMat(f.leafColor, null, { roughness: 0.42, specularIntensity: 0.55 });
    sprig.add(mesh(f.leaves, leafM));
    const through = B.clone().add(slotAt());
    sprig.position.copy(through);
    sprig.quaternion.setFromUnitVectors(UP, d);
    sprig.rotateY(rand() * Math.PI * 2);
    group.add(sprig);
    const end = below(through, d);
    if (end) addStem(f.stemColor, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([through.clone().add(d.clone().multiplyScalar(0.01)), through, ...end]), 16, 0.0018, 6, false));
  }
  for (const [c, geos] of stemsBy) group.add(mesh(mergeGeometries(geos), solid(c, 0.5)));

  // vessel, wrap and tie
  if (vessel) {
    group.add(glassVessel(vessel));
    if (vessel.neck) group.add(water(vessel.r * 0.8 - vessel.wall - 0.004, vessel.base + 0.001, vessel.waterTo));
    else group.add(water(vessel.r - vessel.wall - 0.0006, vessel.base + 0.0008, vessel.waterTo));
  }
  if (recipe.vessel === 'jar' && recipe.tie !== false) group.add(tie(B, bundle, 'twine', '', rand));
  if (recipe.vessel === 'tissue' || recipe.vessel === 'kraft') {
    group.add(wrapSheets(B, recipe.vessel, recipe.paper ?? '#f3e6e4', rand, hb));
    group.add(tie(B.clone().add(V(0, -0.012, 0)), 0.026, recipe.vessel === 'kraft' ? 'twine' : 'ribbon', recipe.ribbon ?? '#e9d6d2', rand));
  }
  if (recipe.vessel === 'ribbon') {
    group.add(mesh(new THREE.CylinderGeometry(bundle + 0.004, bundle * 0.85 + 0.004, 0.11, 48, 8, true).translate(0, B.y - 0.055, 0), satinMat(recipe.ribbon ?? '#f3efe6')));
    group.add(tie(B, bundle + 0.002, 'ribbon', recipe.ribbon ?? '#f3efe6', rand));
  }
  if (recipe.vessel === 'tray') {
    group.add(mesh(new THREE.CylinderGeometry(0.4, 0.38, 0.022, 96).scale(1, 1, 0.36).translate(0, 0.011, 0), new THREE.MeshPhysicalMaterial({ color: albedo('#ece6da'), roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.15 })));
    // the mossy base stays hidden under the flowers and foliage
    group.add(mesh(new THREE.SphereGeometry(0.3, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.62, 0.11, 0.15).translate(0, 0.02, 0), solid('#334126', 0.95)));
    for (const [x, h, z] of [[-0.23, 0.26, -0.07], [0.25, 0.2, -0.05]]) {
      group.add(mesh(new THREE.CylinderGeometry(0.016, 0.016, h, 32).translate(x, 0.022 + h / 2, z), new THREE.MeshPhysicalMaterial({ color: albedo('#f3ece0'), roughness: 0.55, transmission: 0.25, thickness: 0.02, attenuationColor: new THREE.Color('#f1d9b5'), attenuationDistance: 0.02 })));
      group.add(mesh(new THREE.CylinderGeometry(0.0006, 0.0006, 0.008, 6).translate(x, 0.022 + h + 0.004, z), solid('#2b2420', 0.8)));
      group.add(mesh(new THREE.SphereGeometry(0.0042, 16, 12).scale(1, 2.4, 1).translate(x, 0.022 + h + 0.015, z), new THREE.MeshStandardMaterial({ color: '#000000', emissive: new THREE.Color('#ffb54d'), emissiveIntensity: 28 })));
      const l = new THREE.PointLight('#ffb35c', 0.18, 0, 2); l.position.set(x, 0.022 + h + 0.016, z); group.add(l);
    }
  }
  if (recipe.vessel === 'cloche') {
    group.add(mesh(new THREE.CylinderGeometry(0.16, 0.168, 0.035, 96).translate(0, 0.0175, 0), new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.5, color: '#ffffff' })));
    group.add(mesh(new THREE.SphereGeometry(0.07, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.6, 0.35, 1.6).translate(0, 0.035, 0), solid('#5e6b40', 0.95)));
    const prof = [[0.148, 0.035], [0.15, 0.25], [0.142, 0.32], [0.118, 0.37], [0.08, 0.398], [0.03, 0.41], [0.012, 0.414], [0.012, 0.428], [0.022, 0.436], [0.016, 0.446], [0.0, 0.448]];
    group.add(lathe(prof, thinGlassMat(), 96));
  }
  // set dressing on the table: part of the picture, not of the framing
  const dressing = new THREE.Group();
  group.userData.dressing = dressing;
  if (recipe.confetti) {
    const cr = TX.rng(recipe.seed + 5), byC = new Map();
    for (let k = 0; k < 80; k++) {
      const a = cr() * Math.PI * 2, d = 0.075 + cr() * 0.2, c = recipe.colors[k % recipe.colors.length];
      const g = new THREE.CircleGeometry(0.0042 + cr() * 0.002, 12).rotateX(-Math.PI / 2 + (cr() - 0.5) * 0.3).rotateY(cr() * 6).translate(Math.cos(a) * d * 1.3, 0.0006 + cr() * 0.0004, Math.sin(a) * d * 0.6 + 0.05);
      if (!byC.has(c)) byC.set(c, []); byC.get(c).push(g);
    }
    for (const [c, gs] of byC) dressing.add(mesh(mergeGeometries(gs), new THREE.MeshPhysicalMaterial({ color: albedo(c), roughness: 0.4, side: THREE.DoubleSide, specularIntensity: 0.6 })));
  }
  return group;
}

// ------------------------------------------------------------------ studio
let S = null;
const FinishShader = {
  uniforms: { map: { value: null }, res: { value: new THREE.Vector2(1, 1) }, seed: { value: 0 }, vignette: { value: 0.16 }, grain: { value: 0.018 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `
    uniform sampler2D map; uniform vec2 res; uniform float seed, vignette, grain;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    void main(){
      vec3 c = texture2D(map, vUv).rgb;
      // isolated fireflies (a pixel far brighter than all eight neighbours) take the neighbours' mean
      vec3 sum = vec3(0.0); float peak = 0.0;
      for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
        if (x == 0 && y == 0) continue;
        vec3 s = texture2D(map, vUv + vec2(float(x), float(y)) / res).rgb;
        sum += s; peak = max(peak, dot(s, vec3(0.2126, 0.7152, 0.0722)));
      }
      if (dot(c, vec3(0.2126, 0.7152, 0.0722)) > peak * 1.6 + 0.05) c = sum / 8.0;
      vec2 d = (vUv - 0.5) * vec2(res.x / res.y, 1.0);
      c *= 1.0 - vignette * smoothstep(0.18, 0.78, length(d));
      c = toneMapping(c);
      vec4 o = linearToOutputTexel(vec4(c, 1.0));
      // print-like grade: a gentle S-curve and slightly warm highlights
      o.rgb = mix(o.rgb, o.rgb * o.rgb * (3.0 - 2.0 * o.rgb), 0.22);
      o.rgb *= vec3(1.012, 1.0, 0.985);
      vec2 px = vUv * res;
      float n = hash(px + seed * 17.0) + hash(px * 1.31 + seed * 3.0) - 1.0;
      o.rgb += n * grain * (1.0 - 0.5 * o.rgb);
      gl_FragColor = vec4(clamp(o.rgb, 0.0, 1.0), 1.0);
    }`,
};

function sweep(colour) {
  const g = new THREE.PlaneGeometry(9, 1, 1, 90);
  const p = g.getAttribute('position'), uv = g.getAttribute('uv');
  for (let k = 0; k < p.count; k++) {
    const s = (p.getY(k) + 0.5) * 6; // arc length along the profile
    let y, z;
    if (s < 2.2) { y = 0; z = 2.2 - s; } else if (s < 2.2 + Math.PI * 0.35) { const a = (s - 2.2) / 0.7; y = 0.7 - Math.cos(a) * 0.7; z = -Math.sin(a) * 0.7; } else { y = 0.7 + (s - 2.2 - Math.PI * 0.35); z = -0.7; }
    p.setXYZ(k, p.getX(k), y, z - 0.5);
    uv.setXY(k, uv.getX(k), s / 6);
  }
  g.computeVertexNormals();
  return mesh(g, new THREE.MeshStandardMaterial({ color: albedo(colour), map: TEX.paper, roughness: 0.92, side: THREE.DoubleSide }));
}

export function setup({ width = 960, height = 1200 } = {}) {
  makeTextures();
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Khronos PBR Neutral keeps petal hues and saturation true, as product photography needs
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1;
  document.body.appendChild(renderer.domElement);
  const finish = new FullScreenQuad(new THREE.ShaderMaterial({ ...FinishShader, uniforms: THREE.UniformsUtils.clone(FinishShader.uniforms), toneMapped: true, depthTest: false, depthWrite: false }));
  finish.material.uniforms.res.value.set(width, height);
  const pt = new WebGLPathTracer(renderer);
  Object.assign(pt, { renderDelay: 0, minSamples: 0, fadeDuration: 0, rasterizeScene: false, dynamicLowRes: false, renderScale: 1 });
  pt.bounces = 9; pt.transmissiveBounces = 8; pt.filterGlossyFactor = 0.4; pt.multipleImportanceSampling = true;
  renderer.domElement.addEventListener('webglcontextlost', () => console.error('WebGL context lost'));
  pt.textureSize.set(512, 512);
  pt.renderToCanvasCallback = (target, r) => { finish.material.uniforms.map.value = target.texture; finish.render(r); };
  // soft studio surroundings: bright above, warm and darker below
  const env = new ProceduralEquirectTexture(256, 128);
  const dir = new THREE.Vector3();
  env.generationCallback = (polar, uv, coord, color) => {
    dir.setFromSpherical(polar);
    const t = Math.pow(dir.y * 0.5 + 0.5, 1.6);
    color.setRGB(lerp(0.32, 1.0, t), lerp(0.29, 0.98, t), lerp(0.26, 0.95, t));
  };
  env.update();
  S = { renderer, pt, finish, env, width, height };
}

export async function render(recipe, { samples = 256, maxMs = 20 * 60 * 1000, tile = 128, every = 0, onCheckpoint = null } = {}) {
  const { renderer, pt, finish, env, width, height } = S;
  // small tiles keep every GPU call short (Windows resets the GPU after ~2 s)
  pt.tiles.set(Math.ceil(width / tile), Math.ceil(height / tile));
  const scene = new THREE.Scene();
  scene.background = albedo(recipe.bg ?? '#ece4d8');
  scene.environment = env; scene.environmentIntensity = recipe.env ?? 0.3;
  scene.add(sweep(recipe.bg ?? '#ece4d8'));
  const bouquet = buildBouquet(recipe);
  scene.add(bouquet);
  bouquet.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(bouquet);
  scene.add(bouquet.userData.dressing);
  if (recipe.camera?.frame === 'heads') box.copy(bouquet.userData.heads).expandByScalar(0.04).union(new THREE.Box3(V(0, 0, 0), V(0, 0.001, 0)));
  if (box.isEmpty()) box.setFromCenterAndSize(V(0, 0.3, 0), V(0.4, 0.4, 0.2));
  const size = box.getSize(V()), center = box.getCenter(V());

  // framing: 4:5, the whole arrangement (or cropped under the tie for wrapped bouquets)
  const aspect = width / height;
  const cam = recipe.camera ?? {};
  const margin = cam.margin ?? 0.1;
  let H = Math.max(size.y, size.x / aspect) * (1 + margin * 2);
  let cy = center.y;
  if (cam.crop) {
    // wrapped bouquets: the flowers fill the frame, the paper leaves it under the tie
    const hb = bouquet.userData.heads, B = bouquet.userData.B;
    // product crop: nearly the whole dome across, the tie low in the frame, the collar may run off the sides
    const top = hb.max.y, bottom = B.y - (cam.below ?? 0.05);
    H = Math.max(top - bottom, ((hb.max.x - hb.min.x) * 0.85) / aspect) * (1 + margin * 2);
    cy = top + margin * H - H / 2;
  }
  H *= cam.zoom ?? 1;
  const dist = cam.dist ?? 1.6;
  const elev = cam.elev ?? 0.16, azim = cam.azim ?? 0.12;
  const target = V(center.x + (cam.dx ?? 0), cy + (cam.dy ?? 0), center.z);
  const camera = new PhysicalCamera(2 * THREE.MathUtils.radToDeg(Math.atan(H / 2 / dist)), aspect, 0.02, 30);
  camera.position.copy(target).add(V(Math.sin(azim) * Math.cos(elev), Math.sin(elev), Math.cos(azim) * Math.cos(elev)).multiplyScalar(dist));
  camera.lookAt(target);
  camera.fStop = cam.fStop ?? 4;
  camera.apertureBlades = 7; camera.apertureRotation = 0.3;
  camera.focusDistance = cam.focus ?? camera.position.distanceTo(V(center.x, cy, center.z + size.z * (cam.focusFront ?? 0.3)));
  camera.updateMatrixWorld();

  // lights relative to the subject
  // a big window-like softbox high on the left, a cooler back light on the right
  // (rim and glowing petals) and a white card on the right to lift the shadows
  const L = recipe.light ?? {};
  const key = new THREE.RectAreaLight(L.keyColor ?? '#fff1df', L.key ?? 24, 0.6, 0.8);
  key.position.copy(target).add(V(...(L.keyPos ?? [-1.0, 0.8, 0.55])));
  key.lookAt(target); scene.add(key);
  const rim = new THREE.RectAreaLight('#edf2ff', L.rim ?? 16, 0.4, 0.6);
  rim.position.copy(target).add(V(0.7, 0.7, -0.55));
  rim.lookAt(target.clone().add(V(0, 0.08, 0))); scene.add(rim);
  const card = mesh(new THREE.PlaneGeometry(1.2, 1.5), new THREE.MeshStandardMaterial({ color: albedo('#ffffff'), roughness: 1, side: THREE.DoubleSide }));
  card.position.copy(target).add(V(0.95, 0.05, 0.6)); card.lookAt(target); scene.add(card);
  // a low reflector in front lifts the undersides of petals, as on any florist's set
  const fill = new THREE.RectAreaLight('#fff8f0', L.fill ?? 4, 1.0, 0.5);
  fill.position.copy(target).add(V(0.35, -0.25, 1.2));
  fill.lookAt(target); scene.add(fill);

  // the path tracer merges every mesh into one buffer: give all of them an
  // RGBA colour attribute so vertex colours line up (mixed RGB/RGBA corrupts them)
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry, n = g.getAttribute('position').count, c = g.getAttribute('color');
    if (c && c.itemSize === 4) return;
    const rgba = new Float32Array(n * 4).fill(1);
    if (c) for (let i = 0; i < n; i++) { rgba[i * 4] = c.getX(i); rgba[i * 4 + 1] = c.getY(i); rgba[i * 4 + 2] = c.getZ(i); }
    g.setAttribute('color', new THREE.BufferAttribute(rgba, 4));
  });
  pt.setScene(scene, camera);
  pt.reset();
  finish.material.uniforms.seed.value = (recipe.seed % 97) + 0.5;
  renderer.toneMappingExposure = recipe.exposure ?? 1;
  const gl = renderer.getContext();
  const t0 = performance.now();
  let calls = 0;
  // gl.finish() only flushes in Chrome, so without a fence the loop would queue hundreds of
  // samples ahead of the GPU and the browser eventually gives up: wait for the GPU every sample
  const gpuDone = async () => {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    while (gl.clientWaitSync(sync, 0, 0) === gl.TIMEOUT_EXPIRED) await new Promise((r) => setTimeout(r, 4));
    gl.deleteSync(sync);
  };
  const perSample = pt.tiles.x * pt.tiles.y;
  const develop = async () => {
    finish.material.uniforms.map.value = pt.target.texture;
    renderer.setRenderTarget(null);
    finish.render(renderer);
    await gpuDone();
  };
  pt.renderToCanvas = false; // accumulate quietly, develop the picture when it is needed
  while (pt.samples < samples && performance.now() - t0 < maxMs) {
    if (pt.isCompiling) { await new Promise((r) => setTimeout(r, 50)); pt.renderSample(); continue; }
    pt.renderSample();
    if (++calls % perSample === 0) {
      await gpuDone();
      // long renders leave a developed copy behind every few samples
      if (onCheckpoint && every && pt.samples % every === 0 && pt.samples < samples) { await develop(); await onCheckpoint(pt.samples); }
    }
    if (calls % (perSample * 32) === 0) console.info(`${recipe.key}: ${Math.floor(pt.samples)} samples, ${Math.round(performance.now() - t0)} ms`);
  }
  pt.renderToCanvas = true;
  await develop();
  scene.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
  return { samples: pt.samples, ms: Math.round(performance.now() - t0), fov: camera.fov, focus: camera.focusDistance };
}

export function snapshot(type = 'image/webp', quality = 0.88) {
  return S.renderer.domElement.toDataURL(type, quality);
}

/** The GPU the renderer runs on (as reported by WebGL). */
export function gpu() {
  const gl = S.renderer.getContext(), d = gl.getExtension('WEBGL_debug_renderer_info');
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
}

/** Debug helper: average linear radiance of the path-traced buffer. */
export function probe() {
  const { renderer, pt } = S;
  const t = pt._pathTracer.target;
  const buf = new Float32Array(t.width * t.height * 4);
  renderer.readRenderTargetPixels(t, 0, 0, t.width, t.height, buf);
  let r = 0, g = 0, b = 0, a = 0, n = 0, bad = 0;
  for (let i = 0; i < buf.length; i += 4) {
    if (!Number.isFinite(buf[i] + buf[i + 1] + buf[i + 2])) { bad++; continue; }
    r += buf[i]; g += buf[i + 1]; b += buf[i + 2]; a += buf[i + 3]; n++;
  }
  return { w: t.width, h: t.height, r: r / n, g: g / n, b: b / n, a: a / n, nan: bad, samples: pt.samples };
}
