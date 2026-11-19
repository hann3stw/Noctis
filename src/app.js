// The app around the game: title screen, save slots, starting and leaving
// worlds, pause menu and the skin editor in the camp.
import { Game } from './game.js';
import { Screens } from './ui/screens.js';
import { settings, loadSettings, saveSettings, setSetting, onGraphicsChange } from './core/settings.js';
import { listSlots, saveSlot, deleteSlot, keepStorage, readSaveText, backupSlot, readBackup } from './core/storage.js';
import { unlockAudio } from './core/sfx.js';
import { registerSW } from 'virtual:pwa-register';
import { startMusic, setMood } from './core/music.js';
import { initKeyboard, setEscapeHandler } from './input/keyboard.js';
import { sizeRenderer } from './render/renderer.js';
import { randomSeed } from './core/rng.js';
import { t } from './strings.js';
import { CloudSync } from './net/cloudSync.js';
import { ensureSession, flushScore, refreshLink, isLinked, cloudList, cloudGet, cloudDelete, newPairCode, pairWith, unlinkSelf, unlinkOthers, accountName } from './net/online.js';

export class App {
  constructor(debug) {
    this.debug = debug;
    this.game = null;
    this.slots = [null, null, null];
    this.uiRoot = document.getElementById('ui');
    this.screens = new Screens(this);
    this.cloud = new CloudSync();
    this.syncing = null; // the running world sync (paired devices)
  }

  async init(params) {
    loadSettings();
    onGraphicsChange(() => {
      sizeRenderer();
      if (this.game) { this.game.resize(); this.game.applyShadows(); }
    });
    initKeyboard();
    setEscapeHandler(() => this.onEscape());
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    const unlock = () => { unlockAudio(); startMusic(); };
    // capture phase: the game buttons stop their events from bubbling up
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('touchend', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('resize', () => { if (!this.game) sizeRenderer(); });
    sizeRenderer();

    keepStorage();
    this.watchUpdates();
    this.slots = await listSlots();
    // online in the background: sign in, send a waiting leaderboard entry
    ensureSession().then(() => {
      flushScore();
      // paired with another device: take over what was played there
      this.syncWorlds();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.syncWorlds();
    });
    // ?seed=123 starts a test world straight away (never saved); &tutorial=1 with the tutorial
    if (params.has('seed')) {
      this.launch({ slot: -1, name: 'Test', seed: Number(params.get('seed')) >>> 0, tutorial: params.has('tutorial') });
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
    // the cloud copy follows; at once when the game goes to the background
    this.cloud.queue(slot, data, document.hidden);
    return saveSlot(slot, data);
  }

  async removeSlot(slot) {
    const old = this.slots[slot];
    if (old) await backupSlot(slot, old, true); // can be brought back (Worlds, Backups)
    // paired: the world goes on the other devices too
    if (isLinked() && old) cloudDelete(slot, old.seed).catch(() => {});
    await deleteSlot(slot);
    this.slots[slot] = null;
    if (settings.lastSlot === slot) { settings.lastSlot = -1; saveSettings(); }
    this.screens.show(this.slots.some(Boolean) ? 'load' : 'title');
  }

  // ---- paired devices --------------------------------------------------------------
  // Brings the worlds of this device and the shared account together, slot by
  // slot: the newer copy of a world wins; a world deleted on another device
  // goes here too. Two different worlds in one slot: the older one moves to a
  // free slot (if none is free, nothing happens: no world is ever pushed out).
  // Only while no world is being played. Resolves to true when slots changed.
  syncWorlds() {
    if (this.game) return Promise.resolve(false);
    // the link is checked first: another device may have joined or left meanwhile
    if (!this.syncing) {
      this.syncing = refreshLink().then(() => (isLinked() && !this.game ? this.doSync() : false))
        .catch(() => false).finally(() => { this.syncing = null; });
    }
    return this.syncing;
  }

  async doSync() {
    const list = await cloudList();
    const cloud = {};
    for (const c of list) if (c.slot >= 0 && c.slot < 3) cloud[c.slot] = { t: Date.parse(c.saved_at) || 0, m: c.summary || {} };
    let changed = false;
    const sameWorld = (l, c) => c.m.seed === undefined || l.seed === undefined || c.m.seed === l.seed;
    const free = () => [0, 1, 2].find((i) => !this.slots[i] && (!cloud[i] || cloud[i].m.deleted));
    const download = async (slot) => {
      const d = await cloudGet(slot);
      const save = d ? readSaveText(JSON.stringify(d)) : null;
      if (!save || this.game) return;
      await saveSlot(slot, save);
      this.slots[slot] = save;
      changed = true;
    };
    for (let i = 0; i < 3; i++) {
      if (this.game) return changed;
      const l = this.slots[i], c = cloud[i];
      if (!c) { if (l) this.cloud.queue(i, l, true); continue; }
      if (c.m.deleted) {
        if (!l) continue;
        if (sameWorld(l, c) && (l.updated || 0) <= c.t) {
          await deleteSlot(i); // deleted on another device
          this.slots[i] = null;
          changed = true;
        } else this.cloud.queue(i, l, true);
        continue;
      }
      if (!l) { await download(i); continue; }
      if (sameWorld(l, c)) {
        if (c.t > (l.updated || 0) + 500) await download(i);
        else if ((l.updated || 0) > c.t + 500) this.cloud.queue(i, l, true);
        continue;
      }
      // two different worlds in this slot: the older one moves aside
      const f = free();
      if (f === undefined) continue;
      if ((l.updated || 0) < c.t) {
        await this.store(f, l);
        await download(i);
      } else {
        const d = await cloudGet(i);
        const other = d ? readSaveText(JSON.stringify(d)) : null;
        if (!other) continue;
        await this.store(f, other);
        this.cloud.queue(i, l, true);
      }
      cloud[f] = { t: Date.now(), m: { seed: this.slots[f].seed } };
      changed = true;
    }
    // the hunter name belongs to the shared account
    const name = await accountName().catch(() => '');
    if (name && name !== settings.hunterName) { setSetting('hunterName', name); changed = true; }
    if (changed) this.screens.slotsChanged();
    return changed;
  }

  // every world of this device into the cloud of the current account (waits)
  async uploadAll() {
    for (let i = 0; i < 3; i++) if (this.slots[i]) await this.cloud.sendNow(i, this.slots[i]);
  }

  // A code for the other device: first everything of this device goes into
  // the cloud, so the other one sees which slots are taken. { code, expires_at }
  async makePairCode() {
    if (!settings.cloudSave) setSetting('cloudSave', true);
    await this.uploadAll();
    return newPairCode();
  }

  // Joins the account of the code. The worlds of this device move into the
  // free slots there (the server refuses when there are not enough).
  async pair(code) {
    const link = await refreshLink();
    if (link.role === 'member') throw new Error('linked');
    if (link.role === 'owner') throw new Error('has devices');
    const mine = this.slots.filter(Boolean);
    await this.uploadAll(); // a copy stays in this device's own account
    await pairWith(code, mine.length);
    setSetting('cloudSave', true);
    // put this device's worlds into the free slots of the shared account
    const list = await cloudList();
    const taken = new Set(list.filter((c) => !(c.summary && c.summary.deleted)).map((c) => c.slot));
    const placed = [null, null, null];
    const rest = [];
    this.slots.forEach((w, i) => {
      if (!w) return;
      if (!taken.has(i)) { placed[i] = w; taken.add(i); } else rest.push(w);
    });
    for (const w of rest) {
      const f = [0, 1, 2].find((i) => !taken.has(i));
      if (f === undefined) break; // cannot happen: the server checked the free slots
      placed[f] = w;
      taken.add(f);
    }
    for (let i = 0; i < 3; i++) {
      if (placed[i]) {
        await saveSlot(i, placed[i]);
        await this.cloud.sendNow(i, placed[i]);
      } else await deleteSlot(i); // a world of the shared account comes here
      this.slots[i] = placed[i];
    }
    settings.lastSlot = -1;
    saveSettings();
    await this.syncWorlds();
    flushScore();
  }

  // This device leaves the shared account. Its worlds stay on it.
  async unpair() {
    try { await this.uploadAll(); } catch (_) { /* offline: the worlds stay here anyway */ }
    await unlinkSelf();
  }

  // the owner sends the other devices away
  async unpairOthers() {
    await unlinkOthers();
  }

  // ---- automatic backups (core/storage.js) ------------------------------------------
  // Puts a copy back into its slot. A world in the slot now is backed up first.
  async restoreBackup(slot, at) {
    const save = await readBackup(slot, at);
    if (!save) return null;
    const cur = this.slots[slot];
    if (cur) await backupSlot(slot, cur, true);
    save.updated = Date.now();
    await this.store(slot, save);
    return save;
  }

  // ---- new version of the game --------------------------------------------------
  // The new version waits until it is wanted (never in the middle of a fight):
  // the title screen offers it, a tap reloads the page with it.
  watchUpdates() {
    this.updateReady = false;
    try {
      this.updateSW = registerSW({
        onNeedRefresh: () => {
          this.updateReady = true;
          this.screens.updateReady();
        },
        onRegisteredSW: (url, reg) => {
          if (!reg) return;
          const check = () => reg.update().catch(() => {});
          setInterval(check, 30 * 60 * 1000);
          document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
        },
      });
    } catch (_) { /* no service worker here */ }
  }

  applyUpdate() {
    if (this.game || !this.updateSW) return;
    this.updateSW(true);
  }

  // ---- backup: a world as a file -----------------------------------------------
  // Shares the file on phones and tablets, downloads it on a PC.
  exportSlot(slot) {
    const s = this.slots[slot];
    if (!s) return;
    const name = 'noctis-' + (String(s.name || 'world').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'world') + '.json';
    const text = JSON.stringify(s);
    try {
      const file = new File([text], name, { type: 'application/json' });
      const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Noctis' }).catch(() => {});
        return;
      }
    } catch (_) { /* download instead */ }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // Lets the player pick a save file and puts it into the slot. done(ok).
  importSlot(slot, done) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json,text/plain';
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0];
      if (!f) return;
      let save = null;
      try { save = readSaveText(await f.text()); } catch (_) { /* not readable */ }
      if (save) {
        save.updated = Date.now();
        await this.store(slot, save);
      }
      done(!!save);
    });
    inp.click();
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

  startNew(slot, name, appearance, difficulty, tutorial) {
    keepStorage();
    const old = this.slots[slot];
    if (old) backupSlot(slot, old, true).catch(() => {}); // the replaced world stays restorable
    if (old && isLinked()) cloudDelete(slot, old.seed).catch(() => {});
    this.launch({ slot, name, seed: randomSeed(), appearance, difficulty, tutorial });
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
    if (game.slot >= 0) this.cloud.queue(game.slot, this.slots[game.slot], true);
    game.destroy();
    this.game = null;
    setMood('menu');
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
