/* ==========================================================
   fx.js — juicy effects on ONE shared canvas
   ----------------------------------------------------------
   Sparkles, rings, flashes, shards, confetti, the firecracker
   string and the glowing match line are all drawn onto a single
   canvas overlaying the stage, instead of creating DOM nodes.

   • Object pool: particles are pre-allocated and recycled; the
     per-frame path allocates nothing.
   • Keyframes: each particle stores up to 7 keyframes + one easing,
     exactly like the Web Animations they replace, so motion matches.
   • Sprites: every particle look is pre-rendered once to a small
     offscreen canvas (with its glow baked in).
   • Dirty rects: only the area drawn last frame is cleared.
   • Idle: when nothing is alive the shared loop stops.
   Floating score text stays as light DOM text (crisp outlined font).
   ========================================================== */
import { P, EASE, cubicBezier, clamp, n2 } from './util.js';
import { addTask, wake, quality } from './loop.js';
import { stageRes, svgToCanvas } from './raster.js';

const STAGE_W = 1920, STAGE_H = 1080;
const CAP_HIGH = 420, CAP_LOW = 180;
const MAXK = 7;
const SS = 3; // sprite supersampling (sprites scale up to ~1.9×)

const EASE_BURST = cubicBezier(0.2, 0.7, 0.3, 1);
const EASE_CONFETTI = cubicBezier(0.3, 0.1, 0.6, 1);
const EASE_DROP = cubicBezier(0.3, 0.8, 0.4, 1);

let canvas = null, ctx = null, res = 1;
const rnd = (a, b) => a + Math.random() * (b - a);
const lowCount = (n) => (quality.low ? Math.max(2, Math.round(n * 0.5)) : n);

/* ==========================================================
   Sprites
   ========================================================== */
const sprites = {};
function sprite(name, w, h, draw, pad = 0) {
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + pad * 2) * SS);
  c.height = Math.ceil((h + pad * 2) * SS);
  const x = c.getContext('2d');
  x.scale(SS, SS);
  x.translate(pad, pad);
  draw(x);
  sprites[name] = { c, w: w + pad * 2, h: h + pad * 2, diag: Math.hypot(w + pad * 2, h + pad * 2), ax: 0.5, ay: 0.5 };
}
const circle = (x, cx, cy, r) => { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); };
/** Shadow-only fill of the current path (shape drawn off-canvas, its blur offset back in). */
function shadowFill(x, pathFn, color, blur) {
  x.save();
  x.shadowColor = color;
  x.shadowBlur = blur * SS;
  x.shadowOffsetX = 5000 * SS;
  x.translate(-5000, 0);
  pathFn();
  x.fillStyle = '#000';
  x.fill();
  x.restore();
}

function buildSprites() {
  const star = new Path2D('M10 0 Q11.4 8.6 20 10 Q11.4 11.4 10 20 Q8.6 11.4 0 10 Q8.6 8.6 10 0Z');
  sprite('star-gold', 20, 20, (x) => { x.fillStyle = '#ffd36a'; x.fill(star); circle(x, 10, 10, 2.6); x.fillStyle = '#fff'; x.fill(); });
  sprite('star-white', 20, 20, (x) => { x.fillStyle = '#ffffff'; x.fill(star); });
  sprite('star-pink', 20, 20, (x) => { x.fillStyle = '#ffb6c8'; x.fill(star); });
  const shard = (name, a, b) => sprite(name, 10, 18, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 18);
    g.addColorStop(0, a); g.addColorStop(1, b);
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, 10, 18, 3) : x.rect(0, 0, 10, 18);
    x.fillStyle = g; x.fill();
  });
  shard('shard-red', P.cinnabarHi, P.cinnabarDark);
  shard('shard-gold', P.goldHi, P.goldMid);
  shard('shard-white', '#fff8e4', '#fff8e4');

  // ring: 3px border, outer glow 14px, inner glow 10px (was CSS box-shadows)
  sprite('ring', 84, 84, (x) => {
    shadowFill(x, () => circle(x, 42, 42, 42), 'rgba(255,200,80,.65)', 14);
    x.globalCompositeOperation = 'destination-out';
    circle(x, 42, 42, 42); x.fill();
    x.globalCompositeOperation = 'source-over';
    x.save();
    circle(x, 42, 42, 39); x.clip();
    shadowFill(x, () => { x.beginPath(); x.arc(42, 42, 70, 0, Math.PI * 2); x.arc(42, 42, 39, 0, Math.PI * 2, true); }, 'rgba(255,200,80,.45)', 10);
    x.restore();
    x.beginPath(); x.arc(42, 42, 42, 0, Math.PI * 2); x.arc(42, 42, 39, 0, Math.PI * 2, true);
    x.fillStyle = 'rgba(255,236,170,.95)'; x.fill();
  }, 22);

  // flash: radial-gradient(circle, …) sized to the farthest corner, clipped to a circle
  sprite('flash', 120, 120, (x) => {
    const g = x.createRadialGradient(60, 60, 0, 60, 60, 60 * Math.SQRT2);
    g.addColorStop(0, '#fff'); g.addColorStop(0.22, 'rgba(255,226,130,.9)');
    g.addColorStop(0.48, 'rgba(255,110,50,.4)'); g.addColorStop(0.7, 'rgba(255,110,50,0)');
    circle(x, 60, 60, 60); x.fillStyle = g; x.fill();
  });

  const petal = new Path2D('M12 2 C20 6 24 16 18 24 C14 28 8 28 5 23 C1 15 4 6 12 2 Z');
  const vein = new Path2D('M12 6 C12 12 11 18 8 22');
  const petalDraw = (fill, withVein) => (x) => {
    const k = 20 / 26;
    x.translate(0, (24 - 30 * k) / 2);
    x.scale(k, k);
    x.fillStyle = fill; x.fill(petal);
    if (withVein) { x.globalAlpha = 0.7; x.strokeStyle = '#fff'; x.lineWidth = 1; x.stroke(vein); }
  };
  sprite('petal', 20, 24, petalDraw('#ffb8c9', true));
  sprite('petal-alt', 20, 24, petalDraw('#ff8aa6', false));

  sprite('coin', 24, 24, (x) => {
    const g = x.createRadialGradient(8.4, 7.2, 0, 8.4, 7.2, Math.hypot(15.6, 16.8));
    g.addColorStop(0, '#fff8d2'); g.addColorStop(0.45, P.gold); g.addColorStop(1, P.goldDark);
    circle(x, 12, 12, 12); x.fillStyle = g; x.fill();
    circle(x, 12, 12, 11); x.lineWidth = 2; x.strokeStyle = P.goldDark; x.stroke();
    x.fillStyle = P.lacquer;
    x.beginPath(); x.roundRect ? x.roundRect(8.5, 8.5, 7, 7, 1) : x.rect(8.5, 8.5, 7, 7); x.fill();
  });

  buildFirecrackerSprite();
}

/** The firecracker string, rasterised from SVG with its drop shadow baked in. */
async function buildFirecrackerSprite() {
  let crackers = '';
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    crackers += `<g transform="translate(${30 + side * 13} ${46 + i * 30}) rotate(${side * 18})">
      <rect x="-8" y="-14" width="16" height="28" rx="4" fill="${P.cinnabar}" stroke="${P.lacquerDark}" stroke-width="2"/>
      <rect x="-8" y="-9" width="16" height="4" fill="${P.gold}"/><rect x="-8" y="5" width="16" height="4" fill="${P.gold}"/>
      <rect x="-5" y="-12" width="3" height="24" rx="1.5" fill="#fff" opacity=".3"/></g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 240">
    <path d="M30 0 V230" stroke="${P.lacquerDark}" stroke-width="3"/>
    <circle cx="30" cy="20" r="10" fill="${P.gold}" stroke="${P.goldDeep}" stroke-width="2"/>
    <path d="M24 14 L36 26 M36 14 L24 26" stroke="${P.goldDeep}" stroke-width="2"/>
    ${crackers}<path d="M30 226 l-5 10 h10 z" fill="${P.gold}"/></svg>`;
  try {
    const art = await svgToCanvas(svg, 80 * SS, 320 * SS);
    const pad = 32;
    sprite('firecracker', 80, 320, (x) => {
      x.shadowColor = 'rgba(61,10,13,.35)';
      x.shadowBlur = 10 * SS;           // drop-shadow(0 8px 10px)
      x.shadowOffsetY = 8 * SS;
      x.drawImage(art, 0, 0, 80, 320);
    }, pad);
    const s = sprites.firecracker;
    s.ax = (pad + 40) / s.w;            // transform-origin: 50% 0
    s.ay = pad / s.h;
  } catch (e) { /* the pops still play without the string */ }
}

/* ==========================================================
   Particle pool
   ========================================================== */
class Particle {
  constructor() {
    this.sprite = null;
    this.t0 = 0; this.dur = 1; this.ease = EASE.linear; this.n = 0;
    this.ko = new Float32Array(MAXK); this.kx = new Float32Array(MAXK); this.ky = new Float32Array(MAXK);
    this.ks = new Float32Array(MAXK); this.kr = new Float32Array(MAXK); this.ka = new Float32Array(MAXK);
  }
  key(i, o, x, y, s, rDeg, a) {
    this.ko[i] = o; this.kx[i] = x; this.ky[i] = y; this.ks[i] = s; this.kr[i] = rDeg * Math.PI / 180; this.ka[i] = a;
    if (i + 1 > this.n) this.n = i + 1;
  }
}
const pool = Array.from({ length: CAP_HIGH }, () => new Particle());
const free = pool.slice();
const live = new Array(CAP_HIGH);
let liveCount = 0;

function spawn(spriteName, dur, delay, ease) {
  const cap = quality.low ? CAP_LOW : CAP_HIGH;
  const sp = sprites[spriteName];
  if (!sp || liveCount >= cap || !free.length) return null;
  const p = free.pop();
  p.sprite = sp;
  p.n = 0;
  p.t0 = performance.now() + delay;
  p.dur = dur;
  p.ease = ease;
  live[liveCount++] = p;
  wake();
  return p;
}

/* ---------- Match lines (small fixed pool) ---------- */
class Line {
  constructor() { this.on = false; this.n = 0; this.x = new Float32Array(4); this.y = new Float32Array(4); this.len = 0; this.t0 = 0; }
}
const lines = Array.from({ length: 6 }, () => new Line());
let linesOn = 0;

/* ==========================================================
   Canvas + frame
   ========================================================== */
const dirty = { x0: 0, y0: 0, x1: 0, y1: 0, any: false };
const next = { x0: 0, y0: 0, x1: 0, y1: 0, any: false };
function grow(x, y, r) {
  if (!next.any) { next.x0 = x - r; next.y0 = y - r; next.x1 = x + r; next.y1 = y + r; next.any = true; return; }
  if (x - r < next.x0) next.x0 = x - r;
  if (y - r < next.y0) next.y0 = y - r;
  if (x + r > next.x1) next.x1 = x + r;
  if (y + r > next.y1) next.y1 = y + r;
}

function resize() {
  if (!canvas) return;
  const k = Math.min(1.5, stageRes()) * (quality.low ? 0.6 : 1);
  canvas.width = Math.round(STAGE_W * k);
  canvas.height = Math.round(STAGE_H * k);
  res = canvas.width / STAGE_W;
  dirty.any = false;
  wake();
}

/** Attach the shared FX canvas (lives inside the stage, above everything). */
export function initFX(el) {
  canvas = el;
  ctx = el.getContext('2d');
  buildSprites();
  resize();
  quality.onChange(resize);
  addTask(frame);
}
export const resizeFX = resize;

function linePath(L, limit) {
  ctx.beginPath();
  ctx.moveTo(L.x[0], L.y[0]);
  let left = limit;
  for (let i = 1; i < L.n; i++) {
    const sx = L.x[i] - L.x[i - 1], sy = L.y[i] - L.y[i - 1], sl = Math.hypot(sx, sy);
    if (left >= sl) { ctx.lineTo(L.x[i], L.y[i]); left -= sl; }
    else { if (sl > 0) ctx.lineTo(L.x[i - 1] + sx * (left / sl), L.y[i - 1] + sy * (left / sl)); break; }
  }
}
function lineStroke(L, color, w, a, limit) {
  ctx.globalAlpha = a;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  linePath(L, limit);
  ctx.stroke();
}
function endDot(x, y, alpha) {
  ctx.globalAlpha = alpha * 0.45; ctx.fillStyle = '#ffe08a';
  ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha; ctx.fillStyle = P.goldHi; ctx.strokeStyle = P.goldMid; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x, y, 7.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill();
}

function drawLine(L, now) {
  const t = now - L.t0;
  if (t >= 560) { L.on = false; linesOn--; return; }
  // group fade: opacity 1 → 1 (55%) → 0, ease-in over 560ms; inner strokes draw in over 170ms
  const e = EASE.in(t / 560);
  const alpha = e < 0.55 ? 1 : 1 - (e - 0.55) / 0.45;
  const drawn = L.len * EASE.out(clamp(t / 170, 0, 1));
  ctx.setTransform(res, 0, 0, res, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  lineStroke(L, '#ffd36a', 20, alpha * 0.28, L.len);
  lineStroke(L, P.goldMid, 9, alpha * 0.9, L.len);
  if (drawn > 0.5) { lineStroke(L, P.goldHi, 5.5, alpha, drawn); lineStroke(L, '#fff', 2.2, alpha, drawn); }
  endDot(L.x[0], L.y[0], alpha);
  endDot(L.x[L.n - 1], L.y[L.n - 1], alpha);
  for (let i = 0; i < L.n; i++) grow(L.x[i], L.y[i], 18);
}

function drawParticle(p, now) {
  const t = (now - p.t0) / p.dur;
  if (t < 0) return true;              // waiting out its delay
  if (t >= 1) return false;
  const e = p.ease(t);
  let i = 1;
  while (i < p.n - 1 && e > p.ko[i]) i++;
  const o0 = p.ko[i - 1], o1 = p.ko[i];
  const u = o1 > o0 ? clamp((e - o0) / (o1 - o0), 0, 1) : 1;
  const x = p.kx[i - 1] + (p.kx[i] - p.kx[i - 1]) * u;
  const y = p.ky[i - 1] + (p.ky[i] - p.ky[i - 1]) * u;
  const s = p.ks[i - 1] + (p.ks[i] - p.ks[i - 1]) * u;
  const r = p.kr[i - 1] + (p.kr[i] - p.kr[i - 1]) * u;
  const a = p.ka[i - 1] + (p.ka[i] - p.ka[i - 1]) * u;
  if (a <= 0.003 || s <= 0) return true;
  const sp = p.sprite;
  const k = res * s, c = Math.cos(r) * k, sn = Math.sin(r) * k;
  ctx.globalAlpha = a > 1 ? 1 : a;
  ctx.setTransform(c, sn, -sn, c, x * res, y * res);
  ctx.drawImage(sp.c, -sp.ax * sp.w, -sp.ay * sp.h, sp.w, sp.h);
  grow(x, y, sp.diag * s);
  return true;
}

function frame(dt, now) {
  if (!ctx) return false;
  if (dirty.any) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const x0 = Math.max(0, Math.floor(dirty.x0 * res) - 2), y0 = Math.max(0, Math.floor(dirty.y0 * res) - 2);
    ctx.clearRect(x0, y0, Math.ceil(dirty.x1 * res) + 2 - x0, Math.ceil(dirty.y1 * res) + 2 - y0);
  }
  next.any = false;
  if (linesOn) for (const L of lines) if (L.on) drawLine(L, now);
  for (let i = 0; i < liveCount; i++) {
    const p = live[i];
    if (!drawParticle(p, now)) {
      free.push(p);
      live[i] = live[--liveCount];
      live[liveCount] = null;
      i--;
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  dirty.x0 = next.x0; dirty.y0 = next.y0; dirty.x1 = next.x1; dirty.y1 = next.y1; dirty.any = next.any;
  return liveCount > 0 || linesOn > 0 || dirty.any;
}

/* ==========================================================
   Effects (all coordinates in stage pixels)
   ========================================================== */

/** Glowing gold match line with end dots and sparkles running along it. */
export function matchLine(pts) {
  if (!pts || pts.length < 2) return;
  const L = lines.find((l) => !l.on);
  const now = performance.now();
  if (L) {
    L.on = true; linesOn++;
    L.n = Math.min(4, pts.length);
    L.len = 0;
    for (let i = 0; i < L.n; i++) {
      L.x[i] = pts[i].x; L.y[i] = pts[i].y;
      if (i) L.len += Math.hypot(L.x[i] - L.x[i - 1], L.y[i] - L.y[i - 1]);
    }
    L.t0 = now;
    wake();
  }
  // five sparkles; keyframes sample the path at 7 points, like the old WAAPI version
  let len = 0;
  const segs = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); segs.push(l); len += l; }
  const at = (dist) => {
    let k = 0;
    while (k < segs.length - 1 && dist > segs[k]) { dist -= segs[k]; k++; }
    const t = segs[k] ? Math.min(1, dist / segs[k]) : 0;
    return [pts[k].x + (pts[k + 1].x - pts[k].x) * t, pts[k].y + (pts[k + 1].y - pts[k].y) * t];
  };
  const count = lowCount(5);
  for (let i = 0; i < count; i++) {
    const p = spawn('star-gold', 420 + i * 40, i * 35, EASE.linear);
    if (!p) break;
    for (let k = 0; k <= 6; k++) {
      const [qx, qy] = at(len * Math.min(1, (k / 6) * (0.75 + i * 0.07)));
      p.key(k, k / 6, qx, qy, k === 6 ? 0.2 : 0.7 + (k % 2) * 0.4, k * 30, k === 6 ? 0 : 1);
    }
  }
}

const STAR = { gold: 'star-gold', white: 'star-white', pink: 'star-pink', red: 'star-gold' };
const SHARD = { gold: 'shard-gold', white: 'shard-white', red: 'shard-red', pink: 'shard-red' };

/** Sparkle burst with an expanding ring. */
export function burst(x, y, { count = 9, colors = null, spread = 70, size = 1, kind = 'star' } = {}) {
  const palette = colors || ['gold', 'gold', 'white', 'pink'];
  const map = kind === 'shard' ? SHARD : STAR;
  const n = lowCount(count);
  for (let i = 0; i < n; i++) {
    const p = spawn(map[palette[i % palette.length]], rnd(520, 760), 0, EASE_BURST);
    if (!p) break;
    const a = (i / n) * Math.PI * 2 + rnd(-0.3, 0.3);
    const r = spread * rnd(0.55, 1);
    const sc = size * rnd(0.6, 1.15);
    p.key(0, 0, x, y, sc * 0.3, 0, 1);
    p.key(1, 0.55, x + Math.cos(a) * r * 0.75, y + Math.sin(a) * r * 0.75, sc, 120, 1);
    p.key(2, 1, x + Math.cos(a) * r, y + Math.sin(a) * r + 14, sc * 0.2, 200, 0);
  }
  const ring = spawn('ring', 420, 0, EASE.out);
  if (ring) { ring.key(0, 0, x, y, 0.2, 0, 0.9); ring.key(1, 1, x, y, 1.4, 0, 0); }
}

/** Petals & gold coins raining down. */
export function confetti({ count = 46, width = STAGE_W, height = STAGE_H, x0 = 0, duration = [2600, 4200] } = {}) {
  const n = lowCount(count);
  for (let i = 0; i < n; i++) {
    const coin = i % 3 === 0;
    const name = coin ? 'coin' : i % 2 ? 'petal-alt' : 'petal';
    const p = spawn(name, rnd(duration[0], duration[1]), rnd(0, 900), EASE_CONFETTI);
    if (!p) break;
    const hw = coin ? 12 : 10, hh = 12;     // box centre (the old divs rotated about their centre)
    const x = x0 + rnd(0, width), drift = rnd(-140, 140), rot = rnd(-540, 540), sc = rnd(0.7, 1.25);
    p.key(0, 0, x + hw, -60 + hh, sc, 0, 1);
    p.key(1, 0.5, x + drift * 0.6 + hw, height * 0.5 + hh, sc, rot * 0.5, 1);
    p.key(2, 1, x + drift + hw, height + 60 + hh, sc, rot, 0.85);
  }
}

/** Red & gold shards, gold stars and a flash. */
export function festiveBurst(x, y, scale = 1) {
  burst(x, y, { count: 10, colors: ['red', 'gold', 'red', 'white'], spread: 90 * scale, size: 1.2 * scale, kind: 'shard' });
  burst(x, y, { count: 6, colors: ['gold'], spread: 50 * scale, size: 1 * scale });
  const f = spawn('flash', 360, 0, EASE.out);
  if (f) { f.key(0, 0, x, y, 0.3, 0, 1); f.key(1, 1, x, y, 1.6 * scale, 0, 0); }
}

/** Firecracker string drops in, sways, then pops.  Resolves when the pops begin. */
export function firecrackerString(x, y) {
  const top = y - 160;
  const drop = spawn('firecracker', 620, 0, EASE_DROP);
  if (drop) {
    drop.key(0, 0, x, y - 760, 1, 0, 1);
    drop.key(1, 0.55, x, top, 1, 6, 1);
    drop.key(2, 0.78, x, top, 1, -5, 1);
    drop.key(3, 1, x, top, 1, 0, 1);
  }
  const shake = spawn('firecracker', 520, 620, EASE.in);
  if (shake) {
    shake.key(0, 0, x, top, 1, 0, 1);
    shake.key(1, 0.3, x, top, 1.04, 3, 1);
    shake.key(2, 0.6, x, top, 1.08, -3, 1);
    shake.key(3, 1, x, top, 1.3, 0, 0);
  }
  return new Promise((resolve) => setTimeout(() => {
    for (let i = 0; i < 6; i++) setTimeout(() => festiveBurst(x + (i % 2 ? 14 : -14), y - 110 + i * 38, 0.7), 140 + i * 55);
    resolve();
  }, 620));
}

/* ---------- Floating score text (DOM: crisp outlined lettering) ---------- */
export function floatText(layer, x, y, text, cls = '') {
  const el = document.createElement('div');
  el.className = `float-text ${cls}`;
  el.textContent = text;
  layer.appendChild(el);
  const anim = el.animate([
    { transform: `translate(${n2(x)}px, ${n2(y)}px) translate(-50%, -50%) scale(.5)`, opacity: 0 },
    { transform: `translate(${n2(x)}px, ${n2(y - 26)}px) translate(-50%, -50%) scale(1.15)`, opacity: 1, offset: 0.2 },
    { transform: `translate(${n2(x)}px, ${n2(y - 48)}px) translate(-50%, -50%) scale(1)`, opacity: 1, offset: 0.7 },
    { transform: `translate(${n2(x)}px, ${n2(y - 76)}px) translate(-50%, -50%) scale(.95)`, opacity: 0 },
  ], { duration: 1050, easing: 'ease-out', fill: 'forwards' });
  anim.onfinish = () => el.remove();
}
