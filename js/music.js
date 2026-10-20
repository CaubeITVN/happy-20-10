/* Hộp nhạc tạo bằng WebAudio: giai điệu tự sáng tác trên vòng C–G–Am–Em–F–C–F–G. */

const NOTE_INDEX = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const hz = (note) => {
  const [, name, octave] = note.match(/^([A-G]#?)(\d)$/);
  return 440 * 2 ** (((Number(octave) + 1) * 12 + NOTE_INDEX[name] - 69) / 12);
};

const BPM = 84;
const MELODY = [
  ['E5', 1], ['G5', 1], ['C6', 1.5], ['B5', 0.5],
  ['B5', 1], ['G5', 1], ['D5', 2],
  ['C6', 1], ['A5', 1], ['E5', 1.5], ['G5', 0.5],
  ['G5', 1], ['E5', 1], ['B4', 2],
  ['A5', 1], ['C6', 1], ['F5', 1.5], ['A5', 0.5],
  ['G5', 1], ['E5', 1], ['C5', 2],
  ['F5', 1], ['A5', 1], ['C6', 1], ['D6', 1],
  ['B5', 1], ['A5', 1], ['G5', 2],
];
const CHORDS = [
  ['C3', 'G3', 'C4', 'E4'], ['G2', 'D3', 'G3', 'B3'], ['A2', 'E3', 'A3', 'C4'], ['E2', 'B2', 'E3', 'G3'],
  ['F2', 'C3', 'F3', 'A3'], ['C3', 'G3', 'C4', 'E4'], ['F2', 'C3', 'F3', 'A3'], ['G2', 'D3', 'G3', 'B3'],
];
const ARPEGGIO = [0, 1, 2, 3, 2, 1, 2, 1];
const LOOP_BEATS = CHORDS.length * 4;

const SONG = (() => {
  const events = [];
  let beat = 0;
  for (const [note, len] of MELODY) {
    events.push({ beat, f: hz(note), vel: 0.22, dur: 1.9 });
    beat += len;
  }
  CHORDS.forEach((chord, bar) => {
    ARPEGGIO.forEach((idx, i) => {
      events.push({ beat: bar * 4 + i * 0.5, f: hz(chord[idx]), vel: i === 0 ? 0.11 : 0.075, dur: 1.4 });
    });
  });
  return events.sort((a, b) => a.beat - b.beat);
})();

const VOLUME = 0.7;

export class MusicBox {
  constructor() {
    this.ctx = null;
    this.on = true;
    this.started = false;
  }

  _init() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master.connect(comp).connect(ctx.destination);

    this.bus = ctx.createGain();
    const dry = ctx.createGain();
    dry.gain.value = 0.8;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    const verb = ctx.createConvolver();
    verb.buffer = this._impulse(2.4);
    this.bus.connect(dry).connect(this.master);
    this.bus.connect(verb).connect(wet).connect(this.master);
    return true;
  }

  _impulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  // Gọi trong một thao tác chạm để trình duyệt cho phép phát âm thanh
  unlock() {
    if (this.ctx && this.ctx.state === 'suspended' && this.on && !document.hidden) this.ctx.resume();
  }

  start() {
    if (this.started || !this._init()) return;
    this.started = true;
    this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.setValueAtTime(0, now);
    this.master.gain.linearRampToValueAtTime(this.on ? VOLUME : 0, now + 1.5);
    this.beat = 60 / BPM;
    this.loopStart = now + 0.6;
    this.idx = 0;
    this.timer = setInterval(() => this._tick(), 50);
  }

  _tick() {
    if (this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    for (;;) {
      const ev = SONG[this.idx];
      const time = this.loopStart + ev.beat * this.beat;
      if (time > now + 0.3) break;
      if (time >= now - 0.02) this._note(ev.f, time, ev.vel, ev.dur);
      if (++this.idx >= SONG.length) {
        this.idx = 0;
        this.loopStart += LOOP_BEATS * this.beat;
      }
    }
  }

  _note(f, t, vel, dur) {
    const { ctx } = this;
    const voice = (freq, peak, length, type = 'sine') => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(g).connect(this.bus);
      o.start(t);
      o.stop(t + length + 0.05);
    };
    voice(f, vel, dur);
    voice(f * 3.01, vel * 0.3, dur * 0.3);
  }

  toggle() {
    this.on = !this.on;
    if (!this.ctx) return this.on;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(this.on ? VOLUME : 0, now + 0.4);
    if (this.on) {
      this.ctx.resume();
    } else {
      setTimeout(() => { if (!this.on) this.ctx.suspend(); }, 450);
    }
    return this.on;
  }

  setHidden(hidden) {
    if (!this.ctx) return;
    if (hidden) this.ctx.suspend();
    else if (this.on) this.ctx.resume();
  }

  /* ---------- Hiệu ứng âm thanh ---------- */

  _ready() {
    // ngay sau start() context có thể vẫn đang "suspended" trong lúc resume
    return this.ctx && this.on && this.ctx.state !== 'closed';
  }

  _arp(notes, gap, vel, dur) {
    if (!this._ready()) return;
    const t0 = this.ctx.currentTime + 0.01;
    notes.forEach((n, i) => this._note(hz(n), t0 + i * gap, vel, dur));
  }

  sparkle() { this._arp(['C6', 'E6', 'G6', 'C7', 'E7', 'G7'], 0.06, 0.12, 1.2); }
  chime() { this._arp(['E6', 'G6', 'C7'], 0.07, 0.14, 1); }
  fanfare() { this._arp(['C6', 'E6', 'G6', 'C7', 'G6', 'C7', 'E7', 'G7', 'C7'], 0.09, 0.13, 1.4); }

  boing() {
    if (!this._ready()) return;
    const { ctx } = this;
    const t = ctx.currentTime + 0.01;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(330, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.42);
  }

  pop() {
    if (!this._ready()) return;
    const { ctx } = this;
    const t = ctx.currentTime + 0.005;
    const len = Math.floor(ctx.sampleRate * 0.08);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1400;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    noise.connect(bp).connect(ng).connect(this.bus);
    noise.start(t);

    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(700, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.15, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(this.bus);
    o.start(t);
    o.stop(t + 0.16);
  }
}
