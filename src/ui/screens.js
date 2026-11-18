// Full-screen menus outside the game world: title screen, Load Game,
// New World (slot choice and skin editor), settings, pause menu and
// confirmation dialogs. Everything is rendered into #screens; clicks are
// handled by one delegated listener (data-act attributes).
import { CONFIG } from '../config.js';
import { flashClass } from '../core/format.js';
import { t } from '../strings.js';
import { settings, setSetting, gfx } from '../core/settings.js';
import { play } from '../core/sfx.js';
import { Preview } from './preview.js';
import { readSaveText } from '../core/storage.js';
import { cloudList, cloudGet, transferCode, claimCode, formatCode, cleanName, flushScore } from '../net/online.js';

import { RANKS } from '../core/levels.js';
const HAIR_KEYS = ['short', 'spiky', 'long', 'ponytail', 'mohawk', 'swept'];
const BUTTON_SIZES = [0.85, 1, 1.15, 1.3];
const PALETTE_ROWS = [
  ['skin', 'skin'],
  ['hair', 'hair'],
  ['eyes', 'eyes'],
  ['clothes', 'clothes'],
  ['capeColor', 'cape'],
  ['aura', 'aura'],
];

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
  return {
    skin: pick(P.skin), hair: pick(P.hair), hairStyle: (Math.random() * CONFIG.hairStyles) | 0,
    eyes: pick(P.eyes), clothes: pick(P.clothes), cape: Math.random() < 0.75,
    capeColor: pick(P.cape), aura: pick(P.aura),
  };
}

export class Screens {
  constructor(app) {
    this.app = app;
    this.el = document.getElementById('screens');
    this.current = null;
    this.params = null;
    this.confirmBox = null; // { text, yes, onYes }
    this.preview = null;
    this.ed = null; // skin editor state
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('input', (e) => this.onInput(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.msg = ''; // note on the Load Game screen (import result)
    this.cloud = null; // cloud copies by slot: { slot: { saved_at, summary } }
    this.code = ''; // transfer code once shown
    this.setMsg = ''; // note in the online part of the settings
    this.busy = false;
    // typing a name or a code must not reach the game keys
    this.el.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') e.stopPropagation(); });
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
    this.msg = '';
    document.body.classList.toggle('editing', name === 'editor');
    this.el.className = 'on scr-' + name;
    if (name === 'editor') this.openEditor(params);
    if (name === 'load') this.fetchCloud();
    if (name === 'settings') { this.code = ''; this.setMsg = ''; }
    this.render();
    flashClass(this.el, 'enter');
  }

  hide() {
    if (this.current === 'editor') this.closeEditor();
    this.current = null;
    this.confirmBox = null;
    document.body.classList.remove('editing');
    this.el.className = '';
    this.el.innerHTML = '';
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
    switch (act) {
      // title
      case 'continue': app.continueLast(); break;
      case 'newWorld': this.show('newSlot'); break;
      case 'loadGame': this.show('load'); break;
      case 'settings': this.show('settings', { back: this.current }); break;
      case 'toTitle': this.show('title'); break;
      // load
      case 'load': app.loadSlot(slot); break;
      case 'export': app.exportSlot(slot); break;
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
        this.confirm(t('confirm.delete', { name: app.slots[slot].name }), t('confirm.deleteYes'), () => app.removeSlot(slot));
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
      case 'hairStyle': this.ed.look.hairStyle = Number(v); this.lookChanged(); break;
      case 'cape': this.ed.look.cape = !this.ed.look.cape; this.lookChanged(); break;
      case 'random': this.ed.look = randomLook(); this.lookChanged(); break;
      case 'edBack':
        if (this.params.mode === 'camp') app.closeEditorInCamp(null);
        else this.show('newSlot');
        break;
      case 'edDone':
        if (this.params.mode === 'camp') app.closeEditorInCamp({ ...this.ed.look });
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
      case 'fps': setSetting('showFps', !settings.showFps); app.fpsChanged(); this.render(); break;
      case 'cloud': setSetting('cloudSave', !settings.cloudSave); this.render(); break;
      case 'hunterSave': {
        const inp = this.el.querySelector('.set-hunter input');
        const name = cleanName(inp ? inp.value : '');
        if (name.length < 2) { if (inp) flashClass(inp, 'shake'); break; }
        setSetting('hunterName', name);
        if (app.game) app.game.submitAbyss(); else flushScore();
        this.setMsg = '';
        this.render();
        break;
      }
      case 'codeShow': this.showCode(); break;
      case 'claim': this.claim(); break;
      case 'setBack':
        if (this.params.back === 'pause') this.show('pause');
        else this.show('title');
        break;
      // pause
      case 'resume': app.resume(); break;
      case 'saveNow': app.saveNow(); break;
      case 'pauseSettings': this.show('settings', { back: 'pause' }); break;
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
    } else if (e.target.dataset.act === 'name' && this.ed) {
      this.ed.name = e.target.value;
    }
  }

  // ---- cloud ---------------------------------------------------------------------
  async fetchCloud() {
    try {
      const list = await cloudList();
      this.cloud = {};
      for (const c of list) this.cloud[c.slot] = { saved_at: Date.parse(c.saved_at), summary: c.summary || {} };
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

  async showCode() {
    if (this.busy) return;
    this.busy = true;
    this.code = t('set.codeLoading');
    this.render();
    try { this.code = formatCode(await transferCode()); this.setMsg = ''; } catch (_) { this.code = ''; this.setMsg = t('set.offline'); }
    this.busy = false;
    if (this.current === 'settings') this.render();
  }

  async claim() {
    const inp = this.el.querySelector('.set-claim input');
    const code = inp ? inp.value.replace(/[^a-z0-9]/gi, '') : '';
    if (code.length !== 12) { if (inp) flashClass(inp, 'shake'); return; }
    if (this.busy) return;
    this.busy = true;
    try {
      const n = await claimCode(code);
      this.setMsg = t('set.claimOk', { n });
      this.code = '';
    } catch (e) {
      this.setMsg = e.message === 'invalid code' ? t('set.claimBad') : t('set.offline');
    }
    this.busy = false;
    if (this.current === 'settings') this.render();
  }

  // ---- rendering --------------------------------------------------------------
  render() {
    const views = {
      title: () => this.title(), load: () => this.load(), newSlot: () => this.newSlot(),
      editor: () => this.editor(), settings: () => this.settingsView(), pause: () => this.pause(), travel: () => this.travel(),
    };
    const keepScroll = [...this.el.querySelectorAll('[data-scroll]')].map((x) => [x.dataset.scroll, x.scrollTop]);
    let html = views[this.current] ? views[this.current]() : '';
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
    return `<div class="slot"><b>${esc(s.name)}</b>
      <span class="rank">${t('slot.rankLevel', { rank: RANKS[s.rankIndex || 0], level })} · <em class="dif-${dk}">${t('diff.' + dk)}</em></span>
      <small>${t('slot.playTime', { time: formatPlayTime(s.playTime || 0) })}</small>
      <small>${formatDate(s.updated)}</small>${this.cloudPart(i)}${buttons}</div>`;
  }

  title() {
    const last = this.app.lastSave();
    const cont = last
      ? `<button class="sbtn main" data-act="continue">${t('title.continue')}<small>${esc(last.name)} · ${t('slot.rankLevel', { rank: RANKS[last.rankIndex || 0], level: (last.player && last.player.level) || 1 })}</small></button>`
      : `<button class="sbtn main" disabled>${t('title.continue')}</button>`;
    return `<div class="title-bg"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="title">
        <div class="logo"><svg class="moon" viewBox="0 0 64 64"><path d="M40 6a26 26 0 1 0 18 44A22 22 0 1 1 40 6z" fill="currentColor"/></svg><h1>NOCTIS</h1><p>${t('title.tagline')}</p></div>
        <div class="title-menu">${cont}
          <button class="sbtn main" data-act="newWorld">${t('title.new')}</button>
          <button class="sbtn main" data-act="loadGame">${t('title.load')}</button>
          <button class="sbtn main" data-act="settings">${t('title.settings')}</button>
        </div>
      </div>`;
  }

  load() {
    // Backup: a world can be saved as a file and put back into an empty slot
    const cards = [0, 1, 2].map((i) => this.slotCard(i, this.app.slots[i]
      ? `<div class="scr-row"><button class="sbtn" data-act="load" data-slot="${i}">${t('slot.load')}</button>
         <button class="sbtn danger" data-act="delete" data-slot="${i}">${t('slot.delete')}</button></div>
         <button class="sbtn ghost small" data-act="export" data-slot="${i}">${t('slot.export')}</button>`
      : `<button class="sbtn ghost small" data-act="import" data-slot="${i}">${t('slot.import')}</button>`)).join('');
    return `<div class="scr-page">${this.header(t('title.load'), 'toTitle')}<p class="scr-hint">${this.msg || t('slot.backupHint')}</p><div class="slots">${cards}</div></div>`;
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
    // the difficulty belongs to the world: only while one is running
    const g = this.app.game;
    const diff = g && this.params.back === 'pause'
      ? `<div class="set-row"><div><b>${t('set.difficulty')}</b><small>${t('diff.' + g.difficulty + '.desc')}</small></div>
          <div class="segs">${diffSegs(g.difficulty)}</div></div>`
      : '';
    return `<div class="scr-page">${this.header(t('title.settings'), 'setBack')}
      <div class="set-list" data-scroll="set">${diff}
        <div class="set-row"><div><b>${t('set.graphics')}</b><small>${settings.graphics === 'auto' ? t('set.autoNow', { level: t('set.' + gfx.level) }) : t('set.graphicsHint')}</small></div>
          <div class="segs">${seg('gfx', [['auto', t('set.auto')], ['low', t('set.low')], ['medium', t('set.medium')], ['high', t('set.high')]], settings.graphics)}</div></div>
        <div class="set-row"><div><b>${t('set.volume')}</b></div>
          <div class="segs"><input type="range" min="0" max="100" step="5" value="${vol}" data-act="volume"><span class="vol-val">${vol}%</span></div></div>
        <div class="set-row"><div><b>${t('set.buttons')}</b></div>
          <div class="segs">${seg('btnSize', BUTTON_SIZES.map((s, i) => [s, t('set.size' + i)]), settings.buttonSize)}</div></div>
        <div class="set-row"><div><b>${t('set.swap')}</b><small>${t('set.swapHint')}</small></div><div class="segs">${toggle('swap', settings.swap)}</div></div>
        <div class="set-row"><div><b>${t('set.fps')}</b></div><div class="segs">${toggle('fps', settings.showFps)}</div></div>
        <h3 class="set-sec">${t('set.online')}</h3>
        ${this.setMsg ? `<p class="set-msg">${esc(this.setMsg)}</p>` : ''}
        <div class="set-row set-hunter"><div><b>${t('set.hunter')}</b><small>${t('set.hunterHint')}</small></div>
          <div class="segs"><input type="text" maxlength="20" value="${esc(settings.hunterName)}" placeholder="${t('lb.namePh')}" autocomplete="off" aria-label="${t('set.hunter')}">
          <button class="seg" data-act="hunterSave">${t('lb.save')}</button></div></div>
        <div class="set-row"><div><b>${t('set.cloud')}</b><small>${t('set.cloudHint')}</small></div><div class="segs">${toggle('cloud', settings.cloudSave)}</div></div>
        <div class="set-row"><div><b>${t('set.code')}</b><small>${t('set.codeHint')}</small></div>
          <div class="segs">${this.code ? `<span class="set-code">${esc(this.code)}</span>` : `<button class="seg wide" data-act="codeShow">${t('set.codeShow')}</button>`}</div></div>
        <div class="set-row set-claim"><div><b>${t('set.claim')}</b><small>${t('set.claimHint')}</small></div>
          <div class="segs"><input type="text" maxlength="16" placeholder="${t('set.claimPh')}" autocomplete="off" autocapitalize="characters" aria-label="${t('set.claim')}">
          <button class="seg" data-act="claim">${t('set.claimGo')}</button></div></div>
      </div></div>`;
  }

  pause() {
    return `<div class="scr-modal pause"><div class="scr-box">
      <h2>${t('pause.title')}</h2>
      <button class="sbtn main" data-act="resume">${t('pause.resume')}</button>
      <button class="sbtn main" data-act="saveNow"${this.app.game && this.app.game.slot >= 0 ? '' : ' disabled'}>${t('pause.save')}</button>
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
      look: { ...CONFIG.defaultAppearance, ...start },
      name: params.mode === 'new' ? t('new.defaultName', { n: params.slot + 1 }) : '',
      diff: CONFIG.difficulty.default,
      tutorial: !this.app.slots.some(Boolean), // on for the first world
      equip: params.equip || { weapon: { kind: 'weapon', type: CONFIG.player.startWeapon, rarity: 0, level: 1, up: 0 } },
    };
    if (!this.preview) this.preview = new Preview();
    this.preview.setLook(this.ed.look, this.ed.equip);
    this.preview.start(null);
  }

  closeEditor() {
    if (this.preview) this.preview.stop();
    this.ed = null;
  }

  lookChanged() {
    this.preview.setLook(this.ed.look, this.ed.equip);
    this.render();
  }

  worldName() {
    const n = (this.ed.name || '').trim().slice(0, CONFIG.save.nameMaxLength);
    return n || t('new.defaultName', { n: this.params.slot + 1 });
  }

  editor() {
    const L = this.ed.look, P = CONFIG.palettes, isNew = this.params.mode === 'new';
    const rows = PALETTE_ROWS.map(([key, pal]) => {
      const sw = P[pal].map((c) => `<button class="sw${L[key] === c ? ' on' : ''}${pal === 'eyes' || pal === 'aura' ? ' glow' : ''}" style="--c:${hex(c)}" data-act="color" data-key="${key}" data-v="${c}" aria-label="${hex(c)}"></button>`).join('');
      const extra = key === 'capeColor'
        ? `<button class="seg${L.cape ? ' on' : ''}" data-act="cape">${L.cape ? t('set.on') : t('set.off')}</button>`
        : '';
      const hair = key === 'hair'
        ? `<div class="ed-row"><b>${t('ed.hairStyle')}</b><div class="segs wrap">${HAIR_KEYS.map((h, i) => `<button class="seg${L.hairStyle === i ? ' on' : ''}" data-act="hairStyle" data-v="${i}">${t('hair.' + h)}</button>`).join('')}</div></div>`
        : '';
      return `<div class="ed-row"><b>${t('ed.' + key)}${extra}</b><div class="sws${key === 'capeColor' && !L.cape ? ' off' : ''}">${sw}</div></div>${hair}`;
    }).join('');
    const name = isNew
      ? `<label class="ed-name"><b>${t('new.name')}</b><input type="text" data-act="name" maxlength="${CONFIG.save.nameMaxLength}" value="${esc(this.ed.name)}" autocomplete="off" spellcheck="false"></label>
        <div class="ed-diff"><b>${t('set.difficulty')}</b><div class="segs">${diffSegs(this.ed.diff)}</div><small>${t('diff.' + this.ed.diff + '.desc')}</small></div>
        <div class="ed-tut"><b>${t('new.tutorial')}</b><button class="seg${this.ed.tutorial ? ' on' : ''}" data-act="tutorial">${this.ed.tutorial ? t('set.on') : t('set.off')}</button><small>${t('new.tutorialHint')}</small></div>`
      : '';
    return `<div class="ed">
      <div class="ed-stage"><h2>${isNew ? t('new.title2') : t('ed.title')}</h2><p><b>↔ ${t('ed.rotate')}</b><br>${t('ed.note')}</p></div>
      <div class="ed-panel">${name}
        <div class="ed-opts" data-scroll="ed">${rows}</div>
        <div class="scr-row ed-bar">
          <button class="sbtn ghost" data-act="edBack">${isNew ? t('menu.back') : t('confirm.cancel')}</button>
          <button class="sbtn" data-act="random">${t('ed.random')}</button>
          <button class="sbtn go" data-act="edDone">${isNew ? t('new.start') : t('ed.save')}</button>
        </div>
      </div></div>`;
  }
}
