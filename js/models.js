import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/* Mọi mô hình dựng từ khối cơ bản, không tải asset ngoài. */

export const GROUND = 0.29;

export const SPHERE = new THREE.SphereGeometry(1, 28, 20);
export const SPHERE_LO = new THREE.SphereGeometry(1, 14, 10);

const materials = new Map();
export function clay(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts }));
  }
  return materials.get(key);
}

export function ball(parent, material, pos, scale, shadow = true) {
  const m = new THREE.Mesh(SPHERE, material);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = shadow;
  parent.add(m);
  return m;
}

export function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- Hearts & petals ---------- */

function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  return s;
}

// Trái tim phồng, rộng ~1 đơn vị
export function heartGeometry() {
  let g = new THREE.ExtrudeGeometry(heartShape(), {
    depth: 3,
    bevelEnabled: true,
    bevelSegments: 10,
    bevelSize: 2.4,
    bevelThickness: 3.6,
    curveSegments: 32,
    steps: 1,
  });
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-3);
  g.rotateZ(Math.PI);
  g.center();
  g.scale(1 / 26, 1 / 26, 1 / 26);
  g.computeVertexNormals();
  return g;
}

// Trái tim phẳng cho hạt bay
export function flatHeartGeometry() {
  const g = new THREE.ShapeGeometry(heartShape(), 10);
  g.rotateZ(Math.PI);
  g.center();
  g.scale(1 / 22, 1 / 22, 1 / 22);
  return g;
}

// Cánh hoa anh đào phẳng (cao ~1 đơn vị, có khía ở đầu)
export function flatPetalGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(0.45, -0.3, 0.45, 0.35, 0.12, 0.5);
  s.lineTo(0, 0.38);
  s.lineTo(-0.12, 0.5);
  s.bezierCurveTo(-0.45, 0.35, -0.45, -0.3, 0, -0.5);
  return new THREE.ShapeGeometry(s, 8);
}

/* ---------- Island ---------- */

export function createIsland() {
  const group = new THREE.Group();
  const rand = rng(3);

  // Sườn đảo: mặt tiện với vân lớp đất lượn sóng
  const ctrl = [[0.001, -3.2], [0.55, -2.95], [1.3, -2.35], [2.2, -1.55], [2.85, -0.9], [3.3, -0.4], [3.52, -0.05]];
  const profile = new THREE.SplineCurve(ctrl.map(([x, y]) => new THREE.Vector2(x, y))).getPoints(56);
  const radiusAt = (y) => {
    for (let i = 1; i < profile.length; i++) {
      if (profile[i].y >= y) {
        const a = profile[i - 1];
        const b = profile[i];
        return a.x + ((y - a.y) / (b.y - a.y || 1)) * (b.x - a.x);
      }
    }
    return profile[profile.length - 1].x;
  };
  const rockGeo = new THREE.LatheGeometry(profile, 72);
  const pos = rockGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color('#f9d0b4');
  const bottom = new THREE.Color('#d895ad');
  const light = new THREE.Color('#fde8d6');
  const dark = new THREE.Color('#e3a2ab');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const ang = Math.atan2(pos.getZ(i), pos.getX(i));
    c.lerpColors(bottom, top, THREE.MathUtils.clamp((y + 3.2) / 3.2, 0, 1));
    const w = Math.sin(y * 6.5 + Math.sin(ang * 3) * 0.5 + Math.sin(ang * 7) * 0.15);
    if (w > 0.55) c.lerp(light, ((w - 0.55) / 0.45) * 0.65);
    else if (w < -0.8) c.lerp(dark, 0.45);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  rockGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  group.add(new THREE.Mesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })));

  const grassM = clay('#bfeccb', { roughness: 0.9 });
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.56, 0.34, 72), grassM);
  grass.position.y = 0.12;
  grass.receiveShadow = true;
  group.add(grass);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.56, 0.08, 10, 96), grassM);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.24;
  rim.receiveShadow = true;
  group.add(rim);

  // "Kem" cỏ chảy xuống mép đảo
  const drips = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2 + rand() * 0.1;
    const r = 0.13 + rand() * 0.11;
    const g = SPHERE_LO.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * 3.52, -0.02 - rand() * 0.08, Math.sin(a) * 3.52),
      new THREE.Quaternion(),
      new THREE.Vector3(r, r * 1.6, r),
    ));
    drips.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(drips), grassM));

  // Dây leo rủ xuống sườn đảo, có lá và hoa nhỏ
  const vineGeos = [];
  const leafMats = [];
  const blossomMats = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (let v = 0; v < 13; v++) {
    const a = (v / 13) * Math.PI * 2 + rand() * 0.3;
    const len = 0.7 + rand() * 1.5;
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const f = k / 8;
      const y = -0.04 - f * len;
      const r = radiusAt(y) + 0.045;
      const ang = a + Math.sin(f * 3 + v) * 0.08;
      pts.push(new THREE.Vector3(Math.cos(ang) * r, y, Math.sin(ang) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    vineGeos.push(new THREE.TubeGeometry(curve, 20, 0.02, 5));
    const n = Math.floor(len / 0.13);
    for (let j = 1; j <= n; j++) {
      const p = curve.getPointAt(j / (n + 1));
      const s = 0.8 + rand() * 0.5;
      m4.compose(p, q.setFromEuler(e.set(rand() * 6, rand() * 6, rand() * 6)), new THREE.Vector3(0.055 * s, 0.03 * s, 0.09 * s));
      leafMats.push(m4.clone());
      if (rand() < 0.35) {
        const out = new THREE.Vector3(p.x, 0, p.z).normalize().multiplyScalar(0.04);
        m4.compose(p.clone().add(out), q.identity(), new THREE.Vector3(0.035, 0.035, 0.035));
        blossomMats.push(m4.clone());
      }
    }
  }
  group.add(new THREE.Mesh(mergeGeometries(vineGeos), clay('#7cc68d')));
  const leaves = new THREE.InstancedMesh(SPHERE_LO, clay('#93d9a6'), leafMats.length);
  leafMats.forEach((m, i) => leaves.setMatrixAt(i, m));
  const blossoms = new THREE.InstancedMesh(SPHERE_LO, clay('#ffffff', { roughness: 0.6 }), blossomMats.length);
  const blossomColors = ['#ffb3cc', '#ffffff', '#ffd0df'].map((h) => new THREE.Color(h));
  blossomMats.forEach((m, i) => {
    blossoms.setMatrixAt(i, m);
    blossoms.setColorAt(i, blossomColors[i % blossomColors.length]);
  });
  group.add(leaves, blossoms);

  // Bụi cây + sỏi
  const bushParts = [];
  const bushSpots = [[-1.7, -2.85], [0.6, -3.1], [1.85, -2.65], [3.2, 0.35], [-3.0, 1.25], [-0.8, -2.25]];
  for (const [x, z] of bushSpots) {
    const n = 3 + Math.floor(rand() * 2);
    for (let k = 0; k < n; k++) {
      const r = 0.22 + rand() * 0.14;
      const g = SPHERE_LO.clone();
      g.applyMatrix4(new THREE.Matrix4().compose(
        new THREE.Vector3(x + (rand() - 0.5) * 0.5, GROUND + r * 0.7, z + (rand() - 0.5) * 0.4),
        new THREE.Quaternion(),
        new THREE.Vector3(r, r * 0.9, r),
      ));
      bushParts.push(g);
    }
  }
  const bushes = new THREE.Mesh(mergeGeometries(bushParts), clay('#a3dfb4', { roughness: 0.85 }));
  bushes.castShadow = true;
  bushes.receiveShadow = true;
  group.add(bushes);

  const pebbleParts = [];
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = 1.6 + rand() * 1.7;
    const s = 0.06 + rand() * 0.06;
    const g = SPHERE_LO.clone();
    g.applyMatrix4(new THREE.Matrix4().compose(
      new THREE.Vector3(Math.cos(a) * r, GROUND + s * 0.2, Math.sin(a) * r),
      new THREE.Quaternion(),
      new THREE.Vector3(s * 1.3, s * 0.7, s),
    ));
    pebbleParts.push(g);
  }
  group.add(new THREE.Mesh(mergeGeometries(pebbleParts), clay('#f3dad0')));

  // Mấy hòn đá nhỏ bay lơ lửng dưới đáy đảo
  const rockM = clay('#e9b0b2', { flatShading: true, roughness: 0.9 });
  const rocks = [[-1.7, -3.5, 1.0, 0.32], [2.0, -2.9, -0.9, 0.24], [0.5, -4.3, 0.7, 0.2], [-0.9, -4.0, -1.3, 0.16]].map(([x, y, z, s]) => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rockM);
    m.position.set(x, y, z);
    m.scale.set(s, s * 0.8, s);
    m.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    m.userData = { y, phase: rand() * 6 };
    group.add(m);
    return m;
  });

  function update(t) {
    for (const r of rocks) {
      r.position.y = r.userData.y + Math.sin(t * 0.8 + r.userData.phase) * 0.12;
      r.rotation.y += 0.003;
    }
  }

  return { group, update };
}

/* ---------- Clouds ---------- */

function cloudGeometry(rand) {
  const parts = [];
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const mid = (n - 1) / 2;
    const r = 0.5 + rand() * 0.4 + (1 - Math.abs(i - mid) / n) * 0.25;
    const g = new THREE.SphereGeometry(r, 18, 14);
    g.translate((i - mid) * 0.62 + (rand() - 0.5) * 0.2, rand() * 0.25 + (1 - Math.abs(i - mid) / n) * 0.3, (rand() - 0.5) * 0.5);
    parts.push(g);
  }
  const g = mergeGeometries(parts);
  g.scale(1, 0.78, 0.9);
  return g;
}

export function createClouds() {
  const rand = rng(11);
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#fff0f5', roughness: 1, emissive: '#ffe9f1', emissiveIntensity: 0.14 });
  const defs = [
    [-4.6, -2.7, 1.2, 1.3], [4.8, -2.1, -0.6, 1.5], [0.6, -4.7, -1.8, 1.6], [-2.6, -4.3, -3.6, 1.2], [3.3, -4.0, 2.4, 1.0],
    [-6.2, 4.6, -5.8, 1.4], [6.6, 3.4, -6.2, 1.7], [-8.2, 1.2, -3.0, 1.2], [8.4, 6.0, -3.5, 1.1], [-5.5, 8.6, -11.0, 1.6],
    [-9.5, -1.5, 2.0, 1.4], [9.8, -0.6, 1.5, 1.3],
  ];
  const clouds = defs.map(([x, y, z, s]) => {
    const m = new THREE.Mesh(cloudGeometry(rand), mat);
    m.position.set(x, y, z);
    m.scale.setScalar(s);
    m.rotation.y = rand() * Math.PI;
    m.userData = { base: m.position.clone(), phase: rand() * Math.PI * 2 };
    m.raycast = () => {};
    group.add(m);
    return m;
  });
  function update(t) {
    for (const m of clouds) {
      const { base, phase } = m.userData;
      m.position.x = base.x + Math.sin(t * 0.12 + phase) * 0.5;
      m.position.y = base.y + Math.sin(t * 0.3 + phase) * 0.15;
    }
  }
  return { group, update };
}

/* ---------- Gift box ---------- */

export function createGiftBox(dotsTex) {
  const gift = new THREE.Group();
  const boxM = new THREE.MeshStandardMaterial({ map: dotsTex, roughness: 0.55 });
  const ribbonM = clay('#fff4e6', { roughness: 0.4 });

  const base = new THREE.Group();
  gift.add(base);
  const body = new THREE.Mesh(new RoundedBoxGeometry(1.4, 1.1, 1.4, 4, 0.1), boxM);
  body.position.y = 0.55;
  base.add(body);
  for (const [w, d] of [[0.26, 1.416], [1.416, 0.26]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 1.104, d), ribbonM);
    r.position.y = 0.55;
    base.add(r);
  }

  const lid = new THREE.Group();
  lid.position.y = 1.1;
  gift.add(lid);
  const lidBody = new THREE.Mesh(new RoundedBoxGeometry(1.54, 0.32, 1.54, 4, 0.08), boxM);
  lidBody.position.y = 0.1;
  lid.add(lidBody);
  for (const [w, d] of [[0.27, 1.556], [1.556, 0.27]]) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.324, d), ribbonM);
    r.position.y = 0.1;
    lid.add(r);
  }
  const loopGeo = new THREE.TorusGeometry(0.22, 0.075, 12, 32);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(loopGeo, ribbonM);
    loop.position.set(s * 0.22, 0.42, 0);
    loop.rotation.set(0, s * 0.35, s * -0.55);
    loop.scale.set(1, 0.75, 1);
    lid.add(loop);
  }
  ball(lid, ribbonM, [0, 0.33, 0], [0.11, 0.1, 0.11]);

  gift.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  gift.userData = { kind: 'gift', base, lid };
  return gift;
}

/* ---------- Bear ---------- */

export function createBear({ fur, accent, accessory, side }) {
  const bear = new THREE.Group();
  const furM = clay(fur);
  const lightM = clay('#fff1e0');
  const darkM = clay('#4a2e2e', { roughness: 0.35 });
  const earM = clay('#ffc2cf');
  const blushM = clay('#ff9ab5', { transparent: true, opacity: 0.75 });
  const shineM = clay('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 });
  const accentM = clay(accent, { roughness: 0.5 });

  const body = new THREE.Group();
  bear.add(body);
  ball(body, furM, [0, 0.5, 0], [0.44, 0.46, 0.4]);
  ball(body, lightM, [0, 0.46, 0.25], [0.28, 0.3, 0.18]);
  ball(body, furM, [0, 0.35, -0.38], [0.1, 0.1, 0.1]);

  for (const s of [-1, 1]) {
    ball(bear, furM, [s * 0.2, 0.12, 0.12], [0.16, 0.12, 0.2]);
    ball(bear, earM, [s * 0.2, 0.11, 0.3], [0.08, 0.06, 0.03], false);
  }

  const arms = {};
  for (const s of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(s * 0.36, 0.74, 0.05);
    ball(arm, furM, [0, -0.18, 0], [0.12, 0.2, 0.12]);
    const hand = new THREE.Object3D();
    hand.position.set(0, -0.36, 0);
    arm.add(hand);
    arm.userData.hand = hand;
    body.add(arm);
    arms[s] = arm;
  }

  const head = new THREE.Group();
  head.position.set(0, 1.12, 0);
  body.add(head);
  ball(head, furM, [0, 0, 0], [0.44, 0.4, 0.4]);
  for (const s of [-1, 1]) {
    ball(head, furM, [s * 0.3, 0.3, -0.02], [0.15, 0.15, 0.11]);
    ball(head, earM, [s * 0.3, 0.3, 0.06], [0.08, 0.08, 0.04], false);
    ball(head, darkM, [s * 0.15, 0.06, 0.35], [0.055, 0.065, 0.04], false);
    ball(head, shineM, [s * 0.15 + 0.018, 0.085, 0.385], [0.018, 0.018, 0.012], false);
    const blush = ball(head, blushM, [s * 0.27, -0.07, 0.29], [0.085, 0.05, 0.03], false);
    blush.rotation.y = s * 0.6;
  }
  ball(head, lightM, [0, -0.09, 0.32], [0.18, 0.14, 0.12]);
  ball(head, darkM, [0, -0.03, 0.43], [0.065, 0.05, 0.045], false);
  const mouthGeo = new THREE.TorusGeometry(0.032, 0.009, 6, 16, Math.PI);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(mouthGeo, darkM);
    m.position.set(s * 0.032, -0.135, 0.435);
    m.rotation.z = Math.PI;
    head.add(m);
  }

  if (accessory === 'bow') {
    const bow = new THREE.Group();
    bow.position.set(-side * 0.22, 0.31, 0.14);
    bow.rotation.z = side * 0.4;
    head.add(bow);
    for (const s of [-1, 1]) {
      const lobe = ball(bow, accentM, [s * 0.085, 0, 0], [0.09, 0.065, 0.04]);
      lobe.rotation.z = s * 0.3;
    }
    ball(bow, accentM, [0, 0, 0.012], [0.035, 0.035, 0.035]);
  } else {
    const tie = new THREE.Group();
    tie.position.set(0, 0.86, 0.3);
    tie.rotation.x = -0.3;
    body.add(tie);
    for (const s of [-1, 1]) {
      const lobe = ball(tie, accentM, [s * 0.075, 0, 0], [0.08, 0.055, 0.035]);
      lobe.rotation.z = s * -0.25;
    }
    ball(tie, accentM, [0, 0, 0.01], [0.032, 0.032, 0.032]);
  }

  // Tay phía trong (hướng vào giữa đảo) vẫy, tay phía ngoài cầm bóng
  const waveArm = arms[-side];
  const holdArm = arms[side];
  bear.userData = {
    kind: 'bear', side, body, head, waveArm, holdArm,
    hand: holdArm.userData.hand,
    phase: side > 0 ? 1.7 : 0,
    yaw: 0, spin: 0, jumpY: 0, waveK: 0, hover: 0, active: false,
  };
  return bear;
}

/* ---------- Balloon ---------- */

export function createBalloon(shape, color, heartGeo) {
  const group = new THREE.Group();
  const mat = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.18, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: color, emissiveIntensity: 0.08,
  });
  const shine = clay('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.5, transparent: true, opacity: 0.55 });
  let knotY;
  if (shape === 'heart') {
    const m = new THREE.Mesh(heartGeo, mat);
    m.scale.setScalar(0.74);
    m.castShadow = true;
    group.add(m);
    ball(group, shine, [-0.17, 0.1, 0.17], [0.05, 0.08, 0.025], false).rotation.z = 0.5;
    knotY = -0.34;
  } else {
    ball(group, mat, [0, 0, 0], [0.32, 0.38, 0.32]);
    ball(group, shine, [-0.11, 0.14, 0.26], [0.055, 0.09, 0.03], false).rotation.z = 0.4;
    knotY = -0.38;
  }
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.08, 10), mat);
  knot.position.y = knotY - 0.01;
  knot.rotation.x = Math.PI;
  group.add(knot);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
  group.add(hit);
  group.userData = { kind: 'balloon', knotY: knotY - 0.05, hover: 0, active: false };
  return group;
}

/* ---------- Sign ---------- */

export function createSign(tex) {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.9, 8), clay('#e3b98f'));
  post.position.y = 0.45;
  post.castShadow = true;
  g.add(post);
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.3, 0.48, 0.07, 3, 0.03), clay('#f0c9a0'));
  board.position.y = 0.98;
  board.castShadow = true;
  g.add(board);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.44), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  face.position.set(0, 0.98, 0.037);
  g.add(face);
  return g;
}
