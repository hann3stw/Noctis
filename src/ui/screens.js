// Full-screen menus outside the game world: title screen, Load Game,
// New World (slot choice and skin editor), settings, pause menu and
// confirmation dialogs. Everything is rendered into #screens; clicks are
// handled by one delegated listener (data-act attributes).
import { CONFIG } from '../config.js';
import { usageReport, usageReset } from '../core/usage.js';
import { ACTIONS, keyOf, keyLabel, setKey, resetKeys, canBind, keyState } from '../core/keys.js';
import { flashClass, fmt } from '../core/format.js';
import { t } from '../strings.js';
import { settings, setSetting, gfx } from '../core/settings.js';
import { play } from '../core/sfx.js';
import { Preview } from './preview.js';
import { readSaveText, listBackups } from '../core/storage.js';
import { cloudList, cloudGet, cleanName, flushScore, submitScore, publicLook, publicGear, net, linkInfo, isLinked, refreshLink } from '../net/online.js';
import { WorldStages } from './worldStages.js';
import { Board } from './board.js';
import { UI_ICONS } from './icons.js';
import { LOOK_OPTIONS, normLook } from '../render/models/player.js';

import { RANKS } from '../core/levels.js';
const BUTTON_SIZES = [0.85, 1, 1.15, 1.3];
// The skin editor: one tab per part of the hunter. A row is a colour
// ('c', look key, palette) or a choice ('o', look key from LOOK_OPTIONS).
const ED_TABS = {
  body: [['c', 'skin', 'skin'], ['o', 'build'], ['o', 'height']],
  face: [['c', 'eyes', 'eyes'], ['o', 'eyeShape'], ['o', 'mark'], ['o', 'facialHair'], ['o', 'accessory']],
  hair: [['o', 'hairStyle'], ['c', 'hair', 'hair']],
  outfit: [['o', 'outfit'], ['c', 'clothes', 'clothes'], ['c', 'accent', 'accent'], ['c', 'pants', 'pants'], ['c', 'leather', 'leather']],
  cape: [['o', 'capeStyle'], ['c', 'capeColor', 'cape']],
  aura: [['o', 'auraStyle'], ['c', 'aura', 'aura']],
};
const ED_FACE = { face: 1, hair: 1 }; // tabs where the camera moves in on the head
const GLOW_KEYS = { eyes: 1, aura: 1 };

const hex = (n) => '#' + n.toString(16).padStart(6, '0');
const diffSegs = (cur) => Object.keys(CONFIG.difficulty.levels).map((k) =>
  `<button class="seg dif-${k}${cur === k ? ' on' : ''}" data-act="diff" data-v="${k}">${t('diff.' + k)}</button>`).join('');
function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export function formatPlayTime(sec) {
  const m = Math.floor(sec / 60), h = Math.floor(m / 60);
  return h > 0 ? t('time.hm', { h, m: m % 60 }) : t('time.m', { m });
}

export function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function randomLook() {
  const P = CONFIG.palettes;
  const pick = (a) => a[(Math.random() * a.length) | 0];
  const opt = (k) => (Math.random() * LOOK_OPTIONS[k].length) | 0;
  // the plainer choices come up more often
  const maybe = (k, chance) => (Math.random() < chance ? opt(k) : 0);
  return normLook({
    skin: pick(P.skin), hair: pick(P.hair), eyes: pick(P.eyes), clothes: pick(P.clothes),
    accent: pick(P.accent), pants: pick(P.pants), leather: pick(P.leather), capeColor: pick(P.cape), aura: pick(P.aura),
    build: opt('build'), height: opt('height'), hairStyle: opt('hairStyle'), eyeShape: maybe('eyeShape', 0.5),
    mark: maybe('mark', 0.45), facialHair: maybe('facialHair', 0.4), accessory: maybe('accessory', 0.45),
    outfit: opt('outfit'), capeStyle: Math.random() < 0.8 ? 1 + ((Math.random() * (LOOK_OPTIONS.capeStyle.length - 1)) | 0) : 0,
    auraStyle: opt('auraStyle'),
  });
}

export class Screens {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screens');
    this.current = null;
    this.params = null;
    this.confirmBox = null; // { text, yes, onYes }
    this.bk = {}; // automatic backups per slot (Worlds page)
    this.bkPick = -1; // slot whose backups are listed
    this.preview = null;
    this.ed = null; // skin editor state
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('change', (e) => { if (e.target.dataset.act === 'pick' && this.ed) this.render(); });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.msg = ''; // note on the Load Game screen (import result)
    this.cloud = null; // cloud copies by slot: { slot: { saved_at, summary } }
    this.pairCode = null; // pairing code once shown: { code, until }
    this.setMsg = ''; // note in the online part of the settings
    this.busy = false;
    this.stages = new WorldStages(); // 3D hunters on the world cards
    this.stageKey = '';
    this.board = new Board(() => { if (this.current === 'board') this.render(); }, () => this.submitSlots());
    // typing a name or a code must not reach the game keys
    this.el.addEventListener('keydown', (e) => {
      if (e.target.tagName !== 'INPUT') return;
      e.stopPropagation();
      if (e.key === 'Enter' && e.target.closest('.lb-name')) this.board.saveName(this.el);
    });
    // the character in the skin editor is turned by dragging over it
    let drag = -1, lastX = 0, lastT = 0;
    this.el.addEventListener('pointerdown', (e) => {
      if (!this.preview || this.current !== 'editor' || !e.target.closest('.ed-stage')) return;
      drag = e.pointerId;
      lastX = e.clientX;
      lastT = performance.now();
      this.preview.dragStart();
    });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerId !== drag || !this.preview) return;
      const now = performance.now();
      this.preview.dragMove(e.clientX - lastX, (now - lastT) / 1000);
      lastX = e.clientX;
      lastT = now;
    });
    const end = (e) => {
      if (e.pointerId !== drag) return;
      drag = -1;
      if (this.preview) this.preview.dragEnd();
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  show(name, params = {}) {
    if (this.current === 'editor' && name !== 'editor') this.closeEditor();
    this.current = name;
    this.params = params;
    this.confirmBox = null;
    this.bkPick = -1;
    this.msg = '';
    document.body.classList.toggle('editing', name === 'editor');
    this.el.className = 'on scr-' + name;
    if (name === 'editor') this.openEditor(params);
    if (name !== 'load') { this.stages.stop(); this.stageKey = ''; }
    if (name === 'load') { this.fetchCloud(); this.loadBackups(); }
    if (name === 'online') {
      this.pairCode = null;
      this.setMsg = '';
      refreshLink().then(() => { if (this.current === 'online') this.render(); }).catch(() => {});
    }
    // paired devices: take over what was played on the other one
    if (name === 'title' || name === 'load') this.app.syncWorlds();
    // outside the Abyss the level board comes first
    if (name === 'board') { this.board.naming = false; this.submitSlots(); this.board.show('level'); }
    this.render();
    flashClass(this.el, 'enter');
  }

  hide() {
    if (this.current === 'editor') this.closeEditor();
    this.stages.stop();
    this.stageKey = '';
    this.current = null;
    this.confirmBox = null;
    document.body.classList.remove('editing');
    this.el.className = '';
    this.el.innerHTML = '';
  }

  // a new version is ready (shown on the title screen)
  updateReady() {
    if (this.current === 'title') this.render();
  }

  async loadBackups() {
    const bk = {};
    for (let i = 0; i < 3; i++) bk[i] = await listBackups(i).catch(() => []);
    this.bk = bk;
    if (this.current === 'load') this.render();
  }

  bkButton(i) {
    const n = (this.bk[i] || []).length;
    return n ? `<button class="sbtn ghost small" data-act="backups" data-slot="${i}">${t('bk.btn')}</button>` : '';
  }

  backupBox() {
    const i = this.bkPick, list = this.bk[i] || [];
    const items = list.map((b) => `<button class="sbtn ghost bk-item" data-act="bkGo" data-slot="${i}" data-v="${b.at}">
        <b>${esc(b.name)}</b><small>${t('bk.item', { level: b.level, date: formatDate(b.at) })}</small></button>`).join('');
    return `<div class="scr-modal"><div class="scr-box bk-box"><h2>${t('bk.title', { n: i + 1 })}</h2><p>${t('bk.hint')}</p>
      <div class="bk-list">${items}</div>
      <div class="scr-row"><button class="sbtn ghost" data-act="bkClose">${t('bk.close')}</button></div></div></div>`;
  }

  confirm(text, yes, onYes) {
    this.confirmBox = { text, yes, onYes };
    this.render();
  }

  // ---- events -----------------------------------------------------------------
  onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    play('ui');
    const app = this.app, act = b.dataset.act, v = b.dataset.v;
    const slot = Number(b.dataset.slot);

    if (act === 'no') { this.confirmBox = null; this.render(); return; }
    if (act === 'yes') {
      const fn = this.confirmBox && this.confirmBox.onYes;
      this.confirmBox = null;
      if (fn) fn();
      else this.render();
      return;
    }
    if (this.board.handle(act, this.el, v)) return;
    switch (act) {
      // title
      case 'worlds': this.show('load'); break;
      case 'board': this.show('board'); break;
      case 'online': this.show('online', { back: this.current === 'settings' ? 'settings' : 'title', settingsBack: this.params && this.params.back }); break;
      case 'onlineBack':
        if (this.params.back === 'settings') this.show('settings', { back: this.params.settingsBack });
        else this.show('title');
        break;
      case 'newIn': this.show('editor', { mode: 'new', slot }); break;
      // the look of a world is changed here, in the Worlds screen, not while playing
      case 'lookSlot': {
        const s = app.slots[slot];
        if (s) this.show('editor', { mode: 'slot', slot, appearance: { ...CONFIG.defaultAppearance, ...(s.appearance || {}) }, equip: (s.player && s.player.equip) || null, cls: s.mainClass || '' });
        break;
      }
      case 'continue': app.continueLast(); break;
      case 'newWorld': this.show('newSlot'); break;
      case 'loadGame': this.show('load'); break;
      case 'settings': this.show('settings', { back: this.current }); break;
      case 'toTitle': this.show('title'); break;
      // load
      case 'load': app.loadSlot(slot); break;
      case 'export': app.exportSlot(slot); break;
      case 'update': app.applyUpdate(); break;
      case 'backups': this.bkPick = slot; this.render(); break;
      case 'bkClose': this.bkPick = -1; this.render(); break;
      case 'bkGo': {
        const at = Number(v), b = (this.bk[slot] || []).find((x) => x.at === at);
        if (!b) break;
        this.bkPick = -1;
        this.confirm(t('confirm.restore', { name: b.name, level: b.level, date: formatDate(b.at) }), t('confirm.restoreYes'), async () => {
          const s = await app.restoreBackup(slot, at);
          this.msg = s ? t('bk.done', { name: s.name }) : t('bk.failed');
          await this.loadBackups();
          this.render();
        });
        break;
      }
      case 'import':
        app.importSlot(slot, (ok) => {
          if (this.current !== 'load') return;
          this.msg = t(ok ? 'slot.imported' : 'slot.importFailed');
          this.render();
        });
        break;
      case 'cloudLoad': {
        const c = this.cloud && this.cloud[slot];
        if (!c) break;
        const local = app.slots[slot];
        if (local) {
          this.confirm(t('confirm.cloud', { name: local.name, date: formatDate(c.saved_at) }), t('confirm.cloudYes'), () => this.loadCloud(slot));
        } else this.loadCloud(slot);
        break;
      }
      case 'delete':
        this.confirm(t(isLinked() ? 'confirm.deleteLinked' : 'confirm.delete', { name: app.slots[slot].name }), t('confirm.deleteYes'), () => app.removeSlot(slot));
        break;
      // new world
      case 'pickSlot':
        if (app.slots[slot]) {
          this.confirm(t('confirm.overwrite', { name: app.slots[slot].name }), t('confirm.overwriteYes'),
            () => this.show('editor', { mode: 'new', slot }));
        } else {
          this.show('editor', { mode: 'new', slot });
        }
        break;
      // editor
      case 'color': this.ed.look[b.dataset.key] = Number(v); this.lookChanged(); break;
      case 'opt':
        this.ed.look[b.dataset.key] = Number(v);
        this.ed.look.cape = this.ed.look.capeStyle > 0;
        this.lookChanged();
        break;
      case 'edTab':
        this.ed.tab = v;
        this.preview.focus = ED_FACE[v] ? 1 : 0;
        this.preview.setLook(this.ed.look, this.shownEquip());
        this.render();
        break;
      case 'random': this.ed.look = randomLook(); this.lookChanged(); break;
      case 'edBack':
        if (this.params.mode === 'camp') app.closeEditorInCamp(null);
        else this.show('load');
        break;
      case 'edDone':
        if (this.params.mode === 'camp') app.closeEditorInCamp({ ...this.ed.look });
        else if (this.params.mode === 'slot') { app.setLook(this.params.slot, { ...this.ed.look }); this.show('load'); }
        else app.startNew(this.params.slot, this.worldName(), { ...this.ed.look }, this.ed.diff, this.ed.tutorial);
        break;
      case 'tutorial': this.ed.tutorial = !this.ed.tutorial; this.render(); break;
      // difficulty: in the new world editor, or of the running world
      case 'diff':
        if (this.ed) this.ed.diff = v;
        else if (app.game) app.game.setDifficulty(v);
        this.render();
        break;
      // settings
      case 'gfx': setSetting('graphics', v); this.render(); break;
      case 'btnSize': setSetting('buttonSize', Number(v)); this.render(); break;
      case 'swap': setSetting('swap', !settings.swap); this.render(); break;
      case 'hudEdit': app.hudEditor.open(); break;
      // developer: five taps on the heading show the button-use list
      case 'devTap': this.devTaps = (this.devTaps || 0) + 1; if (this.devTaps >= 5) { this.devTaps = 0; this.devUsage = !this.devUsage; this.showUsage = false; this.render(); } break;
      case 'usage': this.showUsage = !this.showUsage; this.render(); break;
      case 'usageReset': usageReset(); this.render(); break;
      // PC keys: a click waits for the next key press
      case 'keys': this.showKeys = !this.showKeys; this.stopBind(); this.render(); break;
      case 'keyBind': this.startBind(b.dataset.k); break;
      case 'keyReset': this.stopBind(); resetKeys(); this.render(); break;
      case 'fps': setSetting('showFps', !settings.showFps); app.fpsChanged(); this.render(); break;
      case 'vibrate': setSetting('vibrate', !settings.vibrate); this.render(); break;
      case 'cloud': if (!isLinked()) { setSetting('cloudSave', !settings.cloudSave); this.render(); } break;
      case 'hunterSave': {
        const inp = this.el.querySelector('.set-hunter input');
        const name = cleanName(inp ? inp.value : '');
        if (name.length < 2) { if (inp) flashClass(inp, 'shake'); break; }
        setSetting('hunterName', name);
        if (app.game) app.game.submitRecords(); else this.submitSlots();
        this.setMsg = '';
        this.render();
        break;
      }
      case 'pairShow': this.showPairCode(); break;
      case 'pairGo': {
        const inp = this.el.querySelector('.set-claim input');
        const code = inp ? inp.value.replace(/[^a-z0-9]/gi, '').toUpperCase() : '';
        if (code.length !== 5) { if (inp) flashClass(inp, 'shake'); break; }
        this.confirm(t('confirm.pair'), t('confirm.pairYes'), () => this.pair(code));
        break;
      }
      case 'unpair': this.confirm(t('confirm.unpair'), t('confirm.unpairYes'), () => this.unpair(false)); break;
      case 'unpairAll': this.confirm(t('confirm.unpairAll'), t('confirm.unpairYes'), () => this.unpair(true)); break;
      case 'setBack':
        if (this.params.back === 'pause') this.show('pause');
        else this.show('title');
        break;
      // pause
      case 'resume': app.resume(); break;
      case 'saveNow': app.saveNow(); break;
      case 'pauseSettings': this.show('settings', { back: 'pause' }); break;
      case 'pauseCoop': app.resume(); if (app.game) app.game.coopPanel.open(); break;
      case 'quit': app.exitToTitle(); break;
      // travel
      case 'travel': app.travelTo(Number(v)); break;
    }
  }

  onInput(e) {
    if (e.target.dataset.act === 'volume') {
      setSetting('volume', Number(e.target.value) / 100);
      const out = this.el.querySelector('.vol-val');
      if (out) out.textContent = e.target.value + '%';
    } else if (e.target.dataset.act === 'music') {
      setSetting('music', Number(e.target.value) / 100);
      const out = this.el.querySelector('.mus-val');
      if (out) out.textContent = e.target.value + '%';
    } else if (e.target.dataset.act === 'name' && this.ed) {
      this.ed.name = e.target.value;
    } else if (e.target.dataset.act === 'pick' && this.ed) {
      // own colour: the hunter follows the picker at once, the panel when it closes
      this.ed.look[e.target.dataset.key] = parseInt(e.target.value.slice(1), 16);
      const sw = e.target.closest('.sw');
      if (sw) sw.style.setProperty('--c', e.target.value);
      if (!this.pickQueued) {
        this.pickQueued = true;
        requestAnimationFrame(() => {
          this.pickQueued = false;
          if (this.ed && this.preview) this.preview.setLook(this.ed.look, this.shownEquip());
        });
      }
    }
  }

  // ---- cloud ---------------------------------------------------------------------
  async fetchCloud() {
    try {
      const list = await cloudList();
      this.cloud = {};
      for (const c of list) if (!(c.summary && c.summary.deleted)) this.cloud[c.slot] = { saved_at: Date.parse(c.saved_at), summary: c.summary || {} };
    } catch (_) {
      this.cloud = null;
    }
    if (this.current === 'load') this.render();
  }

  async loadCloud(slot) {
    if (this.busy) return;
    this.busy = true;
    let save = null;
    try { save = readSaveText(JSON.stringify(await cloudGet(slot))); } catch (_) { /* offline */ }
    this.busy = false;
    if (save) await this.app.store(slot, save);
    this.msg = t(save ? 'slot.cloudDone' : 'slot.cloudFailed', { n: slot + 1 });
    if (this.current === 'load') this.render();
  }

  // the worlds changed in the background (sync with a paired device)
  slotsChanged() {
    if (this.current === 'load') this.fetchCloud();
    if (this.current === 'title' || this.current === 'load' || this.current === 'online') this.render();
  }

  // runs a pairing step; the result is shown on the Online page
  async pairStep(fn) {
    if (this.busy) return;
    if (this.app.game) { this.setMsg = t('pair.leaveFirst'); this.render(); return; }
    this.busy = true;
    this.setMsg = t('pair.working');
    this.render();
    try {
      this.setMsg = (await fn()) || '';
    } catch (e) {
      const k = { invalid: 'pair.bad', 'too many': 'pair.tooMany', busy: 'pair.tooMany', linked: 'pair.linked', 'has devices': 'pair.hasDevices', self: 'pair.self', full: 'pair.full' }[e.message];
      this.setMsg = k ? t(k, { free: e.free || 0, n: this.app.slots.filter(Boolean).length }) : t('set.offline');
    }
    this.busy = false;
    if (this.current === 'online') this.render();
  }

  showPairCode() {
    this.pairStep(async () => {
      const d = await this.app.makePairCode();
      this.pairCode = { code: d.code, until: Date.parse(d.expires_at) };
      return '';
    });
  }

  pair(code) {
    this.pairStep(async () => {
      await this.app.pair(code);
      this.pairCode = null;
      return t('pair.done', { n: this.app.slots.filter(Boolean).length });
    });
  }

  unpair(all) {
    this.pairStep(async () => {
      if (all) await this.app.unpairOthers(); else await this.app.unpair();
      this.pairCode = null;
      return t(all ? 'pair.othersGone' : 'pair.gone');
    });
  }

    // ---- rendering --------------------------------------------------------------
  render() {
    const views = {
      title: () => this.title(), load: () => this.load(), newSlot: () => this.newSlot(),
      editor: () => this.editor(), settings: () => this.settingsView(), board: () => this.boardPage(), online: () => this.onlinePage(), pause: () => this.pause(), travel: () => this.travel(),
    };
    const keepScroll = [...this.el.querySelectorAll('[data-scroll]')].map((x) => [x.dataset.scroll, x.scrollTop]);
    let html = views[this.current] ? views[this.current]() : '';
    if (this.bkPick >= 0 && !this.confirmBox) html += this.backupBox();
    if (this.confirmBox) {
      html += `<div class="scr-modal confirm"><div class="scr-box"><p>${esc(this.confirmBox.text)}</p>
        <div class="scr-row"><button class="sbtn danger" data-act="yes">${esc(this.confirmBox.yes)}</button>
        <button class="sbtn ghost" data-act="no">${t('confirm.cancel')}</button></div></div></div>`;
    }
    this.el.innerHTML = html;
    for (const [k, top] of keepScroll) {
      const x = this.el.querySelector(`[data-scroll="${k}"]`);
      if (x) x.scrollTop = top;
    }
    if (this.current === 'editor' && this.preview) this.preview.anchor = this.el.querySelector('.ed-stage');
    if (this.current === 'load') {
      const els = [0, 1, 2].map((i) => this.el.querySelector(`.wc-stage[data-slot="${i}"]`));
      const key = this.app.slots.map((x) => (x ? x.updated : 0)).join(',');
      if (key !== this.stageKey) { this.stageKey = key; this.stages.set(this.app.slots, els); }
      else this.stages.rebind(els);
    }
  }

  header(title, back) {
    return `<div class="scr-head"><button class="sbtn ghost" data-act="${back}">${t('menu.back')}</button><h2>${title}</h2></div>`;
  }

  // the cloud copy of a slot on the Load Game screen: offered when it is newer
  cloudPart(i) {
    if (this.current !== 'load' || !this.cloud) return '';
    const c = this.cloud[i], s = this.app.slots[i];
    if (!c) return '';
    if (!s) {
      const m = c.summary || {};
      return `<div class="slot-cloud"><small>${t('slot.cloud', { date: formatDate(c.saved_at) })}</small>
        <small>${esc(m.name || '')} · ${t('slot.rankLevel', { rank: RANKS[m.rankIndex || 0], level: m.level || 1 })}</small>
        <button class="sbtn small" data-act="cloudLoad" data-slot="${i}">${t('slot.cloudRestore')}</button></div>`;
    }
    if (c.saved_at > (s.updated || 0) + 5000) {
      return `<div class="slot-cloud newer"><small>${t('slot.cloudNewer', { date: formatDate(c.saved_at) })}</small>
        <button class="sbtn small" data-act="cloudLoad" data-slot="${i}">${t('slot.cloudLoad')}</button></div>`;
    }
    return `<div class="slot-cloud ok"><small>☁ ${t('slot.cloud', { date: formatDate(c.saved_at) })}</small></div>`;
  }

  slotCard(i, buttons) {
    const s = this.app.slots[i];
    if (!s) {
      const cloud = this.cloudPart(i);
      return `<div class="slot empty${cloud ? ' has-cloud' : ''}"><b>${t('slot.title', { n: i + 1 })}</b><span>${t('slot.empty')}</span>${cloud}${buttons}</div>`;
    }
    const level = (s.player && s.player.level) || 1;
    const dk = CONFIG.difficulty.levels[s.difficulty] ? s.difficulty : CONFIG.difficulty.oldSaves;
    return `<div class="slot"><b>${s.mainClass ? `<i class="emb" data-c="${s.mainClass}"></i> ` : ''}${esc(s.name)}</b>
      <span class="rank">${t('slot.rankLevel', { rank: RANKS[s.rankIndex || 0], level })} · <em class="dif-${dk}">${t('diff.' + dk)}</em></span>
      <small>${t('slot.playTime', { time: formatPlayTime(s.playTime || 0) })}</small>
      <small>${formatDate(s.updated)}</small>${this.cloudPart(i)}${buttons}</div>`;
  }

  title() {
    const last = this.app.lastSave();
    const cont = last
      ? `<button class="sbtn main tm-cont" data-act="continue">${t('title.continue')}<small>${esc(last.name)} · ${t('slot.rankLevel', { rank: RANKS[last.rankIndex || 0], level: (last.player && last.player.level) || 1 })}</small></button>`
      : `<button class="sbtn main tm-cont" data-act="worlds">${t('title.start')}<small>${t('title.noWorld')}</small></button>`;
    const sq = (act, icon, label, extra = '') => `<button class="tm-sq" data-act="${act}">${icon}<span>${label}</span>${extra}</button>`;
    const name = settings.hunterName ? `<small class="tm-who">${esc(settings.hunterName)}</small>` : '';
    return `<div class="title-bg"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      ${this.app.updateReady ? `<div class="upd-bar"><span>${t('upd.ready')}</span><button class="sbtn small" data-act="update">${t('upd.go')}</button></div>` : ''}
      <div class="title">
        <div class="logo"><svg class="moon" viewBox="0 0 64 64"><path d="M40 6a26 26 0 1 0 18 44A22 22 0 1 1 40 6z" fill="currentColor"/></svg><h1>NOCTIS</h1><p>${t('title.tagline')}</p></div>
        <div class="title-menu">${cont}
          <button class="sbtn main tm-worlds" data-act="worlds">${UI_ICONS.worlds}<span>${t('title.worlds')}<small>${t('title.worldsSub')}</small></span></button>
          <div class="tm-row">
            ${sq('board', UI_ICONS.trophy, t('title.board'))}
            ${sq('online', UI_ICONS.cloud, t('title.online'), name)}
            ${sq('settings', UI_ICONS.gear, t('title.settings'))}
          </div>
        </div>
      </div>`;
  }

  // Worlds: one card per slot, the 3D hunter on top, the world and its
  // values below, then Continue. Empty slots start a new world.
  worldCard(i) {
    const s = this.app.slots[i];
    if (!s) {
      return `<div class="wcard empty"><div class="wc-empty"><b>${t('slot.title', { n: i + 1 })}</b><span>${t('slot.empty')}</span></div>
        ${this.cloudPart(i)}
        <button class="sbtn" data-act="newIn" data-slot="${i}">${t('wc.new')}</button>
        <button class="sbtn ghost small" data-act="import" data-slot="${i}">${t('slot.import')}</button>${this.bkButton(i)}</div>`;
    }
    const level = (s.player && s.player.level) || 1;
    const dk = CONFIG.difficulty.levels[s.difficulty] ? s.difficulty : CONFIG.difficulty.oldSaves;
    const army = Array.isArray(s.army) ? s.army.length : (s.army && Array.isArray(s.army.units) ? s.army.units.length : 0);
    const best = (s.abyss && s.abyss.best) || 0;
    const last = this.app.lastSave() === s;
    const stat = (label, v) => `<span><small>${label}</small><b>${v}</b></span>`;
    return `<div class="wcard${last ? ' last' : ''}">
      <div class="wc-stage" data-slot="${i}">${last ? `<em class="wc-badge">${t('wc.last')}</em>` : ''}</div>
      <div class="wc-info">
        <b class="wc-name">${esc(s.name)}</b>
        <span class="rank">${t('slot.rankLevel', { rank: RANKS[s.rankIndex || 0], level })} · <em class="dif-${dk}">${t('diff.' + dk)}</em></span>
        <div class="wc-stats">${stat(t('wc.abyss'), best || '–')}${stat(t('wc.shadows'), army)}${stat(t('wc.kills'), fmt(s.kills || 0))}${stat(t('wc.played'), formatPlayTime(s.playTime || 0))}</div>
        ${this.cloudPart(i)}
        <button class="sbtn go" data-act="load" data-slot="${i}">${t('title.continue')}</button>
        <div class="wc-more"><button class="sbtn small" data-act="lookSlot" data-slot="${i}">${t('wc.look')}</button><button class="sbtn ghost small" data-act="export" data-slot="${i}">${t('wc.backup')}</button>${this.bkButton(i)}
          <button class="sbtn danger small" data-act="delete" data-slot="${i}">${t('slot.delete')}</button></div>
      </div></div>`;
  }

  // the list of what was pressed how often (Settings > Button use)
  // wait for the next key press and give it to the action
  startBind(action) {
    this.stopBind();
    this.binding = action;
    keyState.capturing = true;
    this.onBindKey = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.code === 'Escape') { this.stopBind(); this.render(); return; }
      if (!canBind(e.code)) return;
      setKey(action, e.code);
      this.stopBind();
      this.render();
    };
    window.addEventListener('keydown', this.onBindKey, true);
    this.render();
  }

  stopBind() {
    if (this.onBindKey) window.removeEventListener('keydown', this.onBindKey, true);
    this.onBindKey = null;
    this.binding = '';
    keyState.capturing = false;
  }

  keysRows() {
    const rows = ACTIONS.map(([a]) => `<div class="set-row key-row"><div><b>${t('key.' + a)}</b></div><div class="segs"><button class="seg wide${this.binding === a ? ' on' : ''}" data-act="keyBind" data-k="${a}">${this.binding === a ? t('key.press') : keyLabel(keyOf(a))}</button></div></div>`).join('');
    return `<div class="set-row"><small>${t('key.fixed')}</small><div class="segs"><button class="seg" data-act="keyReset">${t('key.reset')}</button></div></div>${rows}`;
  }

  usageRow() {
    const { hours, rows } = usageReport();
    if (!rows.length) return `<div class="set-row"><small>${t('set.usageNone')}</small></div>`;
    const list = rows.slice(0, 14).map((r) => `<span class="us-row"><b>${r.id}</b><i>${r.n}</i><em>${r.perHour ? Math.round(r.perHour) + ' / h' : ''}</em></span>`).join('');
    return `<div class="set-row us"><div class="us-list">${list}</div><div class="segs"><small>${t('set.usageHours', { h: hours.toFixed(1) })}</small><button class="seg" data-act="usageReset">${t('set.usageReset')}</button></div></div>`;
  }

  load() {
    const cards = [0, 1, 2].map((i) => this.worldCard(i)).join('');
    return `<div class="scr-page">${this.header(t('title.worlds'), 'toTitle')}<p class="scr-hint">${this.msg || t('worlds.hint')}</p><div class="wcards">${cards}</div></div>`;
  }

  // the records of every world on this device (the server keeps the best ones)
  submitSlots() {
    for (const x of this.app.slots) {
      if (!x || !x.player) continue;
      submitScore({
        floor: (x.abyss && x.abyss.best) || 0, level: x.player.level || 1, mastery: (x.player.mastery && x.player.mastery.lv) || 0,
        rank: RANKS[x.rankIndex || 0] || 'E', difficulty: x.difficulty || 'normal',
        look: publicLook({ ...CONFIG.defaultAppearance, ...(x.appearance || {}) }), gear: publicGear(x.player.equip),
      }, settings.hunterName);
    }
  }

  // the leaderboard from the main menu
  boardPage() {
    const anyBest = this.board.kind === 'level' ? this.app.slots.some(Boolean) : this.app.slots.some((x) => x && x.abyss && x.abyss.best > 0);
    return `<div class="scr-page">${this.header(t('board.title'), 'toTitle')}
      <div class="board-box">${this.board.html(anyBest)}</div>
      <div class="scr-row end"><button class="sbtn" data-act="lbRefresh"${this.board.canRefresh() ? '' : ' disabled'}>${t('lb.refresh')}</button></div></div>`;
  }

  // hunter name, cloud save and pairing with other devices
  onlinePage() {
    const toggle = (act, on, off) => `<button class="seg wide${on ? ' on' : ''}" data-act="${act}"${off ? ' disabled' : ''}>${on ? t('set.on') : t('set.off')}</button>`;
    const ok = net.status !== 'offline';
    const L = linkInfo(), linked = L.role !== 'solo', busy = this.busy ? ' disabled' : '';
    const pc = this.pairCode && this.pairCode.until > Date.now() ? this.pairCode : null;
    const codeBox = pc
      ? `<div class="pair-code"><b>${esc(pc.code)}</b><small>${t('pair.codeHint', { time: new Date(pc.until).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) })}</small></div>`
      : `<button class="seg wide" data-act="pairShow"${busy}>${t('pair.show')}</button>`;
    let devices;
    if (L.role === 'member') {
      devices = `<div class="set-row pair-on"><div><b>${t('pair.on')}</b><small>${t('pair.onHint', { n: L.devices })}</small></div>
          <div class="segs"><button class="seg wide warn" data-act="unpair"${busy}>${t('pair.leave')}</button></div></div>`;
    } else {
      const others = L.role === 'owner'
        ? `<div class="set-row pair-on"><div><b>${t('pair.owner', { n: L.devices - 1 })}</b><small>${t('pair.ownerHint')}</small></div>
          <div class="segs"><button class="seg wide warn" data-act="unpairAll"${busy}>${t('pair.leaveAll')}</button></div></div>`
        : '';
      const join = L.role === 'solo'
        ? `<div class="set-row set-claim"><div><b>${t('pair.join')}</b><small>${t('pair.joinHint')}</small></div>
          <div class="segs"><input type="text" maxlength="5" placeholder="${t('pair.ph')}" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="${t('pair.join')}">
          <button class="seg" data-act="pairGo"${busy}>${t('pair.go')}</button></div></div>`
        : '';
      devices = `${others}<div class="set-row"><div><b>${t('pair.title')}</b><small>${t('pair.hint')}</small></div>
          <div class="segs">${codeBox}</div></div>${join}`;
    }
    return `<div class="scr-page">${this.header(t('online.title'), 'onlineBack')}
      <p class="scr-hint"><i class="net-dot${ok ? ' ok' : ''}"></i>${ok ? t('online.ok') : t('online.off')}</p>
      <div class="set-list" data-scroll="online">
        ${this.setMsg ? `<p class="set-msg">${esc(this.setMsg)}</p>` : ''}
        <div class="set-row set-hunter"><div><b>${t('set.hunter')}</b><small>${t(linked ? 'set.hunterHintPaired' : 'set.hunterHint')}</small></div>
          <div class="segs"><input type="text" maxlength="20" value="${esc(settings.hunterName)}" placeholder="${t('lb.namePh')}" autocomplete="off" aria-label="${t('set.hunter')}">
          <button class="seg" data-act="hunterSave">${t('lb.save')}</button></div></div>
        ${devices}
        <div class="set-row"><div><b>${t('set.cloud')}</b><small>${t(linked ? 'set.cloudPaired' : 'set.cloudHint')}</small></div><div class="segs">${toggle('cloud', settings.cloudSave || linked, linked)}</div></div>
      </div></div>`;
  }

    newSlot() {
    const cards = [0, 1, 2].map((i) => this.slotCard(i,
      `<div class="scr-row"><button class="sbtn${this.app.slots[i] ? ' warn' : ''}" data-act="pickSlot" data-slot="${i}">${this.app.slots[i] ? t('slot.overwrite') : t('slot.choose')}</button></div>`)).join('');
    return `<div class="scr-page">${this.header(t('new.title'), 'toTitle')}<p class="scr-hint">${t('new.hint')}</p><div class="slots">${cards}</div></div>`;
  }

  settingsView() {
    const seg = (act, options, cur) => options.map(([v, label]) =>
      `<button class="seg${String(cur) === String(v) ? ' on' : ''}" data-act="${act}" data-v="${v}">${label}</button>`).join('');
    const toggle = (act, on) => `<button class="seg wide${on ? ' on' : ''}" data-act="${act}">${on ? t('set.on') : t('set.off')}</button>`;
    const vol = Math.round(settings.volume * 100);
    const mus = Math.round((settings.music ?? 0.5) * 100);
    // the difficulty belongs to the world: only while one is running
    const g = this.app.game;
    const diff = g && this.params.back === 'pause'
      ? `<div class="set-row"><div><b>${t('set.difficulty')}</b><small>${t('diff.' + g.difficulty + '.desc')}</small></div>
          <div class="segs">${diffSegs(g.difficulty)}</div></div>`
      : '';
    return `<div class="scr-page">${this.header(t('title.settings'), 'setBack').replace('<h2>', '<h2 data-act="devTap">')}
      <div class="set-list" data-scroll="set">${diff}
        <div class="set-row"><div><b>${t('set.graphics')}</b><small>${settings.graphics === 'auto' ? t('set.autoNow', { level: t('set.' + gfx.level), pct: Math.round(gfx.renderScale * 100) }) : t('set.graphicsHint')}</small></div>
          <div class="segs">${seg('gfx', [['auto', t('set.auto')], ['low', t('set.low')], ['medium', t('set.medium')], ['high', t('set.high')], ['ultra', t('set.ultra')]], settings.graphics)}</div></div>
        <div class="set-row"><div><b>${t('set.volume')}</b></div>
          <div class="segs"><input type="range" min="0" max="100" step="5" value="${vol}" data-act="volume"><span class="vol-val">${vol}%</span></div></div>
        <div class="set-row"><div><b>${t('set.music')}</b></div>
          <div class="segs"><input type="range" min="0" max="100" step="5" value="${mus}" data-act="music"><span class="mus-val">${mus}%</span></div></div>
        <div class="set-row"><div><b>${t('set.buttons')}</b></div>
          <div class="segs">${seg('btnSize', BUTTON_SIZES.map((s, i) => [s, t('set.size' + i)]), settings.buttonSize)}</div></div>
        <div class="set-row"><div><b>${t('set.layout')}</b><small>${t('set.layoutHint')}</small></div><div class="segs"><button class="seg wide" data-act="hudEdit">${t('set.layoutEdit')}</button></div></div>
        <div class="set-row"><div><b>${t('set.keys')}</b><small>${t('set.keysHint')}</small></div><div class="segs"><button class="seg wide${this.showKeys ? ' on' : ''}" data-act="keys">${t('set.usageShow')}</button></div></div>
        ${this.showKeys ? this.keysRows() : ''}
        ${this.devUsage ? `<div class="set-row"><div><b>${t('set.usage')}</b><small>${t('set.usageHint')}</small></div><div class="segs"><button class="seg wide${this.showUsage ? ' on' : ''}" data-act="usage">${t('set.usageShow')}</button></div></div>` : ''}
        ${this.showUsage ? this.usageRow() : ''}
        <div class="set-row"><div><b>${t('set.swap')}</b><small>${t('set.swapHint')}</small></div><div class="segs">${toggle('swap', settings.swap)}</div></div>
        <div class="set-row"><div><b>${t('set.vibrate')}</b><small>${t('set.vibrateHint')}</small></div><div class="segs">${toggle('vibrate', settings.vibrate)}</div></div>
        <div class="set-row"><div><b>${t('set.fps')}</b></div><div class="segs">${toggle('fps', settings.showFps)}</div></div>
        <div class="set-row"><div><b>${t('set.online')}</b><small>${t('set.onlineHint')}</small></div>
          <div class="segs"><button class="seg wide" data-act="online">${t('set.onlineOpen')}</button></div></div>
      </div></div>`;
  }

  pause() {
    return `<div class="scr-modal pause"><div class="scr-box">
      <h2>${t('pause.title')}</h2>
      <button class="sbtn main" data-act="resume">${t('pause.resume')}</button>
      <button class="sbtn main" data-act="saveNow"${this.app.game && this.app.game.slot >= 0 ? '' : ' disabled'}>${t('pause.save')}</button>
      <button class="sbtn main" data-act="pauseCoop">${t('coop.title')}</button>
      <button class="sbtn main" data-act="pauseSettings">${t('title.settings')}</button>
      <button class="sbtn main ghost" data-act="quit">${t('pause.quit')}</button>
    </div></div>`;
  }

  // ---- fast travel --------------------------------------------------------------
  travel() {
    const g = this.app.game;
    if (!g) return '';
    // One row per zone: rank, name and levels on the left, the four outposts
    // (north, east, south, west) on the right. Zones not found yet stay hidden.
    const here = g.player.safeIndex;
    const op = (si, label) => {
      const s = g.world.safes[si];
      const isHere = si === here, open = si === 0 || g.discovered.has(si);
      const cls = isHere ? 'here' : open ? 'open' : 'locked';
      const sub = isHere ? t('travel.here') : open ? (si === g.respawnIndex ? t('travel.respawn') : t('travel.go')) : t('travel.locked');
      const tag = open && !isHere ? `button data-act="travel" data-v="${si}"` : 'div';
      return `<${tag} class="tv-op ${cls}${si === g.respawnIndex ? ' rs' : ''}"><b>${label || t('dir.' + s.dir)}</b><small>${sub}</small></${tag.split(' ')[0]}>`;
    };
    let captured = 0, total = 0;
    const rows = [`<div class="tv-zone camp"><div class="tv-zh"><em>⌂</em><div><b>${t('zone.camp')}</b><small>${t('zone.camp.sub')}</small></div></div>
      <div class="tv-ops one">${op(0, t('zone.camp'))}</div></div>`];
    let unknown = 0;
    CONFIG.world.zones.forEach((zone, zi) => {
      const ids = [];
      g.world.safes.forEach((s, si) => { if (s.zone === zi) ids.push(si); });
      ids.sort((a, b) => g.world.safes[a].dir - g.world.safes[b].dir);
      const n = ids.filter((si) => g.discovered.has(si)).length;
      captured += n; total += ids.length;
      if (!g.knownZones.has(zi)) { unknown++; return; }
      rows.push(`<div class="tv-zone" style="--zc:${hex(zone.gateColor)}">
        <div class="tv-zh"><em>${zone.rank}</em><div><b>${t('zone.' + zone.id)}</b><small>${t('travel.levels', { level: zone.level, to: zone.levelTo })} · ${n}/${ids.length}</small></div></div>
        <div class="tv-ops">${ids.map((si) => op(si)).join('')}</div></div>`);
    });
    if (unknown) rows.push(`<div class="tv-zone unknown"><div class="tv-zh"><em>?</em><div><b>${t('travel.unknown', { n: unknown })}</b><small>${t('travel.unknownSub')}</small></div></div></div>`);
    return `<div class="scr-modal"><div class="scr-box travel-box">
      <div class="tv-head"><h2>${t('travel.title')}</h2><small>${t('travel.count', { n: captured, max: total })}</small></div>
      <div class="tv-list" data-scroll="tv">${rows.join('')}</div>
      <button class="sbtn ghost" data-act="resume">${t('menu.close')}</button></div></div>`;
  }

  // ---- skin editor -----------------------------------------------------------
  openEditor(params) {
    const start = params.appearance ? { ...params.appearance } : randomLook();
    this.ed = {
      look: normLook({ ...CONFIG.defaultAppearance, ...start }),
      tab: params.mode === 'new' ? 'world' : 'body',
      name: params.mode === 'new' ? t('new.defaultName', { n: params.slot + 1 }) : '',
      diff: CONFIG.difficulty.default,
      tutorial: !this.app.slots.some(Boolean), // on for the first world
      equip: params.equip || { weapon: { kind: 'weapon', type: CONFIG.player.startWeapon, rarity: 0, level: 1, up: 0 } },
    };
    if (!this.preview) this.preview = new Preview();
    this.preview.cls = params.cls || '';
    this.preview.setLook(this.ed.look, this.ed.equip);
    this.preview.focus = 0;
    this.preview.start(null);
  }

  closeEditor() {
    if (this.preview) this.preview.stop();
    this.ed = null;
  }

  // the equipment shown: without the helmet while the face or hair is edited
  shownEquip() {
    const e = this.ed.equip;
    return ED_FACE[this.ed.tab] && e && e.helmet ? { ...e, helmet: null } : e;
  }

  lookChanged() {
    this.preview.setLook(this.ed.look, this.shownEquip());
    this.render();
  }

  worldName() {
    const n = (this.ed.name || '').trim().slice(0, CONFIG.save.nameMaxLength);
    return n || t('new.defaultName', { n: this.params.slot + 1 });
  }

  // one row of the editor: colour swatches with an own colour at the end, or choices
  edRow([kind, key, pal]) {
    const L = this.ed.look;
    const label = `<b>${t('ed.' + key)}</b>`;
    if (kind === 'o') {
      const segs = LOOK_OPTIONS[key].map((o, i) => `<button class="seg${L[key] === i ? ' on' : ''}" data-act="opt" data-key="${key}" data-v="${i}">${t('opt.' + key + '.' + o)}</button>`).join('');
      return `<div class="ed-row">${label}<div class="segs wrap">${segs}</div></div>`;
    }
    const P = CONFIG.palettes[pal], cur = L[key];
    const glow = GLOW_KEYS[key] ? ' glow' : '';
    const sw = P.map((c) => `<button class="sw${cur === c ? ' on' : ''}${glow}" style="--c:${hex(c)}" data-act="color" data-key="${key}" data-v="${c}" aria-label="${hex(c)}"></button>`).join('');
    const own = !P.includes(cur);
    const pick = `<label class="sw pick${own ? ' on' : ''}${glow}" style="--c:${hex(cur)}" title="${t('ed.own')}"><input type="color" data-act="pick" data-key="${key}" value="${hex(cur)}" aria-label="${t('ed.own')}"></label>`;
    const off = key === 'capeColor' && !L.capeStyle;
    return `<div class="ed-row">${label}<div class="sws${off ? ' off' : ''}">${sw}${pick}</div></div>`;
  }

  editor() {
    const isNew = this.params.mode === 'new', tab = this.ed.tab;
    const tabs = (isNew ? ['world'] : []).concat(Object.keys(ED_TABS)).map((k) => `<button class="seg${tab === k ? ' on' : ''}" data-act="edTab" data-v="${k}">${t('edtab.' + k)}</button>`).join('');
    const rows = tab === 'world'
      ? `<label class="ed-name"><b>${t('new.name')}</b><input type="text" data-act="name" maxlength="${CONFIG.save.nameMaxLength}" value="${esc(this.ed.name)}" autocomplete="off" spellcheck="false"></label>
        <div class="ed-diff"><b>${t('set.difficulty')}</b><div class="segs">${diffSegs(this.ed.diff)}</div><small>${t('diff.' + this.ed.diff + '.desc')}</small></div>
        <div class="ed-tut"><b>${t('new.tutorial')}</b><button class="seg${this.ed.tutorial ? ' on' : ''}" data-act="tutorial">${this.ed.tutorial ? t('set.on') : t('set.off')}</button><small>${t('new.tutorialHint')}</small></div>`
      : ED_TABS[tab].map((r) => this.edRow(r)).join('');
    return `<div class="ed">
      <div class="ed-stage"><h2>${isNew ? t('new.title2') : t('ed.title')}</h2><p><b>↔ ${t('ed.rotate')}</b><br>${t('ed.note')}</p></div>
      <div class="ed-panel">
        <div class="ed-tabs">${tabs}</div>
        <div class="ed-opts" data-scroll="ed-${tab}">${rows}</div>
        <div class="scr-row ed-bar">
          <button class="sbtn ghost" data-act="edBack">${isNew ? t('menu.back') : t('confirm.cancel')}</button>
          <button class="sbtn" data-act="random">${t('ed.random')}</button>
          <button class="sbtn go" data-act="edDone">${isNew ? t('new.start') : t('ed.save')}</button>
        </div>
      </div></div>`;
  }
}
