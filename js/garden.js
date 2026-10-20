import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GROUND, SPHERE_LO, clay, rng } from './models.js';
import { blobs } from './sky.js';

/* Vườn trên đảo: hoa, cỏ, cổng hoa trái tim, cây anh đào, xích đu, bướm. */

// Hình giọt nước có thể vuốt nhọn đầu và cong ra ngoài (cánh hoa, lá)
function taperedGeometry(w, h, d, taper, curl, seg = 12) {
  const g = new THREE.SphereGeometry(1, seg, seg);
  g.scale(w, h / 2, d);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getY(i) / h;
    p.setX(i, p.getX(i) * (1 - taper * t ** 3));
    p.setZ(i, p.getZ(i) + curl * t * t);
  }
  g.computeVertexNormals();
  return g;
}

/* ---------- Flowers + grass ---------- */

export function createGarden(avoid, { tulips = 26, daisies = 20, tufts = 150 } = {}) {
  const rand = rng(7);
  const spots = [];
  const ok = (x, z) => {
    const r = Math.hypot(x, z);
    if (r < 1.35 || r > 3.35) return false;
    for (const [ax, az, ar] of avoid) if (Math.hypot(x - ax, z - az) < ar) return false;
    for (const s of spots) if (Math.hypot(x - s.x, z - s.z) < 0.3) return false;
    return true;
  };
  const place = (n, kind, colors) => {
    let tries = 0;
    while (n > 0 && tries++ < 4000) {
      const a = rand() * Math.PI * 2;
      const r = 1.4 + Math.sqrt(rand()) * 1.95;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!ok(x, z)) continue;
      spots.push({
        x, z, kind,
        h: 0.34 + rand() * 0.24,
        yaw: rand() * Math.PI * 2,
        phase: rand() * Math.PI * 2,
        color: new THREE.Color(colors[Math.floor(rand() * colors.length)]),
      });
      n--;
    }
  };
  place(tulips, 'tulip', ['#ff8fb1', '#ff6f9c', '#ffb38a', '#c9a7ff', '#ffd56b', '#ffa3c4', '#ffffff']);
  place(daisies, 'daisy', ['#ffffff', '#ffe3ee', '#efe6ff']);
  const tulipSpots = spots.filter((s) => s.kind === 'tulip');
  const daisySpots = spots.filter((s) => s.kind === 'daisy');

  const make = (geo, mat, count) => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, count));
    m.count = count;
    m.frustumCulled = false;
    m.raycast = () => {};
    return m;
  };
  const white = clay('#ffffff', { roughness: 0.55 });
  const stems = make(new THREE.CylinderGeometry(0.016, 0.022, 1, 6).translate(0, 0.5, 0), clay('#79c48c'), spots.length);
  const leaves = make(taperedGeometry(0.035, 0.24, 0.012, 0.75, 0.05, 8), clay('#8fd6a0', { side: THREE.DoubleSide }), spots.length * 2);
  const petals = make(taperedGeometry(0.075, 0.2, 0.035, 0.55, 0.05), white, tulipSpots.length * 6);
  const centers = make(SPHERE_LO, clay('#ffd56b'), daisySpots.length);
  const dpetals = make(SPHERE_LO, white, daisySpots.length * 6);

  const c = new THREE.Color();
  tulipSpots.forEach((s, i) => {
    for (let k = 0; k < 6; k++) petals.setColorAt(i * 6 + k, k % 2 ? c.copy(s.color).lerp(new THREE.Color('#ffffff'), 0.22) : s.color);
  });
  daisySpots.forEach((s, i) => {
    for (let k = 0; k < 6; k++) dpetals.setColorAt(i * 6 + k, s.color);
  });

  // Cỏ: mỗi búi 3 lá
  const blades = make(new THREE.ConeGeometry(0.022, 1, 3).translate(0, 0.5, 0), white, tufts * 3);
  const greens = ['#8fd6a0', '#a6e3b4', '#7cc68d', '#b5ecc2'].map((h) => new THREE.Color(h));
  const bladeData = [];
  for (let i = 0; i < tufts; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 3.4;
    for (let k = 0; k < 3; k++) {
      bladeData.push({
        x: Math.cos(a) * r + (rand() - 0.5) * 0.08,
        z: Math.sin(a) * r + (rand() - 0.5) * 0.08,
        yaw: rand() * Math.PI * 2,
        tilt: 0.15 + rand() * 0.3,
        h: 0.12 + rand() * 0.12,
        phase: a * 2 + rand(),
      });
      blades.setColorAt(i * 3 + k, greens[Math.floor(rand() * greens.length)]);
    }
  }

  const group = new THREE.Group();
  group.add(stems, leaves, petals, centers, dpetals, blades);

  const base = new THREE.Matrix4();
  const local = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const qi = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();

  function update(t) {
    let ti = 0;
    let di = 0;
    spots.forEach((s, i) => {
      const sway = Math.sin(t * 1.6 + s.phase) * 0.07;
      base.compose(v.set(s.x, GROUND, s.z), q.setFromEuler(e.set(sway * 0.5, s.yaw, sway, 'XYZ')), sc.set(1, 1, 1));
      stems.setMatrixAt(i, out.multiplyMatrices(base, local.makeScale(1, s.h, 1)));
      for (let k = 0; k < 2; k++) {
        local.compose(v.set(0, 0, 0), q.setFromEuler(e.set(0.55, k * Math.PI + 0.4, 0, 'YXZ')), sc.set(1, 0.9 + k * 0.3, 1));
        leaves.setMatrixAt(i * 2 + k, out.multiplyMatrices(base, local));
      }
      if (s.kind === 'tulip') {
        for (let k = 0; k < 6; k++) {
          const outer = k % 2 === 0;
          const a = (k / 6) * Math.PI * 2;
          local.compose(
            v.set(Math.sin(a) * (outer ? 0.045 : 0.03), s.h - 0.03, Math.cos(a) * (outer ? 0.045 : 0.03)),
            q.setFromEuler(e.set(outer ? 0.2 : 0.06, a, 0, 'YXZ')),
            sc.set(1.15, 1.15, 1.15),
          );
          petals.setMatrixAt(ti * 6 + k, out.multiplyMatrices(base, local));
        }
        ti++;
      } else {
        local.compose(v.set(0, s.h, 0), qi, sc.set(0.05, 0.035, 0.05));
        centers.setMatrixAt(di, out.multiplyMatrices(base, local));
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2;
          local.compose(
            v.set(Math.cos(a) * 0.085, s.h - 0.005, Math.sin(a) * 0.085),
            q.setFromEuler(e.set(0, -a, 0.15, 'XYZ')),
            sc.set(0.065, 0.014, 0.03),
          );
          dpetals.setMatrixAt(di * 6 + k, out.multiplyMatrices(base, local));
        }
        di++;
      }
    });
    bladeData.forEach((b, i) => {
      const sway = Math.sin(t * 2 + b.phase) * 0.12;
      out.compose(v.set(b.x, GROUND - 0.01, b.z), q.setFromEuler(e.set(b.tilt + sway, b.yaw, 0, 'YXZ')), sc.set(1, b.h, 1));
      blades.setMatrixAt(i, out);
    });
    for (const m of [stems, leaves, petals, centers, dpetals, blades]) m.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { group, update };
}

/* ---------- Heart arch ---------- */

export const ARCH = { z: -0.55, sx: 0.135, sy: 0.159 };

// Đường viền trái tim tham số; t = 0 là chỗ lõm trên đỉnh, t = π là mũi nhọn chạm đất
export function archPoint(t, out = new THREE.Vector3()) {
  const s = Math.sin(t);
  const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 17;
  return out.set(16 * s * s * s * ARCH.sx, y * ARCH.sy + GROUND + 0.03, ARCH.z);
}

function roseGeometry() {
  const parts = [];
  const bud = new THREE.SphereGeometry(1, 10, 8);
  bud.scale(0.45, 0.45, 0.5);
  bud.translate(0, 0, 0.25);
  parts.push(bud);
  for (let k = 0; k < 5; k++) {
    const p = new THREE.SphereGeometry(1, 8, 6);
    p.scale(0.42, 0.55, 0.22);
    p.translate(0, 0.42, 0);
    p.rotateZ((k / 5) * Math.PI * 2);
    parts.push(p);
  }
  return mergeGeometries(parts);
}

export function createHeartArch(canvases, anisotropy = 4) {
  const rand = rng(31);
  const group = new THREE.Group();
  const pts = [];
  for (let i = 0; i < 240; i++) pts.push(archPoint((i / 240) * Math.PI * 2));
  const curve = new THREE.CatmullRomCurve3(pts, true);

  const frame = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, 0.055, 8, true), clay('#fff4f7', { roughness: 0.35 }));
  frame.castShadow = true;
  group.add(frame);

  // Hoa hồng và lá phủ dọc khung
  const roseMats = [];
  const leafMats = [];
  const roseCols = [];
  const palette = ['#ff8fb1', '#ffc4d6', '#fff6f9', '#ffc3a8', '#dcc8ff', '#ff6f9c'].map((h) => new THREE.Color(h));
  const zAxis = new THREE.Vector3(0, 0, 1);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const len = curve.getLength();
  const n = Math.floor(len / 0.07);
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const p = curve.getPointAt(u);
    if (p.y < GROUND + 0.35) continue;
    const tan = curve.getTangentAt(u);
    const nrm = new THREE.Vector3(-tan.y, tan.x, 0).normalize();
    const a = rand() * Math.PI * 2;
    const dir = nrm.clone().multiplyScalar(Math.cos(a)).addScaledVector(zAxis, Math.abs(Math.sin(a)) * 0.9 + 0.3).normalize();
    if (rand() < 0.7) {
      const s = 0.07 + rand() * 0.05;
      m4.compose(p.clone().addScaledVector(dir, 0.05), q.setFromUnitVectors(zAxis, dir), new THREE.Vector3(s, s, s));
      roseMats.push(m4.clone());
      roseCols.push(palette[Math.floor(rand() * palette.length)]);
    }
    const b = rand() * Math.PI * 2;
    const ldir = nrm.clone().multiplyScalar(Math.cos(b)).addScaledVector(zAxis, Math.sin(b)).normalize();
    m4.compose(
      p.clone().addScaledVector(ldir, 0.06),
      q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)),
      new THREE.Vector3(0.05, 0.025, 0.09),
    );
    leafMats.push(m4.clone());
  }
  // Bụi hoa ở chân cổng
  for (let i = 0; i < 14; i++) {
    const a = rand() * Math.PI * 2;
    const r = 0.15 + rand() * 0.35;
    const s = 0.08 + rand() * 0.05;
    const p = new THREE.Vector3(Math.cos(a) * r, GROUND + 0.2 + rand() * 0.25, ARCH.z + Math.sin(a) * r * 0.7);
    m4.compose(p, q.setFromUnitVectors(zAxis, new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a) + 0.5).normalize()), new THREE.Vector3(s, s, s));
    roseMats.push(m4.clone());
    roseCols.push(palette[i % palette.length]);
  }
  const roses = new THREE.InstancedMesh(roseGeometry(), clay('#ffffff', { roughness: 0.6 }), roseMats.length);
  roseMats.forEach((m, i) => {
    roses.setMatrixAt(i, m);
    roses.setColorAt(i, roseCols[i]);
  });
  const leaves = new THREE.InstancedMesh(SPHERE_LO, clay('#8fd6a0'), leafMats.length);
  leafMats.forEach((m, i) => leaves.setMatrixAt(i, m));
  roses.castShadow = true;
  group.add(roses, leaves);
  const bush = new THREE.Mesh(
    blobs(rand, 7, [0.9, 0.3, 0.6], 0.18, 0.3, '#a3dfb4', [0, GROUND + 0.18, ARCH.z]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  );
  bush.castShadow = true;
  group.add(bush);

  // Đèn nháy quấn quanh khung
  const lightPositions = [];
  const lights = 46;
  for (let k = 0; k < lights; k++) {
    const p = curve.getPointAt((k + 0.5) / lights);
    if (p.y < GROUND + 0.4) continue;
    lightPositions.push(p.x, p.y, p.z + (k % 2 ? 0.09 : -0.09));
  }

  // Ảnh polaroid treo trên cổng; số lẻ thì tấm giữa đặt trên đỉnh
  const count = canvases.length;
  const mid = count % 2 ? (count - 1) / 2 : -1;
  const perSide = Math.floor(count / 2);
  const slotT = (k) => 0.95 + k * 0.5;
  const clipColors = ['#ff8fb1', '#c9a7ff', '#ffd56b', '#8fd8b5', '#9ed0ff'];
  const backGeo = new RoundedBoxGeometry(0.8, 0.94, 0.03, 2, 0.015);
  const frontGeo = new THREE.PlaneGeometry(0.78, 0.915);
  const clipGeo = new THREE.BoxGeometry(0.07, 0.17, 0.05);
  const polaroids = canvases.map((canvas, i) => {
    const topper = i === mid;
    let t = 0;
    if (!topper) {
      const left = i < count / 2 && i !== mid;
      t = left ? -slotT(perSide - 1 - i) : slotT(i - (count - perSide));
    }
    const pivot = new THREE.Group();
    archPoint(t, pivot.position);
    pivot.position.z += 0.11;
    if (topper) pivot.position.y += 0.02;
    group.add(pivot);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    const card = new THREE.Group();
    card.position.y = topper ? 0.48 : -0.55;
    card.rotation.z = topper ? 0 : (i % 2 ? 1 : -1) * 0.06;
    pivot.add(card);
    const back = new THREE.Mesh(backGeo, clay('#fffdf8'));
    back.castShadow = true;
    card.add(back);
    const front = new THREE.Mesh(frontGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }));
    front.position.z = 0.017;
    card.add(front);
    if (!topper) {
      const clip = new THREE.Mesh(clipGeo, clay(clipColors[i % clipColors.length]));
      clip.position.set(0, -0.06, 0.02);
      pivot.add(clip);
    }
    pivot.userData = { kind: 'polaroid', index: i, canvas, phase: i * 1.3, kick: 0, hover: 0, active: false, topper };
    return pivot;
  });

  function update(t, dt, hovered) {
    for (const p of polaroids) {
      const u = p.userData;
      u.kick *= Math.exp(-dt * 1.8);
      u.hover += ((hovered === p ? 1 : 0) - u.hover) * Math.min(1, dt * 8);
      const amp = u.topper ? 0.4 : 1;
      p.rotation.z = (Math.sin(t * 1.1 + u.phase) * 0.045 + Math.sin(t * 9) * u.kick * 0.3) * amp;
      p.rotation.x = Math.sin(t * 0.9 + u.phase) * 0.03 * amp;
      p.scale.setScalar(1 + u.hover * 0.1);
    }
  }

  return { group, polaroids, lightPositions, update };
}

/* ---------- Cherry blossom tree ---------- */

function limb(from, to, r0, r1, material) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, dir.length(), 8), material);
  m.position.copy(from).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

// dir = 1: cành dài vươn sang phải (+x), -1: sang trái
export function createBlossomTree(seed, dir) {
  const rand = rng(seed);
  const g = new THREE.Group();
  const bark = clay('#c4927a');
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  g.add(limb(V(0, 0, 0), V(dir * 0.08, 1.55, 0), 0.15, 0.09, bark));
  g.add(limb(V(dir * 0.06, 1.2, 0), V(-dir * 0.45, 1.9, 0.1), 0.07, 0.04, bark));
  g.add(limb(V(dir * 0.06, 1.45, 0), V(dir * 1.05, 2.0, 0.05), 0.07, 0.035, bark));
  const canopy = new THREE.Mesh(
    mergeGeometries([
      blobs(rand, 9, [1.4, 0.5, 1.0], 0.3, 0.48, '#ffb3cd', [dir * 0.1, 2.1, 0]),
      blobs(rand, 4, [0.6, 0.3, 0.6], 0.22, 0.32, '#ffd3e2', [dir * 0.85, 2.15, 0.05]),
      blobs(rand, 5, [0.8, 0.3, 0.8], 0.2, 0.3, '#ffe4ee', [dir * 0.05, 2.55, 0]),
    ]),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, emissive: '#ff9dc0', emissiveIntensity: 0.08 }),
  );
  canopy.castShadow = true;
  g.add(canopy);
  const anchor = new THREE.Object3D();
  anchor.position.set(-dir * 0.35, 2.5, 0);
  g.add(anchor);
  // điểm treo xích đu, trên cành dài
  const swingPoint = new THREE.Object3D();
  swingPoint.position.set(dir * 0.62, 1.78, 0.03);
  g.add(swingPoint);
  g.userData = { anchor, swingPoint, canopy, phase: rand() * 6 };
  return g;
}

/* ---------- Swing ---------- */

export function createSwing(heartGeo) {
  const g = new THREE.Group();
  const L = 1.25;
  const rope = clay('#f6e2c8');
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L, 6), rope);
    r.position.set(s * 0.26, -L / 2, 0);
    g.add(r);
    for (let k = 1; k <= 5; k++) {
      const f = new THREE.Mesh(SPHERE_LO, clay(k % 2 ? '#ffc4d6' : '#ffffff'));
      f.position.set(s * 0.26 + (k % 2 ? 0.02 : -0.02), -k * (L / 6), 0.01);
      f.scale.setScalar(0.035);
      g.add(f);
    }
  }
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.06, 0.3, 2, 0.02), clay('#e3b98f'));
  seat.position.y = -L;
  seat.castShadow = true;
  g.add(seat);
  const cushion = new THREE.Mesh(heartGeo, new THREE.MeshPhysicalMaterial({ color: '#ff8fb1', roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#ffe0ea') }));
  cushion.scale.setScalar(0.36);
  cushion.position.set(0, -L + 0.19, 0);
  cushion.castShadow = true;
  g.add(cushion);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.45), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = -L + 0.15;
  g.add(hit);
  g.userData = { kind: 'swing', kick: 0, hover: 0, active: false, phase: 0 };
  return g;
}

/* ---------- Butterflies ---------- */

function wingGeometry(color) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.08, 0.22, 0.34, 0.28, 0.31, 0.08);
  s.bezierCurveTo(0.29, 0.0, 0.22, -0.02, 0.18, -0.03);
  s.bezierCurveTo(0.25, -0.13, 0.16, -0.24, 0.06, -0.15);
  s.bezierCurveTo(0.03, -0.1, 0.01, -0.05, 0, 0);
  const g = new THREE.ShapeGeometry(s, 12);
  const pos = g.attributes.position;
  const cols = new Float32Array(pos.count * 3);
  const inner = new THREE.Color(color);
  const edge = inner.clone().lerp(new THREE.Color('#ffffff'), 0.65);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const d = Math.min(1, Math.hypot(pos.getX(i), pos.getY(i)) / 0.32);
    c.lerpColors(inner, edge, d * d);
    cols.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.rotateX(Math.PI / 2);
  return g;
}

export function createButterflies(colors) {
  const group = new THREE.Group();
  const bodyGeo = new THREE.CapsuleGeometry(0.016, 0.14, 4, 8).rotateX(Math.PI / 2);
  const bodyM = clay('#7a5566');
  const flies = colors.map((color, i) => {
    const b = new THREE.Group();
    const geo = wingGeometry(color);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.5, emissive: color, emissiveIntensity: 0.25 });
    const right = new THREE.Group();
    right.add(new THREE.Mesh(geo, mat));
    const left = new THREE.Group();
    const lm = new THREE.Mesh(geo, mat);
    lm.scale.x = -1;
    left.add(lm);
    b.add(right, left, new THREE.Mesh(bodyGeo, bodyM));
    b.scale.setScalar(0.85);
    b.userData = {
      right, left,
      cx: [-1.2, 1.4, 0.2, -0.4, 1.0][i % 5],
      cz: [0.6, 0.2, 1.4, -1.0, -0.6][i % 5],
      R: 1.6 + (i % 3) * 0.5,
      h: GROUND + 0.9 + (i % 4) * 0.45,
      w: (0.22 + (i % 3) * 0.06) * (i % 2 ? 1 : -1),
      phase: i * 1.9,
    };
    b.traverse((o) => { o.raycast = () => {}; });
    group.add(b);
    return b;
  });
  const p = new THREE.Vector3();
  const next = new THREE.Vector3();
  const path = (u, t, out) => out.set(
    u.cx + Math.cos(t * u.w + u.phase) * u.R,
    u.h + Math.sin(t * u.w * 2.7 + u.phase) * 0.35 + Math.sin(t * 9 + u.phase) * 0.04,
    u.cz + Math.sin(t * u.w * 1.3 + u.phase) * u.R * 0.8,
  );
  function update(t) {
    for (const b of flies) {
      const u = b.userData;
      path(u, t, p);
      path(u, t + 0.05, next);
      b.position.copy(p);
      b.lookAt(next);
      const flap = Math.sin(t * 16 + u.phase) * 0.9 + 0.3;
      u.right.rotation.z = flap;
      u.left.rotation.z = -flap;
    }
  }
  return { group, update };
}
