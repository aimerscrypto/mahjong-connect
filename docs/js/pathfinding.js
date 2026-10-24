/* ==========================================================
   pathfinding.js — the classic "connect" rule
   Two tiles match when a path of at most 3 straight segments
   (≤ 2 turns) joins them through empty cells.  The grid passed
   in is padded with an empty ring so paths may leave the board.

   Search: 0-1 BFS over states (cell, direction).  Going straight
   costs 0 turns (push front), turning costs 1 (push back), so
   states are expanded in order of turns used.
   ========================================================== */

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

/* Scratch buffers are reused between calls to keep GC quiet. */
let cap = 0, best, parent, dq;
function ensure(n) {
  if (n <= cap) return;
  cap = n;
  best = new Uint8Array(n * 4);
  parent = new Int32Array(n * 4);
  dq = new Int32Array(n * 4 * 8 + 16);
}

/**
 * Core search.  grid: Int16Array, -1 = empty.  Returns the state that
 * reached `target` (or -1).  When target < 0 it runs to exhaustion and
 * calls onHit(cellIndex) for every occupied cell it bumps into.
 */
function search(grid, w, h, a, target, maxTurns, onHit) {
  const n = w * h;
  ensure(n);
  best.fill(255, 0, n * 4);
  const half = n * 4 * 4 + 8;
  let head = half, tail = half;
  const ax = a % w, ay = (a / w) | 0;

  for (let d = 0; d < 4; d++) {
    const nx = ax + DX[d], ny = ay + DY[d];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const ni = ny * w + nx;
    if (ni === target) return -2; // adjacent: direct hit
    if (grid[ni] !== -1) { if (onHit) onHit(ni); continue; }
    const s = ni * 4 + d;
    best[s] = 0;
    parent[s] = -1;
    dq[tail++] = s;
  }

  while (head < tail) {
    const s = dq[head++];
    const cell = s >> 2, d = s & 3, t = best[s];
    const x = cell % w, y = (cell / w) | 0;
    for (let nd = 0; nd < 4; nd++) {
      if (nd === ((d + 2) & 3)) continue; // never reverse
      const nt = nd === d ? t : t + 1;
      if (nt > maxTurns) continue;
      const nx = x + DX[nd], ny = y + DY[nd];
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (ni === a) continue;
      if (ni === target) return s;
      if (grid[ni] !== -1) { if (onHit) onHit(ni); continue; }
      const ns = ni * 4 + nd;
      if (nt < best[ns]) {
        best[ns] = nt;
        parent[ns] = s;
        if (nd === d) dq[--head] = ns; else dq[tail++] = ns;
      }
    }
  }
  return -1;
}

/**
 * Find a connecting path between padded-grid cells a and b.
 * Returns the list of corner cells [a, ...turns, b] or null.
 */
export function findPath(grid, w, h, a, b, maxTurns = 2) {
  if (a === b) return null;
  const s = search(grid, w, h, a, b, maxTurns, null);
  if (s === -1) return null;
  if (s === -2) return [a, b];
  // Walk parents back to the start to recover every cell on the path.
  const cells = [b];
  let cur = s;
  while (cur !== -1) { cells.push(cur >> 2); cur = parent[cur]; }
  cells.push(a);
  cells.reverse();
  return toCorners(cells);
}

/** Reduce a cell-by-cell path to its corner points. */
export function toCorners(cells) {
  if (cells.length <= 2) return cells.slice();
  const out = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    if (cells[i] - cells[i - 1] !== cells[i + 1] - cells[i]) out.push(cells[i]);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

/** Every occupied cell reachable from a with ≤ maxTurns turns (candidate partners). */
export function reachable(grid, w, h, a, maxTurns = 2) {
  const hits = [];
  const seen = new Set();
  search(grid, w, h, a, -1, maxTurns, (ci) => {
    if (!seen.has(ci)) { seen.add(ci); hits.push(ci); }
  });
  return hits;
}
