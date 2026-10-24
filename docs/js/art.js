/* ==========================================================
   art.js — shared vector primitives used across the UI kit,
   logo and background: spirals, auspicious swirl clouds,
   gold gradients, corner ornaments and stars.
   ========================================================== */
import { P, n2 } from './util.js';

/** Archimedean spiral as a polyline path (used for cloud curls & ornaments). */
export function spiralPath(cx, cy, r, turns = 1.5, start = 0, dir = 1, steps = 36) {
  let d = '';
  for (let k = 0; k <= steps; k++) {
    const t = k / steps;
    const a = start + dir * t * turns * Math.PI * 2;
    const rr = r * (1 - t * 0.82);
    d += `${k ? 'L' : 'M'}${n2(cx + Math.cos(a) * rr)} ${n2(cy + Math.sin(a) * rr)} `;
  }
  return d.trim();
}

/**
 * Chinese auspicious ("xiangyun") swirl cloud.
 * Built from overlapping lobes; a thick outline pass drawn under a fill
 * pass gives a clean single silhouette, then spiral curls on top.
 * Local size ≈ 200 × 90, origin top-left.  flip mirrors horizontally.
 */
export function swirlCloud({ x = 0, y = 0, s = 1, fill, line, curl, lineW = 5, flip = false, opacity = 1 } = {}) {
  const lobes = [
    [44, 56, 26], [82, 40, 34], [124, 44, 30], [160, 58, 22],
  ];
  const base = `<rect x="18" y="52" width="164" height="30" rx="15"/>`;
  const circles = lobes.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('');
  const curls = [
    spiralPath(84, 42, 17, 1.35, Math.PI, 1),
    spiralPath(126, 46, 13, 1.25, 0, -1),
    spiralPath(46, 58, 11, 1.2, Math.PI * 0.9, 1),
  ];
  const tf = `translate(${n2(x)} ${n2(y)}) scale(${flip ? -s : s} ${s})${flip ? ' translate(-200 0)' : ''}`;
  return `<g transform="${tf}" opacity="${opacity}">`
    + `<g fill="${line}" stroke="${line}" stroke-width="${lineW * 2}" stroke-linejoin="round">${base}${circles}</g>`
    + `<g fill="${fill}">${base}${circles}</g>`
    + `<path d="M24 74 H176" stroke="${line}" stroke-width="${lineW * 0.6}" stroke-linecap="round" opacity=".45"/>`
    + `<g fill="none" stroke="${curl || line}" stroke-width="${lineW * 0.75}" stroke-linecap="round" stroke-linejoin="round">${curls.map((d) => `<path d="${d}"/>`).join('')}</g>`
    + `</g>`;
}

/** Standard gold gradients, scoped by prefix p: #p-gold (vertical), #p-goldD (diagonal), #p-goldDark. */
export function goldDefs(p) {
  return `
  <linearGradient id="${p}-gold" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.goldHi}"/><stop offset=".4" stop-color="${P.gold}"/><stop offset=".72" stop-color="${P.goldMid}"/><stop offset="1" stop-color="${P.goldDark}"/>
  </linearGradient>
  <linearGradient id="${p}-goldD" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${P.goldHi}"/><stop offset=".35" stop-color="${P.gold}"/><stop offset=".65" stop-color="${P.goldMid}"/><stop offset="1" stop-color="${P.goldDark}"/>
  </linearGradient>
  <linearGradient id="${p}-goldDark" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${P.goldMid}"/><stop offset="1" stop-color="${P.goldDeep}"/>
  </linearGradient>
  <radialGradient id="${p}-jade" cx=".35" cy=".3" r=".75">
    <stop offset="0" stop-color="#d8ffe9"/><stop offset=".35" stop-color="${P.jadeHi}"/><stop offset="1" stop-color="${P.jadeDark}"/>
  </radialGradient>
  <radialGradient id="${p}-lac" cx=".5" cy=".3" r=".9">
    <stop offset="0" stop-color="${P.lacquerHi}"/><stop offset=".5" stop-color="${P.lacquer}"/><stop offset="1" stop-color="${P.lacquerDark}"/>
  </radialGradient>
  <linearGradient id="${p}-sheen" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>`;
}

/** Gold corner ornament (bracket + cloud curl + jade gem), drawn for the top-left
 *  corner in a 64-unit box. Use transforms to place the other corners. */
export function cornerOrnament(p, size = 64) {
  const k = size / 64;
  return `<g transform="scale(${n2(k)})" stroke-linecap="round" stroke-linejoin="round" fill="none">`
    + `<path d="M6 60 V24 Q6 6 24 6 H60" stroke="${P.goldDeep}" stroke-width="8"/>`
    + `<path d="M6 60 V24 Q6 6 24 6 H60" stroke="url(#${p}-goldD)" stroke-width="5"/>`
    + `<path d="M16 58 V28 Q16 16 28 16 H58" stroke="url(#${p}-goldD)" stroke-width="2.2"/>`
    + `<path d="${spiralPath(32, 32, 9, 1.4, Math.PI * 1.25, 1)}" stroke="${P.goldDeep}" stroke-width="5"/>`
    + `<path d="${spiralPath(32, 32, 9, 1.4, Math.PI * 1.25, 1)}" stroke="url(#${p}-goldD)" stroke-width="3"/>`
    + `<circle cx="8" cy="8" r="7.5" fill="url(#${p}-jade)" stroke="${P.goldDeep}" stroke-width="2.4"/>`
    + `<circle cx="6" cy="5.8" r="2.2" fill="#fff" stroke="none" opacity=".75"/>`
    + `</g>`;
}

/** Place a 64-box ornament in all four corners of a w × h rectangle, inset by m. */
export function fourCorners(p, w, h, m = 0, size = 64) {
  const o = cornerOrnament(p, size);
  return `<g transform="translate(${m} ${m})">${o}</g>`
    + `<g transform="translate(${w - m} ${m}) scale(-1 1)">${o}</g>`
    + `<g transform="translate(${m} ${h - m}) scale(1 -1)">${o}</g>`
    + `<g transform="translate(${w - m} ${h - m}) scale(-1 -1)">${o}</g>`;
}

export const STAR_PATH = (cx, cy, R, r = R * 0.48) => {
  let d = '';
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + k * Math.PI / 5;
    const rr = k % 2 ? r : R;
    d += `${k ? 'L' : 'M'}${n2(cx + Math.cos(a) * rr)} ${n2(cy + Math.sin(a) * rr)} `;
  }
  return d + 'Z';
};
