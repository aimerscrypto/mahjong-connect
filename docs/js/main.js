/* ==========================================================
   main.js — boot: fonts, art, stage scaling and wiring
   ========================================================== */
import { $, $$, fmt, store, todayKey, wait } from './util.js';
import { preloadTiles, bakeTileArt } from './tiles.js';
import { mountBackground } from './background.js';
import { logoSVG } from './logo.js';
import { Dragon, dragonBodyMarkup, pawsSVG, TITLE_W, TITLE_H, invalidateDragons } from './dragon.js';
import { paintSkins, enhanceButton, setButtonIcon, showScreenNow, transitionTo, buildCurtain, openModal, closeModal, modalOpen, getScreen, bakeSkins, onScreen, onModal, toast } from './ui.js';
import { setStageScale, onResizeSettled } from './raster.js';
import { wake, quality } from './loop.js';
import { initFX, resizeFX } from './fx.js';
import { ambient } from './ambient.js';
import { audio } from './audio.js';
import { Game } from './game.js';
import { iconSVG } from './icons.js';

const STAGE_W = 1920, STAGE_H = 1080;

/* ---------- Letterboxed stage ---------- */
function fitStage() {
  const stage = $('#stage');
  const s = Math.min(innerWidth / STAGE_W, innerHeight / STAGE_H);
  const x = (innerWidth - STAGE_W * s) / 2, y = (innerHeight - STAGE_H * s) / 2;
  stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  setStageScale(s);
}

/* ---------- Fonts (never block for long) ---------- */
async function loadFonts() {
  if (!document.fonts) return;
  const want = [document.fonts.load('40px "Lilita One"', 'MAHJONG'), document.fonts.load('800 20px "Nunito"', 'Score')];
  await Promise.race([Promise.all(want).catch(() => {}), wait(2500)]);
}

/* ---------- Help diagram: a 2-turn connection on a mini board ---------- */
function helpDiagram() {
  const cw = 50, ch = 60, cols = 6, rows = 4, ox = 30, oy = 34;
  const layout = [
    [null, null, null, null, null, 13],
    [null, 27, 3, 18, 31, 7],
    [31, 12, 30, 25, 2, 16],
    [20, 8, 11, 29, 24, 6],
  ];
  let tiles = '';
  layout.forEach((row, r) => row.forEach((type, c) => {
    if (type === null) return;
    const hl = type === 31 ? ' hl' : '';
    tiles += `<div class="mini-tile t-${type}${hl}" style="left:${ox + c * cw}px;top:${oy + r * ch}px;z-index:${r * 10 + c}"></div>`;
  }));
  // path: from (0,2) up to row 0 → right to col 4 → down to (4,1)
  const cx = (c) => ox + c * cw + 22, cy = (r) => oy + r * ch + 27;
  const pts = [[cx(0), cy(2)], [cx(0), cy(0)], [cx(4), cy(0)], [cx(4), cy(1)]];
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');
  const label = (x, y, n) => `<g transform="translate(${x} ${y})"><circle r="13" fill="#8e1b1f" stroke="#f2bf4a" stroke-width="2.5"/><text y="5.5" text-anchor="middle" font-family="Lilita One, sans-serif" font-size="16" fill="#fff6df">${n}</text></g>`;
  return `<div class="mini-board">${tiles}
    <svg class="mini-path" viewBox="0 0 360 290" width="360" height="290">
      <path d="${d}" fill="none" stroke="#ffd36a" stroke-width="14" opacity=".35" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#e0a232" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#fff6d0" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${label(cx(0) - 22, (cy(2) + cy(0)) / 2 + 30, 1)}${label((cx(0) + cx(4)) / 2, cy(0) - 22, 2)}${label(cx(4) + 22, (cy(0) + cy(1)) / 2, 3)}
    </svg></div>`;
}

/* ---------- Boot ---------- */
async function boot() {
  fitStage();
  window.addEventListener('resize', fitStage);
  initFX($('#fx-canvas'));

  // Everything heavy is rasterised once, while the loader is up.
  await Promise.all([loadFonts(), preloadTiles(), mountBackground($('#bg')), buildCurtain()]);

  // Re-bake bitmaps only after the window has settled on a new size.
  onResizeSettled(() => { bakeTileArt(); resizeFX(); invalidateDragons(); });
  window.addEventListener('resize', invalidateDragons);

  // Title: dragon body + logo + live head
  $('.title-body').innerHTML = `<svg viewBox="0 0 ${TITLE_W} ${TITLE_H}" aria-hidden="true">${dragonBodyMarkup()}</svg>`;
  $('.title-logo').innerHTML = logoSVG({ clouds: true });
  const titleDragon = new Dragon($('.title-head'));
  // Gameplay: plaque logo, peeking dragon and paws
  $('.plaque-logo').innerHTML = logoSVG({ clouds: false, sparkles: false });
  const gameDragon = new Dragon($('#game-dragon'));
  $('#dragon-paws').innerHTML = pawsSVG();
  const wonDragon = new Dragon($('#won-dragon'), { mood: 'cheer' });
  const lostDragon = new Dragon($('#lost-dragon'), { mood: 'sad' });
  wonDragon.setBase('cheer');
  lostDragon.setBase('sad');
  $('.help-diagram').innerHTML = helpDiagram();
  $$('[data-icon-inline]').forEach((el) => { el.innerHTML = iconSVG(el.dataset.iconInline, { size: +el.dataset.size || 40 }); });

  paintSkins();
  $$('button.btn').forEach(enhanceButton);
  bakeSkins(); // swaps inline SVG skins for identical bitmaps in idle time
  ambient($('.title-group'), 6, (v) => `translateY(${(-5 + 11 * v).toFixed(2)}px)`, { active: () => getScreen() === 'title' });
  onScreen(invalidateDragons);
  onModal(() => { invalidateDragons(); setTimeout(invalidateDragons, 600); });

  const game = new Game({ dragon: gameDragon, dragonWon: wonDragon, dragonLost: lostDragon });

  /* --- title info --- */
  const refreshTitle = () => {
    const d = new Date();
    $('#daily-sub').textContent = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const bc = store.get('mc.best.classic', 0), br = store.get('mc.best.relaxed', 0), bd = store.get(`mc.best.daily.${todayKey()}`, 0);
    $('#best-classic').textContent = bc ? `Best ${fmt(bc)}` : '12 timed levels';
    $('#best-relaxed').textContent = br ? `Best ${fmt(br)}` : 'No timer, just calm';
    $('#best-daily').textContent = bd ? `Today ${fmt(bd)}` : '';
  };
  refreshTitle();

  /* --- sound / music toggles (title + game share state) --- */
  const syncAudioButtons = () => {
    $$('.js-sound').forEach((b) => { setButtonIcon(b, audio.sfxOn ? 'sound' : 'soundOff'); b.classList.toggle('off', !audio.sfxOn); b.setAttribute('aria-pressed', String(audio.sfxOn)); });
    $$('.js-music').forEach((b) => { setButtonIcon(b, audio.musicOn ? 'music' : 'musicOff'); b.classList.toggle('off', !audio.musicOn); b.setAttribute('aria-pressed', String(audio.musicOn)); });
  };
  audio.onChange(syncAudioButtons);
  syncAudioButtons();
  $$('.js-sound').forEach((b) => b.addEventListener('click', () => audio.setSfx(!audio.sfxOn)));
  $$('.js-music').forEach((b) => b.addEventListener('click', () => audio.setMusic(!audio.musicOn)));

  // Unlock audio on the first gesture; click sound on every UI button.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  document.addEventListener('click', (e) => { if (e.target.closest('button.btn')) audio.click(); });

  /* --- navigation --- */
  const start = (mode) => {
    audio.unlock();
    transitionTo('game', () => game.newRun(mode));
  };
  $('#btn-daily').addEventListener('click', () => start('daily'));
  $('#btn-classic').addEventListener('click', () => start('classic'));
  $('#btn-relaxed').addEventListener('click', () => start('relaxed'));

  const goHome = () => {
    closeModal();
    transitionTo('title', () => { game.stop(); refreshTitle(); titleDragon.setBase('neutral'); });
  };
  let helpResumes = false;
  const openHelp = () => {
    helpResumes = getScreen() === 'game' && game.running && !game.paused;
    if (helpResumes) game.paused = true;
    openModal('help');
  };
  $$('.js-help').forEach((b) => b.addEventListener('click', openHelp));
  $('#help-close').addEventListener('click', () => {
    closeModal();
    if (helpResumes) { game.paused = false; wake(); }
  });

  $('#btn-pause').addEventListener('click', () => game.pause());
  $('#pause-resume').addEventListener('click', () => game.resume());
  $('#pause-restart').addEventListener('click', () => game.restartLevel());
  $('#pause-home').addEventListener('click', goHome);
  $('#complete-next').addEventListener('click', () => game.nextLevel());
  $('#complete-home').addEventListener('click', goHome);
  $('#won-again').addEventListener('click', () => game.newGame());
  $('#won-home').addEventListener('click', goHome);
  $('#lost-again').addEventListener('click', () => game.newGame());
  $('#lost-home').addEventListener('click', goHome);

  /* --- keyboard --- */
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    // hidden toggle: force high / low effects quality to compare
    if (k === 'q') {
      quality.set(quality.low ? 'high' : 'low', true);
      if (getScreen() === 'game') toast(`Quality: ${quality.low ? 'Low' : 'High'}`, { ms: 1000 });
      console.info(`[Mahjong Connect] effects quality: ${quality.tier}`);
      return;
    }
    if (getScreen() !== 'game') return;
    if (k === 'escape' || k === 'p') {
      if (modalOpen() === 'pause') game.resume();
      else if (modalOpen() === 'help') $('#help-close').click();
      else if (!modalOpen()) game.pause();
    } else if (k === 'h') game.useHint();
    else if (k === 's') game.useShuffle();
    else if (k === 'f') game.useFirecracker();
  });

  // Title dragon greets you
  showScreenNow('title');
  document.body.classList.add('ready');
  setTimeout(() => titleDragon.react('happy', 1200), 900);
  const loader = $('#loader');
  loader.classList.add('hide');
  setTimeout(() => loader.remove(), 700);
}

// Silence audio and stop work entirely while the tab is hidden.
document.addEventListener('visibilitychange', () => {
  if (!audio.ctx) return;
  if (document.hidden) audio.ctx.suspend();
  else audio.ctx.resume();
});

boot();
