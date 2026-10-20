import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clay, rng } from './models.js';

/* Bầu trời hoàng hôn pastel, cầu vồng, biển mây, đảo nhỏ phía xa, ánh phản chiếu môi trường. */

export const SKY = {
  top: '#9d92ea',
  upper: '#d4b4f3',
  mid: '#ffc0da',
  horizon: '#ffd6c2',
  bottom: '#ffe2ea',
  sun: '#fff0d2',
  fog: '#ffd9d6',
};

export const SUN_DIR = new THREE.Vector3(0.62, 0.2, -1).normalize();

const SKY_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uUpper;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uBottom;
  uniform vec3 uSunColor;
  uniform vec3 uSun;
  uniform float uSunBoost;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.16, h));
    col = mix(col, uUpper, smoothstep(0.14, 0.42, h));
    col = mix(col, uTop, smoothstep(0.4, 0.95, h));
    col = mix(col, uBottom, 1.0 - smoothstep(-0.22, 0.0, h));
    float s = max(dot(d, normalize(uSun)), 0.0);
    col += uSunColor * (pow(s, 900.0) * 3.0 * uSunBoost + pow(s, 40.0) * 0.22 + pow(s, 6.0) * 0.05);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createSky({ sunBoost = 1, radius = 90 } = {}) {
  const c = (hex) => new THREE.Color(hex);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: c(SKY.top) },
      uUpper: { value: c(SKY.upper) },
      uMid: { value: c(SKY.mid) },
      uHorizon: { value: c(SKY.horizon) },
      uBottom: { value: c(SKY.bottom) },
      uSunColor: { value: c(SKY.sun) },
      uSun: { value: SUN_DIR },
      uSunBoost: { value: sunBoost },
    },
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), mat);
  mesh.renderOrder = -10;
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}

// Bản đồ môi trường pastel để các bề mặt bóng (trái tim, bóng bay) có ánh phản chiếu
export function createEnvironment(renderer) {
  const env = new THREE.Scene();
  env.add(createSky({ sunBoost: 0.4 }));
  const panel = (color, intensity, pos, size) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    );
    m.position.copy(pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel('#ffffff', 3, new THREE.Vector3(0, 40, 12), 36);
  panel('#ffd6e6', 2.2, new THREE.Vector3(-40, 12, 20), 28);
  panel('#e6dcff', 2.2, new THREE.Vector3(40, 6, 26), 28);
  panel('#fff0d2', 3, SUN_DIR.clone().multiplyScalar(45), 18);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  return tex;
}

export function createRainbow() {
  const inner = 15;
  const outer = 18.5;
  const colors = ['#c3a6ff', '#9cc8ff', '#9fe3c4', '#fff0a0', '#ffc59e', '#ff9ec0'].map((h) => new THREE.Color(h));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uInner: { value: inner },
      uOuter: { value: outer },
      uColors: { value: colors },
      uOpacity: { value: 0.5 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uInner;
      uniform float uOuter;
      uniform vec3 uColors[6];
      uniform float uOpacity;
      varying vec2 vP;
      void main() {
        float t = clamp((length(vP) - uInner) / (uOuter - uInner), 0.0, 1.0);
        vec3 c = uColors[0];
        c = mix(c, uColors[1], smoothstep(0.1, 0.27, t));
        c = mix(c, uColors[2], smoothstep(0.27, 0.44, t));
        c = mix(c, uColors[3], smoothstep(0.44, 0.61, t));
        c = mix(c, uColors[4], smoothstep(0.61, 0.78, t));
        c = mix(c, uColors[5], smoothstep(0.78, 0.95, t));
        float a = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.85, 1.0, t));
        float ang = atan(vP.y, vP.x);
        a *= smoothstep(0.0, 0.55, ang) * smoothstep(0.0, 0.55, 3.14159 - ang);
        gl_FragColor = vec4(c, a * uOpacity);
        #include <colorspace_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.RingGeometry(inner, outer, 128, 1, 0, Math.PI), mat);
  mesh.renderOrder = -5;
  mesh.raycast = () => {};
  return mesh;
}

// Biển mây trải dài phía dưới, mờ dần vào chân trời nhờ sương
export function createCloudSea(count) {
  const rand = rng(23);
  const mesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 18, 12),
    new THREE.MeshStandardMaterial({ color: '#fff4f8', roughness: 1, emissive: '#ffe9f0', emissiveIntensity: 0.12 }),
    count,
  );
  const d = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2;
    const r = 9 + rand() ** 0.7 * 38;
    const s = 2 + rand() * 2.6 + r * 0.035;
    d.position.set(Math.cos(a) * r, -6.4 - rand() * 1.2 - r * 0.025, Math.sin(a) * r);
    d.scale.set(s * 1.3, s * 0.55, s);
    d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
  }
  mesh.frustumCulled = false;
  mesh.raycast = () => {};
  return mesh;
}

function blobs(rand, n, spread, rMin, rMax, color, center = [0, 0, 0]) {
  const c = new THREE.Color(color);
  const parts = [];
  for (let i = 0; i < n; i++) {
    const r = rMin + rand() * (rMax - rMin);
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.translate(
      center[0] + (rand() - 0.5) * spread[0],
      center[1] + (rand() - 0.5) * spread[1],
      center[2] + (rand() - 0.5) * spread[2],
    );
    const col = new Float32Array(g.attributes.position.count * 3);
    const shade = c.clone().lerp(new THREE.Color('#ffffff'), rand() * 0.25);
    for (let k = 0; k < col.length; k += 3) col.set([shade.r, shade.g, shade.b], k);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  return mergeGeometries(parts);
}

// Đảo nhỏ phía xa cho có chiều sâu
export function createMiniIsland(seed, canopyColor) {
  const rand = rng(seed);
  const g = new THREE.Group();
  const profile = [[0.001, -1.5], [0.4, -1.2], [0.9, -0.62], [1.15, -0.18], [1.22, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), clay('#f0b8ab', { side: THREE.DoubleSide })));
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(1.24, 1.2, 0.2, 32), clay('#bfeccb', { roughness: 0.9 }));
  grass.position.y = 0.08;
  g.add(grass);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.8, 8), clay('#c99a7a'));
  trunk.position.set(0.2, 0.55, -0.1);
  g.add(trunk);
  g.add(new THREE.Mesh(blobs(rand, 6, [0.8, 0.4, 0.7], 0.22, 0.36, canopyColor, [0.2, 1.05, -0.1]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  g.add(new THREE.Mesh(blobs(rand, 4, [1.4, 0.05, 1.2], 0.12, 0.2, '#a3dfb4', [-0.2, 0.25, 0.2]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 })));
  g.userData.phase = rand() * Math.PI * 2;
  return g;
}

export { blobs };
