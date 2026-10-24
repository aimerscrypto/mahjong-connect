/* ==========================================================
   dragon.js — the friendly chibi dragon mascot
   ----------------------------------------------------------
   Layered SVG head (mane, horns, ears, face, eyes, muzzle) with
   every expression present as a group; the live controller only
   flips a data-mood attribute, so swaps cost nothing.
   Pupils follow the cursor with lerped motion, clamped to an
   ellipse inside each eye.  Idle blinks + a breathing bob.
   Moods: neutral, happy, surprised, cheer, sad.
   ========================================================== */
import { P, uid, n2, svgDoc, clamp } from './util.js';
import { spiralPath } from './art.js';
import { addTask, wake } from './loop.js';

export const HEAD_W = 260, HEAD_H = 240;
const EYES = [{ x: 100, y: 124 }, { x: 160, y: 124 }];
const PUPIL_RANGE = { x: 8, y: 9.5 };
export const MOODS = ['neutral', 'happy', 'surprised', 'cheer', 'sad'];

/* Which groups each mood shows. */
const SHOW = {
  neutral:   ['eyes-open', 'brows-normal', 'mouth-smile'],
  happy:     ['eyes-happy', 'brows-normal', 'mouth-open'],
  surprised: ['eyes-open', 'brows-up', 'mouth-o'],
  cheer:     ['eyes-happy', 'brows-up', 'mouth-cheer', 'sparkles'],
  sad:       ['eyes-open', 'brows-sad', 'mouth-sad', 'tear'],
};
const ALL_GROUPS = ['eyes-open', 'eyes-happy', 'brows-normal', 'brows-up', 'brows-sad', 'mouth-smile', 'mouth-open', 'mouth-o', 'mouth-cheer', 'mouth-sad', 'tear', 'sparkles'];

function defs(p) {
  return `<defs>
    <radialGradient id="${p}h" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#ff8a6a"/><stop offset=".5" stop-color="${P.cinnabar}"/><stop offset="1" stop-color="${P.lacquer}"/></radialGradient>
    <linearGradient id="${p}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4de"/><stop offset="1" stop-color="#ffd2a4"/></linearGradient>
    <radialGradient id="${p}g" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff2b0"/><stop offset=".55" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldMid}"/></radialGradient>
    <linearGradient id="${p}hn" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${P.gold}"/><stop offset="1" stop-color="#fff6d8"/></linearGradient>
    <radialGradient id="${p}e" cx=".45" cy=".35" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".75" stop-color="#fbf7f2"/><stop offset="1" stop-color="#e2dcea"/></radialGradient>
    <radialGradient id="${p}i" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="#8a4a20"/><stop offset=".6" stop-color="#4a1a0c"/><stop offset="1" stop-color="#1c0704"/></radialGradient>
  </defs>`;
}

function grp(name, mood, inner) {
  const on = SHOW[mood].includes(name);
  return `<g class="d-${name}"${on ? '' : ' display="none"'}>${inner}</g>`;
}

/** Inner markup of the head.  `mood` sets the default visible expression. */
export function dragonHeadMarkup(mood = 'neutral') {
  const p = uid('dr');
  const OUT = '#6e1216';
  let s = defs(p);

  // whiskers (behind the head)
  s += `<g fill="none" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="M84 168 C60 176 36 172 24 158 C16 148 24 138 33 144" stroke="${P.goldDark}" stroke-width="7"/>`
    + `<path d="M84 168 C60 176 36 172 24 158 C16 148 24 138 33 144" stroke="${P.gold}" stroke-width="4"/>`
    + `<path d="M176 168 C200 176 224 172 236 158 C244 148 236 138 227 144" stroke="${P.goldDark}" stroke-width="7"/>`
    + `<path d="M176 168 C200 176 224 172 236 158 C244 148 236 138 227 144" stroke="${P.gold}" stroke-width="4"/></g>`;

  // fluffy golden mane: two rings of tufts around the top of the head
  let maneBack = '', maneFront = '';
  for (let k = 0; k <= 11; k++) {
    const a = (160 + k * 20) * Math.PI / 180;
    maneBack += `<circle cx="${n2(130 + Math.cos(a) * 92)}" cy="${n2(130 + Math.sin(a) * 80)}" r="23"/>`;
    const a2 = (170 + k * 20) * Math.PI / 180;
    if (k < 11) maneFront += `<circle cx="${n2(130 + Math.cos(a2) * 80)}" cy="${n2(130 + Math.sin(a2) * 70)}" r="22"/>`;
  }
  s += `<g fill="${P.goldDark}" stroke="${P.goldDeep}" stroke-width="3">${maneBack}</g>`
    + `<g fill="url(#${p}g)" stroke="${P.goldDark}" stroke-width="2.5">${maneFront}</g>`
    + `<g fill="none" stroke="#fff3c0" stroke-width="2.5" stroke-linecap="round" opacity=".8">`
    + `<path d="${spiralPath(56, 92, 9, 1.2, Math.PI, 1)}"/><path d="${spiralPath(204, 92, 9, 1.2, 0, -1)}"/><path d="${spiralPath(130, 42, 9, 1.2, Math.PI * 1.5, 1)}"/></g>`;

  // horns
  const horn = `<path d="M92 76 C84 56 72 40 66 24 C63 16 72 13 76 20 C84 34 94 50 110 70 Z" fill="url(#${p}hn)" stroke="${P.goldDeep}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M77 46 C68 45 61 40 57 34 C55 29 61 27 64 31 C68 36 74 38 81 39 Z" fill="url(#${p}hn)" stroke="${P.goldDeep}" stroke-width="2.6" stroke-linejoin="round"/>`
    + `<path d="M72 26 C78 38 86 50 96 62" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>`;
  s += horn + `<g transform="translate(260 0) scale(-1 1)">${horn}</g>`;

  // ears
  const ear = `<path d="M60 116 C36 104 22 86 22 70 C40 76 56 90 70 104 Z" fill="${P.cinnabar}" stroke="${OUT}" stroke-width="3" stroke-linejoin="round"/>`
    + `<path d="M56 108 C42 98 34 88 32 80 C44 86 54 94 62 102 Z" fill="${P.gold}"/>`;
  s += ear + `<g transform="translate(260 0) scale(-1 1)">${ear}</g>`;

  // head
  s += `<ellipse cx="130" cy="132" rx="84" ry="72" fill="url(#${p}h)" stroke="${OUT}" stroke-width="4"/>`
    + `<ellipse cx="98" cy="88" rx="30" ry="12" fill="#fff" opacity=".22" transform="rotate(-18 98 88)"/>`
    + `<path d="M130 66 C139 77 141 88 130 97 C119 88 121 77 130 66 Z" fill="url(#${p}g)" stroke="${P.goldDark}" stroke-width="2"/>`
    + `<g fill="${P.gold}" opacity=".85"><circle cx="64" cy="140" r="3.2"/><circle cx="58" cy="152" r="2.4"/><circle cx="196" cy="140" r="3.2"/><circle cx="202" cy="152" r="2.4"/></g>`;

  // cheeks
  s += `<ellipse cx="74" cy="160" rx="16" ry="9.5" fill="#ff8aa0" opacity=".55"/><ellipse cx="186" cy="160" rx="16" ry="9.5" fill="#ff8aa0" opacity=".55"/>`;

  // brows
  const brow = (d) => `<path d="${d}" fill="none" stroke="${P.goldDeep}" stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${P.gold}" stroke-width="6" stroke-linecap="round"/>`;
  s += grp('brows-normal', mood, brow('M84 93 Q100 85 114 91') + brow('M146 91 Q160 85 176 93'));
  s += grp('brows-up', mood, brow('M82 84 Q100 72 116 80') + brow('M144 80 Q160 72 178 84'));
  s += grp('brows-sad', mood, brow('M84 96 Q100 94 114 84') + brow('M146 84 Q160 94 176 96'));

  // open eyes (white + moving pupil + fixed highlights)
  let eyes = '';
  EYES.forEach((e, i) => {
    eyes += `<g class="d-eye">`
      + `<ellipse cx="${e.x}" cy="${e.y}" rx="24" ry="27" fill="url(#${p}e)" stroke="#4a0e10" stroke-width="3.5"/>`
      + `<g class="d-pupil" data-i="${i}"><circle cx="${e.x}" cy="${e.y + 3}" r="15.5" fill="url(#${p}i)"/><circle cx="${e.x}" cy="${e.y + 3}" r="8" fill="#120403"/></g>`
      + `<circle cx="${e.x - 7}" cy="${e.y - 8}" r="6.5" fill="#fff"/><circle cx="${e.x + 7}" cy="${e.y + 9}" r="3" fill="#fff" opacity=".9"/>`
      + `</g>`;
  });
  s += grp('eyes-open', mood, eyes);
  s += grp('eyes-happy', mood, `<path d="M80 130 Q100 106 120 130 M140 130 Q160 106 180 130" fill="none" stroke="#4a0e10" stroke-width="7" stroke-linecap="round"/>`);

  // muzzle
  s += `<ellipse cx="130" cy="176" rx="56" ry="32" fill="url(#${p}m)" stroke="${OUT}" stroke-width="3.5"/>`
    + `<ellipse cx="112" cy="164" rx="5.5" ry="3.8" fill="#8a2a1e"/><ellipse cx="148" cy="164" rx="5.5" ry="3.8" fill="#8a2a1e"/>`
    + `<ellipse cx="116" cy="155" rx="14" ry="4.5" fill="#fff" opacity=".6"/>`;

  // mouths
  s += grp('mouth-smile', mood, `<path d="M110 182 Q120 193 130 185 Q140 193 150 182" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
  s += grp('mouth-open', mood, `<path d="M106 180 Q130 212 154 180 Q130 188 106 180 Z" fill="#8a1a22" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/><path d="M119 194 Q130 205 141 194 Q130 189 119 194 Z" fill="#ff7a8a"/>`);
  s += grp('mouth-o', mood, `<ellipse cx="130" cy="189" rx="9" ry="11" fill="#8a1a22" stroke="${OUT}" stroke-width="3.5"/>`);
  s += grp('mouth-cheer', mood, `<path d="M100 176 Q130 222 160 176 Q130 186 100 176 Z" fill="#8a1a22" stroke="${OUT}" stroke-width="3.5" stroke-linejoin="round"/><path d="M116 199 Q130 213 144 199 Q130 192 116 199 Z" fill="#ff7a8a"/><path d="M110 180 l4 8 l4 -7 Z M142 181 l4 7 l4 -8 Z" fill="#fff"/>`);
  s += grp('mouth-sad', mood, `<path d="M114 192 Q130 180 146 192" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`);

  // extras
  s += grp('tear', mood, `<path d="M186 140 C180 150 180 158 186 160 C192 158 192 150 186 140 Z" fill="#a9d8ff" stroke="#5a8fc4" stroke-width="1.8"/><circle cx="184" cy="153" r="1.6" fill="#fff"/>`);
  const sp = (x, y, r) => `<path d="M${x} ${y - r} Q${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z" fill="${P.goldHi}" stroke="${P.goldDark}" stroke-width="1.5"/>`;
  s += grp('sparkles', mood, sp(26, 56, 13) + sp(236, 52, 15) + sp(240, 196, 10) + sp(18, 190, 9));
  return s;
}

export function dragonHeadSVG(mood = 'neutral', cls = '') {
  return `<svg class="dragon-svg ${cls}" viewBox="0 0 ${HEAD_W} ${HEAD_H}" aria-hidden="true">${dragonHeadMarkup(mood)}</svg>`;
}
export const dragonHeadDoc = (mood) => svgDoc(0, 0, HEAD_W, HEAD_H, dragonHeadMarkup(mood), `width="${HEAD_W * 2}" height="${HEAD_H * 2}"`);

/* ---------- Paws gripping the board frame ---------- */
export function pawsMarkup() {
  const OUT = '#6e1216';
  const paw = (x) => `<g transform="translate(${x} 0)">`
    + `<path d="M-30 28 C-30 10 -16 2 0 2 C16 2 30 10 30 28 C30 36 22 40 0 40 C-22 40 -30 36 -30 28 Z" fill="${P.cinnabar}" stroke="${OUT}" stroke-width="3.5"/>`
    + `<path d="M-10 30 V38 M10 30 V38" stroke="${OUT}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M-24 37 l3 12 l5 -11 Z M-5 39 l5 12 l5 -12 Z M16 38 l5 11 l3 -12 Z" fill="#fff6dc" stroke="${P.goldDark}" stroke-width="2" stroke-linejoin="round"/>`
    + `<ellipse cx="-10" cy="13" rx="12" ry="5" fill="#fff" opacity=".28"/></g>`;
  return paw(40) + paw(160);
}
export const pawsSVG = () => `<svg class="dragon-paws-svg" viewBox="0 0 200 54" aria-hidden="true">${pawsMarkup()}</svg>`;

/* ---------- Serpentine body for the title screen ---------- */
/** Catmull-Rom through points → sampled polyline (for spines & bands). */
function sampleSpline(pts, perSeg = 24) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/**
 * Title-screen body: a long coil that rises from behind the logo's right
 * side, sweeps under the clouds and ends in a golden tail tuft on the left.
 * Coordinates are in the 1300 × 560 title-group space.
 */
export function dragonBodyMarkup() {
  const p = uid('db');
  const OUT = '#6e1216';
  const pts = [[1150, 150], [1215, 250], [1190, 380], [1040, 470], [800, 500], [560, 492], [330, 470], [170, 410], [92, 318], [118, 236], [196, 222]];
  const S = sampleSpline(pts);
  const d = S.map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join(' ');
  // tapering: draw the tail end in a few thinner passes
  const n = S.length;
  const seg = (a, b) => S.slice(a, b + 1).map(([x, y], i) => `${i ? 'L' : 'M'}${n2(x)} ${n2(y)}`).join(' ');
  const cut1 = Math.floor(n * 0.7), cut2 = Math.floor(n * 0.86);
  let s = `<defs><linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a5c"/><stop offset=".6" stop-color="${P.cinnabar}"/><stop offset="1" stop-color="${P.lacquer}"/></linearGradient>
    <radialGradient id="${p}g" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="#fff2b0"/><stop offset=".55" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldMid}"/></radialGradient></defs>`;

  // dorsal spines along the outer side of the curve
  let spines = '';
  for (let i = 6; i < n - 6; i += 9) {
    const [x0, y0] = S[i - 1], [x1, y1] = S[i + 1];
    const tx = x1 - x0, ty = y1 - y0, len = Math.hypot(tx, ty) || 1;
    const nx = ty / len, ny = -tx / len; // left normal
    const w = i < cut1 ? 1 : i < cut2 ? 0.75 : 0.55;
    const bx = S[i][0] + nx * 26 * w, by = S[i][1] + ny * 26 * w;
    const ang = Math.atan2(ny, nx) * 180 / Math.PI + 90;
    spines += `<path d="M-11 4 C-9 -10 -3 -20 4 -26 C4 -14 9 -6 11 4 Z" transform="translate(${n2(bx)} ${n2(by)}) rotate(${n2(ang)}) scale(${w})" fill="url(#${p}g)" stroke="${P.goldDark}" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
  s += spines;
  const body = (path, wOut, wIn, wBelly) => `<path d="${path}" fill="none" stroke="${OUT}" stroke-width="${wOut}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${path}" fill="none" stroke="url(#${p}b)" stroke-width="${wIn}" stroke-linecap="round" stroke-linejoin="round"/>`
    + `<path d="${path}" fill="none" stroke="#ffe0a0" stroke-width="${wBelly}" stroke-linecap="butt" stroke-dasharray="13 4" stroke-linejoin="round" opacity=".95"/>`;
  s += body(seg(cut2 - 1, n - 1), 34, 28, 10) + body(seg(cut1 - 1, cut2), 46, 39, 15) + body(seg(0, cut1), 60, 52, 20);
  // sheen
  s += `<path d="${seg(0, cut1)}" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".18" transform="translate(-6 -12)"/>`;
  // tail tuft
  const [tx, ty] = S[n - 1];
  s += `<g transform="translate(${n2(tx)} ${n2(ty)})">`
    + `<g fill="url(#${p}g)" stroke="${P.goldDark}" stroke-width="2.5"><circle cx="18" cy="-6" r="16"/><circle cx="30" cy="10" r="14"/><circle cx="8" cy="12" r="13"/><circle cx="32" cy="-18" r="11"/></g>`
    + `<path d="${spiralPath(20, 2, 8, 1.2, 0, 1)}" fill="none" stroke="#fff3c0" stroke-width="2.4" stroke-linecap="round"/></g>`;
  // little legs with claws
  const leg = (i, flip) => {
    const [x, y] = S[i];
    return `<g transform="translate(${n2(x)} ${n2(y + 26)}) scale(${flip ? -1 : 1} 1)">`
      + `<path d="M-14 -8 C-14 10 -6 20 8 22 C18 22 20 14 14 8 C8 2 6 -4 6 -10 Z" fill="${P.cinnabar}" stroke="${OUT}" stroke-width="3"/>`
      + `<path d="M2 22 l2 9 l4 -8 Z M10 21 l4 8 l2 -9 Z" fill="#fff6dc" stroke="${P.goldDark}" stroke-width="1.6" stroke-linejoin="round"/></g>`;
  };
  s += leg(Math.floor(n * 0.38), false) + leg(Math.floor(n * 0.62), true);
  return s;
}
export const TITLE_W = 1300, TITLE_H = 560;

/* ==========================================================
   Live controller
   ----------------------------------------------------------
   • The pointer is only *recorded* in the event handler; pupils are
     moved inside the shared rAF loop, via transform only.
   • Each dragon's on-screen rect is cached and re-read only when
     invalidated (resize, screen change, modal) — never per frame.
   • Once the pupils settle near their target the task goes idle.
   ========================================================== */
const instances = new Set();
const pointer = { x: -1, y: -1, active: false };
let rectVersion = 1;

/** Call when layout may have moved the dragons (resize, screen/modal change). */
export function invalidateDragons() { rectVersion++; wake(); }

if (typeof window !== 'undefined') {
  window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; wake(); }, { passive: true });
  document.addEventListener('pointerleave', () => { pointer.active = false; wake(); });
}

const REACTIONS = {
  hop: { dur: 620, frames: [
    { transform: 'translateY(0)', easing: 'cubic-bezier(.2,.8,.2,1)' },
    { transform: 'translateY(-26px) rotate(-3deg)', offset: 0.35, easing: 'cubic-bezier(.2,.8,.2,1)' },
    { transform: 'translateY(0) scale(1.04, .96)', offset: 0.6, easing: 'cubic-bezier(.2,.8,.2,1)' },
    { transform: 'translateY(-8px)', offset: 0.8, easing: 'cubic-bezier(.2,.8,.2,1)' },
    { transform: 'translateY(0)' }] },
  jolt: { dur: 400, frames: [
    { transform: 'translateY(0)', easing: 'ease-out' },
    { transform: 'translateY(-10px) scale(1.04)', offset: 0.3, easing: 'ease-out' },
    { transform: 'translateY(0)' }] },
  nod: { dur: 450, frames: [
    { transform: 'rotate(0)', easing: 'ease-out' },
    { transform: 'rotate(-4deg) translateY(-4px)', offset: 0.4, easing: 'ease-out' },
    { transform: 'rotate(0)' }] },
};

export class Dragon {
  constructor(host, { mood = 'neutral' } = {}) {
    this.host = host;
    host.classList.add('dragon');
    host.innerHTML = `<div class="dragon-bob">${dragonHeadSVG(mood)}</div>`;
    this.svg = host.querySelector('svg');
    this.pupils = Array.from(host.querySelectorAll('.d-pupil'));
    this.cur = EYES.map(() => ({ x: 0, y: 0 }));
    this.rect = { left: 0, top: 0, width: 0 };
    this.ver = 0;
    this.visible = false;
    this.inModal = !!host.closest('.modal');
    this.base = 'neutral';
    this.active = true;
    this.setMood(mood);
    this.scheduleBlink();
    instances.add(this);
    ensureTask();
  }

  /** Show a mood; with ms it reverts to the base mood afterwards. */
  setMood(mood, ms = 0) {
    clearTimeout(this.moodTimer);
    this.mood = mood;
    this.host.dataset.mood = mood;
    if (ms) this.moodTimer = setTimeout(() => this.setMood(this.base), ms);
    wake(); // pupil target changes for 'sad'
  }
  setBase(mood) { this.base = mood; this.setMood(mood); }

  /** A short reaction with a matching body animation (WAAPI — no forced reflow). */
  react(mood, ms = 900) {
    this.setMood(mood, ms);
    const r = REACTIONS[mood === 'cheer' ? 'hop' : mood === 'surprised' ? 'jolt' : mood === 'happy' ? 'nod' : ''];
    if (!r) return;
    if (this.reaction) this.reaction.cancel();
    this.reaction = this.host.animate(r.frames, { duration: r.dur });
  }

  scheduleBlink() {
    clearTimeout(this.blinkTimer);
    this.blinkTimer = setTimeout(() => {
      if (this.active && this.visible && this.mood !== 'happy' && this.mood !== 'cheer') {
        this.host.classList.add('blink');
        setTimeout(() => this.host.classList.remove('blink'), 150);
        if (Math.random() < 0.2) setTimeout(() => { this.host.classList.add('blink'); setTimeout(() => this.host.classList.remove('blink'), 130); }, 320);
      }
      this.scheduleBlink();
    }, 2200 + Math.random() * 3800);
  }

  /** Layout read — only runs after an invalidation, never every frame. */
  readRect() {
    const r = this.svg.getBoundingClientRect();
    this.rect.left = r.left; this.rect.top = r.top; this.rect.width = r.width;
    this.visible = r.width > 0 && !this.host.closest('.screen:not(.active)');
    this.ver = rectVersion;
  }

  /** Returns true while the pupils are still travelling. */
  update(dt) {
    if (!this.active || !this.visible) return false;
    // freeze dragons behind an open modal
    if (!this.inModal && document.body.classList.contains('has-modal')) return false;
    const rect = this.rect;
    const k = rect.width / HEAD_W;
    const ease = 1 - Math.pow(0.86, dt * 60);
    let moving = false;
    for (let i = 0; i < EYES.length; i++) {
      const e = EYES[i];
      let tx = 0, ty = 0;
      if (this.mood === 'sad') { ty = PUPIL_RANGE.y * 0.8; }
      else if (pointer.active) {
        const dx = pointer.x - (rect.left + e.x * k), dy = pointer.y - (rect.top + (e.y + 3) * k);
        const dist = Math.hypot(dx, dy) || 1;
        const reach = clamp(dist / (220 * k + 60), 0, 1);
        tx = (dx / dist) * PUPIL_RANGE.x * reach;
        ty = (dy / dist) * PUPIL_RANGE.y * reach;
        const q = (tx / PUPIL_RANGE.x) ** 2 + (ty / PUPIL_RANGE.y) ** 2; // clamp inside the eye
        if (q > 1) { const f = 1 / Math.sqrt(q); tx *= f; ty *= f; }
      }
      const c = this.cur[i];
      const ex = tx - c.x, ey = ty - c.y;
      if (Math.abs(ex) < 0.02 && Math.abs(ey) < 0.02) continue; // settled
      c.x += ex * ease;
      c.y += ey * ease;
      this.pupils[i].setAttribute('transform', `translate(${n2(c.x)} ${n2(c.y)})`);
      moving = true;
    }
    return moving;
  }
}

let taskAdded = false;
function ensureTask() {
  if (taskAdded) return;
  taskAdded = true;
  addTask((dt) => {
    // all layout reads first, then all writes (no thrashing)
    for (const d of instances) if (d.ver !== rectVersion) d.readRect();
    let busy = false;
    for (const d of instances) if (d.update(dt)) busy = true;
    return busy;
  });
}
