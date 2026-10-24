/* ==========================================================
   tiles.js — the 42 tile faces, drawn entirely in SVG
   ----------------------------------------------------------
   Design space: a tile FACE is 100 × 124 units.  The body adds
   a bottom-right extrusion (ivory slab + warm tan back) and a
   soft contact shadow.  Every glyph is hand-built from round-cap
   strokes so the whole set shares one stroke weight and style
   (no system fonts needed — it renders identically everywhere).

   Each tile type is rendered ONCE to an SVG blob URL and reused
   by every tile on the board.
   ========================================================== */
import { P, uid, svgDoc, n2, darken } from './util.js';
import { svgToCanvas, canvasToURL, stageRes } from './raster.js';

/* ---------- Geometry (units) ---------- */
export const FW = 100, FH = 124;      // face
export const DX = 10, DY = 13;        // extrusion depth (bottom-right)
export const PAD = 16;                // room for the contact shadow
const R = 12;                         // corner radius

/* ---------- Geometry (stage pixels) ---------- */
export const TILE_SCALE = 0.62;
export const TILE = {
  faceW: FW * TILE_SCALE,                       // 62
  faceH: FH * TILE_SCALE,                       // 76.9
  bodyW: (FW + DX) * TILE_SCALE,                // 68.2
  bodyH: (FH + DY) * TILE_SCALE,                // 84.9
  imgW: (FW + DX + PAD * 2) * TILE_SCALE,       // 88.0
  imgH: (FH + DY + PAD * 2) * TILE_SCALE,       // 104.8
  pad: PAD * TILE_SCALE,                        // 9.9
  stepX: 66,                                    // column pitch (slight overlap of the depth edge)
  stepY: 82,                                    // row pitch
};

/* ---------- Tile catalogue ---------- */
const NUM_NAMES = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const WIND_NAMES = ['East', 'South', 'West', 'North'];
const DRAGON_NAMES = ['Red', 'Green', 'White'];
const SEASON_NAMES = ['Spring', 'Summer', 'Autumn', 'Winter'];
const FLOWER_NAMES = ['Plum', 'Orchid', 'Chrysanthemum', 'Bamboo'];

export const TILE_TYPES = [];
for (let i = 0; i < 9; i++) TILE_TYPES.push({ suit: 'char', rank: i + 1, name: `${NUM_NAMES[i]} of Characters` });
for (let i = 0; i < 9; i++) TILE_TYPES.push({ suit: 'bamboo', rank: i + 1, name: `${NUM_NAMES[i]} of Bamboos` });
for (let i = 0; i < 9; i++) TILE_TYPES.push({ suit: 'dot', rank: i + 1, name: `${NUM_NAMES[i]} of Circles` });
for (let i = 0; i < 4; i++) TILE_TYPES.push({ suit: 'wind', rank: i + 1, name: `${WIND_NAMES[i]} Wind` });
for (let i = 0; i < 3; i++) TILE_TYPES.push({ suit: 'dragon', rank: i + 1, name: `${DRAGON_NAMES[i]} Dragon` });
for (let i = 0; i < 4; i++) TILE_TYPES.push({ suit: 'season', rank: i + 1, name: SEASON_NAMES[i] });
for (let i = 0; i < 4; i++) TILE_TYPES.push({ suit: 'flower', rank: i + 1, name: FLOWER_NAMES[i] });
TILE_TYPES.forEach((t, i) => { t.id = i; t.slug = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); });

export const TYPE_COUNT = TILE_TYPES.length; // 42
export const BASIC_COUNT = 34;               // suits + winds + dragons
export const SEASON_KEY = 34, FLOWER_KEY = 35;

/** Matching key: any Season matches any Season, any Flower any Flower. */
export function tileKey(type) {
  if (type >= 38) return FLOWER_KEY;
  if (type >= 34) return SEASON_KEY;
  return type;
}

/* ==========================================================
   GLYPHS — stroke paths on a 100 × 100 grid
   ========================================================== */
const NUMERALS = [
  'M12 52 Q50 46 88 49',                                                            // 一
  'M26 30 Q50 26 74 28 M12 74 Q50 68 88 71',                                        // 二
  'M24 18 Q50 15 76 17 M30 48 Q50 46 70 47 M10 82 Q50 76 90 79',                    // 三
  'M16 22 V86 M16 22 H84 V86 M16 82 H84 M42 24 Q42 52 26 64 M58 24 V54 Q58 62 66 62 H70', // 四
  'M18 16 H82 M46 16 L38 82 M24 48 H70 V82 M10 84 H90',                             // 五
  'M48 8 L56 22 M12 38 H88 M38 54 Q30 74 16 88 M62 54 Q74 72 86 86',                // 六
  'M10 50 L90 38 M40 10 V70 Q40 88 58 88 H80 Q90 88 90 76',                         // 七
  'M40 16 Q40 58 10 86 M58 18 Q62 62 92 84',                                        // 八
  'M42 10 Q42 62 10 88 M14 38 H62 Q68 38 68 46 V78 Q68 88 78 88 H84 Q92 88 92 78',  // 九
];
const WAN = 'M8 20 H92 M33 8 V32 M67 8 V32 M24 38 V58 M24 38 H76 V58 M24 48 H76 M50 38 V58 M24 58 H76 '
  + 'M14 66 V94 M14 66 H86 V86 Q86 94 77 94 M47 69 L37 86 H66 M58 77 L67 87';               // 萬
const WINDS = [
  'M12 24 H88 M50 6 V96 M26 36 V64 M26 36 H74 V64 M26 50 H74 M26 64 H74 M46 66 Q34 84 12 94 M54 66 Q68 84 90 94', // 東
  'M16 18 H84 M50 6 V32 M18 34 V96 M18 34 H82 V86 Q82 96 72 96 M36 44 L42 54 M64 44 L58 54 M30 60 H70 M28 76 H72 M50 60 V94', // 南
  'M10 14 H90 M18 32 V94 M18 32 H82 V94 M18 88 H82 M40 16 V54 Q40 66 28 72 M60 16 V60 Q60 68 70 68 H80', // 西
  'M36 8 V92 M12 40 H36 M10 80 L36 68 M64 8 V80 Q64 90 76 90 H86 Q92 90 92 80 M64 44 L88 32',          // 北
];
const ZHONG = 'M18 30 V68 M18 30 H82 V68 M18 66 H82 M50 4 V96';                                       // 中
const FA = 'M12 12 H36 L18 34 M24 22 L34 32 M58 8 Q66 26 90 36 M66 18 L80 12 M72 28 L86 22 '
  + 'M14 46 H40 V58 H18 V72 H42 V86 Q42 94 32 94 '
  + 'M62 44 V54 Q62 62 54 66 M62 44 H80 V56 Q80 62 88 62 M56 72 H84 Q78 86 56 96 M64 78 Q74 90 92 96';     // 發

/* Small index digits / letters on a 10 × 14 grid */
export const DIGITS = {
  1: 'M3 4 L6 1 V13.5',
  2: 'M1.5 4 Q2 1 5 1 Q8.5 1 8.5 4 Q8.5 6.5 1.5 13 H9',
  3: 'M1.5 1.5 H8 L4.2 6 Q9 6 9 9.6 Q9 13.2 5 13.2 Q2.2 13.2 1 11.4',
  4: 'M6.6 13.5 V1 L1 9.8 H9.5',
  5: 'M8.5 1 H2.6 L2 6.6 Q3.4 5.5 5.4 5.5 Q9 5.5 9 9.4 Q9 13.2 5 13.2 Q2.2 13.2 1 11.4',
  6: 'M7.6 1.4 Q2 2.8 1.6 8.8 Q1.6 13.2 5.1 13.2 Q8.8 13.2 8.8 9.6 Q8.8 6 5.1 6 Q2.6 6 1.6 8.4',
  7: 'M1 1 H9 L4 13.5',
  8: 'M5 7 Q1.6 7 1.6 4 Q1.6 1 5 1 Q8.4 1 8.4 4 Q8.4 7 5 7 Q1.2 7 1.2 10.2 Q1.2 13.3 5 13.3 Q8.8 13.3 8.8 10.2 Q8.8 7 5 7 Z',
  9: 'M8.4 5.6 Q7.4 8.4 5 8.4 Q1.6 8.4 1.6 4.8 Q1.6 1 5 1 Q8.5 1 8.5 5.4 Q8.5 11 3 13.4',
};
const LETTERS = {
  E: 'M8.5 1 H1.5 V13 H8.5 M1.5 7 H7',
  S: 'M8.4 2.6 Q7 1 5 1 Q1.6 1 1.6 4 Q1.6 6.4 5 7 Q8.8 7.6 8.8 10.2 Q8.8 13.2 5 13.2 Q2.4 13.2 1 11.4',
  W: 'M0.6 1 L2.8 13 L5 5 L7.2 13 L9.4 1',
  N: 'M1.5 13 V1 L8.5 13 V1',
};

/* ==========================================================
   DRAWING HELPERS
   ========================================================== */
const C = () => ({
  red: P.cinnabar, redHi: P.cinnabarHi, redDark: P.cinnabarDark,
  jade: P.jade, jadeHi: P.jadeHi, jadeDark: P.jadeDark,
  blue: P.indigo, blueHi: P.indigoHi, blueDark: P.indigoDark,
  gold: P.gold, goldHi: P.goldHi, goldDark: P.goldDark,
  ink: P.ink, pink: P.pink, ivory: P.ivory, ivory2: P.ivory2,
});

/** A glyph from the 100-grid, placed at (x,y) with uniform scale s.
 *  T is the target stroke width in FACE units (kept ~consistent across the set). */
function glyph(d, x, y, s, color, shade, T = 5) {
  const sw = n2(T / s);
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${sw}">`
    + `<path d="${d}" stroke="${shade}" opacity=".5" transform="translate(${n2(0.9 / s)} ${n2(1.5 / s)})"/>`
    + `<path d="${d}" stroke="${color}"/></g>`;
}

/** Small corner index (digit or letter) in the top-left of the face. */
function cornerMark(d, color) {
  return `<g transform="translate(6.5 6) scale(.78)" fill="none" stroke="${color}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></g>`;
}

/** Round tag with a number, used on Seasons (red) and Flowers (blue). */
function cornerTag(n, fill, dark) {
  return `<circle cx="13" cy="13.5" r="8.6" fill="${fill}" stroke="${dark}" stroke-width="1.4"/>`
    + `<circle cx="11.2" cy="11" r="3" fill="#fff" opacity=".35"/>`
    + `<g transform="translate(9.6 8.6) scale(.7)" fill="none" stroke="#fff8e8" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"><path d="${DIGITS[n]}"/></g>`;
}

/* ---------- Bamboo stick ---------- */
function stick(p, cx, cy, h, red = false, rot = 0) {
  const c = C();
  const w = 9.6, x = cx - w / 2, y = cy - h / 2;
  const dark = red ? c.redDark : c.jadeDark;
  const grad = red ? `${p}sr` : `${p}sg`;
  return `<g transform="rotate(${rot} ${cx} ${cy})">`
    + `<rect x="${n2(x)}" y="${n2(y)}" width="${w}" height="${h}" rx="${w / 2}" fill="url(#${grad})" stroke="${dark}" stroke-width="1.6"/>`
    + `<rect x="${n2(x - 0.9)}" y="${n2(cy - 1.6)}" width="${n2(w + 1.8)}" height="3.2" rx="1.6" fill="${dark}"/>`
    + `<path d="M${n2(x + 1.4)} ${n2(y + 4.6)} H${n2(x + w - 1.4)} M${n2(x + 1.4)} ${n2(y + h - 4.6)} H${n2(x + w - 1.4)}" stroke="${dark}" stroke-width="1.3" opacity=".65"/>`
    + `<path d="M${n2(cx - 2.1)} ${n2(y + 6.5)} V${n2(cy - 3.6)} M${n2(cx - 2.1)} ${n2(cy + 3.6)} V${n2(y + h - 6.5)}" stroke="#fff" stroke-opacity=".6" stroke-width="1.7" stroke-linecap="round"/>`
    + `</g>`;
}

/* ---------- Circle coin ---------- */
function coin(cx, cy, r, outer, inner) {
  const ticks = 2 * Math.PI * r * 0.69 / 24;
  return `<g>`
    + `<circle cx="${cx}" cy="${cy + 1.2}" r="${r}" fill="${darken(outer, 0.45)}" opacity=".35"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${outer}" stroke="${darken(outer, 0.35)}" stroke-width="1.4"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${n2(r * 0.8)}" fill="#fff8ea"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${n2(r * 0.69)}" fill="none" stroke="${outer}" stroke-width="${n2(r * 0.1)}" stroke-dasharray="${n2(ticks)} ${n2(ticks)}" opacity=".75"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${n2(r * 0.52)}" fill="${inner}" stroke="${darken(inner, 0.3)}" stroke-width="1"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${n2(r * 0.27)}" fill="#fff8ea"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${n2(r * 0.13)}" fill="${outer}"/>`
    + `<ellipse cx="${n2(cx - r * 0.36)}" cy="${n2(cy - r * 0.42)}" rx="${n2(r * 0.3)}" ry="${n2(r * 0.15)}" fill="#fff" opacity=".55" transform="rotate(-35 ${n2(cx - r * 0.36)} ${n2(cy - r * 0.42)})"/>`
    + `</g>`;
}

/* ---------- Five-petal blossom ---------- */
function blossom(cx, cy, r, fill, stroke, center, notched = true, rot = 0) {
  const petal = notched
    ? `M0 0 C${n2(-r * 0.58)} ${n2(-r * 0.25)} ${n2(-r * 0.66)} ${n2(-r * 0.95)} ${n2(-r * 0.22)} ${n2(-r)} L0 ${n2(-r * 0.84)} L${n2(r * 0.22)} ${n2(-r)} C${n2(r * 0.66)} ${n2(-r * 0.95)} ${n2(r * 0.58)} ${n2(-r * 0.25)} 0 0 Z`
    : `M0 0 C${n2(-r * 0.66)} ${n2(-r * 0.2)} ${n2(-r * 0.74)} ${n2(-r)} 0 ${n2(-r)} C${n2(r * 0.74)} ${n2(-r)} ${n2(r * 0.66)} ${n2(-r * 0.2)} 0 0 Z`;
  let s = `<g transform="translate(${n2(cx)} ${n2(cy)}) rotate(${rot})">`;
  for (let k = 0; k < 5; k++) s += `<path d="${petal}" transform="rotate(${k * 72})" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  for (let k = 0; k < 5; k++) {
    const a = (k * 72 + 36) * Math.PI / 180, rr = r * 0.42;
    s += `<path d="M0 0 L${n2(Math.sin(a) * rr)} ${n2(-Math.cos(a) * rr)}" stroke="${stroke}" stroke-width=".9" stroke-linecap="round"/>`
      + `<circle cx="${n2(Math.sin(a) * rr)}" cy="${n2(-Math.cos(a) * rr)}" r="${n2(Math.max(1, r * 0.08))}" fill="${center}"/>`;
  }
  s += `<circle r="${n2(r * 0.2)}" fill="${center}" stroke="${stroke}" stroke-width=".9"/></g>`;
  return s;
}

/* ==========================================================
   TILE BODY
   ========================================================== */
function tileBody(p) {
  const defs = `
    <linearGradient id="${p}f" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fffef9"/><stop offset=".5" stop-color="${P.ivory}"/><stop offset="1" stop-color="${P.ivory2}"/>
    </linearGradient>
    <linearGradient id="${p}e" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${P.tileEdgeHi}"/><stop offset="1" stop-color="${P.tileEdge}"/>
    </linearGradient>
    <radialGradient id="${p}g" cx=".2" cy=".12" r=".75">
      <stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".45" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${p}h" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <filter id="${p}b" x="-25%" y="-25%" width="150%" height="150%"><feGaussianBlur stdDeviation="3.4"/></filter>`;

  let s = '';
  // soft contact shadow + a tighter occlusion shadow
  s += `<rect x="3" y="9" width="${FW + DX + 2}" height="${FH + DY}" rx="16" fill="#4a1a0c" opacity=".32" filter="url(#${p}b)"/>`;
  s += `<rect x="${DX + 1}" y="${DY + 2}" width="${FW}" height="${FH}" rx="${R}" fill="#5a2410" opacity=".3"/>`;
  // extrusion: tan back slab, then the ivory front slab
  s += `<rect x="${DX}" y="${DY}" width="${FW}" height="${FH}" rx="${R}" fill="url(#${p}e)" stroke="${P.tileEdgeLine}" stroke-width="1.5"/>`;
  const steps = 12;
  for (let i = steps - 1; i >= 1; i--) {
    const t = i / steps;
    const ivory = t <= 0.4;
    s += `<rect x="${n2(DX * t)}" y="${n2(DY * t)}" width="${FW}" height="${FH}" rx="${R}" fill="${ivory ? P.ivoryEdge : `url(#${p}e)`}"`
      + (Math.abs(t - 0.4) < 0.05 ? ` stroke="${P.tileEdgeLine}" stroke-opacity=".35" stroke-width=".9"` : '') + `/>`;
  }
  // face
  s += `<rect x="0" y="0" width="${FW}" height="${FH}" rx="${R}" fill="url(#${p}f)" stroke="${P.tileLine}" stroke-width="1.2"/>`;
  s += `<rect x="0" y="0" width="${FW}" height="${FH}" rx="${R}" fill="url(#${p}g)" opacity=".75"/>`;
  s += `<path d="M2.7 ${FH - 16} V${R + 1} Q2.7 2.7 ${R + 1} 2.7 H${FW - 16}" fill="none" stroke="url(#${p}h)" stroke-width="2.6" stroke-linecap="round"/>`;
  s += `<path d="M${FW - 2.6} ${R + 6} V${FH - R} Q${FW - 2.6} ${FH - 2.6} ${FW - R} ${FH - 2.6} H${R + 6}" fill="none" stroke="#c8aa78" stroke-opacity=".5" stroke-width="2" stroke-linecap="round"/>`;
  return { defs, body: s };
}

/* Gradients shared by symbol art (scoped by prefix). */
function symbolDefs(p) {
  const c = C();
  return `
    <linearGradient id="${p}sg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.jadeHi}"/><stop offset=".55" stop-color="${c.jade}"/><stop offset="1" stop-color="${c.jadeDark}"/></linearGradient>
    <linearGradient id="${p}sr" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${c.redHi}"/><stop offset=".55" stop-color="${c.red}"/><stop offset="1" stop-color="${c.redDark}"/></linearGradient>
    <linearGradient id="${p}jg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.jadeHi}"/><stop offset="1" stop-color="${c.jade}"/></linearGradient>
    <linearGradient id="${p}bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.blueHi}"/><stop offset="1" stop-color="${c.blue}"/></linearGradient>
    <linearGradient id="${p}pk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3ea"/><stop offset="1" stop-color="${c.pink}"/></linearGradient>
    <linearGradient id="${p}lt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.pink}"/><stop offset=".55" stop-color="#ffc2d0"/><stop offset="1" stop-color="#fff1f4"/></linearGradient>
    <linearGradient id="${p}ap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc35a"/><stop offset=".5" stop-color="#ef6a2e"/><stop offset="1" stop-color="${c.redDark}"/></linearGradient>
    <linearGradient id="${p}gd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.goldHi}"/><stop offset="1" stop-color="${c.gold}"/></linearGradient>
    <linearGradient id="${p}rs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9aa8"/><stop offset="1" stop-color="#d93a55"/></linearGradient>
    <radialGradient id="${p}or" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#e6ecff"/><stop offset=".6" stop-color="${c.blueHi}"/><stop offset="1" stop-color="${c.blue}"/></radialGradient>`;
}

/* ==========================================================
   SYMBOLS (face coordinates 0..100 × 0..124)
   ========================================================== */
function drawChar(n) {
  const c = C();
  return cornerMark(DIGITS[n], c.redDark)
    + glyph(NUMERALS[n - 1], 25, 7, 0.5, c.red, c.redDark, 5.2)
    + glyph(WAN, 23, 61, 0.54, c.red, c.redDark, 4.3);
}

function drawBird(p) {
  const c = C();
  return `
  <path d="M12 101 Q50 92 90 101" fill="none" stroke="${c.jadeDark}" stroke-width="3.4" stroke-linecap="round"/>
  <path d="M72 97 q8 -9 18 -8 q-6 9 -18 8 z M22 99 q-6 -9 -15 -9 q4 9 15 9 z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.2"/>
  <path d="M60 74 C70 58 78 40 88 18 C93 34 86 56 70 78 Z" fill="url(#${p}sr)" stroke="${c.redDark}" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M62 78 C76 70 86 58 94 44 C96 60 86 74 68 84 Z" fill="url(#${p}gd)" stroke="${c.goldDark}" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M58 72 C62 54 64 38 66 20 C74 36 72 56 64 76 Z" fill="url(#${p}bl)" stroke="${c.blueDark}" stroke-width="1.5" stroke-linejoin="round"/>
  <circle cx="86" cy="24" r="3.4" fill="${c.goldHi}" stroke="${c.redDark}" stroke-width="1.2"/>
  <circle cx="66.5" cy="26" r="3" fill="${c.goldHi}" stroke="${c.blueDark}" stroke-width="1.2"/>
  <circle cx="91" cy="50" r="2.8" fill="${c.red}" stroke="${c.goldDark}" stroke-width="1"/>
  <path d="M43 91 L41 99 M41 99 l-3 2 M41 99 l3 2 M55 91 L56 99 M56 99 l-3 2 M56 99 l3 2" stroke="${c.goldDark}" stroke-width="2" stroke-linecap="round"/>
  <ellipse cx="50" cy="72" rx="24" ry="21" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.8"/>
  <ellipse cx="45" cy="78" rx="14" ry="12.5" fill="#fff3c8" stroke="${c.goldDark}" stroke-width="1" stroke-opacity=".5"/>
  <path d="M51 63 C63 59 73 67 72 77 C64 85 54 85 48 79 C51 73 49 67 51 63 Z" fill="url(#${p}bl)" stroke="${c.blueDark}" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M55 70 q5 3 10 1 M53 76 q6 3 12 1" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M33 30 C28 22 30 15 35 13 C35 19 37 24 38 30 Z M39 29 C38 20 42 14 47 14 C45 20 44 25 43 30 Z M29 33 C22 28 21 22 24 18 C27 24 30 27 33 31 Z" fill="url(#${p}sr)" stroke="${c.redDark}" stroke-width="1.3" stroke-linejoin="round"/>
  <circle cx="38" cy="44" r="15" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.8"/>
  <path d="M24 42 L13 46.5 L24 50.5 Z" fill="${c.gold}" stroke="${c.goldDark}" stroke-width="1.4" stroke-linejoin="round"/>
  <circle cx="34.5" cy="41.5" r="4.6" fill="${c.ink}"/>
  <circle cx="33" cy="40" r="1.6" fill="#fff"/>
  <ellipse cx="41" cy="50" rx="3.8" ry="2.4" fill="${c.pink}" opacity=".75"/>
  <ellipse cx="33" cy="34" rx="5" ry="2.4" fill="#fff" opacity=".35" transform="rotate(-25 33 34)"/>`;
}

const BAMBOO_LAYOUT = {
  2: [[50, 40, 34], [50, 86, 34]],
  3: [[50, 40, 34], [33, 86, 34], [67, 86, 34]],
  4: [[33, 40, 34], [67, 40, 34], [33, 86, 34], [67, 86, 34]],
  5: [[29, 37, 28], [71, 37, 28], [50, 62, 28, 1], [29, 88, 28], [71, 88, 28]],
  6: [[26, 40, 34], [50, 40, 34], [74, 40, 34], [26, 86, 34, 1], [50, 86, 34, 1], [74, 86, 34, 1]],
  7: [[50, 28, 26, 1], [26, 62, 26], [50, 62, 26], [74, 62, 26], [26, 96, 26], [50, 96, 26], [74, 96, 26]],
  8: [[19, 40, 34], [39, 40, 34, 0, 18], [61, 40, 34, 0, -18], [81, 40, 34],
      [19, 86, 34], [39, 86, 34, 0, -18], [61, 86, 34, 0, 18], [81, 86, 34]],
  9: [[26, 30, 26], [50, 30, 26, 1], [74, 30, 26], [26, 63, 26], [50, 63, 26, 1], [74, 63, 26], [26, 96, 26], [50, 96, 26, 1], [74, 96, 26]],
};
function drawBamboo(p, n) {
  const c = C();
  if (n === 1) return cornerMark(DIGITS[1], c.jadeDark) + drawBird(p);
  return cornerMark(DIGITS[n], c.jadeDark)
    + BAMBOO_LAYOUT[n].map(([x, y, h, red, rot]) => stick(p, x, y, h, !!red, rot || 0)).join('');
}

function drawDots(p, n) {
  const c = C();
  const J = [c.jade, c.red], B = [c.blue, c.jade], Rd = [c.red, c.blue];
  const L = {
    2: [[50, 38, 19, J], [50, 88, 19, B]],
    3: [[28, 32, 15, B], [50, 63, 15, Rd], [72, 94, 15, J]],
    4: [[31, 40, 16, B], [69, 40, 16, J], [31, 86, 16, J], [69, 86, 16, B]],
    5: [[28, 34, 14, B], [72, 34, 14, J], [50, 63, 14, Rd], [28, 92, 14, J], [72, 92, 14, B]],
    6: [[31, 28, 14, J], [69, 28, 14, J], [31, 63, 14, Rd], [69, 63, 14, Rd], [31, 97, 14, Rd], [69, 97, 14, Rd]],
    7: [[26, 24, 11, J], [50, 36, 11, J], [74, 48, 11, J], [33, 75, 12.5, Rd], [67, 75, 12.5, Rd], [33, 102, 12.5, Rd], [67, 102, 12.5, Rd]],
    8: [[32, 25, 11.5, B], [68, 25, 11.5, B], [32, 52, 11.5, B], [68, 52, 11.5, B], [32, 79, 11.5, B], [68, 79, 11.5, B], [32, 106, 11.5, B], [68, 106, 11.5, B]],
    9: [[24, 31, 11.5, B], [50, 31, 11.5, B], [76, 31, 11.5, B], [24, 63, 11.5, Rd], [50, 63, 11.5, Rd], [76, 63, 11.5, Rd], [24, 95, 11.5, J], [50, 95, 11.5, J], [76, 95, 11.5, J]],
  };
  if (n === 1) {
    let s = cornerMark(DIGITS[1], c.blueDark);
    for (let k = 0; k < 8; k++) {
      s += `<ellipse cx="50" cy="${63 - 39}" rx="6.5" ry="4.2" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.2" transform="rotate(${k * 45} 50 63)"/>`;
    }
    s += coin(50, 63, 31, c.jade, c.red);
    s += blossom(50, 63, 7.5, c.goldHi, c.goldDark, c.blue, false);
    return s;
  }
  return cornerMark(DIGITS[n], c.blueDark) + L[n].map(([x, y, r, col]) => coin(x, y, r, col[0], col[1])).join('');
}

function drawWind(i) {
  const c = C();
  return cornerMark(LETTERS['ESWN'[i]], c.red) + glyph(WINDS[i], 14, 26, 0.72, c.blue, c.blueDark, 5);
}

function drawDragon(i) {
  const c = C();
  if (i === 0) return glyph(ZHONG, 12, 24, 0.76, c.red, c.redDark, 5.4);
  if (i === 1) return glyph(FA, 13, 25, 0.74, c.jade, c.jadeDark, 4.8);
  // White dragon: an indigo double frame
  const frame = (col, op, dx = 0, dy = 0) => `<g transform="translate(${dx} ${dy})" opacity="${op}" fill="none" stroke="${col}" stroke-linejoin="round" stroke-linecap="round">`
    + `<rect x="17" y="20" width="66" height="84" rx="7" stroke-width="5"/>`
    + `<rect x="27" y="30" width="46" height="64" rx="3" stroke-width="2.2"/>`
    + `<path d="M17 44 h10 M73 44 h10 M17 80 h10 M73 80 h10 M41 20 v10 M59 20 v10 M41 94 v10 M59 94 v10" stroke-width="2.2"/></g>`;
  return `<rect x="27" y="30" width="46" height="64" rx="3" fill="#eef2ff" opacity=".8"/>`
    + frame(c.blueDark, 0.45, 0.9, 1.5) + frame(c.blue, 1);
}

/* ---------- Seasons ---------- */
function drawSeason(p, i) {
  const c = C();
  let s = '';
  if (i === 0) { // Spring — cherry blossom branch
    s += `<path d="M14 108 C30 92 40 80 50 66 C58 54 70 42 86 30" fill="none" stroke="#6b3b2e" stroke-width="4.6" stroke-linecap="round"/>`
      + `<path d="M40 80 C34 70 32 60 34 50 M62 52 C70 56 78 56 86 52" fill="none" stroke="#6b3b2e" stroke-width="3" stroke-linecap="round"/>`
      + `<ellipse cx="34" cy="48" rx="3.6" ry="5" fill="${c.pink}" stroke="#c94f6c" stroke-width="1"/>`
      + `<ellipse cx="88" cy="51" rx="3.4" ry="4.6" fill="${c.pink}" stroke="#c94f6c" stroke-width="1" transform="rotate(40 88 51)"/>`
      + blossom(60, 46, 15, `url(#${p}pk)`, '#c94f6c', c.gold, true, 8)
      + blossom(32, 84, 12, `url(#${p}pk)`, '#c94f6c', c.gold, true, -14)
      + blossom(78, 78, 9.5, `url(#${p}pk)`, '#c94f6c', c.gold, true, 20)
      + `<path d="M76 30 q4 -6 10 -6 q-2 6 -10 6 z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1"/>`;
  } else if (i === 1) { // Summer — lotus
    const petal = (w, h, rot, fill) => `<path d="M0 0 C${-w} ${n2(-h * 0.35)} ${n2(-w * 0.55)} ${n2(-h * 0.85)} 0 ${-h} C${n2(w * 0.55)} ${n2(-h * 0.85)} ${w} ${n2(-h * 0.35)} 0 0 Z" transform="translate(50 86) rotate(${rot})" fill="${fill}" stroke="#c94f6c" stroke-width="1.4" stroke-linejoin="round"/>`;
    s += `<path d="M10 106 q8 -4 16 0 t16 0 M58 106 q8 -4 16 0 t16 0 M24 113 q8 -4 16 0 t16 0 t16 0" fill="none" stroke="${c.blueHi}" stroke-width="2" stroke-linecap="round"/>`
      + `<path d="M8 98 C10 88 30 86 44 92 L30 96 L42 100 C30 104 12 104 8 98 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.4" stroke-linejoin="round"/>`
      + `<path d="M62 96 C70 90 86 90 92 96 C88 102 70 102 62 96 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.4"/>`
      + petal(12, 30, -58, '#ffd6df') + petal(12, 30, 58, '#ffd6df')
      + petal(14, 40, -28, `url(#${p}lt)`) + petal(14, 40, 28, `url(#${p}lt)`)
      + petal(15, 48, 0, `url(#${p}lt)`)
      + `<path d="M50 50 V78" stroke="#ff9db2" stroke-width="1.2" opacity=".8"/>`
      + `<path d="M41 88 Q50 80 59 88" fill="${c.gold}" stroke="${c.goldDark}" stroke-width="1.2"/>`;
  } else if (i === 2) { // Autumn — maple leaf
    const lobes = [{ a: 25, R: 30 }, { a: -30, R: 41 }, { a: -90, R: 46 }, { a: -150, R: 41 }, { a: -205, R: 30 }];
    const pts = [[90, 7]];
    lobes.forEach((l, k) => {
      const tooth = [[16, 0.55], [9, 0.84], [5, 0.74], [0, 1], [-5, 0.74], [-9, 0.84], [-16, 0.55]];
      tooth.forEach(([da, rr]) => pts.push([l.a + da, l.R * rr]));
      if (k < lobes.length - 1) pts.push([(l.a + lobes[k + 1].a) / 2, 15]);
    });
    pts.push([-270, 7]);
    const cx = 50, cy = 60;
    const d = pts.map(([a, r], k) => `${k ? 'L' : 'M'}${n2(cx + Math.cos(a * Math.PI / 180) * r)} ${n2(cy + Math.sin(a * Math.PI / 180) * r)}`).join(' ') + ' Z';
    const veins = lobes.map((l) => `M${cx} ${cy + 4} L${n2(cx + Math.cos(l.a * Math.PI / 180) * l.R * 0.8)} ${n2(cy + Math.sin(l.a * Math.PI / 180) * l.R * 0.8)}`).join(' ');
    s += `<path d="M50 66 C50 82 48 96 42 110" fill="none" stroke="#7a3a1e" stroke-width="3" stroke-linecap="round"/>`
      + `<path d="${d}" fill="${c.redDark}" opacity=".35" transform="translate(1 1.6)"/>`
      + `<path d="${d}" fill="url(#${p}ap)" stroke="#8f1f15" stroke-width="1.6" stroke-linejoin="round"/>`
      + `<path d="${veins}" stroke="#ffd9a0" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>`
      + `<ellipse cx="40" cy="40" rx="8" ry="3.5" fill="#fff" opacity=".3" transform="rotate(-40 40 40)"/>`;
  } else { // Winter — plum blossom with snow
    const flake = (x, y, r) => {
      let f = '';
      for (let k = 0; k < 6; k++) {
        const a = k * 60;
        f += `<g transform="rotate(${a} ${x} ${y})"><path d="M${x} ${y} V${n2(y - r)} M${x} ${n2(y - r * 0.55)} l${n2(-r * 0.28)} ${n2(-r * 0.25)} M${x} ${n2(y - r * 0.55)} l${n2(r * 0.28)} ${n2(-r * 0.25)}"/></g>`;
      }
      return `<g fill="none" stroke="${c.blue}" stroke-width="2.3" stroke-linecap="round">${f}</g><circle cx="${x}" cy="${y}" r="2.6" fill="${c.blue}"/>`;
    };
    s += `<path d="M8 100 C26 88 40 82 54 70 C66 60 74 50 92 44" fill="none" stroke="#5d3a2c" stroke-width="4.6" stroke-linecap="round"/>`
      + `<path d="M54 70 C60 80 68 86 80 90" fill="none" stroke="#5d3a2c" stroke-width="3" stroke-linecap="round"/>`
      + `<g fill="#fff" stroke="#aebde6" stroke-width="1.2"><ellipse cx="28" cy="86" rx="8.5" ry="3.4" transform="rotate(-30 28 86)"/><ellipse cx="50" cy="69" rx="9" ry="3.6" transform="rotate(-38 50 69)"/><ellipse cx="80" cy="47" rx="8" ry="3.2" transform="rotate(-20 80 47)"/><ellipse cx="68" cy="83" rx="6" ry="2.6" transform="rotate(28 68 83)"/></g>`
      + blossom(64, 58, 10.5, `url(#${p}rs)`, c.redDark, c.goldHi, false, 10)
      + blossom(38, 90, 9, `url(#${p}rs)`, c.redDark, c.goldHi, false, -10)
      + blossom(84, 90, 7, `url(#${p}rs)`, c.redDark, c.goldHi, false, 30)
      + flake(32, 40, 13)
      + `<g fill="${c.blueHi}"><circle cx="58" cy="26" r="2.2"/><circle cx="76" cy="20" r="1.8"/><circle cx="88" cy="30" r="2"/><circle cx="16" cy="64" r="1.8"/><circle cx="62" cy="38" r="1.4"/></g>`;
  }
  return s + cornerTag(i + 1, c.red, c.redDark);
}

/* ---------- Flowers ---------- */
function drawFlower(p, i) {
  const c = C();
  let s = '';
  if (i === 0) { // Plum
    s += `<path d="M12 112 C24 98 30 86 42 74 C52 64 62 58 74 40" fill="none" stroke="#5d3a2c" stroke-width="4.4" stroke-linecap="round"/>`
      + `<path d="M42 74 C54 80 64 84 78 84 M30 88 C24 80 22 70 24 62" fill="none" stroke="#5d3a2c" stroke-width="2.8" stroke-linecap="round"/>`
      + blossom(56, 50, 19, `url(#${p}rs)`, '#9e1f3a', c.goldHi, false, 4)
      + blossom(30, 84, 12, `url(#${p}rs)`, '#9e1f3a', c.goldHi, false, -20)
      + blossom(78, 86, 9.5, `url(#${p}rs)`, '#9e1f3a', c.goldHi, false, 15)
      + `<g fill="url(#${p}rs)" stroke="#9e1f3a" stroke-width="1"><circle cx="24" cy="60" r="4"/><circle cx="76" cy="38" r="3.6"/><circle cx="18" cy="104" r="3"/></g>`;
  } else if (i === 1) { // Orchid
    const tepal = (rot, len, wid) => `<path d="M0 0 C${-wid} ${n2(-len * 0.35)} ${n2(-wid * 0.7)} ${n2(-len * 0.9)} 0 ${-len} C${n2(wid * 0.7)} ${n2(-len * 0.9)} ${wid} ${n2(-len * 0.35)} 0 0 Z" transform="translate(58 44) rotate(${rot})" fill="url(#${p}or)" stroke="${c.blueDark}" stroke-width="1.3" stroke-linejoin="round"/>`;
    s += `<path d="M48 110 C38 84 24 66 8 58 C26 62 42 78 52 108 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.3"/>`
      + `<path d="M52 110 C56 82 70 64 92 60 C74 68 62 84 56 110 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.3"/>`
      + `<path d="M50 110 C46 90 46 74 52 60 C52 76 54 92 54 110 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.3"/>`
      + `<path d="M58 54 C58 62 56 70 52 76" fill="none" stroke="${c.jadeDark}" stroke-width="2.4" stroke-linecap="round"/>`
      + tepal(0, 30, 9) + tepal(-115, 28, 8) + tepal(115, 28, 8)
      + tepal(-55, 22, 9) + tepal(55, 22, 9)
      + `<path d="M50 48 C48 60 54 66 58 66 C62 66 68 60 66 48 C62 52 54 52 50 48 Z" fill="#fff4f6" stroke="${c.blueDark}" stroke-width="1.3"/>`
      + `<g fill="${c.red}"><circle cx="55" cy="56" r="1.5"/><circle cx="61" cy="56" r="1.5"/><circle cx="58" cy="61" r="1.4"/></g>`
      + `<circle cx="58" cy="44" r="3.4" fill="${c.gold}" stroke="${c.goldDark}" stroke-width="1"/>`;
  } else if (i === 2) { // Chrysanthemum
    let petals = '';
    for (let k = 0; k < 18; k++) petals += `<ellipse cx="50" cy="${52 - 17}" rx="3.6" ry="12.5" transform="rotate(${k * 20} 50 52)" fill="url(#${p}gd)" stroke="${c.goldDark}" stroke-width="1"/>`;
    for (let k = 0; k < 12; k++) petals += `<ellipse cx="50" cy="${52 - 9}" rx="3.2" ry="8.5" transform="rotate(${k * 30 + 15} 50 52)" fill="#ffd34d" stroke="${c.goldDark}" stroke-width="1"/>`;
    s += `<path d="M50 70 C50 86 48 98 46 112" fill="none" stroke="${c.jadeDark}" stroke-width="3" stroke-linecap="round"/>`
      + `<path d="M48 92 C36 84 24 86 16 94 C26 100 40 100 48 92 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.3"/>`
      + `<path d="M49 100 C60 90 74 90 84 96 C74 106 58 106 49 100 Z" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.3"/>`
      + `<path d="M22 94 L44 93 M54 99 L78 97" stroke="${c.jadeDark}" stroke-width="1" opacity=".6"/>`
      + petals
      + `<circle cx="50" cy="52" r="6.5" fill="#f08a24" stroke="${c.goldDark}" stroke-width="1.2"/>`
      + `<circle cx="48" cy="50" r="2" fill="#fff" opacity=".5"/>`;
  } else { // Bamboo plant
    const stalk = (x, y0, y1, w) => {
      let st = `<rect x="${x - w / 2}" y="${y0}" width="${w}" height="${y1 - y0}" rx="${w / 2}" fill="url(#${p}sg)" stroke="${c.jadeDark}" stroke-width="1.4"/>`;
      for (let y = y0 + 20; y < y1 - 6; y += 22) st += `<rect x="${x - w / 2 - 1}" y="${y - 1.4}" width="${w + 2}" height="2.8" rx="1.4" fill="${c.jadeDark}"/>`;
      return st;
    };
    const leaf = (x, y, rot, len = 26) => `<path d="M0 0 C${n2(len * 0.25)} -4.6 ${n2(len * 0.7)} -4.2 ${len} 0 C${n2(len * 0.7)} 4.2 ${n2(len * 0.25)} 4.6 0 0 Z" transform="translate(${x} ${y}) rotate(${rot})" fill="url(#${p}jg)" stroke="${c.jadeDark}" stroke-width="1.2" stroke-linejoin="round"/>`;
    s += stalk(36, 14, 112, 10) + stalk(62, 34, 112, 8)
      + leaf(40, 32, -30) + leaf(40, 34, 10, 22) + leaf(40, 36, 45, 18)
      + leaf(64, 56, -150) + leaf(64, 58, 170, 22) + leaf(64, 60, 140, 18)
      + leaf(66, 84, -20, 22) + leaf(66, 86, 20, 18);
  }
  return s + cornerTag(i + 1, c.blue, c.blueDark);
}

/* ==========================================================
   PUBLIC API
   ========================================================== */
/** Inner SVG markup for a tile (body + symbol) in face coordinates. */
export function tileMarkup(type, prefix = uid('t')) {
  const t = TILE_TYPES[type];
  const { defs, body } = tileBody(prefix);
  let sym = '';
  switch (t.suit) {
    case 'char': sym = drawChar(t.rank); break;
    case 'bamboo': sym = drawBamboo(prefix, t.rank); break;
    case 'dot': sym = drawDots(prefix, t.rank); break;
    case 'wind': sym = drawWind(t.rank - 1); break;
    case 'dragon': sym = drawDragon(t.rank - 1); break;
    case 'season': sym = drawSeason(prefix, t.rank - 1); break;
    case 'flower': sym = drawFlower(prefix, t.rank - 1); break;
  }
  return `<defs>${defs}${symbolDefs(prefix)}</defs>${body}<g>${sym}</g>`;
}

/** Standalone SVG document for a tile (used by the game and the asset sheet). */
export function tileSVG(type, prefix) {
  return svgDoc(-PAD, -PAD, FW + DX + PAD * 2, FH + DY + PAD * 2, tileMarkup(type, prefix),
    `width="${FW + DX + PAD * 2}" height="${FH + DY + PAD * 2}"`);
}

/* ==========================================================
   BAKED BITMAPS (gameplay)
   ----------------------------------------------------------
   The board never shows live SVG: each of the 42 complete tiles
   (shadow, ivory slab, tan edge, face, symbol) is rasterised ONCE
   to a PNG at 2× its displayed size, and the four glow states are
   pre-rendered too.  Tiles reference them through one injected
   stylesheet, so a re-bake on resize updates every tile at once.
   The SVG source stays for the asset sheet export.
   ========================================================== */
const pngURLs = new Array(TYPE_COUNT).fill(null);
let bakedRes = 0;
let svgURLs = null;

/** Image URL for a tile type (baked PNG once available). */
export function tileURL(type) {
  if (pngURLs[type]) return pngURLs[type];
  if (!svgURLs) svgURLs = [];
  if (!svgURLs[type]) svgURLs[type] = URL.createObjectURL(new Blob([tileSVG(type, 't')], { type: 'image/svg+xml' }));
  return svgURLs[type];
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* Glow geometry: a 70 × 85 rounded box hugging the face, plus a margin
   large enough for the softest shadow (blur + spread). */
export const GLOW = { box: [70, 85], radius: 12, margin: 44 };
const GLOWS = {
  hover: [{ spread: 5, blur: 18, color: 'rgba(255,186,90,.5)' }, { spread: 2, color: 'rgba(255,222,140,.85)' }],
  gold: [{ spread: 9, blur: 26, color: 'rgba(255,196,70,.75)' }, { spread: 6, color: 'gold-mid' }, { spread: 3, color: 'gold-hi' }],
  jade: [{ spread: 9, blur: 24, color: 'rgba(60,220,150,.6)' }, { spread: 6, color: 'jade' }, { spread: 3, color: '#c4ffe0' }],
  red: [{ spread: 8, blur: 22, color: 'rgba(255,86,40,.75)' }, { spread: 3, color: '#ffd6bd' }],
};

/** Paint a stack of CSS-style outer box-shadows (bottom → top) into a canvas. */
function glowCanvas(layers, k) {
  const [bw, bh] = GLOW.box, R = GLOW.radius, E = GLOW.margin;
  const c = document.createElement('canvas');
  c.width = Math.round((bw + 2 * E) * k);
  c.height = Math.round((bh + 2 * E) * k);
  const x = c.getContext('2d');
  x.scale(k, k);
  const OFF = 6000; // shadow-only trick: draw the shape off-canvas, offset its shadow back in
  for (const L of layers) {
    const col = /^(gold|jade)/.test(L.color) ? P[L.color.replace(/-(\w)/g, (_, ch) => ch.toUpperCase())] : L.color;
    const sp = L.spread;
    if (L.blur) {
      x.save();
      x.shadowColor = col;
      x.shadowBlur = L.blur * k;            // canvas σ = blur/2, same as CSS box-shadow
      x.shadowOffsetX = OFF * k;
      x.translate(-OFF, 0);
      roundRectPath(x, E - sp, E - sp, bw + 2 * sp, bh + 2 * sp, R + sp);
      x.fillStyle = '#000';
      x.fill();
      x.restore();
    } else {
      roundRectPath(x, E - sp, E - sp, bw + 2 * sp, bh + 2 * sp, R + sp);
      x.fillStyle = col;
      x.fill();
    }
  }
  // outer box-shadows never paint inside the box itself
  x.globalCompositeOperation = 'destination-out';
  roundRectPath(x, E, E, bw, bh, R);
  x.fillStyle = '#000';
  x.fill();
  return c;
}

/**
 * Rasterise all tiles + glows at 2× the current display resolution.
 * Skips work when the resolution has not changed meaningfully.
 */
export async function bakeTileArt() {
  const k = Math.min(3, Math.max(1, stageRes() * 2));
  if (bakedRes && Math.abs(k - bakedRes) / bakedRes < 0.15) return;
  bakedRes = k;
  const W = TILE.imgW * k, H = TILE.imgH * k;
  const urls = await Promise.all(Array.from({ length: TYPE_COUNT }, (_, i) =>
    svgToCanvas(tileSVG(i, 't'), W, H).then(canvasToURL)));
  const glowURLs = {};
  for (const [name, layers] of Object.entries(GLOWS)) glowURLs[name] = await canvasToURL(glowCanvas(layers, k));
  // decode before swapping so nothing flashes
  await Promise.all([...urls, ...Object.values(glowURLs)].map((u) => { const im = new Image(); im.src = u; return im.decode ? im.decode().catch(() => {}) : null; }));

  let css = ':root{' + Object.entries(glowURLs).map(([n, u]) => `--glow-${n}:url("${u}");`).join('') + '}';
  urls.forEach((u, i) => { css += `.t-${i}>.tile-body::before,.mini-tile.t-${i}{background-image:url("${u}")}`; });
  let sheet = document.getElementById('tile-art');
  if (!sheet) { sheet = document.createElement('style'); sheet.id = 'tile-art'; document.head.appendChild(sheet); }
  const old = pngURLs.slice();
  sheet.textContent = css;
  urls.forEach((u, i) => { pngURLs[i] = u; });
  setTimeout(() => old.forEach((u) => u && URL.revokeObjectURL(u)), 2000);
}

/** Boot: bake everything before the first deal. */
export async function preloadTiles() {
  await bakeTileArt();
}
