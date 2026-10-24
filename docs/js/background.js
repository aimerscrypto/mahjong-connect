/* ==========================================================
   background.js — the full-page scene behind the stage
   ----------------------------------------------------------
   Layered SVG (sky → far hills & pagoda → drifting swirl clouds →
   near hills & mist), cherry branches in the top corners, two
   swaying paper lanterns and a handful of slow petals.
   It is sized to the window independently of the 1920×1080 stage.
   Parallax is a few pixels of transform per layer (compositor-only).
   ========================================================== */
import { P, uid, n2, svgDoc, lerp } from './util.js';
import { svgToCanvas, svgToURL, dpr, onResizeSettled } from './raster.js';
import { addTask } from './loop.js';
import { ambient } from './ambient.js';
import { swirlCloud, spiralPath } from './art.js';

const VW = 1920, VH = 1080;

/* ---------- Sky ---------- */
export function skyMarkup() {
  const p = uid('sk');
  return `<defs>
    <linearGradient id="${p}s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${P.skyTop}"/><stop offset=".45" stop-color="${P.skyMid}"/><stop offset=".75" stop-color="${P.skyLow}"/><stop offset="1" stop-color="${P.skyMid}"/>
    </linearGradient>
    <radialGradient id="${p}u" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffdf6"/><stop offset=".55" stop-color="${P.sun}" stop-opacity=".85"/><stop offset="1" stop-color="${P.sun}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${p}w" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6e6" stop-opacity=".9"/><stop offset="1" stop-color="#fff6e6" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${VW}" height="${VH}" fill="url(#${p}s)"/>
  <ellipse cx="1240" cy="560" rx="760" ry="420" fill="url(#${p}w)"/>
  <circle cx="1240" cy="560" r="230" fill="url(#${p}u)"/>
  <g fill="${P.cloudCoral}" opacity=".35">
    <ellipse cx="380" cy="380" rx="300" ry="22"/><ellipse cx="560" cy="410" rx="220" ry="14"/>
    <ellipse cx="1480" cy="330" rx="320" ry="20"/><ellipse cx="1660" cy="362" rx="200" ry="13"/>
  </g>
  <g fill="none" stroke="${P.cloudCoralLine}" stroke-width="3.2" stroke-linecap="round" opacity=".55">
    <path d="M1010 300 q10 -10 20 0 q10 -10 20 0"/><path d="M1068 270 q7 -7 14 0 q7 -7 14 0"/><path d="M960 248 q6 -6 12 0 q6 -6 12 0"/>
  </g>`;
}

/* ---------- Pagoda ---------- */
function pagoda(x, y, s, color) {
  let d = `<rect x="-36" y="-10" width="72" height="10" rx="2"/>`;
  let yy = -10;
  for (let i = 0; i < 5; i++) {
    const w = 52 - i * 8;
    const bodyH = i === 0 ? 20 : 14;
    d += `<rect x="${-w / 2 + 4}" y="${yy - bodyH}" width="${w - 8}" height="${bodyH}"/>`;
    yy -= bodyH;
    const rw = w / 2 + 12;
    d += `<path d="M${-rw} ${yy + 1} Q${-rw + 6} ${yy - 2} ${-w / 2 + 2} ${yy - 7} H${w / 2 - 2} Q${rw - 6} ${yy - 2} ${rw} ${yy + 1} Q${rw - 10} ${yy + 1} ${w / 2 - 4} ${yy + 3} H${-w / 2 + 4} Q${-rw + 10} ${yy + 1} ${-rw} ${yy + 1} Z"/>`;
    yy -= 7;
  }
  d += `<rect x="-1.6" y="${yy - 30}" width="3.2" height="30"/><circle cx="0" cy="${yy - 12}" r="3.6"/><circle cx="0" cy="${yy - 20}" r="3"/><circle cx="0" cy="${yy - 27}" r="2.4"/>`;
  return `<g transform="translate(${x} ${y}) scale(${s})" fill="${color}">${d}</g>`;
}

/* ---------- Far hills + pagoda ---------- */
export function farMarkup() {
  const p = uid('fa');
  return `<defs>
    <linearGradient id="${p}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.mountainFar}"/><stop offset="1" stop-color="${P.skyLow}"/></linearGradient>
    <linearGradient id="${p}n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.mountainMid}"/><stop offset="1" stop-color="${P.skyLow}"/></linearGradient>
  </defs>
  <path d="M0 720 L0 600 C110 560 190 500 300 520 C380 450 470 440 545 488 C620 530 700 462 820 452 C930 444 985 510 1065 532 C1150 500 1220 452 1300 440 C1340 420 1400 418 1440 430 C1500 446 1530 490 1600 506 C1690 462 1790 470 1920 530 L1920 720 Z" fill="url(#${p}m)" opacity=".75"/>
  ${pagoda(1405, 432, 1.15, P.pagoda)}
  <path d="M0 800 C140 708 270 650 410 668 C530 684 610 622 730 604 C870 584 930 664 1050 672 C1170 682 1250 612 1390 602 C1510 594 1610 662 1730 652 C1830 644 1880 610 1920 616 L1920 800 Z" fill="url(#${p}n)" opacity=".7"/>`;
}

/* ---------- Drifting swirl clouds ---------- */
export function cloudsMarkup() {
  const co = { fill: P.cloudCoral, line: P.cloudCoralLine, curl: '#fbd2c2' };
  const cr = { fill: P.cloudCream, line: P.cloudCreamLine, curl: P.cloudCreamLine };
  return swirlCloud({ x: 40, y: 90, s: 1.35, ...cr })
    + swirlCloud({ x: 520, y: 40, s: 0.9, ...co, opacity: 0.85 })
    + swirlCloud({ x: 1240, y: 70, s: 1.15, ...cr, flip: true })
    + swirlCloud({ x: 1620, y: 210, s: 1.0, ...co, flip: true })
    + swirlCloud({ x: 160, y: 470, s: 0.85, ...co, opacity: 0.8 })
    + swirlCloud({ x: 1500, y: 520, s: 0.8, ...cr, opacity: 0.9 })
    + swirlCloud({ x: 820, y: 250, s: 0.7, ...cr, opacity: 0.7, flip: true });
}

/* ---------- Near hills, mist and foreground clouds ---------- */
export function nearMarkup() {
  const p = uid('ne');
  const co = { fill: P.cloudCoral, line: P.cloudCoralLine, curl: '#fbd2c2' };
  const cr = { fill: P.cloudCream, line: P.cloudCreamLine, curl: P.cloudCreamLine };
  return `<defs>
    <linearGradient id="${p}h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.mountainNear}"/><stop offset="1" stop-color="${P.mountainMid}"/></linearGradient>
    <linearGradient id="${p}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.skyLow}" stop-opacity="0"/><stop offset=".5" stop-color="${P.skyLow}" stop-opacity=".85"/><stop offset="1" stop-color="${P.skyLow}" stop-opacity="0"/></linearGradient>
  </defs>
  <rect x="0" y="640" width="${VW}" height="220" fill="url(#${p}m)"/>
  <path d="M0 1080 L0 868 C200 806 380 786 560 826 C760 866 900 806 1080 816 C1260 826 1400 876 1600 846 C1760 822 1860 806 1920 816 L1920 1080 Z" fill="url(#${p}h)" opacity=".6"/>
  <rect x="0" y="900" width="${VW}" height="180" fill="url(#${p}m)" opacity=".7"/>
  ${swirlCloud({ x: -80, y: 860, s: 2.3, ...cr })}
  ${swirlCloud({ x: 150, y: 930, s: 1.8, ...co })}
  ${swirlCloud({ x: 1560, y: 850, s: 2.3, ...cr, flip: true })}
  ${swirlCloud({ x: 1380, y: 940, s: 1.8, ...co, flip: true })}`;
}

/* ---------- Cherry branch (top-left; mirrored with CSS for the right) ---------- */
function cherry(x, y, r, rot, p) {
  const petal = `M0 0 C${n2(-r * 0.58)} ${n2(-r * 0.25)} ${n2(-r * 0.66)} ${n2(-r * 0.95)} ${n2(-r * 0.22)} ${n2(-r)} L0 ${n2(-r * 0.84)} L${n2(r * 0.22)} ${n2(-r)} C${n2(r * 0.66)} ${n2(-r * 0.95)} ${n2(r * 0.58)} ${n2(-r * 0.25)} 0 0 Z`;
  let s = `<g transform="translate(${x} ${y}) rotate(${rot})">`;
  for (let k = 0; k < 5; k++) s += `<path d="${petal}" transform="rotate(${k * 72})" fill="url(#${p}p)" stroke="${P.blossomLine}" stroke-width="1.6" stroke-linejoin="round"/>`;
  for (let k = 0; k < 5; k++) {
    const a = (k * 72 + 36) * Math.PI / 180;
    s += `<path d="M0 0 L${n2(Math.sin(a) * r * 0.45)} ${n2(-Math.cos(a) * r * 0.45)}" stroke="${P.blossomLine}" stroke-width="1.3"/><circle cx="${n2(Math.sin(a) * r * 0.45)}" cy="${n2(-Math.cos(a) * r * 0.45)}" r="${n2(r * 0.09)}" fill="${P.gold}"/>`;
  }
  return s + `<circle r="${n2(r * 0.22)}" fill="#e2557a"/><circle r="${n2(r * 0.1)}" fill="${P.gold}"/></g>`;
}
export function branchMarkup() {
  const p = uid('br');
  const bark = P.bark;
  const bud = (x, y, rot) => `<ellipse cx="${x}" cy="${y}" rx="5" ry="8" transform="rotate(${rot} ${x} ${y})" fill="${P.blossomDeep}" stroke="${P.blossomLine}" stroke-width="1.4"/>`;
  return `<defs>
    <linearGradient id="${p}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0f3"/><stop offset=".6" stop-color="${P.blossom}"/><stop offset="1" stop-color="${P.blossomDeep}"/></linearGradient>
    <linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5040"/><stop offset="1" stop-color="${bark}"/></linearGradient>
  </defs>
  <g fill="url(#${p}b)" stroke="#4a241a" stroke-width="2" stroke-linejoin="round">
    <path d="M-20 -10 C120 10 220 60 330 120 C400 158 460 176 530 180 Q546 186 528 194 C450 198 390 186 320 152 C220 102 120 62 -20 52 Z"/>
    <path d="M196 74 C240 40 280 22 336 12 Q346 15 337 22 C285 34 247 55 207 86 Z"/>
    <path d="M326 128 C356 170 382 220 420 262 Q425 273 413 268 C372 228 344 180 314 138 Z"/>
    <path d="M94 34 C110 76 122 120 152 168 Q154 179 144 173 C112 128 98 86 82 42 Z"/>
  </g>
  <g fill="none" stroke-linecap="round">
    <path d="M10 14 C130 34 230 80 340 140" stroke="#a8705c" stroke-width="3" opacity=".7"/>
    <path d="M60 40 C90 44 120 50 150 60 M260 112 C280 120 300 128 318 136" stroke="#4a241a" stroke-width="2" opacity=".6"/>
    <path d="M470 182 C490 160 500 140 498 120 M250 92 C252 70 262 52 276 40" stroke="${bark}" stroke-width="4"/>
  </g>
  ${bud(498, 116, 15)}${bud(278, 36, 40)}${bud(560, 190, 70)}${bud(170, 196, 160)}${bud(440, 288, 150)}
  ${cherry(336, 14, 24, 10, p)}${cherry(298, 34, 15, -20, p)}${cherry(420, 262, 22, 18, p)}${cherry(390, 226, 14, -10, p)}
  ${cherry(530, 186, 19, 30, p)}${cherry(468, 178, 14, 0, p)}${cherry(152, 170, 20, -12, p)}${cherry(126, 128, 13, 22, p)}
  ${cherry(250, 100, 16, 6, p)}${cherry(60, 54, 15, -30, p)}${cherry(212, 84, 11, 40, p)}`;
}
export const BRANCH_W = 640, BRANCH_H = 320;

/* ---------- Paper lantern ---------- */
export function lanternMarkup() {
  const p = uid('ln');
  return `<defs>
    <radialGradient id="${p}b" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#ffe08a"/><stop offset=".3" stop-color="#ff8a4a"/><stop offset=".7" stop-color="${P.cinnabar}"/><stop offset="1" stop-color="${P.lacquer}"/></radialGradient>
    <linearGradient id="${p}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.goldHi}"/><stop offset=".5" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldDark}"/></linearGradient>
  </defs>
  <path d="M70 0 V78" stroke="#5a2a1a" stroke-width="2.6"/>
  <circle cx="70" cy="80" r="5" fill="none" stroke="url(#${p}g)" stroke-width="3"/>
  <rect x="46" y="84" width="48" height="14" rx="4" fill="url(#${p}g)" stroke="${P.goldDeep}" stroke-width="1.6"/>
  <rect x="36" y="94" width="68" height="9" rx="4.5" fill="url(#${p}g)" stroke="${P.goldDeep}" stroke-width="1.6"/>
  <ellipse cx="70" cy="172" rx="64" ry="72" fill="url(#${p}b)" stroke="${P.lacquerDark}" stroke-width="3"/>
  <g fill="none" stroke="${P.lacquerDark}" stroke-width="2.2" opacity=".42">
    <ellipse cx="70" cy="172" rx="42" ry="72"/><ellipse cx="70" cy="172" rx="18" ry="72"/>
  </g>
  <g fill="none" stroke="${P.goldHi}" stroke-width="1.4" opacity=".5"><path d="M14 132 Q70 120 126 132 M14 212 Q70 224 126 212"/></g>
  <circle cx="70" cy="172" r="23" fill="none" stroke="url(#${p}g)" stroke-width="3"/>
  <path d="${spiralPath(70, 172, 15, 1.4, Math.PI, 1)}" fill="none" stroke="url(#${p}g)" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="44" cy="136" rx="12" ry="22" fill="#fff" opacity=".18" transform="rotate(20 44 136)"/>
  <rect x="36" y="241" width="68" height="9" rx="4.5" fill="url(#${p}g)" stroke="${P.goldDeep}" stroke-width="1.6"/>
  <rect x="46" y="247" width="48" height="13" rx="4" fill="url(#${p}g)" stroke="${P.goldDeep}" stroke-width="1.6"/>
  <path d="M70 260 V272" stroke="${P.lacquer}" stroke-width="3"/>
  <circle cx="70" cy="276" r="6" fill="url(#${p}g)" stroke="${P.goldDeep}" stroke-width="1.4"/>
  <path d="M60 282 H80 L84 324 H56 Z" fill="${P.cinnabar}" stroke="${P.lacquerDark}" stroke-width="1.6" stroke-linejoin="round"/>
  <g stroke="${P.goldHi}" stroke-width="1.4" opacity=".75"><path d="M62 286 L60 322 M66 286 L65 322 M70 286 V322 M74 286 L75 322 M78 286 L80 322"/></g>
  <rect x="58" y="282" width="24" height="5" rx="2" fill="url(#${p}g)"/>`;
}
export const LANTERN_W = 140, LANTERN_H = 330;

/* ---------- Petal (falling) ---------- */
export function petalMarkup(c1 = '#ffd9e2', c2 = '#f48aa8') {
  const p = uid('pt');
  return `<defs><linearGradient id="${p}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`
    + `<path d="M12 2 C20 6 24 16 18 24 C14 28 8 28 5 23 C1 15 4 6 12 2 Z" fill="url(#${p})"/><path d="M12 6 C12 12 11 18 8 22" stroke="#fff" stroke-width="1" opacity=".6" fill="none"/>`;
}

const layerSVG = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid slice">${inner}</svg>`;

/**
 * Build the live background inside host.
 * The vector layers are rendered ONCE to canvases at the current window
 * size (and again only after a debounced resize).  Only the lanterns and
 * petals animate as their own small layers; slow drift/sway is stepped by
 * ambient.js; parallax runs in the shared loop and settles to idle.
 * Resolves once the scene has been painted.
 */
export function mountBackground(host) {
  const petals = Array.from({ length: 9 }, (_, i) => {
    const dur = 20 + (i * 7) % 14;
    const delay = -((i * 5.3) % dur);
    const x = (i * 11.3 + 4) % 100;
    const drift = (i % 2 ? 1 : -1) * (14 + (i * 3) % 12);
    const size = 14 + (i * 5) % 10;
    return `<div class="petal" style="--x:${x}vw;--drift:${drift}vw;--dur:${dur}s;--delay:${delay}s;--s:${size}px;--spin:${i % 2 ? 1 : -1}"><img alt="" draggable="false"></div>`;
  }).join('');

  host.innerHTML = `
    <div class="bg-layer bg-sky"><canvas></canvas></div>
    <div class="bg-layer bg-far" data-depth="6"><canvas></canvas></div>
    <div class="bg-layer bg-clouds" data-depth="12"><div class="bg-drift"><canvas></canvas></div></div>
    <div class="bg-layer bg-near" data-depth="20"><canvas></canvas></div>
    <div class="bg-lantern bg-lantern-left"><div class="lantern-sway"><div class="lantern-glow"></div><canvas></canvas></div></div>
    <div class="bg-lantern bg-lantern-right"><div class="lantern-sway"><div class="lantern-glow"></div><canvas></canvas></div></div>
    <div class="bg-branch bg-branch-left" data-depth="10"><div class="sway"><canvas></canvas></div></div>
    <div class="bg-branch bg-branch-right" data-depth="10"><div class="sway"><canvas></canvas></div></div>
    <div class="bg-petals">${petals}</div>`;

  const q = (sel) => host.querySelector(sel);
  const layers = [
    [q('.bg-sky canvas'), skyMarkup], [q('.bg-far canvas'), farMarkup],
    [q('.bg-clouds canvas'), cloudsMarkup], [q('.bg-near canvas'), nearMarkup],
  ];
  const branches = [...host.querySelectorAll('.bg-branch canvas')];
  const lanterns = [...host.querySelectorAll('.bg-lantern canvas')];

  // Generate the SVG strings once; only the pixel size changes on resize.
  const layerSrc = layers.map(([, fn]) => layerSVG(fn()));
  const branchSrc = svgDoc(0, 0, BRANCH_W, BRANCH_H, branchMarkup());
  const lanternSrc = svgDoc(0, 0, LANTERN_W, LANTERN_H, lanternMarkup());

  const render = async () => {
    const d = dpr();
    const W = (innerWidth + 64) * d, H = (innerHeight + 64) * d;
    for (let i = 0; i < layers.length; i++) await svgToCanvas(layerSrc[i], W, H, layers[i][0]);
    const bw = branches[0].parentElement.clientWidth || 1;
    for (const c of branches) await svgToCanvas(branchSrc, bw * d, bw * d * BRANCH_H / BRANCH_W, c);
    const lw = lanterns[0].parentElement.clientWidth || 1;
    for (const c of lanterns) await svgToCanvas(lanternSrc, lw * d, lw * d * LANTERN_H / LANTERN_W, c);
  };
  onResizeSettled(render);

  // one shared petal bitmap
  const petalURL = svgToURL(svgDoc(0, 0, 26, 30, petalMarkup()), 52 * dpr(), 60 * dpr())
    .then((url) => host.querySelectorAll('.petal img').forEach((im) => { im.src = url; }));

  // slow ambient motion (identical curves to the old CSS keyframes)
  ambient(q('.bg-drift'), 70, (v) => `translate3d(${n2(-36 + 72 * v)}px, 0, 0)`);
  ambient(q('.bg-branch-left .sway'), 9, (v) => `rotate(${n2(-0.8 + 1.9 * v)}deg)`);
  ambient(q('.bg-branch-right .sway'), 9, (v) => `rotate(${n2(-0.8 + 1.9 * v)}deg)`, { delay: -4.5 });

  // pointer parallax on the shared loop; will-change only while moving
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const items = [...host.querySelectorAll('[data-depth]')].map((el) => ({ el, d: +el.dataset.depth }));
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    let moving = false, idleTimer = 0;
    window.addEventListener('pointermove', (e) => {
      target.x = e.clientX / innerWidth - 0.5;
      target.y = e.clientY / innerHeight - 0.5;
      if (!moving) { moving = true; clearTimeout(idleTimer); host.classList.add('parallaxing'); addTask(step); }
    }, { passive: true });
    const step = () => {
      cur.x = lerp(cur.x, target.x, 0.06);
      cur.y = lerp(cur.y, target.y, 0.06);
      for (const { el, d } of items) el.style.transform = `translate3d(${n2(-cur.x * d)}px, ${n2(-cur.y * d * 0.6)}px, 0)`;
      if (Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y) > 0.002) return true;
      moving = false;
      idleTimer = setTimeout(() => host.classList.remove('parallaxing'), 1000);
      return -1;
    };
  }
  return Promise.all([render(), petalURL]);
}

/** The complete composed scene as one SVG (for the asset sheet). */
export function sceneDoc() {
  const nest = (x, y, w, h, vw, vh, inner, extra = '') => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="0 0 ${vw} ${vh}" ${extra}>${inner}</svg>`;
  const inner = skyMarkup() + farMarkup() + cloudsMarkup() + nearMarkup()
    + nest(0, 0, 560, 280, BRANCH_W, BRANCH_H, branchMarkup())
    + `<g transform="translate(${VW} 0) scale(-1 1)">${nest(0, 0, 560, 280, BRANCH_W, BRANCH_H, branchMarkup())}</g>`
    + nest(40, 60, 98, 231, LANTERN_W, LANTERN_H, lanternMarkup())
    + nest(VW - 138, 60, 98, 231, LANTERN_W, LANTERN_H, lanternMarkup());
  return svgDoc(0, 0, VW, VH, inner, `width="${VW}" height="${VH}"`);
}
export const lanternDoc = () => svgDoc(0, 0, LANTERN_W, LANTERN_H, lanternMarkup(), `width="${LANTERN_W * 2}" height="${LANTERN_H * 2}"`);
export const branchDoc = () => svgDoc(0, 0, BRANCH_W, BRANCH_H, branchMarkup(), `width="${BRANCH_W}" height="${BRANCH_H}"`);
export const cloudDoc = () => svgDoc(-10, -10, 220, 110,
  swirlCloud({ fill: P.cloudCoral, line: P.cloudCoralLine, curl: '#fbd2c2' }), 'width="440" height="220"');
