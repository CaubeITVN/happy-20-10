import * as THREE from 'three';

/* ---------- Tween ---------- */

export const ease = {
  linear: (t) => t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inCubic: (t) => t ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  outBack: (t) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
  },
  inBack: (t) => {
    const c1 = 1.70158;
    return (c1 + 1) * t ** 3 - c1 * t ** 2;
  },
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};

const tweens = [];

// update(e, k): e = giá trị đã qua easing, k = tiến độ tuyến tính 0..1
export function tween({ duration = 1, delay = 0, ease: fn = ease.outCubic, update, done } = {}) {
  return new Promise((resolve) => {
    tweens.push({ t: -delay, duration, fn, update, done, resolve });
  });
}

export const wait = (seconds) => tween({ duration: seconds });

export function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(tw.t / tw.duration, 1);
    tw.update?.(tw.fn(k), k);
    if (k >= 1) {
      tweens.splice(i, 1);
      tw.done?.();
      tw.resolve();
    }
  }
}

/* ---------- Sparkles (point sprites) ---------- */

const SPARKLE_VERT = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  uniform float uScale;
  uniform float uDrift;
  uniform float uWander;
  uniform vec2 uYRange;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec3 p = position;
    float ph = aPhase * 6.2831;
    if (uDrift > 0.5) {
      float h = uYRange.y - uYRange.x;
      p.y = uYRange.x + mod(p.y - uYRange.x + uTime * aSpeed, h);
      p.x += sin(uTime * 0.4 + ph) * 0.35;
      p.z += cos(uTime * 0.33 + ph) * 0.35;
    } else if (uWander > 0.0) {
      p += vec3(sin(uTime * aSpeed * 1.7 + ph), sin(uTime * aSpeed * 2.3 + ph * 0.5) * 0.4, cos(uTime * aSpeed * 1.3 + ph)) * uWander;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vTwinkle = 0.5 + 0.5 * sin(uTime * (1.5 + aSpeed * 4.0) + aPhase * 6.2831);
    vColor = aColor;
    gl_PointSize = aSize * uScale * (0.7 + 0.3 * vTwinkle) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const SPARKLE_FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uBoost;
  varying vec3 vColor;
  varying float vTwinkle;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * tex.rgb * uBoost, tex.a * uOpacity * (0.35 + 0.65 * vTwinkle));
    if (gl_FragColor.a < 0.01) discard;
    #include <colorspace_fragment>
  }
`;

export class Sparkles {
  // drift: bay lên rồi quay vòng; wander: lượn lờ tại chỗ (đom đóm); boost > 1 để phát sáng với bloom
  constructor({ positions, colors, sizes, texture, drift = false, wander = 0, boost = 1, yRange = [-4, 10], opacity = 1 }) {
    const n = positions.length / 3;
    const phase = new Float32Array(n);
    const speed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      phase[i] = Math.random();
      speed[i] = 0.15 + Math.random() * 0.35;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 500 },
        uDrift: { value: drift ? 1 : 0 },
        uWander: { value: wander },
        uYRange: { value: new THREE.Vector2(...yRange) },
        uMap: { value: texture },
        uOpacity: { value: opacity },
        uBoost: { value: boost },
      },
      vertexShader: SPARKLE_VERT,
      fragmentShader: SPARKLE_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.raycast = () => {};
  }

  static scattered(count, { radius, yRange, colors, size: [s0, s1], texture, drift = true, ...rest }) {
    const positions = [];
    const cols = [];
    const sizes = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      positions.push(Math.cos(a) * r, yRange[0] + Math.random() * (yRange[1] - yRange[0]), Math.sin(a) * r);
      c.set(colors[i % colors.length]);
      cols.push(c.r, c.g, c.b);
      sizes.push(s0 + Math.random() * (s1 - s0));
    }
    return new Sparkles({ positions, colors: cols, sizes, texture, drift, yRange, ...rest });
  }

  // Hạt xếp thành vòng tròn (quanh trái tim)
  static ring(count, { radius: [r0, r1], spread, colors, size: [s0, s1], texture, ...rest }) {
    const positions = [];
    const cols = [];
    const sizes = [];
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.2;
      const r = r0 + Math.random() * (r1 - r0);
      positions.push(Math.cos(a) * r, (Math.random() - 0.5) * spread, Math.sin(a) * r);
      c.set(colors[i % colors.length]);
      cols.push(c.r, c.g, c.b);
      sizes.push(s0 + Math.random() * (s1 - s0));
    }
    return new Sparkles({ positions, colors: cols, sizes, texture, ...rest });
  }

  update(t) { this.material.uniforms.uTime.value = t; }
  setScale(s) { this.material.uniforms.uScale.value = s; }
}

/* ---------- Heart rain (instanced) ---------- */

const dummy = new THREE.Object3D();

export class HeartRain {
  constructor(geometry, capacity, colors, { radius = 8, top = 9, bottom = -4 } = {}) {
    this.mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.9, depthWrite: false }),
      capacity,
    );
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.opts = { radius, top, bottom };
    this.items = [];
    const c = new THREE.Color();
    for (let i = 0; i < capacity; i++) {
      this.items.push(this._spawn({}, true));
      this.mesh.setColorAt(i, c.set(colors[i % colors.length]));
    }
    this.mesh.count = 0;
  }

  _spawn(p, anywhere) {
    const { radius, top, bottom } = this.opts;
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    p.x = Math.cos(a) * r;
    p.z = Math.sin(a) * r;
    p.y = anywhere ? bottom + Math.random() * (top - bottom) : top + Math.random() * 3;
    p.vy = 0.45 + Math.random() * 0.6;
    p.s = 0.1 + Math.random() * 0.1;
    p.phase = Math.random() * Math.PI * 2;
    p.spin = 0.6 + Math.random();
    return p;
  }

  setActive(n) {
    n = Math.min(n, this.items.length);
    for (let i = this.mesh.count; i < n; i++) this._spawn(this.items[i], false);
    this.mesh.count = n;
  }

  update(dt, t) {
    const n = this.mesh.count;
    for (let i = 0; i < n; i++) {
      const p = this.items[i];
      p.y -= p.vy * dt;
      if (p.y < this.opts.bottom) this._spawn(p, false);
      const w = t * p.spin + p.phase;
      dummy.position.set(p.x + Math.sin(w * 0.7) * 0.4, p.y, p.z + Math.cos(w * 0.5) * 0.3);
      dummy.rotation.set(Math.sin(w) * 0.6, w * 0.8, Math.sin(w * 0.9) * 0.5);
      dummy.scale.setScalar(p.s);
      dummy.updateMatrix();
      this.mesh.setMatrixAt(i, dummy.matrix);
    }
    if (n) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/* ---------- Bursts (confetti, hearts) ---------- */

const _q = new THREE.Quaternion();
const _z = new THREE.Vector3(0, 0, 1);
const _color = new THREE.Color();

export class Burst {
  constructor(geometry, capacity, { gravity = -4, drag = 1.2, billboard = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), capacity);
    this.mesh.frustumCulled = false;
    this.mesh.raycast = () => {};
    this.mesh.setColorAt(0, _color.set('#ffffff'));
    this.mesh.count = 0;
    this.capacity = capacity;
    this.items = [];
    Object.assign(this, { gravity, drag, billboard });
  }

  emit(origin, count, { speed = [1.5, 3.5], up = 1.5, colors = ['#ff8fb1'], life = [1.2, 2], scale = [0.1, 0.18] } = {}) {
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.capacity) this.items.shift();
      const dir = new THREE.Vector3().randomDirection();
      const v = dir.multiplyScalar(speed[0] + Math.random() * (speed[1] - speed[0]));
      v.y += up;
      this.items.push({
        p: origin.clone(),
        v,
        age: 0,
        life: life[0] + Math.random() * (life[1] - life[0]),
        s: scale[0] + Math.random() * (scale[1] - scale[0]),
        color: new THREE.Color(colors[Math.floor(Math.random() * colors.length)]),
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 6),
      });
    }
  }

  update(dt, camera) {
    let j = 0;
    const damp = Math.exp(-this.drag * dt);
    this.items = this.items.filter((it) => (it.age += dt) < it.life);
    for (const it of this.items) {
      it.v.y += this.gravity * dt;
      it.v.multiplyScalar(damp);
      it.p.addScaledVector(it.v, dt);
      const k = it.age / it.life;
      const grow = k < 0.12 ? k / 0.12 : 1;
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      dummy.position.copy(it.p);
      if (this.billboard) {
        dummy.quaternion.copy(camera.quaternion).multiply(_q.setFromAxisAngle(_z, it.rot.z + it.spin.z * it.age * 0.3));
      } else {
        it.rot.x += it.spin.x * dt;
        it.rot.y += it.spin.y * dt;
        it.rot.z += it.spin.z * dt;
        dummy.quaternion.setFromEuler(it.rot);
      }
      dummy.scale.setScalar(Math.max(0.0001, it.s * grow * fade));
      dummy.updateMatrix();
      this.mesh.setMatrixAt(j, dummy.matrix);
      this.mesh.setColorAt(j, it.color);
      j++;
    }
    this.mesh.count = j;
    if (j) {
      this.mesh.instanceMatrix.needsUpdate = true;
      this.mesh.instanceColor.needsUpdate = true;
    }
  }
}
