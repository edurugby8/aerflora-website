// Aerflora 3D cabin, rendered offline frame by frame into the canvas
// sequence (scripts/render-3d-frames.mjs). Deterministic: frame i always
// produces the same image, so scrubbing backwards matches forwards.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCabin, D, EYE, ROWS, ROW_PITCH } from './cabin.js';
import * as FL from './flowers.js';
import * as TX from './textures.js';

const R = TX.rng(20261005);
const rand = (a = 0, b = 1) => a + (b - a) * R();
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));

// ------------------------------------------------------------------ flora
const COLORS = {
  rose: ['#e9a3b4', '#f1c1c9', '#dc8ba1', '#f6d8dd', '#fbf2ee', '#f7e9e4'],
  orchid: ['#fbf8f4', '#f8f1f3'],
  hydra: ['#fbf7ee', '#f8eef1', '#f1f5e4'],
  wis: ['#cdb7e1', '#ddcdec', '#efe7f5'],
  leaf: ['#ffffff', '#e8f0dc', '#d8e4c8', '#f2f5e6'],
};

class Flora {
  constructor() {
    this.kinds = {};
    this.dummy = new THREE.Object3D();
    this.stems = [];
  }
  add(kind, pos, dir, scale, color, spin = R() * Math.PI * 2) {
    (this.kinds[kind] ??= []).push({ pos: pos.clone(), dir: dir.clone().normalize(), scale, color, spin });
  }
  addStem(points, radius = 0.007, taper = 0.6) {
    const s = FL.stem(points, radius, taper);
    this.stems.push(s.geometry);
    return s.curve;
  }
  build(geos, mats) {
    const group = new THREE.Group();
    const col = new THREE.Color();
    for (const [kind, list] of Object.entries(this.kinds)) {
      const variants = geos[kind];
      variants.forEach((geo, vi) => {
        const items = list.filter((_, k) => k % variants.length === vi);
        if (!items.length) return;
        const mesh = new THREE.InstancedMesh(geo, mats[kind], items.length);
        items.forEach((it, k) => {
          const d = this.dummy;
          d.position.copy(it.pos);
          d.up.set(0, 1, 0);
          d.lookAt(it.pos.clone().add(it.dir));
          d.rotateZ(it.spin);
          d.scale.setScalar(it.scale);
          d.updateMatrix();
          mesh.setMatrixAt(k, d.matrix);
          mesh.setColorAt(k, col.set(it.color));
        });
        mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.instanceMatrix.needsUpdate = true;
        group.add(mesh);
      });
    }
    if (this.stems.length) {
      const st = new THREE.Mesh(mergeGeometries(this.stems), mats.stem);
      st.castShadow = true; st.receiveShadow = true;
      group.add(st);
    }
    return group;
  }
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Flowers and leaves fixed along a vine curve. */
function dress(fl, curve, { step = 0.1, kinds = ['rose', 'leaf'], size = [0.1, 0.14], face, jitter = 0.04, leaves = 2 }) {
  const len = curve.getLength();
  for (let s = 0; s < len; s += step * rand(0.7, 1.3)) {
    const t = s / len;
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    const kind = pick(kinds);
    const off = V(rand(-jitter, jitter), rand(-jitter, jitter), rand(-jitter, jitter));
    const dir = face(p).add(V(rand(-0.35, 0.35), rand(-0.25, 0.35), rand(-0.3, 0.3)));
    const sc = rand(size[0], size[1]);
    if (kind === 'leaf') fl.add('leaf', p.clone().add(off), dir, sc * 1.2, pick(COLORS.leaf));
    else if (kind === 'wis') fl.add('wis', p.clone(), V(tan.x, 0, tan.z).lengthSq() > 0 ? V(0, 0, -1) : V(0, 0, -1), sc * 6, pick(COLORS.wis));
    else fl.add(kind, p.clone().add(off), dir, sc * (kind === 'hydra' ? 0.9 : 1), pick(COLORS[kind]));
    for (let k = 0; k < leaves; k++) {
      const ld = dir.clone().add(V(rand(-0.8, 0.8), rand(-0.6, 0.4), rand(-0.6, 0.6)));
      fl.add('leaf', p.clone().add(V(rand(-0.05, 0.05), rand(-0.05, 0.03), rand(-0.05, 0.05))), ld, rand(0.08, 0.13), pick(COLORS.leaf));
    }
  }
}

function buildFlora() {
  const fl = new Flora();
  // 1. seat-top arrangements, anchored on a vine along each row's backrests
  for (const z of ROWS) for (const side of [1, -1]) {
    const pts = [];
    for (let x = 0.47; x <= 1.72; x += 0.18) pts.push(V(side * x, 1.255 + rand(-0.01, 0.025), z - 0.115 + rand(-0.02, 0.02)));
    const c = fl.addStem(pts, 0.008, 0.2);
    dress(fl, c, { step: 0.085, kinds: ['rose', 'rose', 'hydra', 'orchid', 'leaf'], size: [0.1, 0.15], face: () => V(0, 0.55, -1), leaves: 2 });
    // leaves draping over the backrest
    for (let k = 0; k < 5; k++) fl.add('leaf', V(side * rand(0.5, 1.7), rand(1.12, 1.22), z - 0.13), V(0, -0.2, -1), rand(0.1, 0.15), pick(COLORS.leaf), Math.PI + rand(-0.6, 0.6));
  }
  // 2. garland along each bin lip with short wisteria racemes (kept above the seats)
  for (const side of [1, -1]) {
    const pts = [];
    for (let z = -1.5; z < D - 0.6; z += ROW_PITCH / 2) pts.push(V(side * 1.075, 1.675 - (Math.round(z / (ROW_PITCH / 2)) % 2 ? 0.035 : 0), z));
    const c = fl.addStem(pts, 0.009, 0);
    dress(fl, c, { step: 0.11, kinds: ['rose', 'hydra', 'leaf', 'rose'], size: [0.09, 0.13], face: () => V(-side * 0.8, -0.45, -0.5), leaves: 2 });
    for (let z = -1.2; z < D - 0.8; z += rand(0.28, 0.42)) fl.add('wis', V(side * rand(1.03, 1.12), 1.66, z), V(0, 0, -1), rand(0.45, 0.6), pick(COLORS.wis));
  }
  // 3. two ceiling vines over the aisle, roses facing down, wisteria hanging
  //    above head height (lowest tip ≈ 1.72 m, the eye is at 1.45 m)
  for (const x of [-0.24, 0.24]) {
    const pts = [];
    for (let z = -1.5; z < D - 0.5; z += 0.6) pts.push(V(x + rand(-0.04, 0.04), 2.27, z));
    const c = fl.addStem(pts, 0.008, 0);
    dress(fl, c, { step: 0.16, kinds: ['rose', 'hydra', 'leaf', 'leaf'], size: [0.08, 0.12], face: () => V(0, -1, -0.4), leaves: 2 });
    for (let z = -1.2; z < D - 0.8; z += rand(0.45, 0.75)) fl.add('wis', V(x + rand(-0.1, 0.1), 2.27, z), V(0, 0, -1), rand(0.6, 0.9), pick(COLORS.wis));
  }
  // 4. arches across the ceiling every second row
  ROWS.forEach((z, i) => {
    if (i % 2) return;
    const pts = [V(-1.07, 1.7, z), V(-0.85, 2.12, z), V(-0.4, 2.27, z), V(0, 2.3, z), V(0.4, 2.27, z), V(0.85, 2.12, z), V(1.07, 1.7, z)];
    const c = fl.addStem(pts, 0.01, 0);
    dress(fl, c, { step: 0.09, kinds: ['rose', 'rose', 'hydra', 'orchid', 'leaf'], size: [0.09, 0.13], face: (p) => V(-p.x * 0.6, -1, -0.6), leaves: 2 });
  });
  // 5. branches that reach into the aisle at face height – the camera brushes
  //    past their tips (11–20 cm from the lens) and they leave through the edges
  const sprays = [];
  ROWS.forEach((z, i) => {
    for (const side of [1, -1]) {
      const main = (i % 2 === 0) === (side > 0);
      if (!main && R() > 0.4) continue;
      const tipX = side * rand(0.11, 0.2), tipY = rand(1.36, 1.62);
      const zz = z - 0.12;
      const pts = [V(side * 0.5, 1.2, zz), V(side * 0.4, 1.33, zz - 0.12), V(side * 0.29, tipY + 0.02, zz - 0.25), V(tipX, tipY, zz - rand(0.32, 0.42))];
      sprays.push(pts);
    }
  });
  // foreground for the first frames
  for (const side of [1, -1]) sprays.push([V(side * 0.75, 1.0, 0.75), V(side * 0.55, 1.25, 0.6), V(side * 0.36, 1.42, 0.5), V(side * 0.22, 1.52, 0.42)]);
  for (const pts of sprays) {
    const c = fl.addStem(pts, 0.006, 0.7);
    const len = c.getLength();
    for (let s = 0.05; s < len; s += 0.045) {
      const t = s / len, p = c.getPointAt(t), tan = c.getTangentAt(t);
      const side = Math.sign(p.x) || 1;
      const out = V(-tan.z, rand(-0.2, 0.6), tan.x).multiplyScalar(R() < 0.5 ? 1 : -1);
      fl.add('leaf', p, out.add(V(0, 0, -0.6)), rand(0.09, 0.14) * (1 - 0.3 * t), pick(COLORS.leaf));
      if (t > 0.55 && R() < 0.45) fl.add(R() < 0.6 ? 'orchid' : 'rose', p.clone().add(V(-side * 0.01, 0.02, 0)), V(-side * 0.4, 0.3, -1), rand(0.09, 0.12), pick(R() < 0.6 ? COLORS.orchid : COLORS.rose));
    }
  }
  // 6. low ferns along the aisle edge, anchored at the seat bases
  for (const side of [1, -1]) for (let z = 0.6; z < D - 1; z += rand(0.18, 0.3)) {
    const base = V(side * 0.465, 0.03, z);
    for (let k = 0; k < 3; k++) fl.add('leaf', base.clone().add(V(0, rand(0.05, 0.22), rand(-0.05, 0.05))), V(-side * rand(0.5, 1), rand(0.4, 1), -0.4), rand(0.12, 0.2), pick(COLORS.leaf));
    if (R() < 0.3) fl.add('rose', base.clone().add(V(-side * 0.02, rand(0.12, 0.3), 0)), V(-side, 0.6, -0.8), rand(0.09, 0.12), pick(COLORS.rose));
  }
  // 7. the flower frame around the door (kept clear of the opening and the EXIT sign)
  for (const side of [1, -1]) {
    const pts = [V(side * 0.76, 0.05, D - 0.08), V(side * 0.79, 0.9, D - 0.08), V(side * 0.76, 1.75, D - 0.08), V(side * 0.6, 2.1, D - 0.08), V(side * 0.24, 2.22, D - 0.08)];
    const c = fl.addStem(pts, 0.012, 0);
    const len = c.getLength();
    for (let s = 0; s < len; s += 0.035) {
      const p = c.getPointAt(s / len);
      for (let k = 0; k < 3; k++) {
        const q = p.clone().add(V(side * rand(0, 0.28), rand(-0.06, 0.06), -rand(0, 0.3)));
        const kind = pick(['rose', 'rose', 'hydra', 'orchid', 'leaf', 'leaf']);
        fl.add(kind, q, V(side * rand(-0.2, 0.5), rand(-0.2, 0.5), -1), rand(0.11, 0.17), pick(COLORS[kind]));
      }
    }
    for (let k = 0; k < 90; k++) {
      const q = V(side * rand(0.68, 1.25), rand(0.02, 0.55), D - rand(0.1, 0.65));
      const kind = pick(['rose', 'hydra', 'leaf', 'leaf', 'orchid']);
      fl.add(kind, q, V(side * rand(-0.3, 0.3), rand(0.2, 0.8), -1), rand(0.12, 0.18), pick(COLORS[kind]));
    }
  }
  return fl;
}

// ------------------------------------------------------------------ sky & tree
function buildOutside() {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(320, 32, 24), new THREE.MeshBasicMaterial({ map: TX.skyDome(), side: THREE.BackSide, fog: false, toneMapped: false }));
  dome.position.set(0, EYE, D); g.add(dome);
  const cloudTex = [TX.cloud(1), TX.cloud(2), TX.cloud(3)];
  const cloudMats = cloudTex.map((t) => new THREE.SpriteMaterial({ map: t, fog: false, depthWrite: false, color: '#ffffff', toneMapped: false }));
  for (let k = 0; k < 260; k++) {
    const s = new THREE.Sprite(pick(cloudMats));
    const z = D + rand(8, 140), sc = rand(8, 26) * (0.5 + (z - D) / 140);
    s.position.set(rand(-90, 90), rand(-9, -2.5) - (z - D) * 0.02, z);
    s.scale.set(sc * 1.6, sc, 1); g.add(s);
  }
  // cloud mound the tree stands on
  for (let k = 0; k < 18; k++) {
    const s = new THREE.Sprite(pick(cloudMats));
    const sc = rand(2.5, 5.5);
    s.position.set(rand(-7, 7), rand(-2.6, -0.9), D + 12 + rand(-3, 3)); s.scale.set(sc * 1.5, sc, 1); g.add(s);
  }
  // cherry tree: bark-textured branches, blossom clusters at the twigs
  const bark = new THREE.MeshStandardMaterial({ map: TX.bark(), roughness: 0.95 });
  const parts = [], tips = [];
  const grow = (p, dir, len, rad, depth) => {
    const end = p.clone().add(dir.clone().multiplyScalar(len));
    const mid = p.clone().lerp(end, 0.5).add(V(rand(-0.15, 0.15), rand(-0.05, 0.1), rand(-0.15, 0.15)).multiplyScalar(len));
    parts.push(FL.stem([p, mid, end], rad, 0.35).geometry);
    if (depth === 0) { tips.push(end); return; }
    const n = depth > 3 ? 2 : 3;
    for (let k = 0; k < n; k++) {
      const nd = dir.clone().add(V(rand(-0.9, 0.9), rand(-0.1, 0.5), rand(-0.6, 0.6))).normalize();
      grow(end, nd, len * rand(0.62, 0.78), rad * 0.62, depth - 1);
    }
    if (depth < 3) tips.push(end);
  };
  const base = V(0, -1.2, D + 12);
  grow(base, V(0, 1, 0), 2.1, 0.34, 6);
  g.add(new THREE.Mesh(mergeGeometries(parts), bark));
  const blossom = mergeGeometries([0, 1, 2, 3, 4].map((k) => {
    const p = FL.bladeGeometry({ len: 0.5, wid: 0.42, width: (v) => Math.sin(v * Math.PI * 0.95), cup: 0.3, curl: 0.1, seed: 40 + k, segU: 3, segV: 3, baseShade: 0.8 });
    p.rotateZ((k / 5) * Math.PI * 2);
    return p;
  }));
  const bm = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 });
  const N = 16000;
  const inst = new THREE.InstancedMesh(blossom, bm, N);
  const d = new THREE.Object3D(), c = new THREE.Color();
  const pinks = ['#f6c9d4', '#efb0c2', '#fbe1e8', '#f3bccb', '#fff0f3'];
  for (let k = 0; k < N; k++) {
    const t = tips[k % tips.length];
    d.position.copy(t).add(V(rand(-0.9, 0.9), rand(-0.45, 0.55), rand(-0.9, 0.9)));
    d.lookAt(d.position.clone().add(V(rand(-1, 1), rand(-0.2, 1), rand(-1, 1))));
    d.scale.setScalar(rand(0.09, 0.15));
    d.updateMatrix(); inst.setMatrixAt(k, d.matrix);
    const shadeK = 0.8 + 0.2 * Math.min(1, (d.position.y + 1) / 5);
    inst.setColorAt(k, c.set(pick(pinks)).multiplyScalar(shadeK));
  }
  g.add(inst);
  return g;
}

// ------------------------------------------------------------------ depth of field
// Physical circle of confusion ∝ |1/d − 1/focus|: only things very close to
// the lens go soft; the middle distance stays sharp, the far end barely softens.
const DofShader = {
  uniforms: {
    tDiffuse: { value: null }, tDepth: { value: null },
    cameraNear: { value: 0.03 }, cameraFar: { value: 400 },
    focus: { value: 1.8 }, aperture: { value: 0.0045 }, maxblur: { value: 0.03 }, aspect: { value: 16 / 9 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    #include <packing>
    uniform sampler2D tDiffuse; uniform sampler2D tDepth;
    uniform float cameraNear, cameraFar, focus, aperture, maxblur, aspect;
    varying vec2 vUv;
    float dist(vec2 uv){ float d = unpackRGBAToDepth(texture2D(tDepth, uv)); return -perspectiveDepthToViewZ(d, cameraNear, cameraFar); }
    float coc(float d){ float c = aperture * (1.0 / max(d, 0.001) - 1.0 / focus); return c > 0.0 ? min(c, maxblur) : min(-c * 0.06, maxblur * 0.04); }
    void main(){
      float r = coc(dist(vUv));
      // let blurred foreground spread over the sharp background behind it
      for (int i = 0; i < 12; i++) {
        float a = float(i) * 0.5236;
        vec2 o = vec2(cos(a), sin(a) * aspect) * maxblur * 0.5;
        r = max(r, coc(dist(vUv + o)) * 0.75);
      }
      if (r < 0.0006) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 acc = vec4(0.0);
      for (int i = 0; i < 64; i++) {
        float a = float(i) * 2.39996;
        float rr = sqrt((float(i) + 0.5) / 64.0) * r;
        acc += texture2D(tDiffuse, vUv + vec2(cos(a), sin(a) * aspect) * rr);
      }
      gl_FragColor = acc / 64.0;
    }`,
};

// ------------------------------------------------------------------ setup
let S = null;

export function setup({ width, height, portrait, frameCount, markers }) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3ede3');
  scene.fog = new THREE.Fog('#efe7da', 10, 60);

  const cabin = buildCabin();
  scene.add(cabin.group);
  scene.add(buildOutside());

  // flora
  const fl = buildFlora();
  const petalTex = [TX.petal(1), TX.petal(2)];
  const flowerMat = new THREE.MeshPhysicalMaterial({ map: petalTex[0], vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, sheen: 0.6, sheenRoughness: 0.45, sheenColor: new THREE.Color('#ffffff') });
  const leafMat = new THREE.MeshStandardMaterial({ map: TX.leaf(), vertexColors: true, side: THREE.DoubleSide, roughness: 0.5 });
  const geos = {
    rose: [FL.rose(0.45, 1), FL.rose(0.7, 2), FL.rose(0.9, 3)],
    orchid: [FL.orchid(1), FL.orchid(2)],
    hydra: [FL.hydrangea(1), FL.hydrangea(2)],
    leaf: [FL.leafGeometry(1), FL.leafGeometry(2), FL.leafGeometry(3)],
    wis: [FL.wisteria(1), FL.wisteria(2)],
  };
  const mats = { rose: flowerMat, orchid: flowerMat, hydra: flowerMat, wis: flowerMat, leaf: leafMat, stem: new THREE.MeshStandardMaterial({ color: '#566a3c', roughness: 0.8 }) };
  scene.add(fl.build(geos, mats));

  // falling petals (positions are a pure function of the frame index)
  const PET = 700;
  const petals = new THREE.InstancedMesh(FL.loosePetal(), flowerMat, PET);
  petals.castShadow = false;
  const petalSeeds = Array.from({ length: PET }, (_, k) => ({ x: rand(-1.2, 1.2), y: rand(0, 2.3), z: rand(-1, D + 0.5), fall: rand(0.25, 0.45), sway: rand(0.04, 0.12), ph: rand(0, 6.3), spin: rand(0.5, 2), gust: k > 420, col: pick(['#f4c6d1', '#efb2c3', '#fbe4ea', '#fff7f4']) }));
  const pc = new THREE.Color();
  petalSeeds.forEach((p, k) => petals.setColorAt(k, pc.set(p.col)));
  scene.add(petals);

  // light: warm sun through the right-hand windows, daylight through the door,
  // soft sky fill and the cabin's own ceiling lights
  const sun = new THREE.DirectionalLight('#fff0d8', 4.2);
  sun.position.set(7.5, 6.5, 7); sun.target.position.set(0, 1, 10);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const doorSun = new THREE.DirectionalLight('#fff4e4', 0.0);
  doorSun.position.set(0.6, 4, D + 10); doorSun.target.position.set(0, 0.5, D - 5);
  doorSun.castShadow = true; doorSun.shadow.mapSize.set(2048, 2048);
  Object.assign(doorSun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 30 });
  doorSun.shadow.bias = -0.0004; doorSun.shadow.normalBias = 0.02;
  scene.add(doorSun, doorSun.target);
  scene.add(new THREE.HemisphereLight('#fbf6ee', '#c9bba3', 1.15));
  for (let z = -1; z < D; z += 2.4) {
    const l = new THREE.PointLight('#ffe8c8', 0.9, 4.5, 2);
    l.position.set(0, 1.9, z); scene.add(l);
  }

  const camera = new THREE.PerspectiveCamera(portrait ? 80 : 60, width / height, 0.03, 400);

  // post: AO for contact shadows/volume, gentle bloom on daylight, physical DOF
  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, width, height);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 0.9;
  gtao.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.5, thickness: 1.5, scale: 1.0, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.14, 0.55, 0.96));
  const depthRT = new THREE.WebGLRenderTarget(width, height);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const dof = new ShaderPass(DofShader);
  dof.uniforms.tDepth.value = depthRT.texture;
  dof.uniforms.aspect.value = width / height;
  composer.addPass(dof);
  composer.addPass(new OutputPass());

  S = { renderer, scene, camera, composer, depthRT, depthMat, dof, cabin, petals, petalSeeds, sun, doorSun, frameCount, markers, width, height };
}

function cameraZ(i) {
  const { frameCount: N, markers } = S;
  const arrive = markers.arrive;
  if (i <= arrive) return (D - 2.1) * easeInOut(i / arrive);
  return D - 2.1 + 0.75 * easeInOut((i - arrive) / (N - 1 - arrive));
}

export function renderFrame(i) {
  const { renderer, scene, camera, composer, depthRT, depthMat, dof, cabin, petals, petalSeeds, doorSun, markers, frameCount } = S;
  const clock = (i * 144) / frameCount; // motion authored on a 144-frame clock
  const z = cameraZ(i);
  camera.position.set(0, EYE, z);
  camera.lookAt(0, EYE - 0.12, z + 10);

  // door
  const open = easeInOut((i - markers.doorOpenStart) / (markers.doorOpenEnd - markers.doorOpenStart));
  const ang = (open * 80 * Math.PI) / 180;
  for (const { pivot, side } of cabin.doorLeaves) pivot.rotation.y = side * ang;
  doorSun.intensity = 3.2 * open;

  // petals: drift down and sway; a gust blows through the door as it opens
  const gust = smooth(markers.doorOpenStart - 4, markers.doorOpenEnd, i);
  const d = new THREE.Object3D();
  petalSeeds.forEach((p, k) => {
    let x = p.x + Math.sin(clock * 0.09 + p.ph) * p.sway;
    let y = (((p.y - clock * 0.012 * p.fall * 2) % 2.3) + 2.3) % 2.3 + 0.02;
    let pz = p.z;
    let s = 1;
    if (p.gust) {
      // gust petals stream from beyond the door towards the camera
      const travel = gust * 7 + p.ph * 0.4;
      pz = D + 1.5 - travel;
      x = p.x * 0.45 + Math.sin(clock * 0.15 + p.ph) * 0.1;
      y = 0.4 + (p.y / 2.3) * 1.6;
      s = gust > 0.01 ? 1 : 0;
    }
    d.position.set(x, y, pz);
    d.rotation.set(clock * 0.05 * p.spin + p.ph, clock * 0.07 * p.spin, p.ph);
    d.scale.setScalar(s);
    d.updateMatrix(); petals.setMatrixAt(k, d.matrix);
  });
  petals.instanceMatrix.needsUpdate = true;

  // depth pass for the DOF
  scene.overrideMaterial = depthMat;
  const bg = scene.background; scene.background = null;
  renderer.setRenderTarget(depthRT); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null; scene.background = bg;
  dof.uniforms.cameraNear.value = camera.near; dof.uniforms.cameraFar.value = camera.far;
  composer.render();
}

export function snapshot(type = 'image/webp', quality = 0.82, w, h) {
  const src = S.renderer.domElement;
  if (!w) return src.toDataURL(type, quality);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
  return c.toDataURL(type, quality);
}
