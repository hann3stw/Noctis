// The leaderboards as a block of HTML, shared by the Abyss panel in the game
// and the Leaderboard screen of the main menu: 'level' (highest level, every
// hunter) and 'abyss' (deepest floor). Asks for a hunter name first, then
// shows the top 50 and the own place. Buttons inside use the actions lbSave,
// lbRename, lbRefresh and lbKind; the owner passes clicks to handle().
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { fmt, flashClass } from '../core/format.js';
import { settings, setSetting } from '../core/settings.js';
import { loadBoard, cleanName, myId, LOOK_COLORS } from '../net/online.js';
import { RARITY_CSS, itemName } from '../core/items.js';
import { gearIcon } from './gearIcons.js';
import { snapshot } from './preview.js';
import { normLook } from '../render/models/player.js';

const SLOTS = ['weapon', 'helmet', 'chest', 'gloves', 'boots'];
const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);
const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);

// Look and gear of a leaderboard row come from other players: only known
// values are kept, everything else falls back to the defaults.
function cleanLook(l) {
  if (!l || typeof l !== 'object') return null;
  const a = { ...CONFIG.defaultAppearance };
  for (const k of LOOK_COLORS) if (Number.isInteger(l[k]) && l[k] >= 0 && l[k] <= 0xffffff) a[k] = l[k];
  if (typeof l.cape === 'boolean') a.cape = l.cape;
  for (const k of ['hairStyle', 'build', 'height', 'facialHair', 'eyeShape', 'mark', 'accessory', 'outfit', 'capeStyle', 'auraStyle']) if (Number.isInteger(l[k])) a[k] = l[k];
  return normLook(a);
}

// stat points and values of a hunter: numbers only
const num = (v, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, hi) : null);
function cleanStats(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const k of ['str', 'agi', 'vit', 'int', 'per']) out[k] = num(s[k], 1e7);
  for (const k of ['hp', 'dmg', 'def']) out[k] = num(s[k], 1e15);
  out.crit = num(s.crit, 1);
  out.slots = num(s.slots, 999);
  return Object.values(out).some((v) => v !== null) ? out : null;
}

function cleanGear(g) {
  if (!g || typeof g !== 'object') return null;
  const out = {};
  for (const slot of SLOTS) {
    const it = g[slot];
    if (!it || typeof it !== 'object') { out[slot] = null; continue; }
    const weapon = slot === 'weapon';
    if (weapon && !has(CONFIG.weapons, it.type)) { out[slot] = null; continue; }
    const c = { kind: weapon ? 'weapon' : 'armor', type: weapon ? it.type : slot, rarity: int(it.rarity, 0, 7, 0), level: int(it.level, 1, 999999, 1), up: int(it.up, 0, 99, 0) };
    if (!weapon) c.set = has(CONFIG.items.sets, it.set) ? it.set : Object.keys(CONFIG.items.sets)[0];
    const U = CONFIG.uniques;
    if (c.rarity === 7 && (weapon ? has(U.weapon, it.uq) : U.armor[slot] && has(U.armor[slot], it.uq))) c.uq = it.uq;
    else if (c.rarity === 7) c.rarity = 6;
    out[slot] = c;
  }
  return out;
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export class Board {
  // onChange: called when the board has to be drawn again
  // onName: called after a new hunter name was saved
  constructor(onChange, onName, kind = 'level') {
    this.onChange = onChange;
    this.onName = onName;
    this.kind = kind; // the board shown
    this.all = {}; // loaded boards by kind: { rows, me }
    this.data = null; // the board shown
    this.state = ''; // '' | 'loading' | 'error'
    this.naming = false;
    this.openId = ''; // the row whose hunter is shown
    this.pics = {}; // pictures of hunters: user_id -> { key, url }
  }

  // shows a board (and loads it again)
  show(kind) {
    this.kind = kind;
    this.data = this.all[kind] || null;
    this.fetch();
  }

  async fetch() {
    const kind = this.kind;
    this.state = 'loading';
    this.onChange();
    try {
      const d = await loadBoard(kind);
      this.all[kind] = d;
      if (kind !== this.kind) return; // switched meanwhile
      this.data = d;
      this.state = '';
    } catch (_) {
      this.state = 'error';
    }
    this.onChange();
  }

  // true when the click was for the board
  handle(act, root, v) {
    if (act === 'lbShow') { this.openId = this.openId === v ? '' : v; this.onChange(); return true; }
    if (act === 'lbKind') { if (v !== this.kind) this.show(v); return true; }
    if (act === 'lbRefresh') { this.fetch(); return true; }

    if (act === 'lbRename') { this.naming = true; this.onChange(); return true; }
    if (act === 'lbSave') { this.saveName(root); return true; }
    return false;
  }

  saveName(root) {
    const inp = root.querySelector('.lb-name input');
    const name = cleanName(inp ? inp.value : '');
    if (name.length < 2) { if (inp) flashClass(inp, 'shake'); return; }
    setSetting('hunterName', name);
    this.naming = false;
    if (this.onName) this.onName();
    this.onChange();
    // the entry needs a moment to arrive
    setTimeout(() => this.fetch(), 1500);
  }

  canRefresh() {
    return !!settings.hunterName && this.state !== 'loading';
  }

  // the hunter of a row: a picture of its look and the gear it wears
  details(r) {
    const look = cleanLook(r.look), gear = cleanGear(r.gear), st = cleanStats(r.stats);
    if (!look && !gear && !st) return `<div class="lb-det"><p class="lb-note">${t('lb.noLook')}</p></div>`;
    const equip = { ...(gear || {}) };
    if (!equip.weapon) equip.weapon = { kind: 'weapon', type: Object.keys(CONFIG.weapons)[0], rarity: 0, level: 1, up: 0 };
    let pic = '';
    const key = JSON.stringify([look, gear]);
    const cached = this.pics[r.user_id];
    if (cached && cached.key === key) pic = cached.url;
    else {
      try { pic = snapshot(look || { ...CONFIG.defaultAppearance }, equip); } catch (_) { pic = ''; }
      this.pics[r.user_id] = { key, url: pic };
    }
    const items = SLOTS.map((slot) => {
      const it = gear && gear[slot];
      if (!it) return `<div class="lb-it empty"><i></i><div><b>${t('slot.' + slot)}</b><small>${t('lb.emptySlot')}</small></div></div>`;
      return `<div class="lb-it" style="--rc:${RARITY_CSS[it.rarity]}"><i>${gearIcon(it)}</i><div><b>${esc(itemName(it))}</b><small>${t('rarity.' + it.rarity)} · ${t('lb.itemLevel', { n: it.level })}</small></div></div>`;
    }).join('');
    // stat points, then what they lead to
    const chip = (k, v) => (v === null || v === undefined ? '' : `<span><small>${k}</small><b>${v}</b></span>`);
    const stats = st ? `<div class="lb-st">${['str', 'agi', 'vit', 'int', 'per'].map((k) => chip(t('stat.' + k), st[k] === null ? null : fmt(st[k]))).join('')}
      ${chip(t('derived.hp'), st.hp === null ? null : fmt(st.hp))}${chip(t('derived.damage'), st.dmg === null ? null : fmt(st.dmg))}${chip(t('derived.defense'), st.def === null ? null : fmt(st.def))}${chip(t('derived.crit'), st.crit === null ? null : Math.round(st.crit * 100) + '%')}${chip(t('derived.slots'), st.slots === null ? null : fmt(st.slots))}</div>` : '';
    return `<div class="lb-det"><div class="lb-top">${pic ? `<img class="lb-av" src="${pic}" alt="">` : ''}<div class="lb-gear">${gear ? items : `<p class="lb-note">${t('lb.noLook')}</p>`}</div></div>${stats}</div>`;
  }

  // hasRecord: the player has a record for the board shown (for the note below the list)
  html(hasRecord) {
    const kinds = ['level', 'abyss', 's1'].map((k) => `<button class="seg${this.kind === k ? ' on' : ''}" data-act="lbKind" data-v="${k}">${t('lb.kind.' + k)}</button>`).join('');
    return `<div class="lb-kinds">${kinds}</div>${this.body(hasRecord)}`;
  }

  body(hasRecord) {
    const name = settings.hunterName;
    if (!name || this.naming) {
      return `<div class="lb-name"><h4>${t('lb.nameTitle')}</h4><p>${t('lb.nameHint')}</p>
        <div class="lb-form"><input type="text" maxlength="20" value="${esc(name)}" placeholder="${t('lb.namePh')}" aria-label="${t('lb.nameTitle')}" autocomplete="off">
        <button class="ap-btn go" data-act="lbSave">${t('lb.save')}</button></div>
        <small>${t('lb.privacy')}</small></div>`;
    }
    if (this.state === 'loading' && !this.data) return `<div class="lb-msg"><i class="lb-spin"></i>${t('lb.loading')}</div>`;
    if (this.state === 'error' || !this.data) return `<div class="lb-msg">${t('lb.offline')}</div>`;
    const id = myId(), D = CONFIG.difficulty.levels, lv = this.kind === 'level' || this.kind === 's1';
    const dif = (r) => (D[r.difficulty] ? ` · <i class="dif-${r.difficulty}">${t('diff.' + r.difficulty)}</i>` : '');
    const mas = (r) => (r.mastery ? ' · ' + t('lb.mastery', { n: fmt(r.mastery) }) : '');
    // a title of another hunter: only the ones this version knows
    const ttl = (r) => { const k = 'title.' + r.title; return r.title && /^[a-z0-9_]{1,24}$/.test(r.title) && t(k) !== k ? `<i class="lb-title">${esc(t(k))}</i> · ` : ''; };
    const row = (r, place) => `<div class="lb-row${r.user_id === id ? ' me' : ''}${place <= 3 ? ' top' + place : ''}${r.user_id === this.openId ? ' open' : ''}" data-act="lbShow" data-v="${esc(r.user_id)}"><em>${place}</em>
      <div><b>${esc(r.name)}</b><small>${ttl(r)}${lv
    ? t('lb.subRank', { rank: esc(r.rank) }) + mas(r) + (r.floor > 0 ? ' · ' + t('lb.floor', { n: r.floor }) : '')
    : t('lb.sub', { level: r.level, rank: esc(r.rank) }) + mas(r) + dif(r)}</small></div>
      <span>${lv ? t('lb.level', { n: r.level }) : t('lb.floor', { n: r.floor })}</span><i class="lb-more"></i></div>${r.user_id === this.openId ? this.details(r) : ''}`;
    const rows = this.data.rows.map((r, i) => row(r, i + 1)).join('') || `<div class="lb-msg">${t('lb.empty')}</div>`;
    const me = this.data.me;
    const mine = me
      ? (me.place > this.data.rows.length ? `<div class="lb-mine">${row(me.row, me.place)}</div>` : '')
      : this.kind === 's1' ? '' : `<p class="lb-note">${hasRecord ? t('lb.pending') : t(lv ? 'lb.notYetLevel' : 'lb.notYet')}</p>`;
    return `<div class="lb"><div class="lb-head"><span>${t('lb.as', { name: esc(name) })}</span><button class="ap-btn small ghost" data-act="lbRename">${t('lb.rename')}</button></div>
      ${this.kind === 's1' ? `<p class="lb-note">${t('lb.s1')}</p>` : `<p class="lb-note">${t('lb.s2')}</p>`}<div class="lb-list" data-scroll="lb">${rows}</div>${mine}</div>`;
  }
}
