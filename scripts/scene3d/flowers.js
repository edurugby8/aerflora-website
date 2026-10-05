// Flower geometry built from real meshes (no alpha cut-outs), so depth,
// shadows and depth of field all see the true silhouettes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

/**
 * A petal/leaf as a grid that follows its own outline.
 * width(v) gives the half-width along the length; cup bends it across,
 * curl bends the tip back, ruffle waves the margin. Vertex colour darkens
 * the base (occlusion inside the bloom).
 */
export function bladeGeometry({ len = 1, wid = 0.6, width, cup = 0.3, curl = 0.2, ruffle = 0.03, fold = 0, seed = 1, segU = 6, segV = 10, baseShade = 0.6 }) {
  const r = rng(seed);
  const phase = r() * 10;
  const pos = [], uv = [], col = [], idx = [];
  for (let j = 0; j <= segV; j++) {
    const v = j / segV;
    const hw = width(v) * wid;
    const edgeNoise = 1 + Math.sin(v * 5 + phase) * 0.035 + Math.sin(v * 13 + phase * 2) * 0.012;
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * 2 - 1;
      const x = u * hw * edgeNoise;
      const y = v * len;
      let z = cup * len * (u * u) * (0.3 + v) * 0.5; // cupped across
      z -= curl * len * Math.pow(v, 3); // tip curls back
      z += fold * len * Math.abs(u) * 0.25; // leaf midrib fold
      z += Math.sin(u * 3.2 + v * 2.6 + phase) * ruffle * len * u * u * v; // soft wave towards the margin only
      pos.push(x, y, z);
      uv.push(u * 0.5 + 0.5, v);
      const s = baseShade + (1 - baseShade) * Math.min(1, v * 1.6);
      col.push(s, s, s);
    }
  }
  for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
    const a = j * (segU + 1) + i, b = a + 1, c = a + segU + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const petalWidth = (v) => Math.sin(Math.min(1, v * 1.05) * Math.PI * 0.92) * (0.55 + 0.45 * v);
const leafWidth = (v) => Math.sin(v * Math.PI) * (1 - 0.35 * v);
const narrow = (v) => Math.sin(v * Math.PI) * 0.8;

function place(g, m) { const c = g.clone(); c.applyMatrix4(m); return c; }
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S = new THREE.Vector3(), T = new THREE.Vector3();
function mat(px, py, pz, rx, ry, rz, s = 1) {
  E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); S.set(s, s, s); T.set(px, py, pz);
  return M.clone().compose(T, Q, S);
}

/** Garden rose: spiral layers from a closed bud to open outer petals. Unit ≈ 1 = bloom diameter. */
export function rose(openness = 0.6, seed = 1) {
  const r = rng(seed);
  const parts = [];
  const layers = [[4, 0.18, 0.15], [5, 0.26, 0.35], [6, 0.34, 0.6], [7, 0.42, 0.95], [8, 0.5, 1.25]];
  layers.forEach(([n, size, open], L) => {
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + L * 0.7 + r() * 0.25;
      const tilt = Math.min(1.45, open * (0.55 + openness * 0.75));
      // petal grows along +y; tilt it outwards (towards local +z), then turn
      // it to face direction a. Negative cup/curl: margins curve towards the
      // bloom centre while the tips roll outwards, as on a real rose.
      const sz = size * (0.9 + r() * 0.2);
      const p = bladeGeometry({ len: sz, wid: sz * (0.8 + r() * 0.12), width: petalWidth, cup: -(0.85 - L * 0.1), curl: -(0.12 + L * 0.07 * openness), ruffle: 0.04, seed: seed * 31 + L * 7 + k, segU: 7, segV: 10, baseShade: 0.62 + L * 0.06 });
      parts.push(place(p, mat(Math.cos(a) * 0.02 * L, 0, Math.sin(a) * 0.02 * L, tilt, Math.PI / 2 - a, 0)));
    }
  });
  const g = mergeGeometries(parts);
  g.rotateX(Math.PI / 2); // bloom axis +y → faces +z by default
  return g;
}

/** Phalaenopsis: two broad petals, three sepals, a magenta lip. */
export function orchid(seed = 1) {
  const parts = [];
  const spec = [[0, 0.42, 0.42, narrow], [Math.PI * 0.78, 0.4, 0.4, narrow], [-Math.PI * 0.78, 0.4, 0.4, narrow], [Math.PI * 0.42, 0.46, 0.8, petalWidth], [-Math.PI * 0.42, 0.46, 0.8, petalWidth]];
  spec.forEach(([a, len, wid, w], k) => {
    const p = bladeGeometry({ len, wid: wid * 0.6, width: w, cup: 0.12, curl: 0.08, ruffle: 0.02, seed: seed * 17 + k, segU: 5, segV: 7, baseShade: 0.8 });
    parts.push(place(p, mat(0, 0, 0, 0, 0, a)));
  });
  const lip = bladeGeometry({ len: 0.2, wid: 0.12, width: petalWidth, cup: 0.8, curl: -0.2, seed: seed * 5, segU: 4, segV: 5, baseShade: 0.7 });
  const lc = lip.getAttribute('color');
  for (let k = 0; k < lc.count; k++) lc.setXYZ(k, 0.62, 0.18, 0.38);
  parts.push(place(lip, mat(0, -0.02, 0.03, -0.5, 0, Math.PI)));
  return mergeGeometries(parts);
}

/** Hydrangea head: many small four-petal florets on a dome. */
export function hydrangea(seed = 1) {
  const r = rng(seed);
  const parts = [];
  const floret = bladeGeometry({ len: 0.17, wid: 0.15, width: petalWidth, cup: 0.3, curl: 0.05, seed: seed, segU: 3, segV: 4, baseShade: 0.9 });
  for (let k = 0; k < 40; k++) {
    const th = r() * Math.PI * 2, ph = Math.acos(1 - r() * 0.9);
    const n = new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph));
    for (let p = 0; p < 4; p++) {
      const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), n, new THREE.Vector3(0, 1, 0));
      const local = mat(0, 0, 0, 0, 0, (p * Math.PI) / 2 + r() * 0.3);
      const pos = n.clone().multiplyScalar(0.42);
      const world = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z).multiply(m).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(local);
      parts.push(place(floret, world));
    }
  }
  return mergeGeometries(parts);
}

/** Leaf with folded midrib, pointing +y. */
export function leafGeometry(seed = 1, len = 1) {
  return bladeGeometry({ len, wid: len * 0.34, width: leafWidth, cup: -0.05, curl: 0.18, ruffle: 0.015, fold: 0.5, seed, segU: 4, segV: 10, baseShade: 0.8 });
}

/** Wisteria raceme hanging along −y: dense florets tapering to the tip. */
export function wisteria(seed = 1) {
  const r = rng(seed);
  const parts = [];
  const fl = bladeGeometry({ len: 0.05, wid: 0.045, width: petalWidth, cup: 0.6, curl: 0.1, seed, segU: 3, segV: 3, baseShade: 0.7 });
  const N = 70;
  for (let k = 0; k < N; k++) {
    const t = k / N, rad = 0.07 * (1 - t * 0.8);
    const a = k * 2.4;
    for (let p = 0; p < 2; p++) {
      parts.push(place(fl, mat(Math.cos(a) * rad, -t * 0.55, Math.sin(a) * rad, r() * 1.2 - 0.6, a, p * Math.PI + r(), 1 - t * 0.35)));
    }
  }
  const g = mergeGeometries(parts);
  const c = g.getAttribute('color'), pos = g.getAttribute('position');
  for (let k = 0; k < c.count; k++) { const t = Math.min(1, -pos.getY(k) / 0.55); const s = c.getX(k) * (1 - 0.25 * t); c.setXYZ(k, s, s * (0.95 - 0.1 * t), s); }
  return g;
}

/** A single loose petal for the falling-petal system. */
export function loosePetal(seed = 3) {
  return bladeGeometry({ len: 0.035, wid: 0.028, width: petalWidth, cup: 0.5, curl: 0.25, ruffle: 0.05, seed, segU: 3, segV: 4, baseShade: 0.85 });
}

/** Tapered stem / vine along a curve. */
export function stem(points, radius = 0.008, taper = 0.5) {
  const curve = new THREE.CatmullRomCurve3(points);
  const tube = new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 6, false);
  const pos = tube.getAttribute('position');
  // taper towards the end by pulling vertices to the centre line
  const seg = tube.parameters.tubularSegments, rad = tube.parameters.radialSegments;
  for (let i = 0; i <= seg; i++) {
    const t = i / seg, k = 1 - taper * t;
    const c = curve.getPointAt(t);
    for (let j = 0; j <= rad; j++) {
      const id = i * (rad + 1) + j;
      pos.setXYZ(id, c.x + (pos.getX(id) - c.x) * k, c.y + (pos.getY(id) - c.y) * k, c.z + (pos.getZ(id) - c.z) * k);
    }
  }
  tube.computeVertexNormals();
  return { geometry: tube, curve };
}

/** Cherry blossom cluster: 6–9 five-petal flowers on short pedicels around a spur. */
export function blossomCluster(seed = 1) {
  const r = rng(seed);
  const parts = [];
  const n = 6 + Math.floor(r() * 4);
  for (let f = 0; f < n; f++) {
    const dir = new THREE.Vector3(r() - 0.5, r() * 0.8 - 0.2, r() - 0.5).normalize();
    const pos = dir.clone().multiplyScalar(0.18 + r() * 0.1);
    const flower = [];
    for (let k = 0; k < 5; k++) {
      const p = bladeGeometry({ len: 0.12, wid: 0.1, width: (v) => Math.sin(Math.min(1, v * 1.08) * Math.PI * 0.95) * (0.6 + 0.4 * v), cup: 0.25, curl: 0.06, ruffle: 0.03, seed: seed * 97 + f * 5 + k, segU: 4, segV: 5, baseShade: 0.85 });
      p.translate(0, 0.01, 0);
      p.rotateX(-0.35); // petals open slightly forward
      p.rotateZ((k / 5) * Math.PI * 2 + r() * 0.2);
      flower.push(p);
    }
    const g = mergeGeometries(flower);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(), dir, new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationY(Math.PI));
    m.setPosition(pos);
    g.applyMatrix4(m);
    parts.push(g);
  }
  return mergeGeometries(parts);
}