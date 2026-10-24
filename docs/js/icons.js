/* ==========================================================
   icons.js — one consistent icon family
   48 × 48 grid, chunky round strokes (5 units) + filled shapes,
   cream glyph with a soft dark drop under it.
   Each icon: list of [kind, d] where kind 'f' = filled, 's' = stroke.
   ========================================================== */
import { svgDoc } from './util.js';

const star = 'M24 5 L29.4 16.6 L42 18 L32.6 26.6 L35.2 39.2 L24 32.8 L12.8 39.2 L15.4 26.6 L6 18 L18.6 16.6 Z';
const arrowDown = [['s', 'M24 7 V30'], ['f', 'M13 27 L24 40 L35 27 Z']];

export const ICONS = {
  pause: [['f', 'M13 10 H20 V38 H13 Z M28 10 H35 V38 H28 Z']],
  play: [['f', 'M16 9 L39 24 L16 39 Z']],
  sound: [['f', 'M7 18 H15 L25 9 V39 L15 30 H7 Z'], ['s', 'M32 17 Q36 24 32 31 M38 12 Q45 24 38 36']],
  soundOff: [['f', 'M7 18 H15 L25 9 V39 L15 30 H7 Z'], ['s', 'M32 18 L42 30 M42 18 L32 30']],
  music: [['s', 'M25 34 V11 L42 7 V30'], ['f', 'M13 34 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0 M30 30 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0']],
  musicOff: [['s', 'M25 34 V11 L42 7 V30'], ['f', 'M13 34 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0 M30 30 a6 5 0 1 0 12 0 a6 5 0 1 0 -12 0'], ['s', 'M7 7 L41 41']],
  help: [['s', 'M17 17 Q17 9 24 9 Q32 9 32 17 Q32 22 24 25 V29'], ['f', 'M20.6 38 a3.4 3.4 0 1 0 6.8 0 a3.4 3.4 0 1 0 -6.8 0']],
  home: [['f', 'M7 24 L24 9 L41 24 H36 V39 H28.5 V30 H19.5 V39 H12 V24 Z']],
  restart: [['s', 'M36 30 A13 13 0 1 1 33 15'], ['f', 'M27 8 L39 11 L33 21 Z']],
  hint: [['f', 'M24 6 C14.5 6 9 13 9 20 C9 27 15 30 17 35 H31 C33 30 39 27 39 20 C39 13 33.5 6 24 6 Z'], ['s', 'M18 41.5 H30']],
  shuffle: [['s', 'M7 16 H15 C25 16 23 32 33 32 H36 M7 32 H15 C19 32 20.5 29.5 22.5 26.5 M26 21 C28 18 30 16 33 16 H36'], ['f', 'M34 9.5 L42 16 L34 22.5 Z M34 25.5 L42 32 L34 38.5 Z']],
  firecracker: [['f', 'M11 20 H27 V43 H11 Z'], ['s', 'M19 20 Q19 12 27 9'], ['f', 'M35 2 L37 7 L42 8 L37.5 10.5 L37 16 L33.5 12 L28.5 12.5 L31.5 8.5 L30 4 L34 6 Z']],
  star: [['f', star]],
  timer: [['s', 'M12 6.5 H36 M12 41.5 H36'], ['f', 'M15 9 H33 C33 18 26 21 26 24 C26 27 33 30 33 39 H15 C15 30 22 27 22 24 C22 21 15 18 15 9 Z']],
  close: [['s', 'M14 14 L34 34 M34 14 L14 34']],
  next: [['f', 'M8 18 H25 V9 L41 24 L25 39 V30 H8 Z']],
  calendar: [['s', 'M9 15 H39 V40 H9 Z M16 7 V14 M32 7 V14'], ['f', 'M9 15 H39 V22 H9 Z M17 27 h5 v5 h-5 z M26 27 h5 v5 h-5 z']],
  lotus: [['f', 'M24 9 C30.5 17 30.5 29 24 36 C17.5 29 17.5 17 24 9 Z M9 19 C17 21 21.5 29 21.5 36 C13.5 36 7.5 30 9 19 Z M39 19 C31 21 26.5 29 26.5 36 C34.5 36 40.5 30 39 19 Z'], ['s', 'M8 41.5 H40']],
  trophy: [['f', 'M14 7 H34 V18 C34 25 30 29 24 29 C18 29 14 25 14 18 Z M21 29 H27 V35 H21 Z M15 36 H33 V41 H15 Z'], ['s', 'M14 11 H8 V14 C8 19 11 21 15 21 M34 11 H40 V14 C40 19 37 21 33 21']],
  classic: [['f', 'M10 8 H31 Q35 8 35 12 V36 Q35 40 31 40 H10 Q6 40 6 36 V12 Q6 8 10 8 Z'], ['s', 'M38.5 13 V37 Q38.5 43 32.5 43 H14']],
  art: [['f', 'M24 6 C13 6 6 14 6 23 C6 33 14 41 23 41 C27 41 28 38 26.5 35.5 C25 33 26.5 30 30 30 H34 C39 30 42 26.5 42 21.5 C42 12.5 34 6 24 6 Z']],
  gravNone: [['f', 'M10 10 h11 v11 h-11 z M27 10 h11 v11 h-11 z M10 27 h11 v11 h-11 z M27 27 h11 v11 h-11 z']],
  gravDown: arrowDown,
  gravUp: arrowDown.map(([k, d]) => [k, d, 'rotate(180 24 24)']),
  gravLeft: arrowDown.map(([k, d]) => [k, d, 'rotate(90 24 24)']),
  gravRight: arrowDown.map(([k, d]) => [k, d, 'rotate(-90 24 24)']),
  gravCenterH: [['s', 'M5 24 H15 M33 24 H43'], ['f', 'M13 15 L22 24 L13 33 Z M35 15 L26 24 L35 33 Z']],
  gravCenterV: [['s', 'M24 5 V15 M24 33 V43'], ['f', 'M15 13 L24 22 L33 13 Z M15 35 L24 26 L33 35 Z']],
  gravSplitH: [['s', 'M17 24 H8 M31 24 H40'], ['f', 'M12 15 L3 24 L12 33 Z M36 15 L45 24 L36 33 Z']],
};

/** Inner SVG markup for an icon (48-unit space).
 *  Layers: soft drop → dark outline → cream glyph (same treatment as the lettering). */
export function iconMarkup(name, { color = '#fff6df', outline = '#4a0c0f', shade = 'rgba(61,8,10,.45)', sw = 5 } = {}) {
  const parts = ICONS[name] || [];
  const draw = (paint, grow, dy) => parts.map(([k, d, tr]) => {
    const t = tr ? ` transform="${tr}"` : '';
    const open = dy ? `<g transform="translate(0 ${dy})">` : '<g>';
    return k === 'f'
      ? `${open}<path d="${d}" fill="${paint}" stroke="${paint}" stroke-width="${sw * 0.7 + grow}" stroke-linejoin="round"${t}/></g>`
      : `${open}<path d="${d}" fill="none" stroke="${paint}" stroke-width="${sw + grow}" stroke-linecap="round" stroke-linejoin="round"${t}/></g>`;
  }).join('');
  return (shade ? draw(shade, 4, 3) : '') + (outline ? draw(outline, 4) : '') + draw(color, 0);
}

/** Inline <svg> element markup for use inside buttons and HUD. */
export function iconSVG(name, opts = {}) {
  const size = opts.size || 48;
  return `<svg class="icon" viewBox="-3 -3 54 56" width="${size}" height="${size}" aria-hidden="true">${iconMarkup(name, opts)}</svg>`;
}

/** Standalone icon document for export. */
export function iconDoc(name, opts = {}) {
  return svgDoc(-3, -3, 54, 56, iconMarkup(name, opts), 'width="108" height="112"');
}
