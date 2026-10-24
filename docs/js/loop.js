/* ==========================================================
   loop.js — ONE shared requestAnimationFrame loop
   ----------------------------------------------------------
   Every per-frame job (game timer, dragon eyes, canvas FX,
   parallax) is a task.  A task returns true while it still needs
   frames; when every task returns false the loop goes idle and
   costs nothing until something calls wake().  The loop also
   stops while the tab is hidden.

   Also home of the adaptive quality tier (high / low).
   ========================================================== */
const tasks = [];
let raf = 0, last = 0;

/** Register a per-frame task fn(dt, now) → true (needs more frames), false (idle) or -1 (remove me). */
export function addTask(fn) {
  tasks.push(fn);
  wake();
  return () => { const i = tasks.indexOf(fn); if (i >= 0) tasks.splice(i, 1); };
}

/** Ask for frames again (cheap to call often). */
export function wake() {
  if (raf || (typeof document !== 'undefined' && document.hidden)) return;
  raf = requestAnimationFrame(frame);
}

function frame(now) {
  raf = 0;
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
  last = now;
  let keep = false;
  for (let i = 0; i < tasks.length; i++) {
    const r = tasks[i](dt, now);
    if (r === -1) { tasks.splice(i, 1); i--; } else if (r) keep = true;
  }
  if (keep && !document.hidden) raf = requestAnimationFrame(frame);
  else last = 0;
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  } else {
    wake();
  }
});

/* ---------- Adaptive quality ----------
   'low' = fewer particles, no petals, lower-resolution FX canvas.
   Tiles, UI and art are identical in both tiers. */
const qualityListeners = [];
export const quality = {
  tier: 'high',
  forced: false,
  set(tier, forced = false) {
    if (forced) this.forced = true;
    if (tier === this.tier) return;
    this.tier = tier;
    if (typeof document !== 'undefined') document.documentElement.classList.toggle('q-low', tier === 'low');
    qualityListeners.forEach((fn) => fn(tier));
  },
  onChange(fn) { qualityListeners.push(fn); },
  get low() { return this.tier === 'low'; },
};

/** Measure the average frame rate over `ms` of real frames. */
export function measureFPS(ms = 2000) {
  return new Promise((resolve) => {
    let start = 0, frames = 0;
    addTask((dt, now) => {
      if (!start) { start = now; return true; }
      frames++;
      if (now - start >= ms) { resolve((frames * 1000) / (now - start)); return -1; }
      return true;
    });
  });
}
