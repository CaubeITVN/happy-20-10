import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CONFIG } from './config.js';
import {
  GROUND, createIsland, createClouds, createGiftBox, createBear, createBalloon, createSign,
  heartGeometry, flatHeartGeometry, flatPetalGeometry,
} from './models.js';
import { createGarden, createHeartArch, createBlossomTree, createSwing, createButterflies } from './garden.js';
import { SKY, SUN_DIR, createSky, createEnvironment, createRainbow, createCloudSea, createMiniIsland } from './sky.js';
import { loadFonts, glowTexture, sparkleTexture, dotsTexture, signTexture, polaroidCanvas } from './textures.js';
import { ease, tween, wait, updateTweens, Sparkles, HeartRain, Burst } from './effects.js';
import { MusicBox } from './music.js';
import { UI } from './ui.js';

const ui = new UI(CONFIG);
const music = new MusicBox();

const small = Math.min(innerWidth, innerHeight) < 600;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const lite = small || reduced;
const params = new URLSearchParams(location.search);
const debug = params.has('debug');

const PINKS = ['#ff8fb1', '#ff6f9c', '#ffc2d6', '#ff4d85', '#ffb3c9'];
const CONFETTI = ['#ff8fb1', '#ffd56b', '#8fd8b5', '#9ed0ff', '#c9a7ff', '#ffffff', '#ff6f9c'];

/* ---------- Renderer, post-processing, camera ---------- */

const canvas = document.getElementById('scene');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  ui.showNoWebGL();
  throw err;
}
const pixelRatio = Math.min(devicePixelRatio, small ? 1.5 : 2);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(SKY.fog, 22, 60);
// Chỉ các vật bóng loáng mới dùng ánh phản chiếu môi trường; vật liệu đất sét giữ màu pastel gốc
const envMap = createEnvironment(renderer);
const glossy = (root, intensity = 0.6) => root.traverse((o) => {
  if (o.material?.isMeshPhysicalMaterial) {
    o.material.envMap = envMap;
    o.material.envMapIntensity = intensity;
  }
});

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 200);

// Render HDR rồi thêm bloom để các vật phát sáng lung linh.
// MSAA trên target HalfFloat rất tốn, nên khử răng cưa bằng FXAA (chỉ khi màn hình mật độ điểm ảnh thấp).
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.4, 0.96);
const bloomSetSize = bloom.setSize.bind(bloom);
bloom.setSize = (w, h) => bloomSetSize(Math.ceil(w / 2), Math.ceil(h / 2));
composer.addPass(bloom);
composer.addPass(new OutputPass());
const fxaa = pixelRatio < 1.5 ? new ShaderPass(FXAAShader) : null;
if (fxaa) composer.addPass(fxaa);

// Máy yếu: tự hạ độ phân giải render khi khung hình tụt
let quality = 1;
function applyQuality() {
  const pr = pixelRatio * quality;
  renderer.setPixelRatio(pr);
  composer.setPixelRatio(pr);
}
applyQuality();

const controls = new OrbitControls(camera, canvas);
Object.assign(controls, {
  enableDamping: true,
  dampingFactor: 0.08,
  enablePan: false,
  rotateSpeed: 0.7,
  zoomSpeed: 0.8,
  minPolarAngle: 0.12 * Math.PI,
  maxPolarAngle: 0.66 * Math.PI,
  autoRotateSpeed: 0.6,
});

/* ---------- Lights ---------- */

scene.add(new THREE.HemisphereLight('#fff1f7', '#ffc4d6', 1.25));
const sun = new THREE.DirectionalLight('#fff3e8', 1.95);
sun.position.set(4, 10, 6);
sun.castShadow = true;
sun.shadow.mapSize.setScalar(small ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -6, near: 1, far: 30 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.02;
scene.add(sun);
// Ánh nắng hoàng hôn rọi từ phía mặt trời, tạo viền vàng cam cho vật thể
const rimLight = new THREE.DirectionalLight('#ffc9a0', 0.9);
rimLight.position.copy(SUN_DIR).multiplyScalar(20);
scene.add(rimLight);

/* ---------- Textures ---------- */

await loadFonts(CONFIG);
const tex = { glow: glowTexture(), sparkle: sparkleTexture() };
const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

function glowSprite(color, size, opacity) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color, transparent: true, opacity, depthWrite: false }));
  s.scale.setScalar(size);
  s.raycast = () => {};
  return s;
}

/* ---------- Sky ---------- */

const sky = createSky();
scene.add(sky);
const rainbow = createRainbow();
scene.add(rainbow);
scene.add(createCloudSea(lite ? 45 : 75));
const miniIslands = [
  [createMiniIsland(41, '#ffc4d8'), -12.5, 2.4, -9, 0.9],
  [createMiniIsland(42, '#bfe8c8'), 13.5, 4.6, -12, 0.75],
  [createMiniIsland(43, '#ffd9a8'), -7.5, -1.2, -17, 0.65],
].map(([m, x, y, z, s]) => {
  m.position.set(x, y, z);
  m.scale.setScalar(s);
  m.userData.y = y;
  scene.add(m);
  return m;
});
const clouds = createClouds();
scene.add(clouds.group);

/* ---------- Island & garden ---------- */

const world = new THREE.Group();
scene.add(world);
const island = createIsland();
world.add(island.group);

const BEAR_X = 2.05;
const BEAR_Z = 0.55;
const BEAR_SCALE = 0.85;
const SIGN_POS = [-1.05, 2.72];
const TREE_POS = [[-2.95, -1.35], [2.95, -1.35]];

const garden = createGarden(
  [
    [-BEAR_X, BEAR_Z, 0.7], [BEAR_X, BEAR_Z, 0.7], [SIGN_POS[0], SIGN_POS[1], 0.55],
    [TREE_POS[0][0], TREE_POS[0][1], 0.6], [TREE_POS[1][0], TREE_POS[1][1], 0.6], [-2.33, -1.32, 0.55], [0, -0.55, 0.6],
  ],
  lite ? { tulips: 18, daisies: 14, tufts: 80 } : undefined,
);
world.add(garden.group);

const sign = createSign(signTexture(CONFIG.signText));
sign.position.set(SIGN_POS[0], GROUND, SIGN_POS[1]);
sign.rotation.y = 0.2;
world.add(sign);

const trees = TREE_POS.map(([x, z], i) => {
  const t = createBlossomTree(51 + i, i === 0 ? 1 : -1);
  t.position.set(x, GROUND, z);
  world.add(t);
  return t;
});

const heartGeo = heartGeometry();
const swing = createSwing(heartGeo);
glossy(swing, 0.4);
swing.position.copy(trees[0].position).add(trees[0].userData.swingPoint.position);
world.add(swing);

const butterflies = createButterflies(lite ? ['#ffb3d1', '#c9b3ff', '#ffe08a'] : ['#ffb3d1', '#c9b3ff', '#ffe08a', '#9fd9ff', '#ffc8a8']);
scene.add(butterflies.group);

const fireflies = Sparkles.scattered(lite ? 26 : 44, {
  radius: 3.4,
  yRange: [GROUND + 0.3, GROUND + 2.6],
  colors: ['#fff3a0', '#ffe2a6', '#ffd1e8'],
  size: [0.12, 0.2],
  texture: tex.sparkle,
  drift: false,
  wander: 0.35,
  boost: 2.4,
});
world.add(fireflies.points);

/* ---------- Gift ---------- */

const gift = createGiftBox(dotsTexture());
gift.position.y = GROUND;
gift.userData.hover = 0;
world.add(gift);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.0, 1.1, 64),
  new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = GROUND + 0.02;
ring.raycast = () => {};
world.add(ring);

/* ---------- Heart arch with polaroids ---------- */

const arch = createHeartArch(CONFIG.polaroids.map((p) => polaroidCanvas(p.art, p.caption)), anisotropy);
arch.group.visible = false;
arch.group.scale.setScalar(0.0001);
world.add(arch.group);

const fairyColors = [];
const fc = new THREE.Color();
for (let i = 0; i < arch.lightPositions.length / 3; i++) {
  fc.set(['#fff1a8', '#ffc2d9', '#ffffff'][i % 3]);
  fairyColors.push(fc.r, fc.g, fc.b);
}
const fairy = new Sparkles({
  positions: arch.lightPositions,
  colors: fairyColors,
  sizes: new Array(fairyColors.length / 3).fill(0.3),
  texture: tex.sparkle,
  boost: 2.6,
});
arch.group.add(fairy.points);

/* ---------- Big heart ---------- */

const HEART_Y = GROUND + 2.35;
const bigHeart = new THREE.Group();
bigHeart.position.y = HEART_Y;
bigHeart.visible = false;
bigHeart.userData = { kind: 'heart', hover: 0, active: false, appear: 0, rise: 0, squish: 0, spin: 0, yaw: 0 };
world.add(bigHeart);

const heartMesh = new THREE.Mesh(heartGeo, new THREE.MeshPhysicalMaterial({
  color: '#ff4f88',
  roughness: 0.16,
  clearcoat: 1,
  clearcoatRoughness: 0.06,
  iridescence: 0.9,
  iridescenceIOR: 1.4,
  iridescenceThicknessRange: [180, 520],
  sheen: 0.5,
  sheenColor: new THREE.Color('#ffd1e3'),
  emissive: '#ff2e72',
  emissiveIntensity: 0.06,
}));
glossy(heartMesh, 0.7);
heartMesh.scale.setScalar(2);
heartMesh.castShadow = true;
bigHeart.add(heartMesh);
const heartGlow = glowSprite('#ff8fb1', 5, 0);
heartGlow.position.z = -0.4;
bigHeart.add(heartGlow);

const heartLight = new THREE.PointLight('#ff7aa2', 0, 7, 2);
heartLight.position.set(0, HEART_Y, 1.3);
world.add(heartLight);

// Vòng cánh hoa + hạt sáng xoay quanh trái tim, và vòng sáng lan ra theo nhịp đập
const heartFx = new THREE.Group();
heartFx.visible = false;
heartFx.rotation.set(0.32, 0, 0.14);
world.add(heartFx);
const petalGeo = flatPetalGeometry();
const PETALS = 26;
const petalRing = new THREE.InstancedMesh(petalGeo, new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5, emissive: '#ff8fb1', emissiveIntensity: 0.15 }), PETALS);
petalRing.frustumCulled = false;
petalRing.raycast = () => {};
const petalData = Array.from({ length: PETALS }, (_, i) => ({
  a: (i / PETALS) * Math.PI * 2,
  r: 1.45 + Math.random() * 0.4,
  y: (Math.random() - 0.5) * 0.4,
  s: 0.12 + Math.random() * 0.08,
  spin: 0.8 + Math.random() * 1.5,
  ph: Math.random() * 6,
}));
petalData.forEach((_, i) => petalRing.setColorAt(i, new THREE.Color(['#ff8fb1', '#ffc4d6', '#ff5c8a', '#ffffff'][i % 4])));
heartFx.add(petalRing);
const sparkleRing = Sparkles.ring(lite ? 36 : 60, {
  radius: [1.55, 2.0],
  spread: 0.35,
  colors: ['#fff6c8', '#ffffff', '#ffd1e3'],
  size: [0.12, 0.26],
  texture: tex.sparkle,
  boost: 2.2,
});
heartFx.add(sparkleRing.points);

const beatRing = new THREE.Mesh(
  new THREE.RingGeometry(0.98, 1.08, 72),
  new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd6e6').multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false }),
);
beatRing.raycast = () => {};
beatRing.visible = false;
world.add(beatRing);

/* ---------- Bears ---------- */

const bears = [
  createBear({ fur: '#f3cbb0', accent: '#ff6f9c', accessory: 'bow', side: -1 }),
  createBear({ fur: '#c99673', accent: '#8fb8ff', accessory: 'bowtie', side: 1 }),
];
for (const b of bears) {
  const u = b.userData;
  u.home = new THREE.Vector3(u.side * BEAR_X, GROUND, BEAR_Z);
  u.baseYaw = -u.side * 0.4;
  u.yaw = u.baseYaw;
  b.position.copy(u.home);
  b.scale.setScalar(0.0001);
  b.visible = false;
  world.add(b);
}

/* ---------- Balloons ---------- */

const balloonDefs = [
  { shape: 'heart', color: '#ff5c8a', anchor: () => bears[0].userData.hand, offset: [-0.6, 1.6, 0.25] },
  { shape: 'round', color: '#9ed0ff', anchor: () => bears[1].userData.hand, offset: [0.6, 1.7, 0.25] },
  { shape: 'round', color: '#ffd56b', anchor: () => trees[0].userData.anchor, offset: [-0.55, 0.85, 0.3] },
  { shape: 'heart', color: '#c9a7ff', anchor: () => trees[0].userData.anchor, offset: [0.1, 1.15, -0.2] },
  { shape: 'heart', color: '#ff8fb1', anchor: () => trees[1].userData.anchor, offset: [0.55, 0.9, 0.3] },
  { shape: 'round', color: '#8fd8b5', anchor: () => trees[1].userData.anchor, offset: [-0.1, 1.2, -0.2] },
];
const STRING_PTS = 12;
const stringMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 });
const balloons = balloonDefs.map((def, i) => {
  const bl = createBalloon(def.shape, def.color, heartGeo);
  glossy(bl);
  bl.visible = false;
  world.add(bl);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRING_PTS * 3), 3));
  const line = new THREE.Line(geo, stringMat);
  line.frustumCulled = false;
  line.visible = false;
  line.raycast = () => {};
  world.add(line);
  Object.assign(bl.userData, { def, line, appear: 0, phase: i * 1.37, offset: new THREE.Vector3(...def.offset) });
  return bl;
});

/* ---------- Reason hearts ---------- */

const REASON_COLORS = ['#ff8fb1', '#ffb38a', '#c9a7ff', '#ffd56b', '#8fd8b5', '#ff6f9c', '#9ed0ff', '#ffa3d1'];
const hitGeo = new THREE.SphereGeometry(0.42, 8, 6);
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const reasonHearts = CONFIG.reasons.map((_, i, all) => {
  const color = REASON_COLORS[i % REASON_COLORS.length];
  const h = new THREE.Group();
  const mesh = new THREE.Mesh(heartGeo, new THREE.MeshPhysicalMaterial({
    color, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1, emissive: color, emissiveIntensity: 0.45,
  }));
  mesh.scale.setScalar(0.42);
  glossy(mesh, 0.5);
  h.add(mesh, glowSprite(color, 1.3, 0.55), new THREE.Mesh(hitGeo, hitMat));
  h.userData = {
    kind: 'reason',
    mesh,
    color,
    angle: (i / all.length) * Math.PI * 2,
    radius: 3.0 + (i % 3) * 0.45,
    height: GROUND + 1.2 + (((i * 5) % 8) / 8) * 2.6,
    speed: (0.1 + (i % 4) * 0.03) * (i % 2 ? 1 : -1),
    phase: i * 1.7,
    appear: 0,
    hover: 0,
    active: false,
  };
  h.visible = false;
  world.add(h);
  return h;
});

/* ---------- Particles ---------- */

const ambient = Sparkles.scattered(lite ? 70 : 140, {
  radius: 10,
  yRange: [-4, 10],
  colors: ['#ffffff', '#fff4b8', '#ffd1e0', '#e6dcff'],
  size: [0.14, 0.32],
  texture: tex.sparkle,
  boost: 1.5,
});
scene.add(ambient.points);

const flatHeart = flatHeartGeometry();
const rain = new HeartRain(flatHeart, lite ? 90 : 160, [...PINKS, '#ffffff', '#e6b3ff']);
const RAIN_IDLE = lite ? 16 : 26;
const sakura = new HeartRain(petalGeo, lite ? 36 : 64, ['#ffc4d8', '#ffd9e6', '#ffffff', '#ffb3cc'], { radius: 5.5, top: 6, bottom: -3.5 });
sakura.setActive(sakura.items.length);
const heartBurst = new Burst(flatHeart, 240, { gravity: 1.0, drag: 2.0, billboard: true });
const confetti = new Burst(new THREE.PlaneGeometry(0.07, 0.13), lite ? 220 : 360, { gravity: -5, drag: 1.3 });
scene.add(rain.mesh, sakura.mesh, heartBurst.mesh, confetti.mesh);

/* ---------- Camera poses ---------- */

const POSES = {
  intro: { target: new THREE.Vector3(0, GROUND + 0.9, 0), dir: new THREE.Vector3(0, 0.42, 1).normalize(), w: 7.0, h: 5.8 },
  explore: { target: new THREE.Vector3(0, 2.4, 0), dir: new THREE.Vector3(0, 0.2, 1).normalize(), w: 10.4, h: 10.2 },
};

// Khoảng cách camera sao cho khung w×h vừa màn hình (màn dọc thì cho phép cắt bớt hai bên)
function pose(name) {
  const p = POSES[name];
  const w = camera.aspect < 0.85 ? p.w * 0.76 : p.w;
  const vf = THREE.MathUtils.degToRad(camera.fov) / 2;
  const hf = Math.atan(Math.tan(vf) * camera.aspect);
  const distance = Math.max(p.h / 2 / Math.tan(vf), w / 2 / Math.tan(hf));
  return { target: p.target.clone(), position: p.target.clone().addScaledVector(p.dir, distance), distance };
}

function setLimits(d) {
  controls.minDistance = d * 0.5;
  controls.maxDistance = d * 1.45;
  scene.fog.near = d + 8;
  scene.fog.far = d + 60;
}

/* ---------- State ---------- */

let state = 'intro'; // intro → opening → explore
let cameraTween = false;
let hovered = null;
let hoverPos = null;
let found = 0;
let letterRead = false;
let finaleShown = false;
let time = 0;
let lastLine = -1;

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();

const approach = (cur, target, k) => cur + (target - cur) * Math.min(1, k);
const worldPoint = (x, y, z, out = new THREE.Vector3()) => world.localToWorld(out.set(x, y, z));

/* ---------- Picking ---------- */

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const hitTargets = [gift, bigHeart, swing, ...bears, ...balloons, ...reasonHearts, ...arch.polaroids];

function isShown(o) {
  for (; o; o = o.parent) if (!o.visible) return false;
  return true;
}

function pick(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  for (const hit of raycaster.intersectObjects(hitTargets, true)) {
    let o = hit.object;
    while (o && !o.userData.kind) o = o.parent;
    if (!o || !isShown(o)) continue;
    const { kind, active } = o.userData;
    if (state === 'intro' ? kind === 'gift' : state === 'explore' && kind !== 'gift' && active) return { obj: o, point: hit.point };
  }
  return null;
}

const pointers = new Set();
let press = null;
canvas.addEventListener('pointerdown', (e) => {
  pointers.add(e.pointerId);
  press = pointers.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null;
});
canvas.addEventListener('pointerup', (e) => {
  pointers.delete(e.pointerId);
  const p = press;
  press = null;
  if (!p || pointers.size) return;
  if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || performance.now() - p.t > 650) return;
  onTap(e.clientX, e.clientY);
});
canvas.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  press = null;
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') hoverPos = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerleave', () => { hoverPos = null; });

function onTap(x, y) {
  music.unlock();
  if (ui.modalOpen) return;
  const hit = pick(x, y);
  if (!hit) {
    if (state === 'explore') sprinkle(x, y);
    return;
  }
  const o = hit.obj;
  ({
    gift: openGift, heart: tapHeart, bear: tapBear, balloon: popBalloon,
    reason: tapReason, polaroid: tapPolaroid, swing: tapSwing,
  })[o.userData.kind](o);
}

/* ---------- Opening sequence ---------- */

async function openGift() {
  if (state !== 'intro') return;
  state = 'opening';
  cameraTween = true;
  controls.enabled = false;
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  music.start();
  music.sparkle();
  ui.placeCue(0, 0, false);
  ring.visible = false;

  gift.position.y = GROUND;
  await tween({
    duration: 0.55,
    ease: ease.linear,
    update: (_, k) => {
      const w = Math.sin(k * Math.PI * 8) * (1 - k * 0.4);
      gift.rotation.z = w * 0.12;
      gift.scale.set(1 + w * 0.05, 1 - w * 0.05, 1 + w * 0.05);
    },
  });
  gift.rotation.z = 0;
  gift.scale.setScalar(1);

  const { lid, base } = gift.userData;
  const top = worldPoint(0, GROUND + 1.3, 0);
  music.pop();
  confetti.emit(top, lite ? 140 : 230, { speed: [2.5, 5.5], up: 3.5, colors: CONFETTI, life: [2.4, 3.8], scale: [0.8, 1.3] });
  heartBurst.emit(top, 28, { speed: [1.2, 3], up: 1.6, colors: PINKS, life: [1.6, 2.6], scale: [0.14, 0.26] });

  const lid0 = lid.position.clone();
  tween({
    duration: 1.2,
    update: (e, k) => {
      lid.position.set(lid0.x + e * 1.8, lid0.y + e * 3.2 - k * k * 1.2, lid0.z - e * 1.2);
      lid.rotation.set(e * 2.4, e * 1.2, -e * 3.2);
      lid.scale.setScalar(Math.max(0.0001, 1 - ease.inCubic(k)));
    },
    done: () => { lid.visible = false; },
  });
  tween({
    delay: 0.3,
    duration: 0.55,
    ease: ease.inBack,
    update: (e) => base.scale.setScalar(Math.max(0.0001, 1 - e)),
    done: () => { gift.visible = false; },
  });

  const hu = bigHeart.userData;
  bigHeart.visible = true;
  heartFx.visible = true;
  beatRing.visible = true;
  tween({ delay: 0.2, duration: 1.3, ease: ease.outBack, update: (e) => { hu.appear = e; } });
  tween({ delay: 0.2, duration: 1.6, update: (e) => { hu.rise = e; }, done: () => { hu.active = true; } });

  const from = { p: camera.position.clone(), t: controls.target.clone() };
  const to = pose('explore');
  setLimits(to.distance);
  controls.minDistance = 0;
  controls.maxDistance = Infinity;
  tween({
    delay: 0.35,
    duration: 2.8,
    ease: ease.inOutCubic,
    update: (e) => {
      camera.position.lerpVectors(from.p, to.position, e);
      controls.target.lerpVectors(from.t, to.target, e);
    },
    done: () => {
      cameraTween = false;
      setLimits(to.distance);
    },
  });

  bears.forEach((b, i) => {
    const u = b.userData;
    b.visible = true;
    tween({
      delay: 0.55 + i * 0.22,
      duration: 1.05,
      ease: ease.linear,
      update: (_, k) => {
        const e = ease.outCubic(k);
        b.position.set(u.home.x * e, GROUND + 0.6 * (1 - e) + Math.sin(k * Math.PI) * 1.7, u.home.z * e);
        b.scale.setScalar(BEAR_SCALE * Math.max(0.0001, ease.outBack(Math.min(1, k * 1.5))));
        u.spin = (1 - e) * Math.PI * 2 * u.side;
      },
      done: () => {
        b.position.copy(u.home);
        u.spin = 0;
        u.active = true;
        music.boing();
      },
    });
  });

  arch.group.visible = true;
  tween({
    delay: 0.8,
    duration: 1.4,
    ease: ease.outBack,
    update: (e) => arch.group.scale.setScalar(Math.max(0.0001, e)),
    done: () => arch.polaroids.forEach((p) => { p.userData.active = true; }),
  });

  balloons.forEach((bl, i) => {
    const u = bl.userData;
    bl.visible = true;
    u.line.visible = true;
    tween({ delay: 1.3 + i * 0.15, duration: 1.8, update: (e) => { u.appear = e; }, done: () => { u.active = true; } });
  });

  reasonHearts.forEach((h, i) => {
    h.visible = true;
    tween({ delay: 1.8 + i * 0.12, duration: 0.9, ease: ease.outBack, update: (e) => { h.userData.appear = e; }, done: () => { h.userData.active = true; } });
  });

  setTimeout(() => rain.setActive(RAIN_IDLE), 1500);
  await wait(2.3);
  ui.showExplore();
  await wait(1.0);
  state = 'explore';
  swing.userData.active = true;
  controls.enabled = !ui.modalOpen;
  scheduleAutoRotate();
}

/* ---------- Interactions ---------- */

function tapHeart() {
  const u = bigHeart.userData;
  music.chime();
  heartBurst.emit(worldPoint(0, HEART_Y, 0.6), 18, { speed: [1.5, 3], up: 1.2, colors: PINKS, life: [1.2, 2], scale: [0.14, 0.24] });
  tween({
    duration: 0.5,
    ease: ease.linear,
    update: (_, k) => { u.squish = Math.sin(k * Math.PI); },
    done: () => { u.squish = 0; },
  });
  setTimeout(() => ui.openLetter(), 350);
}

function tapBear(b) {
  const u = b.userData;
  if (u.jumping) return;
  u.jumping = true;
  music.boing();
  const lines = CONFIG.bearLines;
  let i;
  do i = Math.floor(Math.random() * lines.length); while (lines.length > 1 && i === lastLine);
  lastLine = i;
  ui.say(b.id, lines[i]);
  heartBurst.emit(b.localToWorld(new THREE.Vector3(0, 1.6, 0.3)), 10, { speed: [0.8, 2], up: 1.5, colors: PINKS, life: [1.2, 1.8], scale: [0.1, 0.18] });
  tween({
    duration: 0.9,
    ease: ease.linear,
    update: (_, k) => {
      u.jumpY = Math.sin(k * Math.PI) * 0.75;
      u.spin = ease.inOutCubic(k) * Math.PI * 2;
    },
    done: () => {
      u.jumpY = 0;
      u.spin = 0;
      u.jumping = false;
    },
  });
}

function tapSwing() {
  swing.userData.kick = 1;
  music.chime();
  heartBurst.emit(swing.localToWorld(new THREE.Vector3(0, -1.0, 0.2)), 12, { speed: [0.8, 2], up: 1.4, colors: PINKS, life: [1.2, 1.8], scale: [0.1, 0.18] });
}

function popBalloon(bl) {
  const u = bl.userData;
  u.active = false;
  music.pop();
  const p = bl.getWorldPosition(new THREE.Vector3());
  heartBurst.emit(p, 14, { speed: [1.5, 3.2], up: 0.6, colors: [u.def.color, '#ffffff', ...PINKS.slice(0, 2)], life: [1, 1.6], scale: [0.1, 0.18] });
  confetti.emit(p, 24, { speed: [1.5, 3.5], up: 1, colors: [u.def.color, '#ffffff'], life: [1, 1.8], scale: [0.8, 1.2] });
  bl.visible = false;
  u.line.visible = false;
  u.appear = 0;
  setTimeout(() => {
    bl.visible = true;
    u.line.visible = true;
    tween({ duration: 1.8, update: (e) => { u.appear = e; }, done: () => { u.active = true; } });
  }, 6000 + Math.random() * 3000);
}

function tapReason(h) {
  const u = h.userData;
  u.active = false;
  music.chime();
  const p = h.getWorldPosition(new THREE.Vector3());
  heartBurst.emit(p, 16, { speed: [1.2, 2.6], up: 1, colors: [u.color, '#ffffff', ...PINKS], life: [1.1, 1.8], scale: [0.1, 0.2] });
  tween({ duration: 0.45, ease: ease.inBack, update: (e) => { u.appear = 1 - e; }, done: () => { h.visible = false; } });
  found++;
  ui.showReason(found, CONFIG.reasons[found - 1]);
  if (found === CONFIG.reasons.length) setTimeout(showFinale, 2600);
}

function showFinale() {
  if (finaleShown) return;
  if (ui.modalOpen) {
    setTimeout(showFinale, 800);
    return;
  }
  finaleShown = true;
  ui.showFinale();
  music.fanfare();
  const max = rain.items.length;
  rain.setActive(max);
  [[-2.6, 3.6, 0.5], [2.6, 3.9, 0.5], [0, 4.6, -0.8]].forEach(([x, y, z], i) => {
    setTimeout(() => confetti.emit(worldPoint(x, y, z), lite ? 70 : 110, {
      speed: [2, 4.5], up: 3, colors: CONFETTI, life: [2.4, 3.6], scale: [0.8, 1.3],
    }), i * 350);
  });
  tween({ delay: 8, duration: 4, ease: ease.linear, update: (e) => rain.setActive(Math.round(max - (max - RAIN_IDLE) * e)) });
}

function tapPolaroid(p) {
  const u = p.userData;
  u.kick = 1;
  music.chime();
  u.url ??= u.canvas.toDataURL('image/png');
  setTimeout(() => ui.showImage(u.url, CONFIG.polaroids[u.index].caption), 180);
}

const tapPlane = new THREE.Plane();
function sprinkle(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  tapPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(v1).negate(), controls.target);
  const p = raycaster.ray.intersectPlane(tapPlane, new THREE.Vector3());
  if (p) heartBurst.emit(p, 7, { speed: [0.4, 1.2], up: 1.4, colors: PINKS, life: [1.2, 2], scale: [0.12, 0.22] });
}

let idleTimer = 0;
function scheduleAutoRotate(ms = 4000) {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (state === 'explore') controls.autoRotate = true; }, ms);
}
controls.addEventListener('start', () => {
  controls.autoRotate = false;
  clearTimeout(idleTimer);
});
controls.addEventListener('end', () => scheduleAutoRotate(5000));

ui.onMusic = () => ui.setMusic(music.toggle());
ui.onModalChange = (open) => {
  controls.enabled = !open && state !== 'opening';
  if (open) hoverPos = null;
};
ui.onLetterClosed = () => {
  if (letterRead) return;
  letterRead = true;
  ui.setHint(CONFIG.hints.afterLetter);
};

/* ---------- Per-frame updates ---------- */

function updateSky() {
  sky.position.copy(camera.position);
  // Cầu vồng luôn nằm phía sau đảo so với người xem
  v1.copy(camera.position).sub(controls.target).setY(0).normalize();
  rainbow.position.copy(controls.target).addScaledVector(v1, -34).setY(-7.5);
  rainbow.lookAt(camera.position.x, -7.5, camera.position.z);
  for (const m of miniIslands) m.position.y = m.userData.y + Math.sin(time * 0.5 + m.userData.phase) * 0.25;
  for (const t of trees) t.userData.canopy.rotation.z = Math.sin(time * 0.8 + t.userData.phase) * 0.015;
}

function updateGift(dt) {
  if (state !== 'intro') return;
  const u = gift.userData;
  u.hover = approach(u.hover, hovered === gift ? 1 : 0, dt * 8);
  const ph = (time % 2.4) / 2.4;
  const hop = ph < 0.2 ? Math.sin((ph / 0.2) * Math.PI) : 0;
  const squash = ph >= 0.2 && ph < 0.3 ? Math.sin(((ph - 0.2) / 0.1) * Math.PI) * 0.08 : 0;
  const s = 1 + u.hover * 0.08;
  gift.position.y = GROUND + hop * 0.25;
  gift.scale.set(s * (1 + squash), s * (1 - squash), s * (1 + squash));
  gift.rotation.set(0, Math.sin(time * 0.7) * 0.3, Math.sin(time * 2.4) * 0.035 + (ph < 0.2 ? Math.sin((ph / 0.2) * Math.PI * 2) * 0.07 : 0));
  const rp = (time % 1.6) / 1.6;
  ring.scale.setScalar(0.85 + rp * 0.9);
  ring.material.opacity = (1 - rp) * 0.85;
}

const pm = new THREE.Matrix4();
const pq = new THREE.Quaternion();
const pe = new THREE.Euler();
const ps = new THREE.Vector3();

function updateHeart(dt) {
  if (!bigHeart.visible) return;
  const u = bigHeart.userData;
  u.hover = approach(u.hover, hovered === bigHeart ? 1 : 0, dt * 6);
  const b = (time * 1.15) % 1;
  const beat = Math.exp(-(((b - 0.08) / 0.05) ** 2)) + 0.6 * Math.exp(-(((b - 0.26) / 0.05) ** 2));
  const s = u.appear * (1 + beat * 0.08 + u.hover * 0.08 + u.squish * 0.2);
  bigHeart.scale.setScalar(Math.max(0.0001, s));
  bigHeart.position.y = THREE.MathUtils.lerp(GROUND + 0.6, HEART_Y, u.rise) + Math.sin(time * 1.3) * 0.1;
  // Luôn quay mặt về phía người xem, chỉ lắc nhẹ để nhìn góc nào cũng ra hình trái tim
  const cam = world.worldToLocal(v1.copy(camera.position));
  const turn = Math.atan2(cam.x, cam.z) - u.yaw;
  u.yaw += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 4);
  bigHeart.rotation.y = u.yaw;
  u.spin += dt * (1.1 + u.hover * 3);
  heartMesh.rotation.y = Math.sin(u.spin) * (0.35 + u.hover * 0.25);
  heartGlow.material.opacity = (0.2 + beat * 0.2 + u.hover * 0.12) * Math.min(1, u.appear);
  heartLight.position.set(Math.sin(u.yaw) * 1.3, bigHeart.position.y, Math.cos(u.yaw) * 1.3);
  heartLight.intensity = Math.max(0, u.appear) * (0.8 + beat * 1.6);

  // Vòng cánh hoa + hạt sáng
  const k = Math.max(0.0001, Math.min(1, u.appear));
  heartFx.position.copy(bigHeart.position);
  heartFx.scale.setScalar(k);
  petalData.forEach((p, i) => {
    const a = p.a + time * 0.45;
    pm.compose(
      ps.set(Math.cos(a) * p.r, p.y + Math.sin(time * 1.3 + p.ph) * 0.08, Math.sin(a) * p.r),
      pq.setFromEuler(pe.set(time * p.spin + p.ph, time * p.spin * 0.7, p.ph)),
      v2.setScalar(p.s),
    );
    petalRing.setMatrixAt(i, pm);
  });
  petalRing.instanceMatrix.needsUpdate = true;
  sparkleRing.points.rotation.y = -time * 0.3;
  sparkleRing.update(time);

  // Vòng sáng lan ra mỗi nhịp đập
  const rk = b / 0.7;
  beatRing.position.copy(bigHeart.position);
  beatRing.quaternion.copy(camera.quaternion);
  beatRing.scale.setScalar((1 + Math.min(rk, 1) * 1.9) * k);
  beatRing.material.opacity = rk < 1 ? (1 - rk) * 0.55 * Math.min(1, u.appear) : 0;
}

function updateBears(dt) {
  const cam = world.worldToLocal(v1.copy(camera.position));
  for (const b of bears) {
    if (!b.visible) continue;
    const u = b.userData;
    u.hover = approach(u.hover, hovered === b ? 1 : 0, dt * 8);
    if (u.active) b.position.set(u.home.x, u.home.y + u.jumpY, u.home.z);
    // Quay mặt về phía người xem (giới hạn để không quay ngoắt ra sau)
    let want = Math.atan2(cam.x - b.position.x, cam.z - b.position.z) - u.baseYaw;
    want = Math.atan2(Math.sin(want), Math.cos(want));
    u.yaw = approach(u.yaw, u.baseYaw + THREE.MathUtils.clamp(want, -1.1, 1.1) * 0.7, dt * 3);
    b.rotation.y = u.yaw + u.spin;

    const br = Math.sin(time * 2.6 + u.phase);
    const hs = 1 + u.hover * 0.05;
    u.body.scale.set(hs * (1 + br * 0.015), hs * (1 - br * 0.02), hs * (1 + br * 0.015));
    u.head.rotation.z = Math.sin(time * 1.4 + u.phase) * 0.09;
    u.head.rotation.x = Math.sin(time * 1.1 + u.phase) * 0.05;

    const cycle = (time + u.phase * 2) % 6;
    u.waveK = approach(u.waveK, cycle < 1.6 || u.hover > 0.5 ? 1 : 0, dt * 6);
    u.waveArm.rotation.z = -u.side * (0.45 + u.waveK * (1.9 + Math.sin(time * 11) * 0.35));
    u.holdArm.rotation.z = u.side * (1.2 + Math.sin(time * 1.7 + u.phase) * 0.06);
  }
}

function updateSwing(dt) {
  const u = swing.userData;
  u.kick *= Math.exp(-dt * 0.6);
  u.hover = approach(u.hover, hovered === swing ? 1 : 0, dt * 8);
  u.phase += dt * (1.7 + u.kick * 0.4);
  swing.rotation.x = Math.sin(u.phase) * (0.07 + u.kick * 0.5 + u.hover * 0.05);
}

function updateBalloons(dt) {
  for (const bl of balloons) {
    if (!bl.visible) continue;
    const u = bl.userData;
    const anchor = world.worldToLocal(u.def.anchor().getWorldPosition(v1));
    u.hover = approach(u.hover, hovered === bl ? 1 : 0, dt * 8);
    const t = time + u.phase;
    v2.copy(anchor).add(u.offset).add(v3.set(Math.sin(t * 0.8) * 0.1, Math.sin(t * 1.1) * 0.12, Math.cos(t * 0.7) * 0.08));
    bl.position.lerpVectors(anchor, v2, u.appear);
    bl.scale.setScalar(Math.max(0.0001, u.appear) * (1 + u.hover * 0.12));
    bl.rotation.z = Math.sin(t * 1.3) * 0.12;
    if (u.def.shape === 'heart') bl.rotation.y = Math.sin(t * 0.8) * 0.5;

    const k = u.knotY * bl.scale.x;
    const kx = bl.position.x - k * Math.sin(bl.rotation.z);
    const ky = bl.position.y + k * Math.cos(bl.rotation.z);
    const kz = bl.position.z;
    const pos = u.line.geometry.attributes.position;
    for (let i = 0; i < STRING_PTS; i++) {
      const f = i / (STRING_PTS - 1);
      const bend = Math.sin(f * Math.PI) * 0.08 * Math.sin(t * 1.5);
      pos.setXYZ(i, anchor.x + (kx - anchor.x) * f + bend, anchor.y + (ky - anchor.y) * f, anchor.z + (kz - anchor.z) * f);
    }
    pos.needsUpdate = true;
  }
}

function updateReasons(dt) {
  for (const h of reasonHearts) {
    if (!h.visible) continue;
    const u = h.userData;
    u.angle += dt * u.speed;
    h.position.set(Math.cos(u.angle) * u.radius, u.height + Math.sin(time * 1.3 + u.phase) * 0.22, Math.sin(u.angle) * u.radius);
    u.hover = approach(u.hover, hovered === h ? 1 : 0, dt * 8);
    const pulse = 1 + Math.sin(time * 3 + u.phase) * 0.06;
    h.scale.setScalar(Math.max(0.0001, u.appear * pulse * (1 + u.hover * 0.35)));
    u.mesh.rotation.y = time * 1.6 + u.phase;
  }
}

function toScreen(v) {
  v.project(camera);
  return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
}

function updateOverlays() {
  if (state === 'intro') {
    const [x, y] = toScreen(worldPoint(0, GROUND - 0.15, 1.0, v1));
    ui.placeCue(x, y, true);
  }
  for (const b of bears) {
    if (!b.visible) continue;
    const [x, y] = toScreen(b.localToWorld(v1.set(0, 1.9, 0)));
    ui.placeBubble(b.id, x, y);
  }
}

/* ---------- Loop ---------- */

const clock = new THREE.Clock();
const perf = { frames: 0, time: 0 };
function watchPerf(raw) {
  if (raw > 0.5 || time < 2.5) return; // vừa quay lại tab, hoặc đang biên dịch shader lúc đầu
  perf.frames++;
  perf.time += raw;
  if (perf.time < 2) return;
  const fps = perf.frames / perf.time;
  perf.frames = 0;
  perf.time = 0;
  if (fps < 42 && quality > 0.6) {
    quality = Math.max(0.6, quality - 0.15);
    applyQuality();
    resize();
  }
}

function frame() {
  const raw = clock.getDelta();
  watchPerf(raw);
  const dt = Math.min(raw, 1 / 30);
  time += dt;
  updateTweens(dt);

  const next = hoverPos && !ui.modalOpen ? pick(hoverPos.x, hoverPos.y)?.obj ?? null : null;
  if (next !== hovered) {
    hovered = next;
    canvas.style.cursor = hovered ? 'pointer' : '';
  }

  world.position.y = Math.sin(time * 0.6) * 0.08;
  clouds.update(time);
  island.update(time);
  garden.update(time);
  butterflies.update(time);
  updateGift(dt);
  updateHeart(dt);
  updateBears(dt);
  updateSwing(dt);
  updateBalloons(dt);
  updateReasons(dt);
  arch.update(time, dt, hovered);
  ambient.update(time);
  fairy.update(time);
  fireflies.update(time);
  rain.update(dt, time);
  sakura.update(dt, time);
  heartBurst.update(dt, camera);
  confetti.update(dt, camera);

  controls.update();
  updateSky();
  composer.render();
  updateOverlays();
}

function resize() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 0.85 ? 50 : 40;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  if (fxaa) {
    const pr = renderer.getPixelRatio();
    fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
  }
  const scale = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  for (const s of [ambient, fairy, fireflies, sparkleRing]) s.setScale(scale);
  if (cameraTween) return;
  const p = pose(state === 'intro' ? 'intro' : 'explore');
  const dir = camera.position.clone().sub(controls.target).normalize();
  camera.position.copy(controls.target).addScaledVector(dir, p.distance);
  setLimits(p.distance);
}

controls.target.copy(POSES.intro.target);
camera.position.copy(POSES.intro.target).add(POSES.intro.dir);
resize();
addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => music.setHidden(document.hidden));

// Biên dịch shader của mọi vật thể (kể cả đang ẩn) trước, để lúc mở quà không bị khựng
const hiddenAtStart = [bigHeart, heartFx, beatRing, arch.group, ...bears, ...balloons, ...reasonHearts];
hiddenAtStart.forEach((o) => { o.visible = true; });
renderer.compile(scene, camera);
hiddenAtStart.forEach((o) => { o.visible = false; });

renderer.setAnimationLoop(frame);
requestAnimationFrame(() => requestAnimationFrame(() => ui.hideLoader()));

// Dùng cho kiểm thử tự động: mở trang với ?debug
if (debug) {
  if (params.has('nobloom')) bloom.enabled = false;
  if (params.has('noshadow')) renderer.shadowMap.enabled = false;
  window.__app = {
    state: () => state,
    screenOf: (o) => toScreen(o.getWorldPosition(new THREE.Vector3())),
    pick: (x, y) => pick(x, y)?.obj.userData.kind ?? null,
    objects: { gift, bigHeart, bears, balloons, reasonHearts, polaroids: arch.polaroids, swing },
  };
}
