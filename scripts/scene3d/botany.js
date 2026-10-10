// Botanical models for the bouquet studio, at real-world scale (metres).
// Blooms grow along +y from the receptacle at the origin and come with their
// colours baked in (RGBA vertex colours, linear albedo), so one material per
// kind of surface can render any palette. Fillers grow along +y as well.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { bladeGeometry } from './flowers.js';
import { rng } from './textures.js';

const E = new THREE.Euler(), Q = new THREE.Quaternion(), M = new THREE.Matrix4(), V = new THREE.Vector3(), S = new THREE.Vector3();
function place(g, x, y, z, rx, ry, rz, s = 1) {
  E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); V.set(x, y, z); S.set(s, s, s);
  M.compose(V, Q, S);
  const c = g.clone(); c.applyMatrix4(M); return c;
}
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Linear albedo for a colour, kept under 0.82 like any real petal. */
export function albedo(hex) {
  const c = new THREE.Color(hex);
  const m = Math.max(c.r, c.g, c.b);
  if (m > 0.82) c.multiplyScalar(0.82 / m);
  return c;
}
const mix = (a, b, t) => albedo(a).lerp(albedo(b), t);
function tint(g, col) {
  const c = col.isColor ? col : albedo(col);
  const n = g.getAttribute('position').count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { a[i * 4] = c.r; a[i * 4 + 1] = c.g; a[i * 4 + 2] = c.b; a[i * 4 + 3] = 1; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 4));
  return g;
}

export const WIDTH = {
  round: (v) => Math.sin(Math.min(1, v * 1.05) * Math.PI * 0.92) * (0.55 + 0.45 * v),
  oval: (v) => Math.sin(Math.min(1, v * 1.02) * Math.PI) * (0.8 + 0.2 * v),
  narrow: (v) => Math.sin(v * Math.PI) * 0.75,
};

// petal outlines: half-width (0..1) along the length v
const OUTLINE = {
  obovate: (v) => 0.16 + 0.84 * Math.pow(Math.sin(Math.min(1, v / 0.78) * Math.PI / 2), 0.8),
  round: (v) => 0.24 + 0.76 * Math.pow(Math.sin(Math.min(1, v / 0.6) * Math.PI / 2), 0.7),
  oval: (v) => (v < 0.52 ? 0.36 + 0.64 * Math.sin((v / 0.52) * Math.PI / 2) : Math.pow(Math.cos(((v - 0.52) / 0.48) * Math.PI / 2), 0.6)),
  ray: (v) => Math.pow(Math.min(1, v * 7), 0.5) * (1 - 0.1 * v),
  wedge: (v) => 0.12 + 0.88 * Math.pow(v, 0.7),
  spathe: (v) => (v < 0.6 ? 0.2 + 0.8 * Math.sin((v / 0.6) * Math.PI / 2) : Math.pow(Math.cos(((v - 0.6) / 0.4) * Math.PI / 2), 1.1)),
};

/**
 * A petal as a grid along its own midline. The midline bends as a true arc
 * (bend = total angle in radians, + towards the bloom centre), the cross
 * section wraps round a cylinder (cup = half-arc angle at the base, scaled by
 * cupTop at the tip), margins can roll back near the tip, ruffle, and the top
 * edge can be rounded, notched or toothed. paint(u, v) gives the linear colour.
 */
export function petalGeo({
  len, wid, outline = 'obovate', roundTop = 0.3, notch = 0, teeth = 0, toothDepth = 0.05,
  cup = 0.6, cupTop = 0.6, bend = 0, bendPow = 1.4, roll = 0, ruffle = 0.01, waves = 3, twist = 0,
  seed = 1, segU = 10, segV = 14, paint = null,
}) {
  const r = rng(seed), ph = r() * 6.283, ph2 = r() * 6.283, ph3 = r() * 6.283;
  const W = typeof outline === 'function' ? outline : OUTLINE[outline];
  // midline as an arc: [y, z, angle] per row
  const cl = [[0, 0, 0]];
  let py = 0, pz = 0;
  for (let j = 1; j <= segV; j++) {
    const am = bend * Math.pow((j - 0.5) / segV, bendPow);
    py += (len / segV) * Math.cos(am); pz -= (len / segV) * Math.sin(am);
    cl.push([py, pz, bend * Math.pow(j / segV, bendPow)]);
  }
  const at = (v) => { const f = Math.min(segV, Math.max(0, v * segV)), j = Math.min(segV - 1, Math.floor(f)), k = f - j; return [0, 1, 2].map((n) => lerp(cl[j][n], cl[j + 1][n], k)); };
  const pos = [], uv = [], col = [], idx = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const hw = W(v) * wid * (1 + 0.04 * Math.sin(v * 7 + ph));
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * 2 - 1, au = Math.abs(u);
      // the top edge: rounded corners, a central notch, small teeth
      const k = smooth(0.5, 1, v);
      let drop = roundTop * u * u * k * k;
      if (notch) drop += notch * Math.exp(-(u * u) / 0.04) * k * k * k;
      if (teeth) drop += toothDepth * (0.5 - 0.5 * Math.cos((u + 1 - 1 / teeth) * teeth * Math.PI)) * k * k * k;
      const vv = Math.max(0, v - drop);
      const [my, mz, a] = at(vv);
      // cross section wrapped round a cylinder (keeps the petal's real width)
      const ca = cup * lerp(1, cupTop, vv);
      const xs = u * hw;
      let x, zl;
      if (Math.abs(ca) < 1e-3 || hw < 1e-6) { x = xs; zl = 0; } else { const R = hw / ca, th = xs / R; x = R * Math.sin(th); zl = -R * (1 - Math.cos(th)); }
      const m = smooth(0.42, 1, au) * smooth(0.3, 1, vv);
      zl += roll * wid * m * m;
      x *= 1 - 0.14 * roll * m;
      zl += ruffle * len * Math.sin(waves * Math.PI * u + ph2 + vv * 2.5) * Math.pow(au, 1.4) * (0.25 + 0.75 * vv);
      zl += 0.016 * len * Math.sin(u * 2.3 + ph3) * Math.sin(vv * 3.4 + ph);
      if (twist) { const t = twist * vv, c = Math.cos(t), s = Math.sin(t); [x, zl] = [x * c - zl * s, x * s + zl * c]; }
      pos.push(x, my + zl * Math.sin(a), mz + zl * Math.cos(a));
      uv.push(u * 0.5 + 0.5, vv);
      const p = paint ? paint(u, vv) : null;
      col.push(p ? p.r : 1, p ? p.g : 1, p ? p.b : 1, 1);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Colour across a petal: base flush, tip and margin tints, overall shade. */
function painter(hex, { base, baseAmt = 0, baseTo = 0.3, tip, tipAmt = 0, edge, edgeAmt = 0, shade = 1 } = {}) {
  const c = albedo(hex), b = base ? albedo(base) : c, t = tip ? albedo(tip) : c, e = edge ? albedo(edge) : c;
  const out = new THREE.Color();
  return (u, v) => {
    out.copy(c);
    if (baseAmt) out.lerp(b, baseAmt * (1 - smooth(0, baseTo, v)));
    if (tipAmt) out.lerp(t, tipAmt * smooth(0.5, 1, v));
    if (edgeAmt) out.lerp(e, edgeAmt * smooth(0.55, 1, Math.abs(u)) * smooth(0.25, 1, v));
    return out.multiplyScalar(shade);
  };
}
const deeper = (hex, k = 0.2) => { const c = albedo(hex), hsl = {}; c.getHSL(hsl); return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * (1 + k)), hsl.l * (1 - k * 0.8)); };
const hexOf = (c) => '#' + c.getHexString();

/** Domed disc covered in florets (daisy, cosmos, gerbera centres). */
function floretDisc({ r, h, n, bump, inner, outer, ringFrom = 0.4, seed = 1 }) {
  const rr = rng(seed);
  const parts = [tint(new THREE.SphereGeometry(r, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, h / r, 1), inner)];
  const ci = albedo(inner), co = albedo(outer);
  for (let k = 0; k < n; k++) {
    const t = Math.sqrt((k + 0.5) / n), a = k * 2.39996;
    const x = Math.cos(a) * t * r * 0.97, z = Math.sin(a) * t * r * 0.97, y = h * Math.sqrt(Math.max(0, 1 - t * t * 0.94));
    const s = new THREE.SphereGeometry(bump * (0.75 + 0.45 * t) * (0.85 + rr() * 0.3), 6, 4).scale(1, 1.25, 1).translate(x, y, z);
    parts.push(tint(s, ci.clone().lerp(co, smooth(ringFrom, 1, t))));
  }
  return mergeGeometries(parts);
}

/** Petals placed on a golden-angle spiral; fn(t, i) returns the petal and its placement. */
function spiral(n, seed, fn) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 1 : i / (n - 1);
    const a = i * 2.39996 + (r() - 0.5) * 0.25;
    const p = fn(t, i, r);
    parts.push(place(petalGeo({ ...p.petal, seed: seed * 131 + i }), Math.cos(a) * p.r, p.y ?? 0, Math.sin(a) * p.r, p.tilt, Math.PI / 2 - a, p.spin ?? (r() - 0.5) * 0.1));
  }
  return parts;
}

// ------------------------------------------------------------------ blooms
// Each returns { petals, parts?: [{ geo, kind }], mat, radius }.
export const BLOOMS = {
  rosa: (seed, open = 0.6, hex = '#e58fa6') => {
    const n = Math.round(lerp(14, 24, open));
    const pale = hexOf(mix(hex, '#fbf1dc', 0.6));
    return {
      radius: 0.045, mat: 'velvet',
      petals: mergeGeometries(spiral(n, seed, (t) => {
        const len = lerp(0.019, 0.045, Math.pow(t, 0.55));
        return {
          r: lerp(0.0012, 0.0072, t), y: lerp(0.004, 0, t),
          tilt: lerp(0.05, lerp(0.62, 1.12, open), Math.pow(t, 1.5)),
          petal: {
            len, wid: len * lerp(0.6, 0.7, t), outline: 'obovate', roundTop: 0.3, notch: 0.035 * t,
            cup: lerp(1.45, 0.75, t), cupTop: lerp(0.95, 0.35, t), bend: lerp(0.55, lerp(-0.05, -0.55, open), Math.pow(t, 0.8)), bendPow: lerp(1, 2.2, t),
            roll: lerp(0.0, 1.1, Math.pow(t, 1.3)) * (0.4 + 0.6 * open), ruffle: 0.008, waves: 2, segU: 12, segV: 14,
            paint: painter(hex, { base: pale, baseAmt: 0.55, baseTo: 0.38, shade: lerp(0.82, 1, t) }),
          },
        };
      })),
    };
  },
  // double peony: a ball of upright, crinkled petals held in a cup of broad guard petals
  peonia: (seed, open = 0.6, hex = '#f4c9d2') => {
    const deep = hexOf(deeper(hex, 0.1));
    const inner = spiral(60, seed, (t, i, r) => {
      // the middle petals stand tallest, so the top domes like a ball
      const len = lerp(0.034, 0.04, t) * (0.88 + r() * 0.24);
      return {
        r: lerp(0.002, 0.013, t), y: lerp(0.024, 0.003, t), tilt: lerp(0.06, 0.85, Math.pow(t, 1.4)) + (r() - 0.5) * 0.2,
        petal: {
          len, wid: len * 0.62, outline: 'obovate', roundTop: 0.2, notch: 0.16, cup: 0.9, cupTop: 0.6, bend: lerp(0.35, 0.15, t), bendPow: 1.5,
          roll: 0.12, ruffle: 0.09, waves: 3 + (i % 3), twist: (r() - 0.5) * 0.5, segU: 12, segV: 12,
          paint: painter(hex, { base: deep, baseAmt: 0.3, baseTo: 0.5, shade: lerp(0.94, 1, t) }),
        },
      };
    });
    const guard = spiral(7, seed + 3, () => {
      const len = 0.058;
      return {
        r: 0.014, y: 0, tilt: lerp(0.55, 0.95, open),
        petal: { len, wid: len * 0.74, outline: 'obovate', roundTop: 0.3, notch: 0.05, cup: 1.2, cupTop: 0.6, bend: lerp(0.55, 0.25, open), bendPow: 1.3, roll: 0.2, ruffle: 0.035, waves: 3, segU: 14, segV: 14, paint: painter(hex, {}) },
      };
    });
    return { radius: 0.058, mat: 'layered', petals: mergeGeometries([...inner, ...guard]) };
  },
  ranunculo: (seed, open = 0.6, hex = '#f2b48c') => {
    const n = Math.round(lerp(54, 72, open));
    const base = hexOf(mix(hex, '#f7eccc', 0.45)), edge = hexOf(deeper(hex, 0.18));
    return {
      radius: 0.033, mat: 'layered',
      petals: mergeGeometries(spiral(n, seed, (t, i, r) => {
        const len = lerp(0.012, 0.03, Math.pow(t, 0.7)) * (0.9 + r() * 0.2);
        // layered open cups building a dome: the camera sees their lit inner faces, not rolled-up backs
        return {
          r: lerp(0.0008, 0.0055, t), y: lerp(0.016, 0, t), tilt: lerp(0.15, lerp(1.1, 1.25, open), Math.pow(t, 1.6)) + (r() - 0.5) * 0.12,
          petal: {
            len, wid: len * 0.8, outline: 'round', roundTop: 0.5, cup: lerp(1.2, 0.75, t), cupTop: 0.8, bend: lerp(0.35, 0.1, t), bendPow: 1.4,
            ruffle: 0.008, waves: 2, segU: 9, segV: 10,
            paint: painter(hex, { base, baseAmt: 0.45, baseTo: 0.6, edge, edgeAmt: 0.08 }),
          },
        };
      })),
      parts: [{ geo: tint(new THREE.SphereGeometry(0.0032, 14, 8).scale(1, 0.65, 1).translate(0, 0.0052, 0), '#7a8a3c'), kind: 'plant' }],
    };
  },
  tulipan: (seed, open = 0.4, hex = '#f08a6b') => {
    const r = rng(seed), parts = [];
    const base = hexOf(mix(hex, '#f2d66e', 0.55));
    for (let k = 0; k < 6; k++) {
      const inner = k % 2 === 1, a = (k / 6) * Math.PI * 2 + (r() - 0.5) * 0.08;
      const len = (inner ? 0.056 : 0.06) * (0.97 + r() * 0.06);
      const g = petalGeo({
        len, wid: len * 0.42, outline: 'oval', roundTop: 0.04, cup: 1.25, cupTop: 0.9, bend: lerp(1.45, 1.0, open), bendPow: 1,
        ruffle: 0.003, waves: 2, seed: seed * 19 + k, segU: 12, segV: 18, paint: painter(hex, { base, baseAmt: 0.45, baseTo: 0.22 }),
      });
      const rr = inner ? 0.0025 : 0.0045;
      parts.push(place(g, Math.cos(a) * rr, 0, Math.sin(a) * rr, lerp(0.85, 1.0, open) + (r() - 0.5) * 0.05, Math.PI / 2 - a, 0));
    }
    return { radius: 0.03, mat: 'wax', petals: mergeGeometries(parts) };
  },
  anemona: (seed, open = 0.6, hex = '#9fbcd8') => {
    const c = albedo(hex), hsl = {}; c.getHSL(hsl);
    const white = hsl.l > 0.7; // white anemones have no pale ring
    const tepals = spiral(7, seed, (t, i) => {
      const len = 0.034 * (i < 5 ? 1 : 0.86);
      return {
        r: 0.006, y: 0, tilt: lerp(1.0, 1.3, open) - (i < 5 ? 0 : 0.18),
        petal: {
          len, wid: len * 0.8, outline: 'obovate', roundTop: 0.42, cup: 0.7, cupTop: 0.45, bend: 0.25, bendPow: 1.6, roll: 0.05, ruffle: 0.014, waves: 2, segU: 14, segV: 14,
          paint: painter(hex, white ? { base: '#e9eadf', baseAmt: 0.35, baseTo: 0.25 } : { base: '#f2f0ea', baseAmt: 0.9, baseTo: 0.26 }),
        },
      };
    });
    const r = rng(seed + 1), fil = [], anth = [];
    for (let k = 0; k < 110; k++) {
      const a = k * 2.39996, tilt = 0.55 + r() * 0.55, L = 0.0055 + r() * 0.0035, r0 = 0.0058;
      const d = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt));
      const p0 = new THREE.Vector3(Math.cos(a) * r0, 0.002, Math.sin(a) * r0), p1 = p0.clone().add(d.clone().multiplyScalar(L));
      fil.push(tint(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 1, 0.00018, 3, false), '#2c2838'));
      anth.push(tint(new THREE.SphereGeometry(0.00062, 6, 4).scale(1, 0.7, 1).translate(p1.x, p1.y, p1.z), '#141218'));
    }
    return {
      radius: 0.038, mat: 'satin', petals: mergeGeometries(tepals),
      parts: [
        { geo: floretDisc({ r: 0.0062, h: 0.0052, n: 70, bump: 0.00075, inner: '#1d2620', outer: '#171a18', seed }), kind: 'plant' },
        { geo: mergeGeometries([...fil, ...anth]), kind: 'plant' },
      ],
    };
  },
  cosmos: (seed, open = 0.7, hex = '#f2a3c3') => {
    const eye = hexOf(deeper(hex, 0.3));
    return {
      radius: 0.036, mat: 'thin',
      petals: mergeGeometries(spiral(8, seed, () => ({
        r: 0.0055, y: 0, tilt: 1.42,
        petal: { len: 0.033, wid: 0.0125, outline: 'wedge', roundTop: 0.12, teeth: 3, toothDepth: 0.05, cup: 0.35, cupTop: 0.25, bend: -0.12, bendPow: 2, ruffle: 0.012, waves: 2, segU: 14, segV: 12, paint: painter(hex, { base: eye, baseAmt: 0.55, baseTo: 0.2 }) },
      }))),
      parts: [{ geo: floretDisc({ r: 0.0062, h: 0.003, n: 110, bump: 0.00068, inner: '#b88a24', outer: '#f0c548', ringFrom: 0.3, seed }), kind: 'plant' }],
    };
  },
  gerbera: (seed, open = 0.7, hex = '#f2cf5b') => {
    const rays = [
      ...spiral(22, seed, () => ({ r: 0.0125, y: 0, tilt: 1.47, petal: { len: 0.04, wid: 0.0042, outline: 'ray', roundTop: 0.1, teeth: 2, toothDepth: 0.03, cup: 0.5, cupTop: 0.3, bend: -0.12, bendPow: 2, ruffle: 0.006, segU: 6, segV: 12, paint: painter(hex, { tip: hexOf(mix(hex, '#ffffff', 0.15)), tipAmt: 0.4 }) } })),
      ...spiral(18, seed + 9, () => ({ r: 0.0118, y: 0.0012, tilt: 1.36, petal: { len: 0.033, wid: 0.0038, outline: 'ray', roundTop: 0.1, teeth: 2, toothDepth: 0.03, cup: 0.5, cupTop: 0.3, bend: -0.08, bendPow: 2, ruffle: 0.006, segU: 6, segV: 10, paint: painter(hex, { shade: 0.95 }) } })),
      ...spiral(34, seed + 17, () => ({ r: 0.0108, y: 0.0016, tilt: 0.75, petal: { len: 0.0055, wid: 0.0008, outline: 'ray', roundTop: 0, cup: 0.3, bend: -0.2, segU: 2, segV: 4, paint: painter(hex, { shade: 0.9 }) } })),
    ];
    return {
      radius: 0.05, mat: 'matte', petals: mergeGeometries(rays),
      parts: [{ geo: floretDisc({ r: 0.0112, h: 0.0024, n: 230, bump: 0.00072, inner: '#2a2716', outer: '#9c8a37', ringFrom: 0.5, seed }), kind: 'plant' }],
    };
  },
  margarita: (seed, open = 0.7, hex = '#f6f2ea') => ({
    radius: 0.03, mat: 'thin',
    petals: mergeGeometries(spiral(24, seed, () => ({
      r: 0.0072, y: 0, tilt: 1.5,
      petal: { len: 0.024, wid: 0.0042, outline: 'ray', roundTop: 0.1, teeth: 2, toothDepth: 0.035, cup: 0.45, cupTop: 0.2, bend: -0.2, bendPow: 2, ruffle: 0.008, segU: 6, segV: 10, paint: painter(hex, { base: '#e4e2cf', baseAmt: 0.4, baseTo: 0.15 }) },
    }))),
    parts: [{ geo: floretDisc({ r: 0.0078, h: 0.0042, n: 170, bump: 0.00064, inner: '#d39d1c', outer: '#eec33b', ringFrom: 0.2, seed }), kind: 'plant' }],
  }),
  cala: (seed, open = 0.6, hex = '#f1ebe1') => {
    const g = petalGeo({
      len: 0.085, wid: 0.032, outline: 'spathe', roundTop: 0, cup: 2.75, cupTop: 0.35, bend: -0.75, bendPow: 3.2, roll: 0.35,
      ruffle: 0.004, waves: 2, seed, segU: 22, segV: 26, paint: painter(hex, { base: '#a4b56f', baseAmt: 0.75, baseTo: 0.28 }),
    });
    return {
      radius: 0.04, mat: 'wax', facing: true, petals: place(g, 0, -0.012, 0, 0.18, Math.PI, 0),
      parts: [{ geo: tint(new THREE.CapsuleGeometry(0.003, 0.034, 6, 12).translate(0, 0.012, -0.01), '#e9b93a'), kind: 'plant' }],
    };
  },
};

// ------------------------------------------------------------------ fillers
function curveStem(len, bend, r, seed) {
  const rr = rng(seed);
  const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(bend * 0.3, len * 0.35, (rr() - 0.5) * 0.02), new THREE.Vector3(bend * 0.7, len * 0.7, (rr() - 0.5) * 0.03), new THREE.Vector3(bend, len, 0)];
  const curve = new THREE.CatmullRomCurve3(pts);
  return { curve, geo: new THREE.TubeGeometry(curve, 24, r, 6, false) };
}

export const FILLERS = {
  // "verdes de campo": a leafy sprig with small alternate oval leaves
  verde: (seed, len = 0.26) => {
    const rr = rng(seed);
    const { curve, geo } = curveStem(len, (rr() - 0.5) * 0.05, 0.0014, seed);
    const leaves = [];
    for (let t = 0.18, k = 0; t < 0.98; t += 0.06, k++) {
      const p = curve.getPointAt(t), s = k % 2 ? 1 : -1;
      const L = lerp(0.034, 0.018, t) * (0.85 + rr() * 0.3);
      const g = bladeGeometry({ len: L, wid: L * 0.36, width: WIDTH.oval, cup: -0.25, curl: 0.12, fold: 0.25, seed: seed * 7 + k, segU: 4, segV: 7, baseShade: 0.9 });
      leaves.push(place(g, p.x, p.y, p.z, 0.75 + rr() * 0.35, k * 2.4 + rr() * 0.5, s * 0.15));
    }
    return { stem: geo, leaves: mergeGeometries(leaves), leafColor: '#5d7a43', stemColor: '#5f6b3e' };
  },
  // silver-dollar eucalyptus: round, slightly cupped leaves in opposite pairs, each pair turned 90°
  eucalipto: (seed, len = 0.32) => {
    const rr = rng(seed);
    const { curve, geo } = curveStem(len, (rr() - 0.5) * 0.09, 0.0017, seed);
    const leaves = [];
    for (let t = 0.1, k = 0; t < 0.985; t += 0.052, k++) {
      const p = curve.getPointAt(t), a = k * Math.PI / 2 + (rr() - 0.5) * 0.3;
      for (const s of [-1, 1]) {
        const rad = lerp(0.019, 0.008, Math.pow(t, 1.3)) * (0.85 + rr() * 0.3);
        const disc = new THREE.CircleGeometry(rad, 22);
        const pos = disc.getAttribute('position');
        for (let q = 0; q < pos.count; q++) { const x = pos.getX(q), y = pos.getY(q); pos.setZ(q, (x * x + y * y) * 4.5 + Math.abs(x) * 0.12); }
        disc.translate(0, rad * 0.95, 0); // the leaf hangs from a short petiole
        disc.computeVertexNormals();
        const dir = a + (s < 0 ? Math.PI : 0);
        leaves.push(place(disc, p.x + Math.cos(dir) * 0.002, p.y, p.z + Math.sin(dir) * 0.002, 1.1 + (rr() - 0.5) * 0.7, Math.PI / 2 - dir, (rr() - 0.5) * 0.5));
      }
    }
    return { stem: geo, leaves: mergeGeometries(leaves), leafColor: '#8d9e95', stemColor: '#7a6650' };
  },
  olivo: (seed, len = 0.3) => {
    const rr = rng(seed);
    const { curve, geo } = curveStem(len, -0.04, 0.0016, seed);
    const leaves = [];
    for (let t = 0.1; t < 1; t += 0.07) {
      const p = curve.getPointAt(t);
      for (const s of [-1, 1]) {
        const g = bladeGeometry({ len: 0.05 * (1 - t * 0.3), wid: 0.0055, width: WIDTH.narrow, cup: -0.2, curl: 0.15, fold: 0.3, seed: seed + Math.round(t * 100) + s, segU: 3, segV: 6, baseShade: 0.85 });
        leaves.push(place(g, p.x, p.y, p.z, 0.2, rr() * 6.28, s * (0.8 + rr() * 0.4)));
      }
    }
    return { stem: geo, leaves: mergeGeometries(leaves), leafColor: '#73804c', stemColor: '#6b6447' };
  },
  espigas: (seed, len = 0.42) => {
    const { curve, geo } = curveStem(len, 0.025, 0.0012, seed);
    const grains = [], awns = [];
    for (let k = 0; k < 22; k++) {
      const t = 0.8 + (k / 22) * 0.2, p = curve.getPointAt(Math.min(0.999, t));
      const s = k % 2 ? 1 : -1;
      grains.push(new THREE.SphereGeometry(0.0032, 8, 6).scale(0.8, 1.7, 0.8).rotateZ(s * 0.35).translate(p.x + s * 0.003, p.y, p.z));
      awns.push(new THREE.CylinderGeometry(0.0002, 0.0002, 0.03, 3).rotateZ(s * 0.25).translate(p.x + s * 0.007, p.y + 0.015, p.z));
    }
    return { stem: geo, leaves: mergeGeometries([...grains, ...awns]), leafColor: '#d4b57a', stemColor: '#b9a06a' };
  },
  lavanda: (seed, len = 0.34) => {
    const rr = rng(seed);
    const { curve, geo } = curveStem(len, 0.02, 0.0012, seed);
    const fl = [];
    for (let k = 0; k < 46; k++) {
      const t = 0.68 + (k / 46) * 0.32, p = curve.getPointAt(Math.min(0.999, t));
      const a = k * 2.4, rad = 0.004 * (1 - (t - 0.68) * 1.5);
      fl.push(new THREE.SphereGeometry(0.0024 + rr() * 0.001, 6, 5).translate(p.x + Math.cos(a) * rad, p.y, p.z + Math.sin(a) * rad));
    }
    return { stem: geo, leaves: mergeGeometries(fl), leafColor: '#8a74c0', stemColor: '#7d8a62' };
  },
  paniculata: (seed, len = 0.3) => {
    const rr = rng(seed);
    const { curve, geo } = curveStem(len, 0.02, 0.0011, seed);
    const twigs = [geo], dots = [];
    for (let k = 0; k < 9; k++) {
      const p0 = curve.getPointAt(0.55 + rr() * 0.42);
      const dir = new THREE.Vector3(rr() - 0.5, 0.6 + rr() * 0.5, rr() - 0.5).normalize();
      const p1 = p0.clone().add(dir.multiplyScalar(0.03 + rr() * 0.04));
      twigs.push(new THREE.TubeGeometry(new THREE.LineCurve3(p0, p1), 2, 0.0006, 4, false));
      for (let d = 0; d < 9; d++) dots.push(new THREE.SphereGeometry(0.0022 + rr() * 0.0012, 6, 5).translate(p1.x + (rr() - 0.5) * 0.016, p1.y + (rr() - 0.5) * 0.012, p1.z + (rr() - 0.5) * 0.016));
    }
    return { stem: mergeGeometries(twigs), leaves: mergeGeometries(dots), leafColor: '#fbfaf5', stemColor: '#86955f' };
  },
};
