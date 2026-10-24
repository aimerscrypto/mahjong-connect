/* ==========================================================
   util.js — small shared helpers (math, RNG, tokens, storage)
   ========================================================== */

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const fmt = (n) => Math.round(n).toLocaleString('en-US');
export const pad2 = (n) => String(n).padStart(2, '0');

/** Seeded PRNG (mulberry32). Returns a function producing floats in [0, 1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash → 32-bit unsigned int (used to seed the daily board). */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffleInPlace(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

/** Unique id generator for SVG defs (gradients, filters) so inline SVGs never collide. */
let uidCounter = 0;
export const uid = (prefix = 'u') => `${prefix}${(++uidCounter).toString(36)}`;

/* ---------- Design tokens ----------
   Art generators read colours from the CSS custom properties in tokens.css,
   so the palette is defined in exactly one place.  P.goldHi → var(--gold-hi). */
const tokCache = new Map();
export function tok(name, fallback = '#ff00ff') {
  if (tokCache.has(name)) return tokCache.get(name);
  let v = '';
  try { v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (e) { /* no DOM */ }
  if (!v) v = fallback;
  tokCache.set(name, v);
  return v;
}
const kebab = (s) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
export const P = new Proxy({}, { get: (_, key) => tok('--' + kebab(String(key))) });

/* ---------- Colour helpers ---------- */
function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
/** Mix two hex colours: t = 0 → a, t = 1 → b. */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
}
export const lighten = (c, t) => mix(c, '#ffffff', t);
export const darken = (c, t) => mix(c, '#000000', t);

/* ---------- Persistent settings (always guarded) ---------- */
export const store = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* private mode etc. */ }
  },
};

/* ---------- DOM helpers ---------- */
export function html(str) {
  const t = document.createElement('template');
  t.innerHTML = str.trim();
  return t.content.firstElementChild;
}
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Wrap inner SVG markup in a standalone, export-ready <svg> root. */
export function svgDoc(x, y, w, h, inner, extra = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${x} ${y} ${w} ${h}" ${extra}>${inner}</svg>`;
}

/** Number formatting for SVG paths. */
export const n2 = (v) => (Math.round(v * 100) / 100).toString();

/** Today's date key in local time, e.g. "2026-10-23". */
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/* ---------- Easing ----------
   CSS-equivalent cubic-bézier timing functions (used by the canvas FX
   so they move exactly like the WAAPI/CSS animations they replace). */
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const e = sx(t) - x;
      if (Math.abs(e) < 1e-5) return sy(t);
      const d = dx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= e / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
    return sy(t);
  };
}
export const EASE = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  in: cubicBezier(0.42, 0, 1, 1),
  out: cubicBezier(0, 0, 0.58, 1),
  inOut: cubicBezier(0.42, 0, 0.58, 1),
};
