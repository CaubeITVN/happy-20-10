import * as THREE from 'three';

/* Mọi texture đều vẽ bằng canvas, không tải ảnh ngoài. */

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export async function loadFonts(cfg) {
  if (!document.fonts?.load) return;
  const sample = [cfg.signText, '20/10', ...cfg.polaroids.map((p) => p.caption)].join(' ');
  const jobs = [
    document.fonts.load('700 48px "Dancing Script"', sample),
    document.fonts.load('800 48px "Baloo 2"', sample),
  ];
  await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 3000))]);
}

/* ---------- Drawing helpers ---------- */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function ellipse(ctx, x, y, rx, ry, fill, rot = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  ctx.fill();
}

export function heartPath(ctx, x, y, size) {
  const s = size / 2;
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.95);
  ctx.bezierCurveTo(x - s * 1.25, y + s * 0.1, x - s * 0.95, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.95, y - s * 1.05, x + s * 1.25, y + s * 0.1, x, y + s * 0.95);
  ctx.closePath();
}

function heart(ctx, x, y, size, fill, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = fill;
  heartPath(ctx, 0, 0, size);
  ctx.fill();
  ctx.restore();
}

function star4(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

function gradientBg(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function seeded(seed) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function scatter(ctx, x, y, w, h, n, seed, draw) {
  const r = seeded(seed);
  for (let i = 0; i < n; i++) draw(x + r() * w, y + r() * h, r());
}

/* ---------- Small textures ---------- */

export function glowTexture() {
  const [c, ctx] = makeCanvas(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return toTexture(c);
}

export function sparkleTexture() {
  const [c, ctx] = makeCanvas(128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 40);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  star4(ctx, 64, 64, 56, 'rgba(255,255,255,0.95)');
  circle(ctx, 64, 64, 9, '#ffffff');
  return toTexture(c);
}

export function dotsTexture(bg = '#ff9cbd', dot = 'rgba(255,255,255,0.9)') {
  const [c, ctx] = makeCanvas(256);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const x = col * 64 + (row % 2 ? 32 : 0);
      circle(ctx, x, row * 64, 11, dot);
    }
  }
  const tex = toTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function signTexture(text) {
  const [c, ctx] = makeCanvas(512, 184);
  ctx.fillStyle = '#f7dcbc';
  ctx.fillRect(0, 0, 512, 184);
  ctx.strokeStyle = 'rgba(190,130,90,0.18)';
  ctx.lineWidth = 3;
  for (const y of [46, 92, 138]) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y - 6, 340, y + 6, 512, y);
    ctx.stroke();
  }
  heart(ctx, 44, 92, 34, '#ff8fb1', -0.2);
  heart(ctx, 468, 92, 34, '#ff8fb1', 0.2);
  let size = 66;
  ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
  while (ctx.measureText(text).width > 370 && size > 30) {
    size -= 2;
    ctx.font = `800 ${size}px "Baloo 2", sans-serif`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c94f77';
  ctx.fillText(text, 256, 98);
  return toTexture(c);
}

/* ---------- Polaroid illustrations ---------- */

const ARTS = {
  bear(ctx, x, y, w, h) {
    gradientBg(ctx, x, y, w, h, ['#ffd9e6', '#ffeedd']);
    scatter(ctx, x, y, w, h, 10, 3, (px, py, r) => heart(ctx, px, py, 18 + r * 16, 'rgba(255,143,177,0.35)', r - 0.5));
    const cx = x + w / 2;
    const cy = y + h * 0.58;
    for (const s of [-1, 1]) {
      circle(ctx, cx + s * 98, cy - 92, 46, '#e7b08a');
      circle(ctx, cx + s * 98, cy - 92, 26, '#ffc3cf');
    }
    ellipse(ctx, cx, cy, 128, 112, '#f0c39f');
    ellipse(ctx, cx, cy + 40, 56, 42, '#fff1e0');
    ellipse(ctx, cx, cy + 22, 17, 12, '#5a3838');
    ctx.strokeStyle = '#5a3838';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * 11, cy + 40, 11, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    }
    for (const s of [-1, 1]) {
      circle(ctx, cx + s * 50, cy - 14, 12, '#3a2626');
      circle(ctx, cx + s * 50 + 4, cy - 18, 4.5, '#ffffff');
      ellipse(ctx, cx + s * 84, cy + 26, 22, 13, 'rgba(255,130,165,0.6)');
    }
    heart(ctx, cx + 138, cy - 148, 56, '#ff6f9c', 0.25);
    heart(ctx, cx - 150, cy - 160, 30, '#ff8fb1', -0.3);
  },

  tulip(ctx, x, y, w, h) {
    gradientBg(ctx, x, y, w, h, ['#e2f6ea', '#fff4d9']);
    scatter(ctx, x, y, w, h * 0.6, 12, 11, (px, py, r) => star4(ctx, px, py, 6 + r * 8, 'rgba(255,255,255,0.9)'));
    const cx = x + w / 2;
    const base = y + h * 0.72;
    const heads = [
      [cx - 70, y + h * 0.36, '#ff8fb1'],
      [cx + 70, y + h * 0.36, '#c9a7ff'],
      [cx - 26, y + h * 0.24, '#ffb27a'],
      [cx + 30, y + h * 0.27, '#ff6f9c'],
    ];
    ctx.strokeStyle = '#78c58c';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const [hx, hy] of heads) {
      ctx.beginPath();
      ctx.moveTo(hx, hy + 28);
      ctx.quadraticCurveTo(hx * 0.6 + cx * 0.4, (hy + base) / 2, cx + (hx - cx) * 0.12, base + 20);
      ctx.stroke();
    }
    ellipse(ctx, cx - 40, base - 40, 14, 40, '#93d9a6', -0.6);
    ellipse(ctx, cx + 42, base - 44, 14, 40, '#93d9a6', 0.6);
    for (const [hx, hy, color] of heads) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(hx - 30, hy - 26);
      ctx.lineTo(hx - 15, hy - 8);
      ctx.lineTo(hx, hy - 32);
      ctx.lineTo(hx + 15, hy - 8);
      ctx.lineTo(hx + 30, hy - 26);
      ctx.quadraticCurveTo(hx + 34, hy + 22, hx, hy + 30);
      ctx.quadraticCurveTo(hx - 34, hy + 22, hx - 30, hy - 26);
      ctx.fill();
      ellipse(ctx, hx - 12, hy + 2, 6, 12, 'rgba(255,255,255,0.45)', 0.2);
    }
    // giấy gói
    ctx.fillStyle = '#efe5ff';
    ctx.beginPath();
    ctx.moveTo(cx - 110, base - 40);
    ctx.lineTo(cx + 110, base - 40);
    ctx.lineTo(cx + 26, y + h + 10);
    ctx.lineTo(cx - 26, y + h + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e2d4ff';
    ctx.beginPath();
    ctx.moveTo(cx - 110, base - 40);
    ctx.lineTo(cx, base - 10);
    ctx.lineTo(cx - 26, y + h + 10);
    ctx.closePath();
    ctx.fill();
    // nơ
    ellipse(ctx, cx - 28, base + 26, 28, 16, '#ff8fb1', -0.4);
    ellipse(ctx, cx + 28, base + 26, 28, 16, '#ff8fb1', 0.4);
    ellipse(ctx, cx - 16, base + 58, 9, 26, '#ff8fb1', 0.3);
    ellipse(ctx, cx + 16, base + 58, 9, 26, '#ff8fb1', -0.3);
    circle(ctx, cx, base + 28, 12, '#ff6f9c');
  },

  cake(ctx, x, y, w, h) {
    gradientBg(ctx, x, y, w, h, ['#ece3ff', '#ffe3ee']);
    const palette = ['#ff8fb1', '#ffd56b', '#8fd8b5', '#9ed0ff', '#c9a7ff'];
    scatter(ctx, x, y, w, h * 0.5, 22, 5, (px, py, r) => {
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(r * 6);
      ctx.fillStyle = palette[Math.floor(r * palette.length)];
      roundRect(ctx, -7, -2.5, 14, 5, 2.5);
      ctx.fill();
      ctx.restore();
    });
    const cx = x + w / 2;
    const by = y + h * 0.86;
    ellipse(ctx, cx, by + 6, 176, 26, 'rgba(160,110,170,0.18)');
    ellipse(ctx, cx, by, 172, 24, '#ffffff');
    // tầng dưới
    ctx.fillStyle = '#fff3e6';
    roundRect(ctx, cx - 132, by - 120, 264, 118, 22);
    ctx.fill();
    ctx.fillStyle = '#ffb3c9';
    roundRect(ctx, cx - 132, by - 120, 264, 34, 18);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const dx = cx - 112 + i * 37;
      const len = 18 + ((i * 13) % 4) * 9;
      roundRect(ctx, dx - 10, by - 96, 20, len, 10);
      ctx.fill();
    }
    ctx.font = '800 50px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff6f9c';
    ctx.fillText('20/10', cx, by - 40);
    // tầng trên
    ctx.fillStyle = '#ffd3e1';
    roundRect(ctx, cx - 90, by - 196, 180, 80, 20);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, cx - 90, by - 196, 180, 26, 14);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const dx = cx - 70 + i * 35;
      roundRect(ctx, dx - 9, by - 178, 18, 14 + (i % 2) * 12, 9);
      ctx.fill();
    }
    // nến
    for (const [dx, color] of [[-46, '#9ed0ff'], [0, '#ff8fb1'], [46, '#ffd56b']]) {
      ctx.fillStyle = color;
      roundRect(ctx, cx + dx - 7, by - 252, 14, 58, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      for (let k = 0; k < 3; k++) ctx.fillRect(cx + dx - 7, by - 244 + k * 18, 14, 5);
      const glow = ctx.createRadialGradient(cx + dx, by - 268, 0, cx + dx, by - 268, 30);
      glow.addColorStop(0, 'rgba(255,220,120,0.7)');
      glow.addColorStop(1, 'rgba(255,220,120,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx + dx - 30, by - 298, 60, 60);
      ellipse(ctx, cx + dx, by - 266, 8, 14, '#ffb347');
      ellipse(ctx, cx + dx, by - 262, 4, 8, '#fff3b0');
    }
  },

  moon(ctx, x, y, w, h) {
    gradientBg(ctx, x, y, w, h, ['#5b4aa8', '#9a7fe0', '#ffb8d2']);
    scatter(ctx, x, y, w, h * 0.75, 40, 9, (px, py, r) => circle(ctx, px, py, 1.5 + r * 2.5, `rgba(255,255,255,${0.4 + r * 0.5})`));
    scatter(ctx, x, y, w, h * 0.6, 7, 21, (px, py, r) => star4(ctx, px, py, 8 + r * 10, '#fff4b8'));
    const mx = x + w * 0.5;
    const my = y + h * 0.42;
    const R = 92;
    const glow = ctx.createRadialGradient(mx, my, R * 0.8, mx, my, R * 1.9);
    glow.addColorStop(0, 'rgba(255,244,190,0.5)');
    glow.addColorStop(1, 'rgba(255,244,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    circle(ctx, mx, my, R, '#fff3b8');
    circle(ctx, mx + 42, my - 40, 14, 'rgba(240,215,140,0.5)');
    circle(ctx, mx - 50, my - 46, 9, 'rgba(240,215,140,0.5)');
    circle(ctx, mx + 52, my + 38, 10, 'rgba(240,215,140,0.45)');
    ctx.strokeStyle = '#8a5a3c';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(mx + s * 30, my + 6, 12, 1.1 * Math.PI, 1.9 * Math.PI);
      ctx.stroke();
      ellipse(ctx, mx + s * 50, my + 26, 16, 9, 'rgba(255,140,170,0.55)');
    }
    ctx.beginPath();
    ctx.arc(mx, my + 24, 11, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    heart(ctx, mx + 112, my - 70, 40, '#ff8fb1', 0.3);
    // mây
    const cloudY = y + h - 34;
    for (const [dx, r] of [[-170, 46], [-110, 58], [-40, 50], [30, 62], [100, 52], [170, 48]]) {
      circle(ctx, x + w / 2 + dx, cloudY, r, '#fff6fb');
    }
  },

  hearts(ctx, x, y, w, h) {
    gradientBg(ctx, x, y, w, h, ['#ffe0ea', '#fff3e6']);
    scatter(ctx, x, y, w, h, 12, 17, (px, py, r) => heart(ctx, px, py, 14 + r * 14, 'rgba(255,111,156,0.25)', r - 0.5));
    const cy = y + h * 0.56;
    const face = (hx, hy, size, color, rot) => {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      heartPath(ctx, 0, 0, size);
      ctx.fill();
      ellipse(ctx, -size * 0.2, -size * 0.2, size * 0.08, size * 0.05, 'rgba(255,255,255,0.6)', -0.6);
      for (const s of [-1, 1]) {
        circle(ctx, s * size * 0.13, -size * 0.02, size * 0.035, '#5a2a3a');
        circle(ctx, s * size * 0.13 + size * 0.012, -size * 0.035, size * 0.012, '#ffffff');
        ellipse(ctx, s * size * 0.24, size * 0.08, size * 0.06, size * 0.035, 'rgba(255,255,255,0.45)');
      }
      ctx.strokeStyle = '#5a2a3a';
      ctx.lineWidth = size * 0.022;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, size * 0.05, size * 0.05, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      ctx.restore();
    };
    face(x + w * 0.35, cy, 190, '#ff9ab8', -0.2);
    face(x + w * 0.66, cy + 8, 176, '#ff6f9c', 0.2);
    heart(ctx, x + w * 0.5, y + h * 0.16, 44, '#ff4d85');
    star4(ctx, x + w * 0.2, y + h * 0.18, 14, '#ffd56b');
    star4(ctx, x + w * 0.82, y + h * 0.22, 18, '#ffd56b');
  },
};

export function polaroidCanvas(art, caption) {
  const W = 512;
  const H = 600;
  const [c, ctx] = makeCanvas(W, H);
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(0, 0, W, H);
  const px = 40;
  const py = 40;
  const pw = 432;
  const ph = 420;
  ctx.save();
  roundRect(ctx, px, py, pw, ph, 8);
  ctx.clip();
  (ARTS[art] || ARTS.hearts)(ctx, px, py, pw, ph);
  ctx.restore();
  ctx.strokeStyle = 'rgba(120,70,90,0.12)';
  ctx.lineWidth = 2;
  roundRect(ctx, px, py, pw, ph, 8);
  ctx.stroke();

  let size = 52;
  const font = () => `700 ${size}px "Dancing Script", cursive`;
  ctx.font = font();
  while (ctx.measureText(caption).width > pw - 16 && size > 26) {
    size -= 2;
    ctx.font = font();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#a24c69';
  ctx.fillText(caption, W / 2, py + ph + (H - py - ph) / 2 + 2);
  return c;
}

export { toTexture };
