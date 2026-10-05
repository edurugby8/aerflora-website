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
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildCabin, D, EYE, ROWS, ROW_PITCH } from './cabin.js';
import { buildSky } from './sky.js';
import * as FL from './flowers.js';
import * as TX from './textures.js';

const R = TX.rng(20261005);
const rand = (a = 0, b = 1) => a + (b - a) * R();
const pick = (arr) => arr[Math.floor(R() * arr.length)];
const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const easeInOut = (t) => 0.5 - 0.5 * Math.cos(Math.PI * Math.min(1, Math.max(0, t)));
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const CAM_END = D - 1.6; // where the camera stops in front of the open door
const TREE = V(0, -6.2, D + 32); // close enough to dominate, sunk into the clouds so the crown fits the door
const CLOUD_SUN = V(-0.55, 0.62, 0.75).normalize(); // low warm sun ahead: back-lit blossoms, silver linings

// ------------------------------------------------------------------ flora
const COLORS = {
  rose: ['#e9a3b4', '#f1c1c9', '#dc8ba1', '#f6d8dd', '#fbf2ee', '#f7e9e4', '#eeb2bd', '#f9e1e3'],
  orchid: ['#fbf8f4', '#f8f1f3', '#fcf6f8'],
  hydra: ['#fbf7ee', '#f8eef1', '#f1f5e4', '#f6f2fa'],
  wis: ['#cdb7e1', '#ddcdec', '#efe7f5', '#d6c3e6'],
  leaf: ['#ffffff', '#e8f0dc', '#d8e4c8', '#f2f5e6', '#e2ebd2'],
};
// rough radius of each kind at scale 1, used for the camera clearance test
const RADIUS = { rose: 0.55, orchid: 0.5, hydra: 0.5, leaf: 1.0, wis: 0.12 };

// the camera travels along x = 0, y = EYE; nothing may come closer than this
const CLEAR = 0.1;
function clearOfCamera(pos, r) {
  if (pos.z < -1.2 || pos.z > CAM_END + 0.6) return true;
  return Math.hypot(pos.x, pos.y - EYE) >= CLEAR + r;
}

class Flora {
  constructor() { this.kinds = {}; this.stems = []; this.dummy = new THREE.Object3D(); this.rejected = 0; }
  add(kind, pos, dir, scale, color, spin = R() * Math.PI * 2) {
    if (!clearOfCamera(pos, RADIUS[kind] * scale)) { this.rejected++; return false; }
    (this.kinds[kind] ??= []).push({ pos: pos.clone(), dir: dir.clone().normalize(), scale, color, spin, v: R() });
    return true;
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
        // random (not round-robin) variant assignment: no visible pattern
        const items = list.filter((it) => Math.floor(it.v * variants.length) === vi);
        if (!items.length) return;
        const mesh = new THREE.InstancedMesh(geo, mats[kind], items.length);
        items.forEach((it, k) => {
          const d = this.dummy;
          d.position.copy(it.pos); d.up.set(0, 1, 0);
          d.lookAt(it.pos.clone().add(it.dir)); d.rotateZ(it.spin);
          d.scale.setScalar(it.scale); d.updateMatrix();
          mesh.setMatrixAt(k, d.matrix);
          // per-instance hue/saturation/lightness jitter
          col.set(it.color).offsetHSL((it.v - 0.5) * 0.025, ((it.v * 7.3) % 1 - 0.5) * 0.08, ((it.v * 3.1) % 1 - 0.5) * 0.06);
          mesh.setColorAt(k, col);
        });
        mesh.castShadow = true; mesh.receiveShadow = true;
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

/** Flowers and leaves fixed along a vine curve. */
function dress(fl, curve, { step = 0.1, kinds = ['rose', 'leaf'], size = [0.1, 0.14], face, jitter = 0.035, leaves = 2 }) {
  const len = curve.getLength();
  for (let s = 0; s < len; s += step * rand(0.75, 1.35)) {
    const p = curve.getPointAt(s / len);
    const kind = pick(kinds);
    const off = V(rand(-jitter, jitter), rand(-jitter, jitter), rand(-jitter, jitter));
    const dir = face(p).add(V(rand(-0.4, 0.4), rand(-0.3, 0.4), rand(-0.35, 0.35)));
    const sc = rand(size[0], size[1]);
    fl.add(kind, p.clone().add(off), dir, kind === 'leaf' ? sc * 1.2 : kind === 'orchid' ? sc * 0.9 : sc, pick(COLORS[kind]));
    for (let k = 0; k < leaves; k++) {
      const ld = dir.clone().add(V(rand(-0.8, 0.8), rand(-0.6, 0.4), rand(-0.6, 0.6)));
      fl.add('leaf', p.clone().add(V(rand(-0.05, 0.05), rand(-0.05, 0.03), rand(-0.05, 0.05))), ld, rand(0.07, 0.13), pick(COLORS.leaf));
    }
  }
}

/** A leafy branch from an anchor to a tip, flowers towards the tip; leaves point away from the aisle centre. */
function spray(fl, pts, { flowers = 0.45, kinds = ['orchid', 'rose'] } = {}) {
  const c = fl.addStem(pts, 0.006, 0.7);
  const len = c.getLength();
  for (let s = 0.04; s < len; s += rand(0.035, 0.055)) {
    const t = s / len, p = c.getPointAt(t), tan = c.getTangentAt(t);
    const side = Math.sign(p.x) || 1;
    const perp = V(-tan.z, 0, tan.x).multiplyScalar(R() < 0.5 ? 1 : -1);
    const out = perp.add(V(side * 0.6, rand(-0.2, 0.6), -0.5));
    fl.add('leaf', p, out, rand(0.08, 0.13) * (1 - 0.3 * t), pick(COLORS.leaf));
    if (t > 0.5 && R() < flowers) {
      const kind = pick(kinds);
      fl.add(kind, p.clone().add(V(side * 0.015, 0.02, 0)), V(-side * 0.35, 0.3, -1), rand(0.08, 0.12), pick(COLORS[kind]));
    }
  }
}

function buildFlora() {
  const fl = new Flora();
  // 1. seat-top arrangements on a vine along each row's backrests
  for (const z of ROWS) for (const side of [1, -1]) {
    const pts = [];
    for (let x = 0.47; x <= 1.72; x += 0.18) pts.push(V(side * x, 1.255 + rand(-0.01, 0.025), z - 0.115 + rand(-0.02, 0.02)));
    const c = fl.addStem(pts, 0.008, 0.2);
    dress(fl, c, { step: 0.09, kinds: ['rose', 'rose', 'orchid', 'orchid', 'leaf'], size: [0.09, 0.15], face: () => V(0, 0.55, -1), leaves: 2 });
    for (let k = 0; k < 4; k++) fl.add('leaf', V(side * rand(0.5, 1.7), rand(1.12, 1.22), z - 0.13), V(0, -0.2, -1), rand(0.1, 0.15), pick(COLORS.leaf), Math.PI + rand(-0.6, 0.6));
  }
  // 2. garland along each bin lip with short wisteria (kept above the seats)
  for (const side of [1, -1]) {
    const pts = [];
    for (let z = -1.5; z < D - 0.6; z += ROW_PITCH / 2) pts.push(V(side * 1.075, 1.675 - (Math.round(z / (ROW_PITCH / 2)) % 2 ? 0.035 : 0), z));
    const c = fl.addStem(pts, 0.009, 0);
    dress(fl, c, { step: 0.12, kinds: ['rose', 'orchid', 'leaf', 'rose'], size: [0.08, 0.13], face: () => V(-side * 0.8, -0.45, -0.5), leaves: 2 });
    for (let z = -1.2; z < D - 0.8; z += rand(0.3, 0.5)) fl.add('wis', V(side * rand(1.03, 1.12), 1.66, z), V(0, 0, -1), rand(0.42, 0.6), pick(COLORS.wis));
  }
  // 3. two ceiling vines; wisteria and single blooms hang from them
  for (const x of [-0.24, 0.24]) {
    const pts = [];
    for (let z = -1.5; z < D - 0.5; z += 0.6) pts.push(V(x + rand(-0.04, 0.04), 2.27, z));
    const c = fl.addStem(pts, 0.008, 0);
    dress(fl, c, { step: 0.17, kinds: ['rose', 'orchid', 'leaf', 'leaf'], size: [0.08, 0.12], face: () => V(0, -1, -0.4), leaves: 2 });
    for (let z = -1.2; z < D - 0.8; z += rand(0.45, 0.75)) fl.add('wis', V(x + rand(-0.1, 0.1), 2.27, z), V(0, 0, -1), rand(0.6, 0.9), pick(COLORS.wis));
    // single blooms on long stems, just above and beside the head
    for (let z = 0.2; z < D - 1.8; z += rand(0.7, 1.2)) {
      const hx = Math.sign(x) * rand(0.14, 0.24), hy = rand(1.66, 1.78);
      const pts2 = [V(x, 2.27, z), V((x + hx) / 2, (2.27 + hy) / 2 + 0.05, z - 0.05), V(hx, hy, z - 0.08)];
      fl.addStem(pts2, 0.004, 0.5);
      const kind = pick(['rose', 'orchid', 'rose']);
      fl.add(kind, V(hx, hy - 0.02, z - 0.08), V(-Math.sign(x) * 0.3, -0.6, -1), rand(0.09, 0.12), pick(COLORS[kind]));
      fl.add('leaf', V(hx, hy + 0.04, z - 0.06), V(Math.sign(x), 0.3, -0.5), rand(0.08, 0.11), pick(COLORS.leaf));
    }
  }
  // 4. arches across the ceiling every second row
  ROWS.forEach((z, i) => {
    if (i % 2) return;
    const pts = [V(-1.07, 1.7, z), V(-0.85, 2.12, z), V(-0.4, 2.27, z), V(0, 2.3, z), V(0.4, 2.27, z), V(0.85, 2.12, z), V(1.07, 1.7, z)];
    const c = fl.addStem(pts, 0.01, 0);
    dress(fl, c, { step: 0.1, kinds: ['rose', 'rose', 'orchid', 'orchid', 'leaf'], size: [0.08, 0.13], face: (p) => V(-p.x * 0.6, -1, -0.6), leaves: 2 });
  });
  // 5. branches that reach into the aisle at three heights; their tips pass
  //    10–22 cm from the lens and slide past the background with parallax
  ROWS.forEach((z, i) => {
    for (const side of [1, -1]) {
      const zz = z - 0.12;
      // face height
      if ((i % 2 === 0) === (side > 0) || R() < 0.35) {
        const tipX = side * rand(0.13, 0.21), tipY = rand(1.36, 1.58);
        spray(fl, [V(side * 0.5, 1.2, zz), V(side * 0.4, 1.33, zz - 0.12), V(side * 0.29, tipY + 0.02, zz - 0.25), V(tipX, tipY, zz - rand(0.32, 0.42))]);
      }
      // low, from the armrest, sweeping the lower edge of the frame
      if (R() < 0.45) {
        spray(fl, [V(side * 0.47, 0.72, z + 0.15), V(side * 0.36, 0.92, z + 0.02), V(side * rand(0.18, 0.26), rand(1.05, 1.18), z - 0.12)], { flowers: 0.6, kinds: ['rose', 'orchid'] });
      }
    }
  });
  // foreground for the first frames
  for (const side of [1, -1]) spray(fl, [V(side * 0.75, 1.0, 0.75), V(side * 0.55, 1.25, 0.6), V(side * 0.36, 1.42, 0.5), V(side * 0.23, 1.52, 0.42)]);
  // 6. low ferns along the aisle edge, anchored at the seat bases
  for (const side of [1, -1]) for (let z = 0.6; z < D - 1; z += rand(0.18, 0.3)) {
    const base = V(side * 0.465, 0.03, z);
    for (let k = 0; k < 3; k++) fl.add('leaf', base.clone().add(V(0, rand(0.05, 0.22), rand(-0.05, 0.05))), V(-side * rand(0.5, 1), rand(0.4, 1), -0.4), rand(0.12, 0.2), pick(COLORS.leaf));
    if (R() < 0.3) fl.add('rose', base.clone().add(V(-side * 0.02, rand(0.12, 0.3), 0)), V(-side, 0.6, -0.8), rand(0.09, 0.12), pick(COLORS.rose));
  }
  // 7. flower frame around the door (clear of the opening and the EXIT sign)
  for (const side of [1, -1]) {
    const pts = [V(side * 0.76, 0.05, D - 0.08), V(side * 0.79, 0.9, D - 0.08), V(side * 0.76, 1.75, D - 0.08), V(side * 0.6, 2.1, D - 0.08), V(side * 0.24, 2.22, D - 0.08)];
    const c = fl.addStem(pts, 0.012, 0);
    const len = c.getLength();
    for (let s = 0; s < len; s += 0.04) {
      const p = c.getPointAt(s / len);
      for (let k = 0; k < 3; k++) {
        const q = p.clone().add(V(side * rand(0, 0.28), rand(-0.06, 0.06), -rand(0, 0.3)));
        const kind = pick(['rose', 'rose', 'orchid', 'orchid', 'leaf', 'leaf']);
        fl.add(kind, q, V(side * rand(-0.2, 0.5), rand(-0.2, 0.5), -1), rand(0.1, 0.17), pick(COLORS[kind]));
      }
    }
    for (let k = 0; k < 80; k++) {
      const q = V(side * rand(0.68, 1.25), rand(0.02, 0.55), D - rand(0.1, 0.65));
      const kind = pick(['rose', 'orchid', 'leaf', 'leaf', 'orchid']);
      fl.add(kind, q, V(side * rand(-0.3, 0.3), rand(0.2, 0.8), -1), rand(0.11, 0.18), pick(COLORS[kind]));
    }
  }
  return fl;
}

// translucency: thin petals and leaves let light through, so they brighten
// with their own colour, more at grazing angles (a cheap subsurface term)
function translucent(mat, k) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTrans = { value: k };
    sh.fragmentShader = 'uniform float uTrans;\n' + sh.fragmentShader.replace('#include <opaque_fragment>', `
      { float facing = abs(dot(normal, normalize(vViewPosition)));
        outgoingLight += diffuseColor.rgb * uTrans * (0.5 + 0.8 * pow(1.0 - facing, 2.0)); }
      #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => `translucent-${k}`;
  return mat;
}

// ------------------------------------------------------------------ cherry tree
function buildTree(petalMat) {
  const g = new THREE.Group();
  const bk = TX.bark();
  const barkMat = new THREE.MeshStandardMaterial({ map: bk.map, normalMap: bk.normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.92, fog: false });
  const parts = [], spurs = [];
  // root flare
  parts.push(FL.stem([TREE.clone().add(V(0, -1.0, 0)), TREE.clone(), TREE.clone().add(V(0.08, 1.3, 0.03))], 1.05, 0.35).geometry);
  const grow = (start, dir, len, rad, depth) => {
    const pts = [start.clone()];
    let p = start.clone();
    const d = dir.clone();
    for (let k = 1; k <= 4; k++) {
      d.add(V(rand(-0.22, 0.22), rand(-0.05, 0.1), rand(-0.22, 0.22))).normalize();
      p = p.clone().add(d.clone().multiplyScalar(len / 4));
      pts.push(p);
    }
    parts.push(FL.stem(pts, rad, depth === 0 ? 0.8 : 0.4).geometry);
    // blossom spurs spaced along the outer twigs, leaving gaps so branches show through
    if (depth <= 3) for (let k = 2; k < pts.length; k++) for (let m = 0; m < (depth <= 1 ? 3 : 1); m++) spurs.push(pts[k - 1].clone().lerp(pts[k], R()));
    if (depth === 0) { spurs.push(p.clone()); return; }
    const kids = depth >= 6 ? 3 : depth >= 4 ? 2 : 2 + (R() < 0.4 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const from = k === 0 ? p : pts[2 + Math.floor(R() * 2)];
      // cherries spread wide: more horizontal the higher the order
      // cherries open into a wide parasol: main limbs leave the trunk at a low angle
      const ang = (k / kids) * Math.PI * 2 + rand(-0.5, 0.5);
      const outward = V(Math.cos(ang), 0, Math.sin(ang) * 0.6);
      const nd = depth >= 6
        ? d.clone().multiplyScalar(0.6).add(outward.multiplyScalar(rand(0.9, 1.3))).add(V(0, rand(0.15, 0.45), 0)).normalize()
        : d.clone().add(V(rand(-0.9, 0.9), rand(-0.05, 0.35), rand(-0.6, 0.6))).normalize();
      grow(from, nd, len * rand(0.72, 0.86), rad * 0.62, depth - 1);
    }
  };
  grow(TREE.clone().add(V(0, 1.1, 0)), V(0.06, 1, 0.02).normalize(), 3.6, 0.72, 7);
  const trunk = new THREE.Mesh(mergeGeometries(parts), barkMat);
  trunk.castShadow = true;
  g.add(trunk);
  const clusters = [FL.blossomCluster(1), FL.blossomCluster(2), FL.blossomCluster(3)];
  const pinks = ['#f8cdd7', '#f2b6c6', '#fde6ec', '#f5c2cf', '#fff3f5', '#efa9bc'];
  const d = new THREE.Object3D(), c = new THREE.Color();
  clusters.forEach((geo, vi) => {
    const mine = spurs.filter((_, k) => k % 3 === vi);
    const inst = new THREE.InstancedMesh(geo, petalMat, mine.length);
    mine.forEach((s, k) => {
      d.position.copy(s).add(V(rand(-0.2, 0.2), rand(-0.12, 0.16), rand(-0.2, 0.2)));
      d.rotation.set(rand(0, 6.3), rand(0, 6.3), rand(0, 6.3));
      d.scale.setScalar(rand(1.0, 1.6)); d.updateMatrix();
      inst.setMatrixAt(k, d.matrix);
      const lift = 0.82 + 0.18 * Math.min(1, (s.y - TREE.y) / 14);
      inst.setColorAt(k, c.set(pick(pinks)).multiplyScalar(lift));
    });
    inst.castShadow = true;
    g.add(inst);
  });
  // lit cloud puffs tucking the base of the trunk into the cloud deck
  const puffs = [TX.cloudPuff(1), TX.cloudPuff(2), TX.cloudPuff(3)].map((t) => new THREE.SpriteMaterial({ map: t, depthWrite: false, fog: false }));
  for (let k = 0; k < 14; k++) {
    const s = new THREE.Sprite(pick(puffs));
    const sc = rand(3, 5.5);
    s.position.set(TREE.x + rand(-7, 7), TREE.y + rand(-1.6, 0.3), TREE.z + rand(-6, -1.5));
    s.scale.set(sc * 1.6, sc, 1);
    g.add(s);
  }
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
  renderer.toneMappingExposure = 0.84;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f3ede3');
  scene.fog = new THREE.Fog('#efe7da', 12, 70);
  // image-based ambient light and reflections: without it every PBR surface
  // looks flat and metal can't read as metal
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.28;

  const cabin = buildCabin();
  scene.add(cabin.group);

  const petalTex = TX.petal(1);
  const flowerMat = translucent(new THREE.MeshPhysicalMaterial({ map: petalTex, vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, sheen: 0.7, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ffffff') }), 0.09);
  const leafMat = translucent(new THREE.MeshPhysicalMaterial({ map: TX.leaf(), vertexColors: true, side: THREE.DoubleSide, roughness: 0.42, clearcoat: 0.25, clearcoatRoughness: 0.5 }), 0.05);
  const geos = {
    rose: [FL.rose(0.35, 1), FL.rose(0.5, 2), FL.rose(0.65, 3), FL.rose(0.8, 4), FL.rose(0.95, 5)],
    orchid: [FL.orchid(1), FL.orchid(2), FL.orchid(3)],
    hydra: [FL.hydrangea(1), FL.hydrangea(2)],
    leaf: [FL.leafGeometry(1), FL.leafGeometry(2), FL.leafGeometry(3), FL.leafGeometry(4)],
    wis: [FL.wisteria(1), FL.wisteria(2), FL.wisteria(3)],
  };
  const fl = buildFlora();
  const mats = { rose: flowerMat, orchid: flowerMat, hydra: flowerMat, wis: flowerMat, leaf: leafMat, stem: new THREE.MeshStandardMaterial({ color: '#566a3c', roughness: 0.7 }) };
  scene.add(fl.build(geos, mats));
  console.log('flora rejected for camera clearance:', fl.rejected);

  // outside: volumetric sky + cherry tree
  const sky = buildSky(CLOUD_SUN, TREE);
  scene.add(sky);
  // the tree lives outside the cabin haze: no fog on its materials
  const treeMat = flowerMat.clone(); treeMat.fog = false; translucent(treeMat, 0.12);
  scene.add(buildTree(treeMat));

  // falling petals (positions are a pure function of the frame index)
  const PET = 700;
  const petals = new THREE.InstancedMesh(FL.loosePetal(), flowerMat, PET);
  petals.castShadow = false;
  const petalSeeds = Array.from({ length: PET }, (_, k) => ({ x: rand(-1.2, 1.2), y: rand(0, 2.3), z: rand(-1, D + 0.5), fall: rand(0.25, 0.45), sway: rand(0.04, 0.12), ph: rand(0, 6.3), spin: rand(0.5, 2), gust: k > 460, col: pick(['#f4c6d1', '#efb2c3', '#fbe4ea', '#f7d0da']) }));
  const pc = new THREE.Color();
  petalSeeds.forEach((p, k) => petals.setColorAt(k, pc.set(p.col)));
  scene.add(petals);

  // light: warm sun through the right-hand windows, daylight through the
  // door once it opens, soft sky fill and the cabin's own lights
  const sun = new THREE.DirectionalLight('#fff0d8', 4.4);
  sun.position.set(7.5, 6.5, 7); sun.target.position.set(0, 1, 10);
  sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
  Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 0.5, far: 40 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015; sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const doorSun = new THREE.DirectionalLight('#ffe9d2', 0.0);
  doorSun.position.copy(V(0, 0, D).add(CLOUD_SUN.clone().multiplyScalar(30))); doorSun.target.position.set(0, 0.5, D - 5);
  doorSun.castShadow = true; doorSun.shadow.mapSize.set(2048, 2048);
  Object.assign(doorSun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 60 });
  doorSun.shadow.bias = -0.0004; doorSun.shadow.normalBias = 0.02;
  scene.add(doorSun, doorSun.target);
  // the tree is back-lit by the low sun; a separate soft key keeps the blossoms luminous
  const treeKey = new THREE.DirectionalLight('#fff1e6', 1.6);
  treeKey.position.copy(TREE).add(V(-6, 10, -14)); treeKey.target.position.copy(TREE);
  scene.add(treeKey, treeKey.target);
  scene.add(new THREE.HemisphereLight('#fbf6ee', '#b9ab93', 0.55));
  for (let z = -1; z < D; z += 2.4) {
    const l = new THREE.PointLight('#ffe8c8', 0.8, 4.5, 2);
    l.position.set(0, 1.9, z); scene.add(l);
  }

  const camera = new THREE.PerspectiveCamera(portrait ? 80 : 60, width / height, 0.03, 600);

  const target = new THREE.WebGLRenderTarget(width, height, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const gtao = new GTAOPass(scene, camera, width, height);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1.0;
  gtao.updateGtaoMaterial({ radius: 0.45, distanceExponent: 1.6, thickness: 1.6, scale: 1.1, samples: 16 });
  composer.addPass(gtao);
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.08, 0.4, 1.0));
  const depthRT = new THREE.WebGLRenderTarget(width, height);
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const dof = new ShaderPass(DofShader);
  dof.uniforms.tDepth.value = depthRT.texture;
  dof.uniforms.aspect.value = width / height;
  composer.addPass(dof);
  composer.addPass(new OutputPass());

  S = { renderer, scene, camera, composer, depthRT, depthMat, dof, cabin, petals, petalSeeds, doorSun, sky, frameCount, markers };
}

function cameraZ(i) {
  const { frameCount: N, markers } = S;
  const arrive = markers.arrive;
  if (i <= arrive) return (D - 2.1) * easeInOut(i / arrive);
  return D - 2.1 + (CAM_END - (D - 2.1)) * easeInOut((i - arrive) / (N - 1 - arrive));
}

export function renderFrame(i) {
  const { renderer, scene, camera, composer, depthRT, depthMat, dof, cabin, petals, petalSeeds, doorSun, sky, markers, frameCount } = S;
  const clock = (i * 144) / frameCount; // motion authored on a 144-frame clock
  const z = cameraZ(i);
  camera.position.set(0, EYE, z);
  camera.lookAt(0, EYE - 0.12, z + 10);
  camera.updateMatrixWorld();
  sky.position.copy(camera.position);
  sky.material.uniforms.uCam.value.copy(camera.position);

  const open = easeInOut((i - markers.doorOpenStart) / (markers.doorOpenEnd - markers.doorOpenStart));
  const ang = (open * 80 * Math.PI) / 180;
  for (const { pivot, side } of cabin.doorLeaves) pivot.rotation.y = side * ang;
  doorSun.intensity = 3.0 * open;
  sky.visible = open > 0.001; // the sky is only seen through the open door (windows use their own view)

  const gust = smooth(markers.doorOpenStart - 4, markers.doorOpenEnd, i);
  const d = new THREE.Object3D();
  petalSeeds.forEach((p, k) => {
    let x = p.x + Math.sin(clock * 0.09 + p.ph) * p.sway;
    let y = ((((p.y - clock * 0.012 * p.fall * 2) % 2.3) + 2.3) % 2.3) + 0.02;
    let pz = p.z, s = 1;
    if (p.gust) {
      const travel = gust * 7 + p.ph * 0.4;
      pz = D + 1.5 - travel;
      x = p.x * 0.6 + Math.sin(clock * 0.15 + p.ph) * 0.1;
      y = 0.4 + (p.y / 2.3) * 1.6;
      s = gust > 0.01 ? 0.8 : 0;
    }
    // keep falling petals off the lens itself
    if (Math.hypot(x, y - EYE) < 0.12 && Math.abs(pz - z) < 0.4) s = 0;
    d.position.set(x, y, pz);
    d.rotation.set(clock * 0.05 * p.spin + p.ph, clock * 0.07 * p.spin, p.ph);
    d.scale.setScalar(s);
    d.updateMatrix(); petals.setMatrixAt(k, d.matrix);
  });
  petals.instanceMatrix.needsUpdate = true;

  // depth pass for the DOF (sky hidden: it is infinitely far anyway)
  const skyVis = sky.visible; sky.visible = false;
  scene.overrideMaterial = depthMat;
  const bg = scene.background; scene.background = null;
  renderer.setRenderTarget(depthRT); renderer.setClearColor(0xffffff, 1); renderer.clear(); renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  scene.overrideMaterial = null; scene.background = bg; sky.visible = skyVis;
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
