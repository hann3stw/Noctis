// The app around the game: title screen, save slots, starting and leaving
// worlds, pause menu and the skin editor in the camp.
import { Game } from './game.js';
import { Screens } from './ui/screens.js';
import { settings, loadSettings, saveSettings, onGraphicsChange } from './core/settings.js';
import { listSlots, saveSlot, deleteSlot } from './core/storage.js';
import { unlockAudio } from './core/sfx.js';
import { initKeyboard, setEscapeHandler } from './input/keyboard.js';
import { sizeRenderer } from './render/renderer.js';
import { randomSeed } from './core/rng.js';
import { t } from './strings.js';

export class App {
  constructor(debug) {
    this.debug = debug;
    this.game = null;
    this.slots = [null, null, null];
    this.uiRoot = document.getElementById('ui');
    this.screens = new Screens(this);
  }

  async init(params) {
    loadSettings();
    onGraphicsChange(() => {
      sizeRenderer();
      if (this.game) this.game.resize();
    });
    initKeyboard();
    setEscapeHandler(() => this.onEscape());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('resize', () => { if (!this.game) sizeRenderer(); });
    sizeRenderer();

    this.slots = await listSlots();
    // ?seed=123 starts a test world straight away (never saved)
    if (params.has('seed')) {
      this.launch({ slot: -1, name: 'Test', seed: Number(params.get('seed')) >>> 0 });
      return;
    }
    this.screens.show('title');
  }

  // ---- saves ------------------------------------------------------------------
  lastSave() {
    const s = this.slots;
    if (settings.lastSlot >= 0 && s[settings.lastSlot]) return s[settings.lastSlot];
    let best = null;
    for (const x of s) if (x && (!best || x.updated > best.updated)) best = x;
    return best;
  }

  store(slot, data) {
    this.slots[slot] = data;
    return saveSlot(slot, data);
  }

  async removeSlot(slot) {
    await deleteSlot(slot);
    this.slots[slot] = null;
    if (settings.lastSlot === slot) { settings.lastSlot = -1; saveSettings(); }
    this.screens.show(this.slots.some(Boolean) ? 'load' : 'title');
  }

  // ---- starting and leaving worlds ---------------------------------------------
  // On phones and tablets the game goes fullscreen in landscape. Browsers only
  // allow this right after a tap, so it happens when a world starts.
  goFullscreen() {
    const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const installed = window.matchMedia && window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
    if (!touch || installed || document.fullscreenElement) return;
    const el = document.documentElement;
    if (!el.requestFullscreen) return;
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => { /* not allowed here: play in the normal window */ });
  }

  launch(opts) {
    this.goFullscreen();
    this.screens.hide();
    if (opts.slot >= 0) { settings.lastSlot = opts.slot; saveSettings(); }
    this.game = new Game(this, this.uiRoot, { ...opts, showFps: settings.showFps || this.debug });
    this.game.start();
    if (this.debug) window.__noctis = this.game;
  }

  startNew(slot, name, appearance, difficulty) {
    this.launch({ slot, name, seed: randomSeed(), appearance, difficulty });
    this.game.save(); // the slot is taken (or overwritten) right away
  }

  loadSlot(slot) {
    const save = this.slots[slot];
    if (save) this.launch({ slot, save });
  }

  continueLast() {
    const last = this.lastSave();
    if (last) this.loadSlot(this.slots.indexOf(last));
  }

  async exitToTitle() {
    const game = this.game;
    if (!game) return;
    await game.save();
    game.destroy();
    this.game = null;
    if (this.debug) window.__noctis = null;
    this.screens.show('title');
  }

  // ---- pause ---------------------------------------------------------------------
  openPause() {
    const g = this.game;
    if (!g || g.paused) return;
    g.setPaused(true);
    g.save();
    this.screens.show('pause');
  }

  // fast travel list (only opened from the camp or an outpost)
  openTravel() {
    const g = this.game;
    if (!g || g.paused || !g.player.inCamp) return;
    g.setPaused(true);
    this.screens.show('travel');
  }

  travelTo(si) {
    this.screens.hide();
    if (!this.game) return;
    this.game.setPaused(false);
    this.game.travel(si);
  }

  resume() {
    this.screens.hide();
    if (this.game) this.game.setPaused(false);
  }

  saveNow() {
    if (!this.game) return;
    this.game.save(true).then((ok) => {
      // the toast of the HUD is hidden behind the pause menu, so say it here too
      const b = this.screens.el.querySelector('[data-act="saveNow"]');
      if (b) b.textContent = t(ok ? 'toast.saved' : 'toast.saveFailed');
    });
  }

  fpsChanged() {
    if (this.game) this.game.hud.setFps(settings.showFps || this.debug);
  }

  onEscape() {
    const g = this.game, cur = this.screens.current;
    if (!g) {
      if (cur && cur !== 'title' && cur !== 'editor') this.screens.show('title');
      return;
    }
    if (cur === 'pause' || cur === 'travel') this.resume();
    else if (cur === 'settings') this.screens.show('pause');
    else if (cur === 'editor') this.closeEditorInCamp(null);
    else if (g.menu.isOpen) g.menu.close();
    else this.openPause();
  }

  // ---- skin editor in the camp --------------------------------------------------
  openEditorInCamp() {
    const g = this.game;
    if (!g) return;
    g.setPaused(true);
    this.screens.show('editor', { mode: 'camp', appearance: g.appearance, equip: g.player.equip });
  }

  // look = new appearance, or null when the editor was cancelled
  closeEditorInCamp(look) {
    const g = this.game;
    this.screens.hide();
    if (!g) return;
    if (look) {
      g.setAppearance(look);
      g.save();
    }
    g.resize();
    g.setPaused(false);
  }
}
