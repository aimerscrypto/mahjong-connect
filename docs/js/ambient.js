/* ==========================================================
   ambient.js — very slow decorative motion at 8 Hz
   ----------------------------------------------------------
   Cloud drift, branch sway and the title float move only ~1–3 px
   per second.  Driving them from a 60 fps CSS animation forces the
   GPU to recomposite huge layers every frame; stepping them 8 times
   a second moves them by a fraction of a pixel per step — visually
   identical, a fraction of the cost.  Same ease-in-out alternate
   curve as the CSS keyframes they replace.
   ========================================================== */
import { EASE } from './util.js';

const items = [];
let timer = 0;

/**
 * el: element to move.  dur: seconds per leg (CSS duration).  delay: CSS
 * animation-delay (negative = start part-way).  fn(v) → transform for v in [0, 1].
 * active(): optional — skip while false (e.g. screen hidden).
 */
export function ambient(el, dur, fn, { delay = 0, active = null } = {}) {
  if (!el) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.style.transform = fn(0); return; }
  const item = { el, dur, fn, delay, active, last: '' };
  items.push(item);
  apply(item, performance.now() / 1000);
  if (!timer) timer = setInterval(tick, 125);
}

function apply(it, t) {
  const p = (t - it.delay) / it.dur;
  const leg = Math.floor(p);
  let f = p - leg;
  if (leg % 2) f = 1 - f;            // alternate
  const tf = it.fn(EASE.inOut(f));
  if (tf !== it.last) { it.el.style.transform = tf; it.last = tf; }
}

function tick() {
  if (document.hidden) return;
  const t = performance.now() / 1000;
  for (const it of items) if (!it.active || it.active()) apply(it, t);
}

