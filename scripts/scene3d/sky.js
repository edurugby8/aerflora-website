// Sky above a sea of clouds, ray-marched per pixel (it is rendered offline,
// so we can afford real volumetric clouds instead of flat sprites):
// a billowing cloud deck below the cabin, distant cumulus towers, a raised
// mound where the cherry tree stands, warm low sun ahead with silver linings,
// and aerial perspective towards the horizon.
import * as THREE from 'three';

const vert = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;

const frag = /* glsl */ `
  uniform vec3 uCam;
  uniform vec3 uSun;
  uniform vec3 uTree;
  varying vec3 vWorld;

  float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p, int oct) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * noise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
    return s;
  }

  // cloud-top height field: undulating deck + far towers + the tree's mound
  float topHeight(vec2 xz) {
    float deck = -9.0 + 7.0 * fbm(vec3(xz * 0.018, 0.0), 4);
    float towers = smoothstep(0.52, 0.78, fbm(vec3(xz * 0.0065 + vec2(13.0, 7.0), 1.0), 3));
    float far = smoothstep(60.0, 140.0, length(xz - uCam.xz));
    float mound = 7.0 * exp(-dot(xz - uTree.xz, xz - uTree.xz) / 160.0);
    return max(deck + mound, -5.0 + towers * far * 34.0);
  }

  float density(vec3 p, int oct) {
    float top = topHeight(p.xz);
    float base = -30.0;
    if (p.y > top + 2.0 || p.y < base) return 0.0;
    // (GLSL smoothstep needs edge0 < edge1, so fade the tops with 1 - smoothstep)
    float shape = (1.0 - smoothstep(top - 3.0, top + 1.5, p.y)) * smoothstep(base, base + 6.0, p.y);
    // billowing cumulus: crisp edges from a thresholded fbm, softened inside
    float detail = fbm(p * vec3(0.06, 0.09, 0.06), oct);
    return clamp(shape * smoothstep(0.36, 0.6, detail) * 1.3, 0.0, 1.0);
  }

  float hg(float c, float g) { float g2 = g * g; return (1.0 - g2) / pow(1.0 + g2 - 2.0 * g * c, 1.5) / 12.566; }

  vec3 skyColor(vec3 rd) {
    float h = rd.y;
    vec3 zenith = vec3(0.30, 0.47, 0.74);
    vec3 horizon = vec3(0.98, 0.86, 0.80);
    vec3 below = vec3(0.66, 0.71, 0.80);
    vec3 c = h > 0.0 ? mix(horizon, zenith, pow(h, 0.55)) : mix(horizon, below, pow(-h, 0.6));
    float s = max(dot(rd, uSun), 0.0);
    c += vec3(1.0, 0.82, 0.62) * (pow(s, 10.0) * 0.55 + pow(s, 300.0) * 3.0);
    return c;
  }

  void main() {
    vec3 ro = uCam;
    vec3 rd = normalize(vWorld - uCam);
    vec3 col = skyColor(rd);
    vec3 sunCol = vec3(1.5, 1.24, 0.95);
    vec3 amb = vec3(0.40, 0.48, 0.65);
    float trans = 1.0;
    vec3 acc = vec3(0.0);
    float jitter = hash(vec3(gl_FragCoord.xy, 1.0));
    float t = 2.0 + jitter * 1.5;
    float cosT = dot(rd, uSun);
    float phase = mix(hg(cosT, 0.55), hg(cosT, -0.15), 0.4) * 5.0;
    for (int i = 0; i < 72; i++) {
      vec3 p = ro + rd * t;
      if (p.y < -32.0 && rd.y < 0.0) break;
      if (p.y > 40.0 && rd.y > 0.0) break;
      float dt = 0.9 + t * 0.045;
      float d = density(p, 5);
      if (d > 0.003) {
        // light march towards the sun
        float ld = 0.0;
        for (int j = 1; j <= 4; j++) ld += density(p + uSun * float(j) * 3.0, 3);
        float beer = exp(-ld * 1.35);
        float powder = 1.0 - exp(-d * 4.0);
        float hFrac = clamp((p.y + 30.0) / 34.0, 0.0, 1.0);
        // sky light from above brightens the billow tops, so the deck reads as volumes even back-lit
        float topLit = smoothstep(-2.5, 0.5, p.y - topHeight(p.xz));
        vec3 light = sunCol * beer * phase * mix(0.7, 1.0, powder) + amb * (0.35 + 0.45 * hFrac + 0.9 * topLit);
        float a = 1.0 - exp(-d * dt * 0.65);
        // aerial perspective: distant clouds melt into the warm horizon haze
        float haze = 1.0 - exp(-t * 0.0028);
        light = mix(light, skyColor(normalize(vec3(rd.x, 0.02, rd.z))), haze);
        acc += trans * a * light;
        trans *= 1.0 - a;
        if (trans < 0.02) break;
      }
      t += dt;
      if (t > 520.0) break;
    }
    gl_FragColor = vec4(col * trans + acc, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function buildSky(sunDir, treePos) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uCam: { value: new THREE.Vector3() }, uSun: { value: sunDir.clone().normalize() }, uTree: { value: treePos.clone() } },
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(380, 64, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 999; // drawn after the cabin so occluded pixels are depth-rejected (the march is expensive)
  return mesh;
}
