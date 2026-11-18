// The leaderboards as a block of HTML, shared by the Abyss panel in the game
// and the Leaderboard screen of the main menu: 'level' (highest level, every
// hunter) and 'abyss' (deepest floor). Asks for a hunter name first, then
// shows the top 50 and the own place. Buttons inside use the actions lbSave,
// lbRename, lbRefresh and lbKind; the owner passes clicks to handle().
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { fmt, flashClass } from '../core/format.js';
import { settings, setSetting } from '../core/settings.js';
import { loadBoard, cleanName, myId } from '../net/online.js';

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

  // hasRecord: the player has a record for the board shown (for the note below the list)
  html(hasRecord) {
    const kinds = ['level', 'abyss'].map((k) => `<button class="seg${this.kind === k ? ' on' : ''}" data-act="lbKind" data-v="${k}">${t('lb.kind.' + k)}</button>`).join('');
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
    const id = myId(), D = CONFIG.difficulty.levels, lv = this.kind === 'level';
    const dif = (r) => (D[r.difficulty] ? ` · <i class="dif-${r.difficulty}">${t('diff.' + r.difficulty)}</i>` : '');
    const mas = (r) => (r.mastery ? ' · ' + t('lb.mastery', { n: fmt(r.mastery) }) : '');
    const row = (r, place) => `<div class="lb-row${r.user_id === id ? ' me' : ''}${place <= 3 ? ' top' + place : ''}"><em>${place}</em>
      <div><b>${esc(r.name)}</b><small>${lv
    ? t('lb.subRank', { rank: esc(r.rank) }) + mas(r) + (r.floor > 0 ? ' · ' + t('lb.floor', { n: r.floor }) : '')
    : t('lb.sub', { level: r.level, rank: esc(r.rank) }) + mas(r) + dif(r)}</small></div>
      <span>${lv ? t('lb.level', { n: r.level }) : t('lb.floor', { n: r.floor })}</span></div>`;
    const rows = this.data.rows.map((r, i) => row(r, i + 1)).join('') || `<div class="lb-msg">${t('lb.empty')}</div>`;
    const me = this.data.me;
    const mine = me
      ? (me.place > this.data.rows.length ? `<div class="lb-mine">${row(me.row, me.place)}</div>` : '')
      : `<p class="lb-note">${hasRecord ? t('lb.pending') : t(lv ? 'lb.notYetLevel' : 'lb.notYet')}</p>`;
    return `<div class="lb"><div class="lb-head"><span>${t('lb.as', { name: esc(name) })}</span><button class="ap-btn small ghost" data-act="lbRename">${t('lb.rename')}</button></div>
      <div class="lb-list" data-scroll="lb">${rows}</div>${mine}</div>`;
  }
}
