/* ==========================================================
   game.js — game controller & board view
   ----------------------------------------------------------
   Owns the run state (mode, level, score, timer, combo, power-ups),
   renders tiles into the board, handles input and drives effects,
   sound, the dragon's reactions and the result modals.
   ========================================================== */
import { Board, COLS, ROWS, N, fromPad, dealTypes, GRAVITY } from './board.js';
import { TILE } from './tiles.js';
import { audio } from './audio.js';
import * as fx from './fx.js';
import { $, $$, fmt, pad2, mulberry32, hashString, todayKey, store, clamp, wait, mix, P } from './util.js';
import { openModal, closeModal, modalOpen, toast, transitionTo, starSVG } from './ui.js';
import { addTask, wake, measureFPS, quality } from './loop.js';
import { iconSVG } from './icons.js';

/* ---------- Tuning ---------- */
export const LEVEL_COUNT = 12;
const LEVELS = [
  { time: 300, gravity: 'none' },
  { time: 285, gravity: 'none' },
  { time: 270, gravity: 'down' },
  { time: 255, gravity: 'left' },
  { time: 245, gravity: 'up' },
  { time: 235, gravity: 'right' },
  { time: 225, gravity: 'centerH' },
  { time: 215, gravity: 'centerV' },
  { time: 205, gravity: 'down' },
  { time: 195, gravity: 'splitH' },
  { time: 185, gravity: 'left' },
  { time: 175, gravity: 'centerH' },
];
const DAILY_GRAVITY = ['none', 'down', 'left', 'centerH', 'up', 'right'];
const COMBO_WINDOW = 4500;      // ms between matches to keep a combo alive
const MATCH_TIME_BONUS = 3;     // seconds added per match
const POWER_START = { hint: 3, shuffle: 3, fire: 2 };

/* ---------- Board geometry (board-local pixels) ---------- */
const SX = TILE.stepX, SY = TILE.stepY;
export const BOARD_W = Math.round((COLS - 1) * SX + TILE.bodyW);   // 926
export const BOARD_H = Math.round((ROWS - 1) * SY + TILE.bodyH);   // 823

/* Board origin on the stage (frame 451,152 + 46 inset): FX canvas uses stage pixels. */
const BOARD_X = 497, BOARD_Y = 198;
const toStage = (p) => ({ x: p.x + BOARD_X, y: p.y + BOARD_Y });

const SHAKE = [
  { transform: 'translateX(0)', easing: 'ease-in-out' },
  { transform: 'translateX(-6px) rotate(-3deg)', offset: 0.2, easing: 'ease-in-out' },
  { transform: 'translateX(5px) rotate(2.5deg)', offset: 0.4, easing: 'ease-in-out' },
  { transform: 'translateX(-4px) rotate(-1.5deg)', offset: 0.6, easing: 'ease-in-out' },
  { transform: 'translateX(2px)', offset: 0.8, easing: 'ease-in-out' },
  { transform: 'translateX(0)' },
];
const BUMP = [
  { transform: 'scale(1)', easing: 'cubic-bezier(.34,1.56,.64,1)' },
  { transform: 'scale(1.35)', offset: 0.45, easing: 'cubic-bezier(.34,1.56,.64,1)' },
  { transform: 'scale(1)' },
];
let fpsChecked = false;

/** Centre of a cell; cells on the empty outer ring hug the board edge. */
function cellCenter(c, r) {
  const x = c < 0 ? -14 : c >= COLS ? BOARD_W + 12 : c * SX + TILE.faceW / 2;
  const y = r < 0 ? -14 : r >= ROWS ? BOARD_H + 12 : r * SY + TILE.faceH / 2;
  return { x, y };
}
const tileCenter = (t) => cellCenter(t.c, t.r);
const clock = (s) => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${pad2(s % 60)}`; };

export class Game {
  constructor({ dragon, dragonWon, dragonLost }) {
    this.dragon = dragon;
    this.dragonWon = dragonWon;
    this.dragonLost = dragonLost;
    this.board = new Board();
    this.tileMap = new Map();
    this.el = {
      screen: $('.screen-game'),
      tiles: $('#tiles'),
      fx: $('#fx-layer'),
      level: $('#hud-level'),
      score: $('#hud-score'),
      ribbon: $('#ribbon-text'),
      timerFill: $('#timer-fill'),
      timerText: $('#timer-text'),
      timerPanel: $('.hud-right'),
      pairs: $('#pairs-left'),
      pairsBar: $('#pairs-bar'),
      combo: $('#combo-value'),
      comboBar: $('#combo-bar'),
      gravIcon: $('#gravity-icon'),
      gravText: $('#gravity-text'),
      power: { hint: $('#pw-hint'), shuffle: $('#pw-shuffle'), fire: $('#pw-fire') },
    };
    this.running = false;
    this.paused = false;
    this.busy = false;
    this.displayScore = 0;
    this.score = 0;
    this.lastSecond = -1;

    // Input: ONE delegated listener for all 140 tiles.
    this.el.tiles.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const tEl = e.target.closest('.tile');
      if (!tEl) return;
      const t = this.tileMap.get(+tEl.dataset.id);
      if (t) this.onTile(t);
    });
    this.el.power.hint.addEventListener('click', () => this.useHint());
    this.el.power.shuffle.addEventListener('click', () => this.useShuffle());
    this.el.power.fire.addEventListener('click', () => this.useFirecracker());

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.canPlay()) this.pause();
    });

    // Runs on the shared loop; idles whenever the game is not ticking.
    addTask((dt, now) => this.tick(dt, now));
  }

  /* ==========================================================
     Run & level flow
     ========================================================== */
  newRun(mode) {
    this.mode = mode;                       // 'daily' | 'classic' | 'relaxed'
    this.timed = mode !== 'relaxed';
    this.level = 1;
    this.score = 0;
    this.displayScore = 0;
    this.startLevel();
  }

  levelConfig() {
    if (this.mode === 'daily') {
      const rng = mulberry32(hashString(`mahjong-connect:${todayKey()}`));
      return { time: 300, gravity: DAILY_GRAVITY[Math.floor(rng() * DAILY_GRAVITY.length)], rng };
    }
    return { ...LEVELS[this.level - 1], rng: Math.random };
  }

  startLevel() {
    const cfg = this.levelConfig();
    this.gravity = cfg.gravity;
    this.timeMax = cfg.time;
    this.time = cfg.time;
    this.elapsed = 0;
    this.power = { ...POWER_START };
    this.combo = 0;
    this.lastMatch = -1e9;
    this.selected = null;
    this.hintPair = null;
    this.matchPoints = 0;
    this.levelStartScore = this.score;
    this.lastSecond = -1;
    this.token = (this.token || 0) + 1;   // invalidates timers from a previous level

    this.board.load(dealTypes(cfg.rng, this.gravity));
    this.renderBoard();
    this.el.screen.classList.toggle('relaxed', !this.timed);
    this.updateHUD();
    this.dragon.setBase('neutral');
    this.running = true;
    this.paused = false;
    this.busy = true;
    setTimeout(() => { this.busy = false; }, 900);
    wake();

    // Adaptive quality: sample the frame rate over the first 2 s of play, once.
    if (!fpsChecked) {
      fpsChecked = true;
      setTimeout(() => measureFPS(2000).then((fps) => {
        if (!quality.forced && fps < 50) quality.set('low');
      }), 400);
    }

    const g = GRAVITY[this.gravity];
    const title = this.mode === 'daily' ? 'Daily Game' : `Level ${this.level}`;
    setTimeout(() => toast(title, { sub: g.label, icon: g.icon, ms: 2000 }), 650);
  }

  stop() {
    this.token = (this.token || 0) + 1;
    this.running = false;
    this.paused = false;
    this.el.tiles.innerHTML = '';
    this.el.fx.innerHTML = '';
    this.tileMap.clear();
  }

  canPlay() { return this.running && !this.paused && !this.busy && !modalOpen(); }

  /* ==========================================================
     Rendering
     ========================================================== */
  renderBoard() {
    const { tiles, fx: fxl } = this.el;
    tiles.innerHTML = '';
    fxl.innerHTML = '';
    this.tileMap.clear();
    const frag = document.createDocumentFragment();
    for (const t of this.board.tiles()) {
      const el = document.createElement('div');
      // two nodes per tile: the baked tile bitmap and glow are ::before / ::after
      el.className = `tile t-${t.type}`;
      el.dataset.id = t.id;
      el.innerHTML = '<div class="tile-body"></div>';
      t.el = el;
      this.tileMap.set(t.id, t);
      this.place(t);
      frag.appendChild(el);
    }
    tiles.appendChild(frag);
    // deal-in cascade
    for (const t of this.board.tiles()) {
      t.el.firstElementChild.animate([
        { transform: 'translateY(-46px) scale(.86)', opacity: 0 },
        { transform: 'translateY(4px) scale(1.02)', opacity: 1, offset: 0.7 },
        { transform: 'none', opacity: 1 },
      ], { duration: 420, delay: 320 + t.r * 34 + t.c * 12, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
    }
  }

  place(t) {
    t.el.style.transform = `translate(${t.c * SX}px, ${t.r * SY}px)`;
    t.el.style.zIndex = String(t.r * COLS + t.c + 1);
  }

  pop(t) {
    const el = t.el;
    if (!el) return;
    el.classList.remove('selected', 'hint');
    el.classList.add('gone');
    this.tileMap.delete(t.id);
    const a = el.firstElementChild.animate([
      { transform: 'scale(1)', opacity: 1 },
      { transform: 'scale(1.16)', opacity: 1, offset: 0.3 },
      { transform: 'scale(.35) rotate(8deg)', opacity: 0 },
    ], { duration: 430, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'forwards' });
    a.onfinish = () => el.remove();
    t.el = null;
  }

  /* ==========================================================
     Input
     ========================================================== */
  onTile(t) {
    if (!this.canPlay()) return;
    audio.clack();
    const a = this.selected;
    if (a === t) { this.select(null); return; }
    if (!a) { this.select(t); return; }
    const path = this.board.path(a, t);
    if (path) this.match(a, t, path);
    else this.wrong(a, t);
  }

  select(t) {
    if (this.selected && this.selected.el) this.selected.el.classList.remove('selected');
    this.selected = t;
    if (t) t.el.classList.add('selected');
  }

  clearHint() {
    if (this.hintPair) this.hintPair.forEach((t) => t.el && t.el.classList.remove('hint'));
    this.hintPair = null;
  }

  match(a, b, path) {
    this.select(null);
    this.clearHint();
    const now = performance.now();
    this.combo = now - this.lastMatch < COMBO_WINDOW ? Math.min(this.combo + 1, 10) : 1;
    this.lastMatch = now;
    const pts = Math.round(100 * (1 + 0.2 * (this.combo - 1)));
    this.score += pts;
    this.matchPoints += pts;
    if (this.timed) this.time = Math.min(this.timeMax, this.time + MATCH_TIME_BONUS);

    const ca = tileCenter(a), cb = tileCenter(b);
    fx.matchLine(path.map((i) => { const { c, r } = fromPad(i); return toStage(cellCenter(c, r)); }));
    this.board.remove(a);
    this.board.remove(b);
    this.pop(a);
    this.pop(b);
    setTimeout(() => {
      fx.burst(ca.x + BOARD_X, ca.y + BOARD_Y);
      fx.burst(cb.x + BOARD_X, cb.y + BOARD_Y);
    }, 90);
    const mx = (ca.x + cb.x) / 2, my = (ca.y + cb.y) / 2;
    fx.floatText(this.el.fx, mx, my, `+${pts}`, this.combo >= 2 ? 'combo' : '');
    if (this.combo >= 2) setTimeout(() => fx.floatText(this.el.fx, mx, my + 40, `Combo ×${this.combo}`, 'combo-label'), 120);
    audio.chime(this.combo);
    this.dragon.react(this.combo >= 4 ? 'cheer' : 'happy', 900);
    this.bumpCombo();
    this.afterRemoval();
  }

  wrong(a, b) {
    this.select(null);
    for (const t of [a, b]) {
      const body = t.el.firstElementChild;
      if (body.shakeAnim) body.shakeAnim.cancel();
      body.shakeAnim = body.animate(SHAKE, { duration: 360 });
    }
    this.combo = 0;
    this.updateCombo();
    audio.wrong();
    this.dragon.react('surprised', 850);
  }

  /** After tiles leave: win check, gravity, and the no-moves safety net. */
  afterRemoval() {
    this.updateHUD();
    if (this.board.count === 0) {
      this.running = false;
      const token = this.token;
      setTimeout(() => { if (token === this.token) this.levelComplete(); }, 750);
      return;
    }
    if (this.gravity !== 'none') {
      const moved = this.board.applyGravity(this.gravity);
      if (moved.length) setTimeout(() => moved.forEach((t) => t.el && this.place(t)), 170);
    }
    if (!this.board.findMove()) this.autoShuffle();
  }

  async autoShuffle() {
    this.busy = true;
    await wait(450);
    toast('No moves — shuffling!', { icon: 'shuffle', ms: 1500 });
    this.dragon.react('surprised', 900);
    await wait(650);
    this.shuffleTiles();
  }

  shuffleTiles() {
    this.busy = true;
    this.select(null);
    this.clearHint();
    this.board.shuffle(this.gravity);
    audio.whoosh();
    for (const t of this.board.tiles()) {
      if (!t.el) continue;
      t.el.classList.add('flying');
      t.el.style.transitionDelay = `${Math.round(Math.random() * 160)}ms`;
      this.place(t);
      t.el.firstElementChild.animate([
        { transform: 'scale(1) rotate(0deg)' },
        { transform: `scale(1.22) rotate(${Math.random() < 0.5 ? -8 : 8}deg)`, offset: 0.45 },
        { transform: 'scale(1) rotate(0deg)' },
      ], { duration: 760, easing: 'ease-in-out' });
    }
    setTimeout(() => {
      for (const t of this.board.tiles()) if (t.el) { t.el.classList.remove('flying'); t.el.style.transitionDelay = ''; }
      this.busy = false;
      if (this.running && !this.board.findMove()) this.autoShuffle();
    }, 980);
  }

  /* ==========================================================
     Power-ups
     ========================================================== */
  useHint() {
    if (!this.canPlay() || this.power.hint <= 0) return;
    const mv = this.board.findMove();
    if (!mv) return;
    audio.sparkle();
    this.power.hint--;
    this.select(null);
    this.clearHint();
    this.hintPair = mv;
    mv.forEach((t) => t.el.classList.add('hint'));
    this.updatePowers();
  }

  useShuffle() {
    if (!this.canPlay() || this.power.shuffle <= 0) return;
    this.power.shuffle--;
    this.updatePowers();
    this.shuffleTiles();
  }

  async useFirecracker() {
    if (!this.canPlay() || this.power.fire <= 0 || this.board.count < 2) return;
    this.power.fire--;
    this.updatePowers();
    this.busy = true;
    this.select(null);
    this.clearHint();
    const pairs = this.board.randomPairs(3);
    const tiles = pairs.flat();
    tiles.forEach((t) => { this.board.remove(t); t.el.classList.add('doomed'); });
    await fx.firecrackerString(BOARD_X + BOARD_W / 2, BOARD_Y + BOARD_H / 2 - 30);
    audio.crackle();
    for (const [a, b] of pairs) {
      await wait(120);
      for (const t of [a, b]) {
        const c = tileCenter(t);
        fx.festiveBurst(c.x + BOARD_X, c.y + BOARD_Y);
        this.pop(t);
      }
      this.score += 50;
      this.matchPoints += 50;
    }
    fx.floatText(this.el.fx, BOARD_W / 2, BOARD_H / 2, `+${pairs.length * 50}`, 'fire');
    this.dragon.react('cheer', 1100);
    this.busy = false;
    this.afterRemoval();
  }

  /* ==========================================================
     HUD
     ========================================================== */
  updateHUD() {
    const e = this.el;
    e.level.textContent = this.mode === 'daily' ? 'Daily' : `${this.level}/${LEVEL_COUNT}`;
    e.ribbon.textContent = this.mode === 'daily' ? 'Daily' : `Level ${pad2(this.level)}`;
    e.pairs.textContent = String(this.board.count / 2);
    e.pairsBar.style.transform = `scaleX(${this.board.count / N})`;
    const g = GRAVITY[this.gravity];
    e.gravIcon.innerHTML = iconSVG(g.icon, { size: 44 });
    e.gravText.textContent = g.label;
    this.updatePowers();
    this.updateCombo();
    this.updateTimer(true);
  }

  updatePowers() {
    for (const key of ['hint', 'shuffle', 'fire']) {
      const btn = this.el.power[key];
      btn.disabled = this.power[key] <= 0;
      btn.parentElement.querySelector('.badge').textContent = String(this.power[key]);
      btn.parentElement.classList.toggle('empty', this.power[key] <= 0);
    }
  }

  updateCombo() {
    this.el.combo.textContent = `×${Math.max(1, this.combo)}`;
    this.el.combo.parentElement.classList.toggle('hot', this.combo >= 3);
  }
  bumpCombo() {
    this.updateCombo();
    const v = this.el.combo;
    if (v.bumpAnim) v.bumpAnim.cancel();
    v.bumpAnim = v.animate(BUMP, { duration: 320 });
  }

  updateTimer(force = false) {
    const e = this.el;
    if (!this.timed) {
      const sec = Math.floor(this.elapsed);
      if (force || sec !== this.lastSecond) { this.lastSecond = sec; e.timerText.textContent = clock(sec); }
      return;
    }
    const f = clamp(this.time / this.timeMax, 0, 1);
    e.timerFill.style.transform = `scaleX(${f.toFixed(4)})`;
    const sec = Math.ceil(this.time);
    if (force || sec !== this.lastSecond) {
      this.lastSecond = sec;
      e.timerText.textContent = clock(sec);
      const col = f > 0.5 ? mix(P.gold, P.jade, (f - 0.5) / 0.5) : mix(P.cinnabar, P.gold, clamp((f - 0.12) / 0.38, 0, 1));
      e.timerFill.style.setProperty('--timer-color', col);
      const low = sec <= 20;
      e.timerPanel.classList.toggle('low', low);
      if (low && !force && this.running && !this.paused) audio.tick();
    }
  }

  /** Shared-loop task.  Returns true while it needs more frames. */
  tick(dt, now) {
    // score count-up
    let counting = false;
    if (this.displayScore !== this.score) {
      const diff = this.score - this.displayScore;
      this.displayScore = Math.abs(diff) < 1 ? this.score : this.displayScore + diff * Math.min(1, dt * 9);
      const txt = fmt(this.displayScore);
      if (txt !== this.scoreText) { this.scoreText = txt; this.el.score.textContent = txt; }
      counting = this.displayScore !== this.score;
    }
    const live = this.running && !this.paused && !modalOpen();
    // will-change only on the bars while they are actually animating
    if (live !== this.liveFlag) { this.liveFlag = live; this.el.screen.classList.toggle('live', live); }
    if (!live) return counting;
    // combo meter drains
    const left = this.combo > 0 ? clamp(1 - (now - this.lastMatch) / COMBO_WINDOW, 0, 1) : 0;
    this.el.comboBar.style.transform = `scaleX(${left.toFixed(3)})`;
    if (left === 0 && this.combo > 0) { this.combo = 0; this.updateCombo(); }

    this.elapsed += dt;
    if (this.timed) {
      this.time -= dt;
      if (this.time <= 0) { this.time = 0; this.updateTimer(); this.timeUp(); return counting; }
    }
    this.updateTimer();
    return true;
  }

  /* ==========================================================
     Pause & results
     ========================================================== */
  pause() {
    if (!this.running || this.paused) return;
    this.paused = true;
    audio.click();
    openModal('pause');
  }
  resume() {
    closeModal();
    this.paused = false;
    wake();
  }

  stars() {
    if (this.timed) {
      const f = this.time / this.timeMax;
      return f >= 0.45 ? 3 : f >= 0.2 ? 2 : 1;
    }
    return this.elapsed < 240 ? 3 : this.elapsed < 420 ? 2 : 1;
  }

  bestKey() { return this.mode === 'daily' ? `mc.best.daily.${todayKey()}` : `mc.best.${this.mode}`; }
  saveBest() {
    const best = store.get(this.bestKey(), 0);
    if (this.score > best) { store.set(this.bestKey(), this.score); return { best: this.score, isNew: true }; }
    return { best, isNew: false };
  }

  levelComplete() {
    // Timed modes reward seconds left; Relaxed rewards a calm, quick clear.
    const timeBonus = this.timed ? Math.ceil(this.time) * 10 : Math.max(0, 1200 - Math.floor(this.elapsed) * 2);
    const powerBonus = (this.power.hint + this.power.shuffle + this.power.fire) * 100;
    const clearBonus = 500 + (this.mode === 'daily' ? 700 : this.level * 100);
    const stars = this.stars();
    this.score += timeBonus + powerBonus + clearBonus;
    this.saveBest();
    this.dragon.setBase('cheer');
    this.dragon.react('cheer', 0);
    audio.fanfare(this.level === LEVEL_COUNT || this.mode === 'daily');

    const final = this.mode === 'daily' || this.level === LEVEL_COUNT;
    if (final) { this.showWon(); return; }

    const m = $('[data-modal="complete"]');
    $('.modal-title-text', m).textContent = `Level ${this.level} Complete!`;
    const rows = [
      ['Matches', this.matchPoints],
      [this.timed ? 'Time Bonus' : 'Zen Bonus', timeBonus],
      ['Power-ups Saved', powerBonus],
      ['Level Clear', clearBonus],
    ];
    const levelTotal = rows.reduce((s, r) => s + r[1], 0);
    $('.breakdown', m).innerHTML = rows.map(([label, v]) => `<div class="row"><span>${label}</span><b data-to="${v}">0</b></div>`).join('')
      + `<div class="row total"><span>Level Total</span><b data-to="${levelTotal}">0</b></div>`
      + `<div class="row grand"><span>Total Score</span><b data-to="${this.score}">0</b></div>`;
    this.renderStars($('.stars', m), stars);
    openModal('complete');
    this.countUp(m);
    fx.confetti({ count: 44 });
  }

  renderStars(holder, n) {
    holder.innerHTML = [0, 1, 2].map((i) => `<div class="star-slot s${i}">${starSVG(false)}<div class="star-on${i < n ? ' earned' : ''}">${starSVG(true)}</div></div>`).join('');
    $$('.star-on.earned', holder).forEach((s, i) => setTimeout(() => { s.classList.add('pop'); audio.star(i + 1); }, 450 + i * 320));
  }

  async countUp(root) {
    const cells = $$('[data-to]', root);
    await wait(500);
    for (const b of cells) {
      const to = +b.dataset.to;
      const t0 = performance.now(), dur = 520;
      await new Promise((res) => {
        addTask((dt, now) => {   // runs on the shared loop, removes itself when done
          const k = clamp((now - t0) / dur, 0, 1);
          b.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
          if (k < 1) return true;
          audio.coin();
          res();
          return -1;
        });
      });
    }
  }

  showWon() {
    const m = $('[data-modal="won"]');
    const daily = this.mode === 'daily';
    const { best, isNew } = this.saveBest();
    $('.modal-title-text', m).textContent = daily ? 'Daily Complete!' : 'You Win!';
    $('.won-sub', m).textContent = daily ? `The ${todayKey()} board is cleared — see you tomorrow!` : 'All 12 levels cleared. The dragon is so proud!';
    $('.won-score b', m).dataset.to = this.score;
    $('.won-best', m).textContent = isNew ? 'New best score!' : `Best: ${fmt(best)}`;
    $('.won-best', m).classList.toggle('new', isNew);
    this.dragonWon.setBase('cheer');
    openModal('won');
    this.countUp(m);
    const waves = [0, 900, 1800];
    waves.forEach((d) => setTimeout(() => fx.confetti({ count: 40 }), d));
    for (let i = 0; i < 7; i++) setTimeout(() => fx.festiveBurst(260 + Math.random() * 1400, 140 + Math.random() * 500, 1.6), 300 + i * 380);
  }

  timeUp() {
    this.running = false;
    this.select(null);
    this.dragon.setBase('sad');
    audio.sad();
    const { best } = this.saveBest();
    const m = $('[data-modal="lost"]');
    $('.lost-score b', m).textContent = fmt(this.score);
    $('.lost-sub', m).textContent = this.mode === 'daily'
      ? `${this.board.count / 2} pairs were left on today's board.`
      : `You reached level ${this.level} with ${this.board.count / 2} pairs to go.`;
    $('.lost-best', m).textContent = `Best: ${fmt(best)}`;
    this.dragonLost.setBase('sad');
    const token = this.token;
    setTimeout(() => { if (token === this.token) openModal('lost'); }, 500);
  }

  /* Modal actions */
  nextLevel() {
    closeModal();
    this.level++;
    transitionTo('game', () => this.startLevel());
  }
  restartLevel() {
    closeModal();
    this.score = this.levelStartScore;
    this.displayScore = this.score;
    transitionTo('game', () => this.startLevel());
  }
  newGame() {
    closeModal();
    const mode = this.mode;
    transitionTo('game', () => this.newRun(mode));
  }
}
