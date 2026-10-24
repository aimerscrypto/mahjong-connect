/* ==========================================================
   logo.js — "MAHJONG CONNECT" game logo
   Cream-to-gold fill, thin lacquer keyline, gold inner stroke,
   thick dark-red outline and a soft drop — layered from one text
   definition with <use>, so every layer stays perfectly aligned.
   ========================================================== */
import { P, uid, svgDoc } from './util.js';
import { swirlCloud } from './art.js';

export const LOGO_W = 1000, LOGO_H = 380;

function sparkle(x, y, r, color) {
  return `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${color}"/>`;
}

export function logoMarkup({ clouds = true, sparkles = true } = {}) {
  const p = uid('lg');
  const font = `font-family="Lilita One, 'Baloo 2', 'Arial Rounded MT Bold', sans-serif"`;
  const lines = [`${p}a`, `${p}b`];
  const layer = (attrs) => lines.map((id) => `<use href="#${id}" xlink:href="#${id}" ${attrs(id)}/>`).join('');

  const defs = `<defs>
    <path id="${p}arc" d="M70 214 Q500 112 930 214"/>
    <text id="${p}a" ${font} font-size="172" letter-spacing="3" text-anchor="middle"><textPath href="#${p}arc" xlink:href="#${p}arc" startOffset="50%">MAHJONG</textPath></text>
    <text id="${p}b" x="500" y="324" ${font} font-size="110" letter-spacing="10" text-anchor="middle">CONNECT</text>
    <linearGradient id="${p}f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fffdf2"/><stop offset=".42" stop-color="#ffefb8"/><stop offset=".7" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldMid}"/>
    </linearGradient>
    <linearGradient id="${p}g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.goldHi}"/><stop offset=".5" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldDark}"/>
    </linearGradient>
    <linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".44" stop-color="#fff" stop-opacity=".25"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>`;

  let s = defs;
  if (clouds) {
    s += swirlCloud({ x: 40, y: 262, s: 1.05, fill: P.cloudCoral, line: P.cloudCoralLine, lineW: 4.5 })
      + swirlCloud({ x: 750, y: 262, s: 1.05, fill: P.cloudCoral, line: P.cloudCoralLine, lineW: 4.5, flip: true })
      + swirlCloud({ x: 150, y: 272, s: 1.2, fill: P.cloudCream, line: P.cloudCreamLine, lineW: 4.5 })
      + swirlCloud({ x: 610, y: 272, s: 1.2, fill: P.cloudCream, line: P.cloudCreamLine, lineW: 4.5, flip: true })
      + swirlCloud({ x: 390, y: 284, s: 1.1, fill: P.cloudCream, line: P.cloudCreamLine, lineW: 4.5 });
  }
  s += layer(() => `transform="translate(0 12)" fill="${P.lacquerInk}" stroke="${P.lacquerInk}" stroke-width="30" stroke-linejoin="round" opacity=".32"`)
    + layer(() => `fill="${P.lacquerDark}" stroke="${P.lacquerDark}" stroke-width="27" stroke-linejoin="round"`)
    + layer(() => `fill="url(#${p}g)" stroke="url(#${p}g)" stroke-width="14" stroke-linejoin="round"`)
    + layer(() => `fill="none" stroke="${P.lacquer}" stroke-width="5" stroke-linejoin="round"`)
    + layer(() => `fill="url(#${p}f)"`)
    + layer(() => `fill="url(#${p}s)"`);
  if (sparkles) {
    s += sparkle(64, 120, 18, P.goldHi) + sparkle(940, 96, 22, P.goldHi) + sparkle(905, 150, 10, '#fff')
      + sparkle(110, 70, 9, '#fff');
  }
  return s;
}

/** Inline logo element markup. */
export function logoSVG(opts = {}) {
  return `<svg class="logo-svg" viewBox="0 0 ${LOGO_W} ${LOGO_H}" aria-label="Mahjong Connect" role="img">${logoMarkup(opts)}</svg>`;
}

export function logoDoc(opts = {}) {
  return svgDoc(0, 0, LOGO_W, LOGO_H, logoMarkup(opts), `width="${LOGO_W}" height="${LOGO_H}"`);
}
