/* ==========================================================
   raster.js — turn vector art into cached bitmaps
   ----------------------------------------------------------
   SVG is perfect for authoring and export, but re-rasterising
   dozens of complex SVGs on every repaint or resize is what
   makes low-end GPUs struggle.  These helpers render an SVG
   string once into a canvas or a PNG blob URL.
   ========================================================== */

let stageScale = 1;
export const setStageScale = (s) => { stageScale = s; };
export const getStageScale = () => stageScale;
export const dpr = () => Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
/** Device pixels per design pixel for art drawn on the stage. */
export const stageRes = () => stageScale * dpr();

const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';
/** Give an SVG string a root xmlns and explicit pixel size for rasterising. */
function sized(svg, w, h) {
  const m = /<svg\b[^>]*>/.exec(svg);
  let tag = m[0].replace(/\s(width|height)="[^"]*"/g, '');
  if (!/xmlns=/.test(tag)) tag = tag.replace('<svg', `<svg ${XMLNS} xmlns:xlink="http://www.w3.org/1999/xlink"`);
  tag = tag.replace('<svg', `<svg width="${w}" height="${h}"`);
  return svg.replace(m[0], tag);
}

function loadSVG(svg, w, h) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([sized(svg, w, h)], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

/** Draw an SVG string into a canvas of w × h device pixels (creates one if needed). */
export async function svgToCanvas(svg, w, h, canvas = document.createElement('canvas')) {
  w = Math.max(1, Math.round(w));
  h = Math.max(1, Math.round(h));
  const img = await loadSVG(svg, w, h);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/** Canvas → PNG blob URL. */
export function canvasToURL(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b ? URL.createObjectURL(b) : canvas.toDataURL()), 'image/png');
  });
}

/** SVG string → PNG blob URL at w × h device pixels. */
export async function svgToURL(svg, w, h) {
  return canvasToURL(await svgToCanvas(svg, w, h));
}

/** Run jobs in idle time, a few at a time, so rasterising never causes a hitch. */
export function idleQueue(jobs) {
  const ric = window.requestIdleCallback || ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 16));
  return new Promise((resolve) => {
    let i = 0;
    const run = async (deadline) => {
      while (i < jobs.length && deadline.timeRemaining() > 4) {
        try { await jobs[i++](); } catch (e) { /* keep the vector version */ }
      }
      if (i < jobs.length) ric(run); else resolve();
    };
    ric(run);
  });
}

/** Debounced resize hook shared by everything that re-renders bitmaps. */
const resizeFns = [];
let resizeTimer = 0;
export function onResizeSettled(fn) { resizeFns.push(fn); }
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => resizeFns.forEach((fn) => fn()), 250);
  });
}
