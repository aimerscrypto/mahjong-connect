/* ==========================================================
   audio.js — every sound is synthesised with WebAudio
   ----------------------------------------------------------
   SFX: wooden clack, combo chimes (rising pentatonic), soft bonk,
        whoosh, firecracker crackle, fanfares.
   Music: a quiet generative pentatonic loop with a plucked,
        guzheng-like voice (pitch-bend attack + darkening filter)
        through a small synthetic reverb.
   Settings persist in localStorage (guarded).
   ========================================================== */
import { store, mulberry32 } from './util.js';

// D major pentatonic, MIDI numbers
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78, 81, 83, 86];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxOn = store.get('mc.sfx', true);
    this.musicOn = store.get('mc.music', true);
    this.musicTimer = 0;
    this.listeners = [];
  }

  /** Create the context lazily on the first user gesture (autoplay policy). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0.8;
      this.master.connect(ctx.destination);
      this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 0.9 : 0;
      this.sfx.connect(this.master);
      this.music = ctx.createGain(); this.music.gain.value = 0;
      this.music.connect(this.master);
      // reverb send
      this.verb = ctx.createConvolver();
      this.verb.buffer = this.impulse(2.4);
      this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.32;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      this.noise = this.noiseBuffer(0.6);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.musicOn) this.startMusic();
  }

  impulse(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    return buf;
  }
  noiseBuffer(seconds) {
    const ctx = this.ctx, len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* ---------- toggles ---------- */
  setSfx(on) {
    this.sfxOn = on; store.set('mc.sfx', on);
    if (this.sfx) this.sfx.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.02);
    this.emit();
  }
  setMusic(on) {
    this.musicOn = on; store.set('mc.music', on);
    if (!this.ctx) { this.emit(); return; }
    if (on) this.startMusic(); else this.stopMusic();
    this.emit();
  }
  onChange(fn) { this.listeners.push(fn); }
  emit() { this.listeners.forEach((fn) => fn(this)); }

  /* ---------- building blocks ---------- */
  env(gainNode, t, peak, attack, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Plucked string: triangle + sine octave, small pitch bend, closing low-pass. */
  pluck(freq, t, { vol = 0.3, dur = 1.6, bend = 1.012, dest, verb = 0.5, bright = 3400 } = {}) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(bright, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + dur * 0.8);
    const o1 = ctx.createOscillator(); o1.type = 'triangle';
    const o2 = ctx.createOscillator(); o2.type = 'sine';
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.frequency.setValueAtTime(freq * bend, t);
    o1.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
    o2.frequency.setValueAtTime(freq * 2 * bend, t);
    o2.frequency.exponentialRampToValueAtTime(freq * 2, t + 0.07);
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(out);
    out.connect(dest || this.sfx);
    if (verb) { const s = ctx.createGain(); s.gain.value = verb; out.connect(s); s.connect(this.verb); }
    this.env(out, t, vol, 0.006, dur);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  /** Bell-like chime (sine partials with inharmonic shimmer). */
  bell(freq, t, vol = 0.22, dur = 1.3) {
    const ctx = this.ctx;
    [[1, 1], [2.01, 0.4], [3.02, 0.18], [4.2, 0.08]].forEach(([mul, amp]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mul;
      const g = ctx.createGain();
      o.connect(g); g.connect(this.sfx);
      const s = ctx.createGain(); s.gain.value = 0.45; g.connect(s); s.connect(this.verb);
      this.env(g, t, vol * amp, 0.004, dur / mul ** 0.4);
      o.start(t); o.stop(t + dur + 0.1);
    });
  }

  noiseHit(t, { freq = 1800, q = 3, vol = 0.4, dur = 0.06, type = 'bandpass', dest } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(dest || this.sfx);
    this.env(g, t, vol, 0.002, dur);
    src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.05);
  }

  ready() { return this.ctx && this.sfxOn && this.ctx.state === 'running'; }

  /* ---------- SFX ---------- */
  clack() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, { freq: 1900 + Math.random() * 400, q: 5, vol: 0.5, dur: 0.05 });
    const o = this.ctx.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(560, t); o.frequency.exponentialRampToValueAtTime(360, t + 0.06);
    const g = this.ctx.createGain(); o.connect(g); g.connect(this.sfx);
    this.env(g, t, 0.28, 0.002, 0.08);
    o.start(t); o.stop(t + 0.12);
  }

  chime(combo = 1) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const i = Math.min(combo - 1, PENTA.length - 3);
    const f = mtof(PENTA[i] + 12);
    this.bell(f, t, 0.2);
    this.bell(mtof(PENTA[i + 2] + 12), t + 0.07, 0.12, 1.0);
    if (combo >= 3) this.bell(mtof(PENTA[i + 2] + 24), t + 0.14, 0.06, 0.8);
  }

  wrong() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    [[196, 0], [165, 0.09]].forEach(([f, dt]) => {
      const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g = this.ctx.createGain();
      o.connect(lp); lp.connect(g); g.connect(this.sfx);
      this.env(g, t + dt, 0.25, 0.005, 0.16);
      o.start(t + dt); o.stop(t + dt + 0.25);
    });
  }

  click() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(980, t + 0.05);
    const g = this.ctx.createGain(); o.connect(g); g.connect(this.sfx);
    this.env(g, t, 0.18, 0.003, 0.08);
    o.start(t); o.stop(t + 0.12);
  }

  whoosh() {
    if (!this.ready()) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2800, t + 0.45);
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(this.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    src.start(t); src.stop(t + 0.6);
    [0, 2, 4].forEach((k, j) => this.pluck(mtof(PENTA[k + 3]), t + 0.08 + j * 0.07, { vol: 0.12, dur: 0.6 }));
  }

  crackle() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 14; i++) {
      const dt = 0.05 + i * 0.045 + Math.random() * 0.03;
      this.noiseHit(t + dt, { freq: 1500 + Math.random() * 2500, q: 0.8, vol: 0.5 + Math.random() * 0.3, dur: 0.035, type: 'highpass' });
    }
    this.noiseHit(t + 0.02, { freq: 220, q: 0.7, vol: 0.7, dur: 0.3, type: 'lowpass' });
  }

  sparkle() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    [0, 2, 4, 5].forEach((k, j) => this.bell(mtof(PENTA[k + 4] + 12), t + j * 0.05, 0.05, 0.6));
  }

  tick() {
    if (!this.ready()) return;
    this.noiseHit(this.ctx.currentTime, { freq: 3200, q: 8, vol: 0.18, dur: 0.03 });
  }

  star(n) {
    if (!this.ready()) return;
    this.bell(mtof(PENTA[3 + n * 2] + 12), this.ctx.currentTime, 0.16, 1.2);
  }

  coin() {
    if (!this.ready()) return;
    this.bell(mtof(PENTA[8] + 12), this.ctx.currentTime, 0.035, 0.25);
  }

  fanfare(big = false) {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    const seq = big ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 3, 5, 7];
    seq.forEach((k, j) => this.pluck(mtof(PENTA[k]), t + j * 0.11, { vol: 0.24, dur: 1.4 }));
    const end = t + seq.length * 0.11;
    [PENTA[5], PENTA[7], PENTA[9]].forEach((m) => this.bell(mtof(m), end, 0.1, 2));
  }

  sad() {
    if (!this.ready()) return;
    const t = this.ctx.currentTime;
    [69, 66, 64, 62].forEach((m, j) => this.pluck(mtof(m - 12), t + j * 0.26, { vol: 0.24, dur: 1.8, bend: 0.985 }));
  }

  /* ---------- Music ---------- */
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.8);
    this.beat = 60 / 72 / 2; // eighth notes at 72 bpm
    this.nextTime = this.ctx.currentTime + 0.15;
    this.step = 0;
    this.rng = mulberry32((Date.now() / 1000) | 0);
    this.phrase = this.makePhrase();
    this.musicTimer = setInterval(() => this.schedule(), 120);
  }
  stopMusic() {
    if (!this.ctx) return;
    clearInterval(this.musicTimer);
    this.musicTimer = 0;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
  }

  /** A 4-bar melodic phrase as 32 eighth-note slots (null = rest). */
  makePhrase() {
    const r = this.rng;
    const notes = [];
    let idx = 4 + Math.floor(r() * 3);
    for (let i = 0; i < 32; i++) {
      const strong = i % 4 === 0;
      if (!strong && r() < 0.45) { notes.push(null); continue; }
      idx += Math.round((r() - 0.5) * 3.2);
      idx = Math.max(2, Math.min(PENTA.length - 2, idx));
      if (i % 8 === 6 && r() < 0.6) { notes.push(null); continue; }
      notes.push(PENTA[idx]);
    }
    notes[31] = null; notes[30] = PENTA[5];
    return notes;
  }

  schedule() {
    const ctx = this.ctx;
    if (ctx.state !== 'running') { this.nextTime = ctx.currentTime + 0.15; return; }
    // Bass roots for D – Bm – G – A (one bar each)
    const roots = [50, 47, 43, 45];
    while (this.nextTime < ctx.currentTime + 0.5) {
      const s = this.step % 32;
      const bar = Math.floor(s / 8);
      const t = this.nextTime;
      if (s % 8 === 0) {
        this.pluck(mtof(roots[bar] - 12), t, { vol: 0.2, dur: 2.6, dest: this.music, verb: 0.6, bright: 1200 });
        this.pluck(mtof(roots[bar] - 5), t + this.beat * 2, { vol: 0.09, dur: 2, dest: this.music, verb: 0.6, bright: 1400 });
      }
      if (s % 8 === 4) this.pluck(mtof(roots[bar]), t, { vol: 0.08, dur: 1.6, dest: this.music, verb: 0.6, bright: 1600 });
      const n = this.phrase[s];
      if (n) {
        const humanize = (this.rng() - 0.5) * 0.02;
        this.pluck(mtof(n), t + humanize, { vol: 0.13 + this.rng() * 0.04, dur: 1.5, dest: this.music, verb: 0.75, bright: 2600 });
        if (this.rng() < 0.12) this.pluck(mtof(n + 12), t + this.beat * 0.5, { vol: 0.04, dur: 1, dest: this.music, verb: 0.9 });
      }
      this.step++;
      if (this.step % 64 === 0) this.phrase = this.makePhrase(); // fresh phrase every 8 bars
      this.nextTime += this.beat;
    }
  }
}

export const audio = new AudioEngine();
