// Aircraft cabin geometry: shell, window panels with real recesses, overhead
// bins, floor, 3+3 seats and the bulkhead door. Units are metres; the floor is
// y = 0 and the aisle runs along +z towards the door at z = D.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as TX from './textures.js';

export const D = 19;
export const EYE = 1.45;
export const ROW_PITCH = 0.9;
export const ROWS = [];
for (let z = 1.0; z < D - 1.7; z += ROW_PITCH) ROWS.push(z);
export const SEATS = [[0.45, 0.87], [0.88, 1.3], [1.31, 1.73]]; // |x| ranges, aisle seat first
export const DOOR = { w: 0.56, bottom: 0.05, top: 1.85, r: 0.14, jamb: 0.18 };

// right half of the cross-section, floor → ceiling centre; the window band
// (between WB0 and WB1) is built from separate panels with real holes
const LOWER = [[1.7, 0], [1.8, 0.55], [1.84, 0.98]];
const UPPER = [[1.83, 1.62], [1.64, 1.95], [1.22, 2.2], [0.6, 2.3], [0, 2.32]];
export const PROFILE = [...LOWER, ...UPPER];

const shadowy = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };

function ribbon(profile, z0, z1, steps) {
  // inward-facing strip swept along z
  const pos = [], uv = [], idx = [];
  const n = profile.length;
  let s = 0; const sAt = [0];
  for (let k = 1; k < n; k++) { s += Math.hypot(profile[k][0] - profile[k - 1][0], profile[k][1] - profile[k - 1][1]); sAt.push(s); }
  for (let j = 0; j <= steps; j++) {
    const z = z0 + ((z1 - z0) * j) / steps;
    for (let k = 0; k < n; k++) { pos.push(profile[k][0], profile[k][1], z); uv.push(sAt[k], z); }
  }
  for (let j = 0; j < steps; j++) for (let k = 0; k < n - 1; k++) {
    const a = j * n + k, b = a + 1, c = a + n, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function mirrorX(points) { return points.map(([x, y]) => [-x, y]); }

function roundRectShape(x0, y0, x1, y1, r, corners = [1, 1, 1, 1]) {
  const s = new THREE.Shape();
  const [bl, br, tr, tl] = corners.map((c) => (c ? r : 0));
  s.moveTo(x0 + bl, y0);
  s.lineTo(x1 - br, y0); if (br) s.quadraticCurveTo(x1, y0, x1, y0 + br);
  s.lineTo(x1, y1 - tr); if (tr) s.quadraticCurveTo(x1, y1, x1 - tr, y1);
  s.lineTo(x0 + tl, y1); if (tl) s.quadraticCurveTo(x0, y1, x0, y1 - tl);
  s.lineTo(x0, y0 + bl); if (bl) s.quadraticCurveTo(x0, y0, x0 + bl, y0);
  return s;
}
function roundRectPath(x0, y0, x1, y1, r) {
  const p = new THREE.Path();
  p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.quadraticCurveTo(x1, y0, x1, y0 + r);
  p.lineTo(x1, y1 - r); p.quadraticCurveTo(x1, y1, x1 - r, y1); p.lineTo(x0 + r, y1);
  p.quadraticCurveTo(x0, y1, x0, y1 - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0);
  return p;
}
function ellipsePath(cx, cy, rx, ry) { const p = new THREE.Path(); p.absellipse(cx, cy, rx, ry, 0, Math.PI * 2, true); return p; }

export function buildCabin() {
  const group = new THREE.Group();
  const pnl = TX.panel('#ece6d9');
  const wallMat = new THREE.MeshStandardMaterial({ color: '#ffffff', map: pnl.map, normalMap: pnl.normalMap, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.62, side: THREE.DoubleSide, shadowSide: THREE.DoubleSide });
  const binMat = new THREE.MeshStandardMaterial({ color: '#f3eee4', map: pnl.map, normalMap: pnl.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), roughness: 0.48, shadowSide: THREE.DoubleSide });
  const darkMat = new THREE.MeshStandardMaterial({ color: '#6c665c', roughness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: '#9a9c97', metalness: 0.7, roughness: 0.35 });
  const lightMat = new THREE.MeshStandardMaterial({ color: '#fff8ea', emissive: '#fff3df', emissiveIntensity: 0.35 });

  // --- shell (lower sidewall + upper sidewall/ceiling), both sides
  for (const side of [1, -1]) {
    for (const part of [LOWER, UPPER]) {
      const prof = side > 0 ? part : mirrorX(part).reverse();
      group.add(shadowy(new THREE.Mesh(ribbon(prof, -2, D + 0.02, 60), wallMat)));
    }
  }

  // --- window panels: real holes with depth, raised bezel, shade, sky view
  const viewTex = [TX.windowView(1), TX.windowView(2), TX.windowView(3)];
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#e9e3d6', roughness: 0.7, side: THREE.DoubleSide });
  const WB0 = 0.98, WB1 = 1.62, WC = 1.3, RZ = 0.13, RY = 0.19;
  let k = 0;
  for (let zc = -2 + ROW_PITCH / 2; zc - ROW_PITCH / 2 < D; zc += ROW_PITCH, k++) {
    const half = Math.min(ROW_PITCH / 2, D - zc) + 0.002;
    const hasWindow = zc < D - 1.2;
    const shape = new THREE.Shape();
    shape.moveTo(-ROW_PITCH / 2 - 0.002, WB0); shape.lineTo(half, WB0); shape.lineTo(half, WB1); shape.lineTo(-ROW_PITCH / 2 - 0.002, WB1); shape.closePath();
    if (hasWindow) shape.holes.push(ellipsePath(0, WC, RZ, RY));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: hasWindow, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 3, curveSegments: 24 });
    const bezelShape = new THREE.Shape(); bezelShape.absellipse(0, WC, RZ * 1.45, RY * 1.35, 0, Math.PI * 2, false); bezelShape.holes.push(ellipsePath(0, WC, RZ * 1.02, RY * 1.02));
    const bezel = new THREE.ExtrudeGeometry(bezelShape, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.008, bevelSegments: 3, curveSegments: 24 });
    for (const side of [1, -1]) {
      // shape x → world z, shape y → world y, extrusion → inwards (−side·x)
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, side), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-side, 0, 0));
      m.setPosition(side * 1.92, 0, zc);
      const panelMesh = shadowy(new THREE.Mesh(geo, wallMat)); panelMesh.applyMatrix4(m); group.add(panelMesh);
      if (!hasWindow) continue;
      const bm = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, side), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-side, 0, 0));
      bm.setPosition(side * 1.83, 0, zc);
      const bz = shadowy(new THREE.Mesh(bezel, wallMat)); bz.applyMatrix4(bm); group.add(bz);
      // the sky outside (unlit) and a shade pulled to a different height on each window
      const view = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ map: viewTex[k % 3], toneMapped: false, fog: false }));
      view.position.set(side * 1.99, WC, zc); view.rotation.y = -side * Math.PI / 2; group.add(view);
      const frac = [0, 0.32, 0.55, 0.12, 0.42][(k * 3 + (side > 0 ? 1 : 0)) % 5];
      if (frac > 0) {
        const h = 0.5 * frac + 0.06;
        const shade = shadowy(new THREE.Mesh(new THREE.PlaneGeometry(0.34, h), shadeMat));
        shade.position.set(side * 1.875, WC + RY + 0.06 - h / 2, zc); shade.rotation.y = -side * Math.PI / 2;
        group.add(shade);
      }
    }
  }

  // --- overhead bins with seams, latches, service units and reading lights
  const binShape = (side) => {
    const pts = [[1.11, 1.66], [1.79, 1.6], [1.72, 1.97], [1.06, 2.07], [0.99, 2.0], [1.03, 1.78]];
    const s = new THREE.Shape(); const P = side > 0 ? pts : pts.map(([x, y]) => [-x, y]).reverse();
    s.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length; i++) s.lineTo(P[i][0], P[i][1]); s.closePath();
    return s;
  };
  for (const side of [1, -1]) {
    const shape = binShape(side);
    for (let z = ROWS[0] - ROW_PITCH * 3 - 0.2; z < D - 0.4; z += ROW_PITCH) {
      const len = Math.min(ROW_PITCH, D - 0.4 - z) - 0.008;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 4 });
      const bin = shadowy(new THREE.Mesh(geo, binMat)); bin.position.z = z; group.add(bin);
      const latch = new THREE.Mesh(new RoundedBoxGeometry(0.16, 0.035, 0.03, 2, 0.008), darkMat);
      latch.position.set(side * 1.085, 1.74, z + len / 2); latch.rotation.z = side * 0.3; group.add(latch);
      const psu = shadowy(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, len - 0.04), binMat));
      psu.position.set(side * 1.3, 1.62, z + len / 2); group.add(psu);
      for (const [dx, dz] of [[-0.09, -0.12], [0.02, -0.12], [0.11, 0.15]]) {
        const rl = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 16), lightMat);
        rl.position.set(side * (1.3 + dx), 1.607, z + len / 2 + dz); group.add(rl);
      }
    }
  }
  // ceiling light strip and floor path lights
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, D + 2), lightMat);
  strip.position.set(0, 2.31, D / 2 - 1); group.add(strip);
  for (const x of [-0.445, 0.445]) {
    const pl = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.006, D + 2), new THREE.MeshStandardMaterial({ color: '#f7ecd3', emissive: '#ffe6b5', emissiveIntensity: 0.8 }));
    pl.position.set(x, 0.004, D / 2 - 1); group.add(pl);
  }

  // --- floor: patterned aisle carpet, darker carpet under the seats
  const cA = TX.carpet('#66715c', '#5d6853'), cB = TX.carpet('#4f5747', '#495141');
  for (const [x0, x1, c] of [[-0.43, 0.43, cA], [0.43, 1.85, cB], [-1.85, -0.43, cB]]) {
    const w = x1 - x0, l = D + 2;
    const map = c.map.clone(); map.repeat.set(w / 0.5, l / 0.5); map.needsUpdate = true;
    const nm = c.normalMap.clone(); nm.repeat.set(w / 0.5, l / 0.5); nm.needsUpdate = true;
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, l), new THREE.MeshStandardMaterial({ map, normalMap: nm, roughness: 0.95 }));
    f.rotation.x = -Math.PI / 2; f.position.set((x0 + x1) / 2, 0, D / 2 - 1); f.receiveShadow = true; group.add(f);
  }

  // --- seats
  const seatParts = makeSeatParts();
  for (const z of ROWS) for (const side of [1, -1]) SEATS.forEach(([a, b], i) => group.add(placeSeat(seatParts, side, a, b, z, i)));

  // --- bulkhead with a deep door surround, door leaves and EXIT sign
  const door = buildDoor(wallMat, metal);
  group.add(door.group);
  return { group, doorLeaves: door.leaves };
}

function makeSeatParts() {
  const fab = TX.fabric('#d4c7ad', 4);
  const fabric = new THREE.MeshStandardMaterial({ color: '#ffffff', map: fab.map, normalMap: fab.normalMap, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.92 });
  fabric.map.repeat.set(4, 4); fabric.normalMap.repeat.set(4, 4);
  const backMat = new THREE.MeshStandardMaterial({ map: TX.seatBack('#d4c7ad'), normalMap: fab.normalMap, normalScale: new THREE.Vector2(0.5, 0.5), roughness: 0.9 });
  const linenMat = new THREE.MeshStandardMaterial({ map: TX.linen(), roughness: 0.95 });
  const plastic = new THREE.MeshStandardMaterial({ color: '#cbc3b2', roughness: 0.45 });
  const armMat = new THREE.MeshStandardMaterial({ color: '#8f887b', roughness: 0.5 });
  const metal = new THREE.MeshStandardMaterial({ color: '#7f817c', metalness: 0.7, roughness: 0.38 });
  const dark = new THREE.MeshStandardMaterial({ color: '#57534b', roughness: 0.6 });
  // backrest outline: full width at the shoulders, narrower rounded top
  const s = new THREE.Shape();
  s.moveTo(-0.19, 0); s.lineTo(0.19, 0); s.lineTo(0.195, 0.55);
  s.bezierCurveTo(0.2, 0.74, 0.17, 0.78, 0.1, 0.785); s.lineTo(-0.1, 0.785);
  s.bezierCurveTo(-0.17, 0.78, -0.2, 0.74, -0.195, 0.55); s.closePath();
  const back = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.022, bevelSegments: 5, curveSegments: 12 });
  return {
    back, backMats: [backMat, fabric],
    headrest: new THREE.ExtrudeGeometry(roundRectShape(-0.16, 0, 0.16, 0.19, 0.04), { depth: 0.006, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2 }),
    tray: new THREE.ExtrudeGeometry(roundRectShape(-0.155, 0, 0.155, 0.25, 0.025), { depth: 0.014, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.005, bevelSegments: 2 }),
    latch: new RoundedBoxGeometry(0.05, 0.02, 0.014, 2, 0.005),
    pocket: new RoundedBoxGeometry(0.3, 0.15, 0.016, 2, 0.006),
    cushion: new RoundedBoxGeometry(0.41, 0.13, 0.48, 4, 0.045),
    arm: new RoundedBoxGeometry(0.05, 0.055, 0.42, 3, 0.02),
    armPost: new THREE.BoxGeometry(0.03, 0.2, 0.04),
    leg: new THREE.BoxGeometry(0.03, 0.34, 0.045),
    bar: new THREE.BoxGeometry(0.4, 0.035, 0.035),
    mats: { fabric, linenMat, plastic, armMat, metal, dark },
  };
}

function placeSeat(P, side, a, b, z, index) {
  const g = new THREE.Group();
  const cx = side * (a + b) / 2;
  g.position.set(cx, 0, z);
  const m = P.mats;
  // passengers face +z (the door); we see the backs
  const backG = new THREE.Group();
  backG.position.set(0, 0.45, 0);
  backG.rotation.x = -0.14; // reclined towards the camera
  const back = shadowy(new THREE.Mesh(P.back, P.backMats));
  back.position.z = -0.04; // shape cap at z=0 faces −z (the camera)
  backG.add(back);
  const hr = shadowy(new THREE.Mesh(P.headrest, m.linenMat)); hr.position.set(0, 0.57, -0.088); backG.add(hr);
  const tray = shadowy(new THREE.Mesh(P.tray, m.plastic)); tray.position.set(0, 0.27, -0.094); backG.add(tray);
  const latch = new THREE.Mesh(P.latch, m.dark); latch.position.set(0, 0.54, -0.09); backG.add(latch);
  const pocket = shadowy(new THREE.Mesh(P.pocket, m.fabric)); pocket.position.set(0, 0.13, -0.085); backG.add(pocket);
  g.add(backG);
  const cushion = shadowy(new THREE.Mesh(P.cushion, m.fabric)); cushion.position.set(0, 0.39, 0.25); g.add(cushion);
  // armrests on the aisle side of every seat, plus the window side of the last one
  const armXs = [-side * 0.205];
  if (index === 2) armXs.push(side * 0.205);
  for (const ax of armXs) {
    const arm = shadowy(new THREE.Mesh(P.arm, m.armMat)); arm.position.set(ax, 0.64, 0.2); g.add(arm);
    const post = new THREE.Mesh(P.armPost, m.dark); post.position.set(ax, 0.52, 0.38); g.add(post);
  }
  for (const lx of [-0.15, 0.15]) { const leg = shadowy(new THREE.Mesh(P.leg, m.metal)); leg.position.set(lx, 0.17, 0.3); g.add(leg); }
  const bar = shadowy(new THREE.Mesh(P.bar, m.metal)); bar.position.set(0, 0.31, 0.12); g.add(bar);
  return g;
}

function buildDoor(wallMat, metal) {
  const group = new THREE.Group();
  const { w, bottom, top, r, jamb } = DOOR;
  // bulkhead outline = full fuselage cross-section, with the door opening as a hole
  const full = [...PROFILE.map(([x, y]) => [x, y]).filter((p) => p[0] > 0.001), [0, 2.32], ...PROFILE.slice().reverse().map(([x, y]) => [-x, y]).filter((p) => p[0] < -0.001)];
  const shape = new THREE.Shape();
  shape.moveTo(full[0][0], full[0][1]);
  for (let i = 1; i < full.length; i++) shape.lineTo(full[i][0], full[i][1]);
  shape.closePath();
  shape.holes.push(roundRectPath(-w, bottom, w, top, r));
  const bulk = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: jamb, bevelEnabled: false, curveSegments: 10 }), wallMat));
  bulk.position.z = D; group.add(bulk);
  // raised trim around the opening
  const trimShape = roundRectShape(-w - 0.07, bottom - 0.04, w + 0.07, top + 0.07, r + 0.06);
  trimShape.holes.push(roundRectPath(-w, bottom, w, top, r));
  const trim = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(trimShape, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10 }), wallMat));
  trim.position.z = D - 0.04; group.add(trim);
  // EXIT sign
  const sign = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.13, 0.05, 2, 0.01), [
    new THREE.MeshStandardMaterial({ color: '#232725' }), new THREE.MeshStandardMaterial({ color: '#232725' }),
    new THREE.MeshStandardMaterial({ color: '#232725' }), new THREE.MeshStandardMaterial({ color: '#232725' }),
    new THREE.MeshStandardMaterial({ color: '#232725' }),
    new THREE.MeshStandardMaterial({ color: '#000000', emissive: '#ffffff', emissiveMap: TX.exitSign(), emissiveIntensity: 1.6 }),
  ]);
  sign.position.set(0, 2.03, D - 0.06); group.add(sign);

  // leaves: sage, with porthole, recessed panel frame, handle and placard
  const doorMat = new THREE.MeshStandardMaterial({ color: '#9cb29c', roughness: 0.42, metalness: 0.05 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#2f332f', roughness: 0.8 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#e8f0f4', roughness: 0.05, transparent: true, opacity: 0.18, reflectivity: 0.6 });
  const placardMat = new THREE.MeshStandardMaterial({ map: TX.placard(), roughness: 0.6 });
  const LW = w - 0.004, T = 0.05;
  const leaves = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * w, 0, D + jamb - T);
    // local x runs from the hinge (0) towards the centre (−side)
    const x0 = side < 0 ? 0 : -LW, x1 = side < 0 ? LW : 0;
    const ls = roundRectShape(x0, bottom + 0.008, x1, top - 0.008, r - 0.01, side < 0 ? [1, 0, 0, 1] : [0, 1, 1, 0]);
    const pcx = -side * LW / 2, pcy = 1.42, pr = 0.12;
    ls.holes.push(ellipsePath(pcx, pcy, pr, pr));
    const leaf = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(ls, { depth: T, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 16 }), doorMat));
    pivot.add(leaf);
    const gasket = new THREE.Mesh(new THREE.TorusGeometry(pr + 0.004, 0.014, 10, 40), rubber);
    gasket.position.set(pcx, pcy, -0.004); pivot.add(gasket);
    const ringShape = new THREE.Shape(); ringShape.absellipse(pcx, pcy, pr + 0.045, pr + 0.045, 0, Math.PI * 2, false); ringShape.holes.push(ellipsePath(pcx, pcy, pr + 0.016, pr + 0.016));
    const ring = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.006, bevelSegments: 2, curveSegments: 32 }), doorMat));
    ring.position.z = -0.014; pivot.add(ring);
    const gl = new THREE.Mesh(new THREE.CircleGeometry(pr, 32), glass); gl.position.set(pcx, pcy, T / 2); pivot.add(gl);
    // recessed lower panel: a fine raised frame
    const fs = roundRectShape(-side * 0.08 - (side > 0 ? 0.39 : 0), 0.2, -side * 0.08 + (side < 0 ? 0.39 : 0), 0.95, 0.04);
    fs.holes.push(roundRectPath(-side * 0.1 - (side > 0 ? 0.35 : 0), 0.22, -side * 0.1 + (side < 0 ? 0.35 : 0), 0.93, 0.03));
    const frame = shadowy(new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.004, bevelSegments: 2 }), doorMat));
    frame.position.z = -0.008; pivot.add(frame);
    // handle near the meeting edge
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.2, 0.012, 2, 0.006), new THREE.MeshStandardMaterial({ color: '#7e8f7f', roughness: 0.5 }));
    plate.position.set(-side * (LW - 0.07), 1.0, -0.008); pivot.add(plate);
    const lever = new THREE.Mesh(new RoundedBoxGeometry(0.022, 0.15, 0.026, 2, 0.009), metal);
    lever.position.set(-side * (LW - 0.07), 0.99, -0.024); pivot.add(lever);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.085), placardMat);
    pl.rotation.y = Math.PI; pl.position.set(-side * 0.2, 1.17, -0.009); pivot.add(pl);
    group.add(pivot);
    leaves.push({ pivot, side });
  }
  return { group, leaves };
}
