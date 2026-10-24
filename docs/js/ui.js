/* ==========================================================
   ui.js — the UI kit
   ----------------------------------------------------------
   Part 1: vector skins (buttons, panels, ribbons, frame, plaque,
           stars).  Because the stage is a fixed 1920 × 1080 design,
           each skin is generated at its exact pixel size: crisp
           corners, no 9-slicing.  The same generators feed the
           asset sheet, so exports match the game 1:1.
   Part 2: runtime helpers (button enhancement, screens with a
           cloud-curtain transition, modals, toasts).
   ========================================================== */
import { P, uid, n2, lighten, darken, svgDoc, wait, clamp, $, $$ } from './util.js';
import { svgToURL, svgToCanvas, stageRes, dpr, idleQueue, onResizeSettled } from './raster.js';
import { goldDefs, fourCorners, spiralPath, STAR_PATH, swirlCloud } from './art.js';
import { iconSVG, iconMarkup } from './icons.js';

/* ==========================================================
   PART 1 — SKINS
   ========================================================== */
export const SKIN_MARGIN = 10;

export function variantColors(variant) {
  switch (variant) {
    case 'jade': return { face: [lighten(P.jadeHi, 0.3), P.jade, P.jadeDark], edge: darken(P.jadeDark, 0.3), outline: darken(P.jadeDark, 0.35) };
    case 'gold': return { face: [P.goldHi, P.gold, P.goldMid], edge: P.goldDark, outline: P.goldDeep };
    case 'grey': return { face: ['#f3ebdf', '#d4c6b2', '#ab9b84'], edge: '#7f6f5b', outline: '#6f5f4b' };
    default: return { face: [lighten(P.cinnabarHi, 0.15), P.cinnabar, P.cinnabarDark], edge: P.lacquerDark, outline: P.lacquerDark };
  }
}

const edgeOf = (h) => Math.max(6, Math.min(12, Math.round(h * 0.11)));

/**
 * Button skin (inner markup) for a w × h button.  h includes the 3D bottom edge.
 * state: normal | hover | pressed | disabled.   round: circle button (w = face height).
 */
export function buttonSkinMarkup(w, h, variant = 'red', state = 'normal', { round = false, radius } = {}) {
  const p = uid('b');
  const E = edgeOf(h), fh = h - E;
  const r = round ? fh / 2 : (radius ?? fh / 2);
  const v = variantColors(state === 'disabled' ? 'grey' : variant);
  const face = state === 'hover' ? v.face.map((c) => lighten(c, 0.12)) : v.face;
  const dy = state === 'pressed' ? E - 2 : 0;
  const shine = round
    ? `<ellipse cx="${n2(w / 2)}" cy="${n2(fh * 0.3)}" rx="${n2(w * 0.32)}" ry="${n2(fh * 0.17)}" fill="url(#${p}s)"/>`
    : `<rect x="10" y="6" width="${w - 20}" height="${n2((fh - 7) * 0.44)}" rx="${n2(Math.min(r - 7, (fh - 7) * 0.22))}" fill="url(#${p}s)"/>`;
  return `<defs>${goldDefs(p)}
      <linearGradient id="${p}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${face[0]}"/><stop offset=".55" stop-color="${face[1]}"/><stop offset="1" stop-color="${face[2]}"/></linearGradient>
      <linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>`
    + `<rect x="3" y="${E + (state === 'pressed' ? 2 : 6)}" width="${w - 6}" height="${fh}" rx="${n2(r)}" fill="#4a0c0f" opacity="${state === 'pressed' ? 0.14 : 0.24}"/>`
    + `<rect x="0" y="${E}" width="${w}" height="${fh}" rx="${n2(r)}" fill="url(#${p}-goldDark)"/>`
    + `<rect x="3" y="${E + 1}" width="${w - 6}" height="${fh - 4}" rx="${n2(r - 3)}" fill="${v.edge}"/>`
    + `<g transform="translate(0 ${dy})">`
    + (state === 'hover' ? `<rect x="-3" y="-3" width="${w + 6}" height="${fh + 6}" rx="${n2(r + 3)}" fill="none" stroke="${P.goldHi}" stroke-width="3" opacity=".55"/>` : '')
    + `<rect x="0" y="0" width="${w}" height="${fh}" rx="${n2(r)}" fill="url(#${p}-gold)"/>`
    + `<rect x="3.5" y="3.5" width="${w - 7}" height="${fh - 7}" rx="${n2(r - 3.5)}" fill="url(#${p}f)"/>`
    + shine
    + `<rect x="5.5" y="5.5" width="${w - 11}" height="${fh - 11}" rx="${n2(Math.max(1, r - 5.5))}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.4"/>`
    + `</g>`;
}

export function buttonSkinSVG(w, h, variant, state, opts) {
  const m = SKIN_MARGIN;
  return `<svg class="skin skin-${state}" viewBox="${-m} ${-m} ${w + m * 2} ${h + m * 2}" width="${w + m * 2}" height="${h + m * 2}" aria-hidden="true">${buttonSkinMarkup(w, h, variant, state, opts)}</svg>`;
}

/** Export-ready button: skin + icon + outlined label, for the asset sheet. */
export function buttonDoc(w, h, variant, state, { label = '', icon = '', round = false, fontSize } = {}) {
  const m = SKIN_MARGIN;
  const E = edgeOf(h), fh = h - E;
  const dy = state === 'pressed' ? E - 2 : 0;
  const v = variantColors(state === 'disabled' ? 'grey' : variant);
  const fs = fontSize || Math.round(fh * 0.42);
  let content = '';
  if (round && icon) {
    const s = fh * 0.58;
    content = `<g transform="translate(${n2(w / 2 - s / 2)} ${n2(fh / 2 - s / 2 + dy)}) scale(${n2(s / 48)})">${iconMarkup(icon, { outline: v.outline })}</g>`;
  } else {
    const iconW = icon ? fh * 0.52 : 0;
    const textW = label.length * fs * 0.52;
    const startX = w / 2 - (iconW + (icon ? 12 : 0) + textW) / 2;
    if (icon) content += `<g transform="translate(${n2(startX)} ${n2(fh / 2 - iconW / 2 + dy)}) scale(${n2(iconW / 48)})">${iconMarkup(icon, { outline: v.outline })}</g>`;
    const tx = icon ? startX + iconW + 12 + textW / 2 : w / 2;
    content += `<text x="${n2(tx)}" y="${n2(fh / 2 + fs * 0.36 + dy)}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="${fs}" fill="#fff6df" stroke="${v.outline}" stroke-width="${n2(fs * 0.16)}" stroke-linejoin="round" paint-order="stroke" letter-spacing="1">${label}</text>`;
  }
  return svgDoc(-m, -m, w + m * 2, h + m * 2, buttonSkinMarkup(w, h, variant, state, { round }) + content,
    `width="${w + m * 2}" height="${h + m * 2}"`);
}

/* ---------- Ribbon (title banner) ---------- */
export function ribbonMarkup(w, h) {
  const p = uid('rb');
  const bh = h * 0.78, tt = h * 0.24, inset = h * 0.62, fold = 16;
  const tail = (mirror) => {
    const pts = `${inset + fold},${tt} 0,${tt} ${h * 0.34},${(tt + h) / 2} 0,${h} ${inset + fold},${h}`;
    const fl = `${inset},${bh} ${inset + fold},${bh} ${inset + fold},${h}`;
    const tr = mirror ? `transform="translate(${w} 0) scale(-1 1)"` : '';
    return `<g ${tr}><polygon points="${pts}" fill="url(#${p}t)" stroke="url(#${p}-gold)" stroke-width="2.4" stroke-linejoin="round"/>`
      + `<polygon points="${fl}" fill="${P.lacquerInk}" opacity=".85"/></g>`;
  };
  return `<defs>${goldDefs(p)}
      <linearGradient id="${p}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.lacquerHi}"/><stop offset=".55" stop-color="${P.lacquer}"/><stop offset="1" stop-color="${P.lacquerDark}"/></linearGradient>
      <linearGradient id="${p}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.lacquer}"/><stop offset="1" stop-color="${P.lacquerInk}"/></linearGradient>
    </defs>`
    + `<rect x="${inset}" y="${tt + 6}" width="${w - inset * 2}" height="${h - tt - 2}" fill="#3d0a0d" opacity=".25"/>`
    + tail(false) + tail(true)
    + `<rect x="${inset}" y="0" width="${w - inset * 2}" height="${n2(bh)}" rx="4" fill="url(#${p}-gold)"/>`
    + `<rect x="${inset}" y="3.5" width="${w - inset * 2}" height="${n2(bh - 7)}" fill="url(#${p}r)"/>`
    + `<rect x="${inset}" y="3.5" width="${w - inset * 2}" height="${n2((bh - 7) * 0.45)}" fill="url(#${p}-sheen)"/>`
    + `<path d="M${inset + 6} 8.5 H${w - inset - 6} M${inset + 6} ${n2(bh - 8.5)} H${w - inset - 6}" stroke="${P.goldHi}" stroke-width="1.2" opacity=".55"/>`;
}

/* ---------- Panels ---------- */
export function panelMarkup(w, h, variant = 'lacquer') {
  const p = uid('pn');
  const d = goldDefs(p);
  const parch = `<linearGradient id="${p}pa" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.parchment}"/><stop offset="1" stop-color="${P.parchment2}"/></linearGradient>`;
  const lattice = `<pattern id="${p}lt" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M14 2 L26 14 L14 26 L2 14 Z" fill="none" stroke="${P.lacquerHi}" stroke-width="1.3" opacity=".45"/><circle cx="14" cy="14" r="1.6" fill="${P.gold}" opacity=".35"/></pattern>`;
  const clouds = `<pattern id="${p}cl" width="120" height="70" patternUnits="userSpaceOnUse"><path d="${spiralPath(30, 30, 12, 1.3, Math.PI, 1)}" fill="none" stroke="${P.parchmentLine}" stroke-width="2" opacity=".35" stroke-linecap="round"/><path d="${spiralPath(90, 52, 9, 1.3, 0, -1)}" fill="none" stroke="${P.parchmentLine}" stroke-width="2" opacity=".3" stroke-linecap="round"/></pattern>`;

  if (variant === 'scroll') {
    const roller = (y) => `<g>`
      + `<rect x="10" y="${y + 4}" width="${w - 20}" height="40" rx="20" fill="#3d0a0d" opacity=".25"/>`
      + `<rect x="10" y="${y}" width="${w - 20}" height="40" rx="20" fill="url(#${p}ro)" stroke="${P.lacquerInk}" stroke-width="2"/>`
      + `<rect x="24" y="${y + 6}" width="${w - 48}" height="9" rx="4.5" fill="#fff" opacity=".22"/>`
      + `<rect x="34" y="${y}" width="14" height="40" fill="url(#${p}-gold)"/><rect x="${w - 48}" y="${y}" width="14" height="40" fill="url(#${p}-gold)"/>`
      + `<circle cx="8" cy="${y + 20}" r="17" fill="url(#${p}-goldD)" stroke="${P.goldDeep}" stroke-width="2.5"/>`
      + `<circle cx="${w - 8}" cy="${y + 20}" r="17" fill="url(#${p}-goldD)" stroke="${P.goldDeep}" stroke-width="2.5"/>`
      + `<circle cx="8" cy="${y + 20}" r="6" fill="url(#${p}-jade)" stroke="${P.goldDeep}" stroke-width="1.5"/>`
      + `<circle cx="${w - 8}" cy="${y + 20}" r="6" fill="url(#${p}-jade)" stroke="${P.goldDeep}" stroke-width="1.5"/>`
      + `</g>`;
    return `<defs>${d}${parch}${clouds}
        <linearGradient id="${p}ro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.lacquerHi}"/><stop offset=".5" stop-color="${P.lacquer}"/><stop offset="1" stop-color="${P.lacquerInk}"/></linearGradient>
        <linearGradient id="${p}ed" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a4a1a" stop-opacity=".22"/><stop offset=".08" stop-color="#8a4a1a" stop-opacity="0"/><stop offset=".92" stop-color="#8a4a1a" stop-opacity="0"/><stop offset="1" stop-color="#8a4a1a" stop-opacity=".22"/></linearGradient>
        <linearGradient id="${p}sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5e2a0a" stop-opacity=".3"/><stop offset="1" stop-color="#5e2a0a" stop-opacity="0"/></linearGradient>
      </defs>`
      + `<rect x="30" y="24" width="${w - 60}" height="${h - 48}" fill="url(#${p}pa)" stroke="${P.parchmentLine}" stroke-width="1.5"/>`
      + `<rect x="30" y="24" width="${w - 60}" height="${h - 48}" fill="url(#${p}cl)"/>`
      + `<rect x="30" y="24" width="${w - 60}" height="${h - 48}" fill="url(#${p}ed)"/>`
      + `<rect x="30" y="44" width="${w - 60}" height="22" fill="url(#${p}sh)"/>`
      + `<rect x="52" y="78" width="${w - 104}" height="${h - 156}" rx="6" fill="none" stroke="${P.lacquer}" stroke-width="2.5" opacity=".75"/>`
      + `<rect x="60" y="86" width="${w - 120}" height="${h - 172}" rx="3" fill="none" stroke="${P.gold}" stroke-width="1.5" opacity=".8"/>`
      + roller(4) + roller(h - 44);
  }

  if (variant === 'hud') {
    const r = Math.min(h / 2, 28);
    return `<defs>${d}${lattice}</defs>`
      + `<rect x="0" y="5" width="${w}" height="${h}" rx="${r}" fill="#3d0a0d" opacity=".25"/>`
      + `<rect x="0" y="0" width="${w}" height="${h}" rx="${r}" fill="url(#${p}-goldD)"/>`
      + `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="${r - 4}" fill="url(#${p}-lac)"/>`
      + `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="${r - 4}" fill="url(#${p}lt)" opacity=".55"/>`
      + `<rect x="4" y="4" width="${w - 8}" height="${n2((h - 8) * 0.45)}" rx="${r - 4}" fill="url(#${p}-sheen)"/>`
      + `<rect x="9" y="9" width="${w - 18}" height="${h - 18}" rx="${r - 9}" fill="none" stroke="${P.goldHi}" stroke-width="1.3" opacity=".55"/>`;
  }

  // lacquer modal panel with a parchment inset
  return `<defs>${d}${parch}${lattice}${clouds}
      <linearGradient id="${p}is" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a3a10" stop-opacity=".2"/><stop offset="1" stop-color="#7a3a10" stop-opacity="0"/></linearGradient>
    </defs>`
    + `<rect x="0" y="0" width="${w}" height="${h}" rx="32" fill="url(#${p}-goldD)"/>`
    + `<rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="28" fill="url(#${p}-lac)"/>`
    + `<rect x="5" y="5" width="${w - 10}" height="${h - 10}" rx="28" fill="url(#${p}lt)" opacity=".6"/>`
    + `<rect x="5" y="5" width="${w - 10}" height="${n2(h * 0.22)}" rx="28" fill="url(#${p}-sheen)"/>`
    + `<rect x="13" y="13" width="${w - 26}" height="${h - 26}" rx="22" fill="none" stroke="${P.goldHi}" stroke-width="1.4" opacity=".6"/>`
    + `<rect x="28" y="28" width="${w - 56}" height="${h - 56}" rx="16" fill="url(#${p}pa)" stroke="url(#${p}-gold)" stroke-width="4"/>`
    + `<rect x="30" y="30" width="${w - 60}" height="${h - 60}" rx="14" fill="url(#${p}cl)"/>`
    + `<rect x="30" y="30" width="${w - 60}" height="36" rx="14" fill="url(#${p}is)"/>`
    + `<rect x="38" y="38" width="${w - 76}" height="${h - 76}" rx="10" fill="none" stroke="${P.parchmentLine}" stroke-width="1.3" opacity=".8"/>`
    + fourCorners(p, w, h, -4, 70);
}

/* ---------- Board frame ---------- */
export function frameMarkup(w, h, border = 24) {
  const p = uid('fr');
  const B = border;
  const ornMid = (x, y, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})">`
    + `<path d="M-16 0 L0 -9 L16 0 L0 9 Z" fill="url(#${p}-goldD)" stroke="${P.goldDeep}" stroke-width="1.6"/>`
    + `<circle r="3.6" fill="url(#${p}-jade)" stroke="${P.goldDeep}" stroke-width="1"/></g>`;
  return `<defs>${goldDefs(p)}
      <radialGradient id="${p}m" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="${P.matHi}"/><stop offset=".6" stop-color="${P.mat}"/><stop offset="1" stop-color="${P.matDark}"/></radialGradient>
      <pattern id="${p}pt" width="66" height="82" patternUnits="userSpaceOnUse">
        <path d="${spiralPath(20, 22, 9, 1.3, Math.PI, 1)}" fill="none" stroke="#bff5dc" stroke-width="1.6" stroke-linecap="round" opacity=".09"/>
        <path d="M44 58 l6 -6 l6 6 l-6 6 z" fill="none" stroke="#bff5dc" stroke-width="1.4" opacity=".08"/>
      </pattern>
      <linearGradient id="${p}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#062a20" stop-opacity=".55"/><stop offset="1" stop-color="#062a20" stop-opacity="0"/></linearGradient>
      <linearGradient id="${p}l" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#062a20" stop-opacity=".4"/><stop offset="1" stop-color="#062a20" stop-opacity="0"/></linearGradient>
      <clipPath id="${p}c"><rect x="${B}" y="${B}" width="${w - 2 * B}" height="${h - 2 * B}" rx="14"/></clipPath>
    </defs>`
    + `<rect x="0" y="0" width="${w}" height="${h}" rx="32" fill="url(#${p}-goldD)"/>`
    + `<rect x="4" y="4" width="${w - 8}" height="${h - 8}" rx="29" fill="url(#${p}-lac)"/>`
    + `<rect x="4" y="4" width="${w - 8}" height="60" rx="29" fill="url(#${p}-sheen)"/>`
    + `<rect x="11" y="11" width="${w - 22}" height="${h - 22}" rx="23" fill="none" stroke="${P.goldHi}" stroke-width="1.6" opacity=".7"/>`
    + `<rect x="${B - 5}" y="${B - 5}" width="${w - 2 * B + 10}" height="${h - 2 * B + 10}" rx="18" fill="url(#${p}-gold)"/>`
    + `<rect x="${B}" y="${B}" width="${w - 2 * B}" height="${h - 2 * B}" rx="14" fill="url(#${p}m)"/>`
    + `<g clip-path="url(#${p}c)">`
    + `<rect x="${B}" y="${B}" width="${w - 2 * B}" height="${h - 2 * B}" fill="url(#${p}pt)"/>`
    + `<rect x="${B}" y="${B}" width="${w - 2 * B}" height="34" fill="url(#${p}t)"/>`
    + `<rect x="${B}" y="${B}" width="26" height="${h - 2 * B}" fill="url(#${p}l)"/>`
    + `</g>`
    + ornMid(B / 2 + 0.5, h / 2, 90) + ornMid(w - B / 2 - 0.5, h / 2, 90) + ornMid(w / 2, h - B / 2 - 0.5, 0)
    + fourCorners(p, w, h, -6, 78);
}

/* ---------- Gameplay logo plaque (merges into the frame's top edge) ---------- */
export function plaqueMarkup(w, h) {
  const p = uid('pq');
  const lobeR = h * 0.3;
  const shapes = `<rect x="${lobeR}" y="10" width="${w - lobeR * 2}" height="${h - 34}" rx="${n2((h - 34) / 2)}"/>`
    + `<circle cx="${n2(lobeR + 6)}" cy="${n2(h * 0.48)}" r="${n2(lobeR)}"/><circle cx="${n2(w - lobeR - 6)}" cy="${n2(h * 0.48)}" r="${n2(lobeR)}"/>`
    + `<rect x="${n2(w * 0.24)}" y="${h - 50}" width="${n2(w * 0.52)}" height="50" rx="10"/>`;
  return `<defs>${goldDefs(p)}</defs>`
    + `<g fill="#3d0a0d" opacity=".25" transform="translate(0 6)">${shapes}</g>`
    + `<g fill="${P.goldDeep}" stroke="${P.goldDeep}" stroke-width="18" stroke-linejoin="round">${shapes}</g>`
    + `<g fill="url(#${p}-goldD)" stroke="url(#${p}-goldD)" stroke-width="12" stroke-linejoin="round">${shapes}</g>`
    + `<g fill="url(#${p}-lac)">${shapes}</g>`
    + `<rect x="${lobeR}" y="10" width="${w - lobeR * 2}" height="${n2((h - 34) * 0.45)}" rx="${n2((h - 34) * 0.45 / 2)}" fill="url(#${p}-sheen)"/>`
    + `<rect x="${lobeR + 10}" y="20" width="${w - lobeR * 2 - 20}" height="${h - 54}" rx="${n2((h - 54) / 2)}" fill="none" stroke="${P.goldHi}" stroke-width="1.5" opacity=".6"/>`
    + `<g fill="none" stroke="url(#${p}-gold)" stroke-width="3.2" stroke-linecap="round">`
    + `<path d="${spiralPath(lobeR + 6, h * 0.48, lobeR * 0.62, 1.4, Math.PI * 0.5, 1)}"/>`
    + `<path d="${spiralPath(w - lobeR - 6, h * 0.48, lobeR * 0.62, 1.4, Math.PI * 0.5, -1)}"/></g>`;
}

/* ---------- Stars ---------- */
export function starMarkup(filled = true) {
  const p = uid('st');
  const d = STAR_PATH(50, 52, 44, 21);
  return `<defs>${goldDefs(p)}
      <linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldMid}"/></linearGradient></defs>`
    + (filled
      ? `<path d="${d}" fill="${P.goldDeep}" stroke="${P.goldDeep}" stroke-width="10" stroke-linejoin="round" transform="translate(0 4)" opacity=".5"/>`
        + `<path d="${d}" fill="${P.lacquerDark}" stroke="${P.lacquerDark}" stroke-width="12" stroke-linejoin="round"/>`
        + `<path d="${d}" fill="url(#${p}s)" stroke="url(#${p}-gold)" stroke-width="5" stroke-linejoin="round"/>`
        + `<path d="${STAR_PATH(50, 52, 28, 13)}" fill="#fff" opacity=".28"/>`
        + `<ellipse cx="38" cy="34" rx="9" ry="5" fill="#fff" opacity=".8" transform="rotate(-30 38 34)"/>`
      : `<path d="${d}" fill="${P.lacquerDark}" stroke="${P.lacquerDark}" stroke-width="12" stroke-linejoin="round"/>`
        + `<path d="${d}" fill="#5a1a14" stroke="${P.goldDark}" stroke-width="3" stroke-linejoin="round" opacity=".9"/>`);
}
export const starSVG = (filled) => `<svg viewBox="-8 -6 116 116" aria-hidden="true">${starMarkup(filled)}</svg>`;

/* ---------- Standalone export helpers ---------- */
export const panelDoc = (w, h, variant) => svgDoc(-12, -12, w + 24, h + 24, panelMarkup(w, h, variant), `width="${w + 24}" height="${h + 24}"`);
export const ribbonDoc = (w, h, label) => svgDoc(-4, -4, w + 8, h + 12, ribbonMarkup(w, h)
  + (label ? `<text x="${w / 2}" y="${n2(h * 0.39 + h * 0.15)}" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="${n2(h * 0.42)}" fill="#fff6df" stroke="${P.lacquerInk}" stroke-width="5" stroke-linejoin="round" paint-order="stroke" letter-spacing="2">${label}</text>` : ''),
`width="${w + 8}" height="${h + 12}"`);
export const frameDoc = (w, h) => svgDoc(-12, -12, w + 24, h + 24, frameMarkup(w, h), `width="${w + 24}" height="${h + 24}"`);
export const plaqueDoc = (w, h) => svgDoc(-12, -12, w + 24, h + 24, plaqueMarkup(w, h), `width="${w + 24}" height="${h + 24}"`);
export const starDoc = (filled) => svgDoc(-8, -6, 116, 116, starMarkup(filled), 'width="232" height="232"');

/** A decorative cloud bank used under the title logo and in the curtain transition. */
export function cloudBankMarkup(w, h, tone = 'cream') {
  const fill = tone === 'cream' ? P.cloudCream : P.cloudCoral;
  const line = tone === 'cream' ? P.cloudCreamLine : P.cloudCoralLine;
  const s = h / 90;
  let out = '';
  const count = Math.ceil(w / (150 * s)) + 1;
  for (let i = 0; i < count; i++) {
    out += swirlCloud({ x: i * 150 * s - 40 * s, y: (i % 2 ? 0.08 : 0.22) * h, s: s * (i % 2 ? 1 : 0.92), fill, line, flip: i % 2 === 1 });
  }
  return out;
}

/* ==========================================================
   PART 2 — RUNTIME
   ========================================================== */

/**
 * Upgrade a <button class="btn"> into a skinned game button.
 * data-variant  red | jade | gold      data-w / data-h  pixel size
 * data-icon     icon name (optional)    data-round       circular icon button
 */
export function enhanceButton(btn) {
  if (btn.dataset.enhanced) return btn;
  const w = +btn.dataset.w || 300, h = +btn.dataset.h || 96;
  const round = 'round' in btn.dataset;
  const variant = btn.dataset.variant || 'red';
  const E = edgeOf(h);
  btn.style.setProperty('--w', w + 'px');
  btn.style.setProperty('--h', h + 'px');
  btn.style.setProperty('--edge', E + 'px');
  btn.style.setProperty('--outline', variantColors(variant).outline);
  btn.classList.add(`btn-${variant}`);
  if (round) btn.classList.add('btn-round');
  const label = btn.innerHTML.trim();
  const icon = btn.dataset.icon;
  const iconSize = round ? Math.round((h - E) * 0.58) : Math.round((h - E) * 0.52);
  const outline = variantColors(variant).outline;
  btn.dataset.outline = outline;
  btn.innerHTML = ['normal', 'hover', 'pressed', 'disabled'].map((s) => buttonSkinSVG(w, h, variant, s, { round })).join('')
    + `<span class="btn-content">${icon ? `<span class="btn-icon">${iconSVG(icon, { size: iconSize, outline })}</span>` : ''}`
    + `${label ? `<span class="btn-label">${label}</span>` : ''}</span>`;
  btn.dataset.enhanced = '1';
  for (const svg of btn.querySelectorAll('svg.skin')) queueSkin(svg, w + SKIN_MARGIN * 2, h + SKIN_MARGIN * 2);
  return btn;
}

export function setButtonIcon(btn, icon) {
  const holder = btn.querySelector('.btn-icon');
  if (!holder) return;
  const svg = holder.querySelector('svg');
  const size = svg ? svg.getAttribute('width') : 48;
  holder.innerHTML = iconSVG(icon, { size: +size, outline: btn.dataset.outline });
}

/** Fill every [data-skin] placeholder with its vector art at its pixel size. */
export function paintSkins(root = document) {
  for (const el of $$('[data-skin]', root)) {
    const w = +el.dataset.w, h = +el.dataset.h;
    const kind = el.dataset.skin;
    let markup = '', m = 12;
    if (kind === 'ribbon') { markup = ribbonMarkup(w, h); m = 4; }
    else if (kind === 'frame') markup = frameMarkup(w, h);
    else if (kind === 'plaque') markup = plaqueMarkup(w, h);
    else markup = panelMarkup(w, h, kind);
    // insertAdjacentHTML keeps existing children (and nested skins) intact
    el.insertAdjacentHTML('afterbegin', `<svg class="skin-art" viewBox="${-m} ${-m} ${w + m * 2} ${h + m * 2}" width="${w + m * 2}" height="${h + m * 2}" style="left:${-m}px;top:${-m}px" aria-hidden="true">${markup}</svg>`);
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    queueSkin(el.firstElementChild, w + m * 2, h + m * 2);
  }
}

/* ---------- Skin bitmaps ----------
   Skins are inserted as inline SVG (so the first paint is instant), then
   swapped in idle time for PNG bitmaps rendered at exactly the current
   device-pixel resolution of the stage.  Same pixels, but repaints over
   them (score text, meters, hover swaps, resizes) no longer re-rasterise
   gradients, patterns and clip paths.  Re-baked after a debounced resize. */
const skinJobs = [];
let skinRes = 0;
function queueSkin(svgEl, cssW, cssH) {
  skinJobs.push({ node: svgEl, src: svgEl.outerHTML, cssW, cssH, url: '' });
}
export async function bakeSkins() {
  const k = clamp(stageRes(), 0.5, 2);
  if (skinRes && Math.abs(k - skinRes) / skinRes < 0.1) return;
  skinRes = k;
  await idleQueue(skinJobs.map((job) => async () => {
    const url = await svgToURL(job.src, job.cssW * k, job.cssH * k);
    let img = job.node;
    if (img.tagName !== 'IMG') {
      img = document.createElement('img');
      img.className = job.node.getAttribute('class');
      const st = job.node.getAttribute('style');
      if (st) img.setAttribute('style', st);
      img.width = job.cssW;
      img.height = job.cssH;
      img.alt = '';
      img.draggable = false;
      img.setAttribute('aria-hidden', 'true');
    }
    img.src = url;
    if (img.decode) await img.decode().catch(() => {});
    if (job.node !== img) { job.node.replaceWith(img); job.node = img; }
    if (job.url) URL.revokeObjectURL(job.url);
    job.url = url;
  }));
}
if (typeof window !== 'undefined') onResizeSettled(() => { bakeSkins(); });

/* ---------- Screens & cloud-curtain transition ---------- */
let currentScreen = null;
const screenListeners = [];
export const onScreen = (fn) => screenListeners.push(fn);
export const getScreen = () => currentScreen;

export function showScreenNow(name) {
  for (const s of $$('.screen')) s.classList.toggle('active', s.dataset.screen === name);
  currentScreen = name;
  screenListeners.forEach((fn) => fn(name));
}

/** Clouds sweep in, the screen swaps underneath, clouds part again. */
export async function transitionTo(name, midway) {
  const curtain = $('#curtain');
  if (!curtain || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (midway) await midway();
    showScreenNow(name);
    return;
  }
  curtain.classList.remove('opening');
  curtain.classList.add('closing');
  await wait(520);
  if (midway) await midway();
  showScreenNow(name);
  await wait(60);
  curtain.classList.remove('closing');
  curtain.classList.add('opening');
  await wait(620);
  curtain.classList.remove('opening');
}

/** The cloud curtain: rendered to two canvases at window size (re-rendered on resize). */
export function buildCurtain() {
  const c = $('#curtain');
  if (!c) return Promise.resolve();
  const half = (side) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1100 1200" preserveAspectRatio="${side === 'left' ? 'xMaxYMid' : 'xMinYMid'} slice">`
    + `<rect x="${side === 'left' ? 0 : 200}" width="900" height="1200" fill="${P.cloudCream}"/>`
    + Array.from({ length: 9 }, (_, i) => swirlCloud({
      x: (side === 'left' ? 690 : -10) + (i % 2 ? -50 : 0) * (side === 'left' ? 1 : -1), y: i * 135 - 40, s: 2.1,
      fill: i % 3 === 0 ? P.cloudCoral : P.cloudCream, line: i % 3 === 0 ? P.cloudCoralLine : P.cloudCreamLine,
      flip: side === 'left',
    })).join('')
    + `</svg>`;
  const src = { left: half('left'), right: half('right') };
  c.innerHTML = `<div class="curtain-half curtain-left"><canvas></canvas></div><div class="curtain-half curtain-right"><canvas></canvas></div>`;
  const render = async () => {
    const d = dpr();
    for (const side of ['left', 'right']) await svgToCanvas(src[side], innerWidth * 0.62 * d, innerHeight * d, $(`.curtain-${side} canvas`, c));
  };
  onResizeSettled(render);
  return render();
}

/* ---------- Modals ---------- */
let openModalName = null;
export const modalOpen = () => openModalName;

const modalListeners = [];
export const onModal = (fn) => modalListeners.push(fn);

export function openModal(name) {
  const layer = $('#modal-layer');
  for (const m of $$('.modal', layer)) m.classList.toggle('show', m.dataset.modal === name);
  layer.classList.add('show');
  document.body.classList.add('has-modal');
  openModalName = name;
  modalListeners.forEach((fn) => fn(name));
}

export function closeModal() {
  const layer = $('#modal-layer');
  layer.classList.remove('show');
  for (const m of $$('.modal', layer)) m.classList.remove('show');
  document.body.classList.remove('has-modal');
  openModalName = null;
  modalListeners.forEach((fn) => fn(null));
}

/* ---------- Toast ---------- */
let toastTimer = 0, toastRaf = 0;
export function toast(text, { sub = '', ms = 1700, icon = '' } = {}) {
  const t = $('#toast');
  if (!t) return;
  $('.toast-text', t).textContent = text;
  $('.toast-sub', t).textContent = sub;
  $('.toast-icon', t).innerHTML = icon ? iconSVG(icon, { size: 40 }) : '';
  t.classList.toggle('has-icon', !!icon);
  // restart the entrance on the next frames (no forced reflow)
  t.classList.remove('show');
  cancelAnimationFrame(toastRaf);
  toastRaf = requestAnimationFrame(() => { toastRaf = requestAnimationFrame(() => t.classList.add('show')); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
