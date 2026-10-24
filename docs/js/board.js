/* ==========================================================
   board.js — board model, gravity, dealing & solvability
   ----------------------------------------------------------
   The play area is 14 × 10.  For pathfinding it is embedded in a
   16 × 12 "padded" grid whose outer ring is always empty, so match
   lines can travel around the outside of the board.
   This module is DOM-free: it is also used by the solver.
   ========================================================== */
import { findPath, reachable } from './pathfinding.js';
import { tileKey, BASIC_COUNT } from './tiles.js';
import { shuffleInPlace } from './util.js';

export const COLS = 14, ROWS = 10;
export const W = COLS + 2, H = ROWS + 2;
export const N = COLS * ROWS;

/** board index (c,r) → padded grid index */
export const toPad = (c, r) => (r + 1) * W + (c + 1);
/** padded grid index → {c, r} in board coordinates (may be -1 or COLS/ROWS on the ring) */
export const fromPad = (i) => ({ c: (i % W) - 1, r: Math.floor(i / W) - 1 });
const bIndex = (c, r) => r * COLS + c;

/* ---------- Gravity ----------
   Each mode is a set of "lines"; every line lists board indices
   starting at the sink.  Compacting a line slides its tiles toward
   the sink while preserving their order. */
export const GRAVITY = {
  none:    { label: 'No gravity',              icon: 'gravNone' },
  down:    { label: 'Tiles fall down',         icon: 'gravDown' },
  up:      { label: 'Tiles float up',          icon: 'gravUp' },
  left:    { label: 'Tiles slide left',        icon: 'gravLeft' },
  right:   { label: 'Tiles slide right',       icon: 'gravRight' },
  centerH: { label: 'Tiles gather to center',  icon: 'gravCenterH' },
  centerV: { label: 'Tiles gather to middle',  icon: 'gravCenterV' },
  splitH:  { label: 'Tiles drift apart',       icon: 'gravSplitH' },
};

const range = (a, b) => {
  const out = [];
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
};
const lineCache = new Map();
function gravityLines(mode) {
  if (lineCache.has(mode)) return lineCache.get(mode);
  const L = [];
  const col = (c, rs) => rs.map((r) => bIndex(c, r));
  const row = (r, cs) => cs.map((c) => bIndex(c, r));
  const hc = COLS / 2, hr = ROWS / 2;
  switch (mode) {
    case 'down': for (let c = 0; c < COLS; c++) L.push(col(c, range(ROWS - 1, 0))); break;
    case 'up': for (let c = 0; c < COLS; c++) L.push(col(c, range(0, ROWS - 1))); break;
    case 'left': for (let r = 0; r < ROWS; r++) L.push(row(r, range(0, COLS - 1))); break;
    case 'right': for (let r = 0; r < ROWS; r++) L.push(row(r, range(COLS - 1, 0))); break;
    case 'centerH':
      for (let r = 0; r < ROWS; r++) { L.push(row(r, range(hc - 1, 0))); L.push(row(r, range(hc, COLS - 1))); }
      break;
    case 'centerV':
      for (let c = 0; c < COLS; c++) { L.push(col(c, range(hr - 1, 0))); L.push(col(c, range(hr, ROWS - 1))); }
      break;
    case 'splitH':
      for (let r = 0; r < ROWS; r++) { L.push(row(r, range(0, hc - 1))); L.push(row(r, range(COLS - 1, hc))); }
      break;
    default: break;
  }
  lineCache.set(mode, L);
  return L;
}

/** Slide non-empty slots toward each line's sink (works on tiles or keys). */
export function compact(slots, mode) {
  if (mode === 'none') return;
  for (const line of gravityLines(mode)) {
    let k = 0;
    for (const i of line) if (slots[i] != null) slots[line[k++]] = slots[i];
    for (; k < line.length; k++) slots[line[k]] = null;
  }
}

/* ---------- Solver helpers on plain key arrays ---------- */
function fillGrid(grid, slots, keyOf) {
  grid.fill(-1);
  for (let i = 0; i < N; i++) {
    const v = slots[i];
    if (v != null) grid[toPad(i % COLS, (i / COLS) | 0)] = keyOf(v);
  }
}
const isExposed = (grid, p) => grid[p - 1] === -1 || grid[p + 1] === -1 || grid[p - W] === -1 || grid[p + W] === -1;

/**
 * Find a random valid move.  Returns [i, j] board indices or null.
 * Only "exposed" tiles (an empty neighbour) can ever start a path.
 */
function randomMove(grid, slots, keyOf, rng) {
  const order = [];
  for (let i = 0; i < N; i++) if (slots[i] != null) order.push(i);
  shuffleInPlace(order, rng);
  for (const i of order) {
    const p = toPad(i % COLS, (i / COLS) | 0);
    if (!isExposed(grid, p)) continue;
    const k = keyOf(slots[i]);
    const hits = reachable(grid, W, H, p);
    for (const h of hits) {
      if (grid[h] !== k) continue;
      const { c, r } = fromPad(h);
      return [i, bIndex(c, r)];
    }
  }
  return null;
}

const asKey = (v) => v;
/** Greedy randomised play-out.  True means a full clear was found (deal is solvable). */
function greedySolve(keys, gravity, rng) {
  const slots = keys.slice();
  const grid = new Int16Array(W * H);
  let left = slots.reduce((n, v) => n + (v != null ? 1 : 0), 0);
  while (left > 0) {
    fillGrid(grid, slots, asKey);
    const mv = randomMove(grid, slots, asKey, rng);
    if (!mv) return false;
    slots[mv[0]] = slots[mv[1]] = null;
    left -= 2;
    compact(slots, gravity);
  }
  return true;
}
export function isSolvable(keys, gravity, rng, attempts = 3) {
  for (let a = 0; a < attempts; a++) if (greedySolve(keys, gravity, rng)) return true;
  return false;
}

/* ---------- Dealing ----------
   70 pairs: 33 of the 34 classic faces appear as two pairs each
   (one face is rested per deal), plus two Season pairs and two
   Flower pairs so all eight bonus tiles are on the board. */
function makeTypes(rng) {
  const basic = shuffleInPlace(Array.from({ length: BASIC_COUNT }, (_, i) => i), rng);
  const rested = basic[0];
  const types = [];
  for (let t = 0; t < BASIC_COUNT; t++) if (t !== rested) types.push(t, t, t, t);
  types.push(34, 35, 36, 37, 38, 39, 40, 41);
  return shuffleInPlace(types, rng);
}

/** Produce 140 tile types in board order, verified solvable by an actual play-out. */
export function dealTypes(rng, gravity) {
  let last = null;
  for (let attempt = 0; attempt < 30; attempt++) {
    const types = makeTypes(rng);
    if (isSolvable(types.map(tileKey), gravity, rng, 4)) return types;
    last = types;
  }
  return last; // extremely rare; the no-moves auto-shuffle still keeps play going
}

/* ==========================================================
   Board — live game state
   ========================================================== */
let nextId = 1;
export class Board {
  constructor() {
    this.slots = new Array(N).fill(null);   // board index → tile
    this.grid = new Int16Array(W * H).fill(-1);
    this.count = 0;
  }

  /** Fill the board from a list of 140 types. */
  load(types) {
    this.slots.fill(null);
    types.forEach((type, i) => {
      this.slots[i] = { id: nextId++, type, key: tileKey(type), c: i % COLS, r: (i / COLS) | 0, el: null };
    });
    this.count = types.length;
    this.sync();
  }

  /** Rebuild the padded key grid and each tile's (c, r) from slots. */
  sync() {
    this.grid.fill(-1);
    for (let i = 0; i < N; i++) {
      const t = this.slots[i];
      if (!t) continue;
      t.c = i % COLS; t.r = (i / COLS) | 0;
      this.grid[toPad(t.c, t.r)] = t.key;
    }
  }

  tiles() { return this.slots.filter(Boolean); }

  /** Corner points (padded indices) of a connecting path, or null. */
  path(a, b) {
    if (!a || !b || a === b || a.key !== b.key) return null;
    return findPath(this.grid, W, H, toPad(a.c, a.r), toPad(b.c, b.r));
  }

  remove(t) {
    const i = bIndex(t.c, t.r);
    if (this.slots[i] === t) { this.slots[i] = null; this.count--; }
    this.grid[toPad(t.c, t.r)] = -1;
  }

  /** Apply gravity; returns the tiles whose position changed. */
  applyGravity(mode) {
    if (mode === 'none') return [];
    const before = new Map(this.tiles().map((t) => [t, t.c + t.r * COLS]));
    compact(this.slots, mode);
    this.sync();
    return this.tiles().filter((t) => before.get(t) !== t.c + t.r * COLS);
  }

  /** A random valid move as [tileA, tileB], or null. */
  findMove(rng = Math.random) {
    const mv = randomMove(this.grid, this.slots, (t) => t.key, rng);
    return mv ? [this.slots[mv[0]], this.slots[mv[1]]] : null;
  }

  /**
   * Re-deal the remaining tiles over the same occupied cells.
   * Tries for a solvable arrangement first, then settles for one with a move.
   */
  shuffle(gravity, rng = Math.random) {
    const cells = [];
    const tiles = [];
    for (let i = 0; i < N; i++) if (this.slots[i]) { cells.push(i); tiles.push(this.slots[i]); }
    if (tiles.length < 2) return;
    let fallback = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      shuffleInPlace(tiles, rng);
      const keys = new Array(N).fill(null);
      cells.forEach((cell, k) => { keys[cell] = tiles[k].key; });
      const solvable = attempt < 25 ? isSolvable(keys, gravity, rng, 2) : false;
      if (solvable) { fallback = tiles.slice(); break; }
      if (!fallback) {
        const g = new Int16Array(W * H);
        fillGrid(g, keys, asKey);
        if (randomMove(g, keys, asKey, rng)) fallback = tiles.slice();
      }
    }
    const order = fallback || tiles;
    this.slots.fill(null);
    cells.forEach((cell, k) => { this.slots[cell] = order[k]; });
    this.sync();
  }

  /** Pick up to n random same-key pairs (used by the Firecracker). */
  randomPairs(n, rng = Math.random) {
    const groups = new Map();
    for (const t of shuffleInPlace(this.tiles(), rng)) {
      if (!groups.has(t.key)) groups.set(t.key, []);
      groups.get(t.key).push(t);
    }
    const pairs = [];
    for (const list of shuffleInPlace([...groups.values()], rng)) {
      while (list.length >= 2 && pairs.length < n) pairs.push([list.pop(), list.pop()]);
      if (pairs.length >= n) break;
    }
    return pairs;
  }
}
