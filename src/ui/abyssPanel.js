// The panel in front of the Abyss (start floor, modifiers, Enter, and the
// online leaderboard) and in front of a normal gate (modifiers only). The game
// is paused while it is open. The chosen modifiers stay until the player
// changes them (game.mods, saved).
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { flashClass, fmt } from '../core/format.js';
import { settings, setSetting } from '../core/settings.js';
import { loadBoard, cleanName, myId } from '../net/online.js';

const MOD_ICONS = {
  explode: '💥', noHeal: '✚', timeLimit: '⏱', swift: '»', weakArmy: '☍', elites: '♛', tough: '⛨', manaCurse: '✦',
};

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export class AbyssPanel {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'abyss-panel';
    root.appendChild(this.el);
    this.mode = 'abyss'; // 'abyss' or 'mods'
    this.start = 1; // chosen start floor
    this.isOpen = false;
    this.tab = 'run'; // 'run' (start floor and modifiers) or 'board' (leaderboard)
    this.board = null; // { rows, me } once loaded
    this.boardState = ''; // '' | 'loading' | 'error'
    this.naming = false; // the name form is open
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing a name must not move the hunter
      if (e.key === 'Enter' && e.target.closest('.lb-name')) this.saveName();
    });
  }

  open(mode) {
    if (this.isOpen) return;
    this.mode = mode;
    this.tab = 'run';
    this.naming = false;
    const starts = this.game.abyss.starts();
    this.start = starts[starts.length - 1]; // the deepest start point
    this.isOpen = true;
    this.game.setPaused(true);
    this.el.classList.add('on');
    this.render();
    flashClass(this.el, 'enter');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('on');
    this.game.setPaused(false);
  }

  onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    const game = this.game, act = b.dataset.act, mods = game.mods, M = CONFIG.modifiers;
    play('ui');
    if (act === 'close') { this.close(); return; }
    if (act === 'enter') {
      this.close();
      game.gates.enter(game.gates.abyssIndex, this.start);
      return;
    }
    if (act === 'saveName') { this.saveName(); return; }
    if (act === 'tab') {
      this.tab = b.dataset.v;
      if (this.tab === 'board') { this.fetchBoard(); return; }
    } else if (act === 'refresh') {
      this.fetchBoard();
      return;
    } else if (act === 'rename') {
      this.naming = true;
    } else if (act === 'mod') {
      const id = b.dataset.id, k = mods.indexOf(id);
      if (k >= 0) mods.splice(k, 1);
      else if (mods.length < M.max) mods.push(id);
    } else if (act === 'floor') {
      const starts = game.abyss.starts();
      const k = Math.max(0, Math.min(starts.length - 1, starts.indexOf(this.start) + Number(b.dataset.d)));
      this.start = starts[k];
    }
    this.render();
  }

  saveName() {
    const inp = this.el.querySelector('.lb-name input');
    const name = cleanName(inp ? inp.value : '');
    if (name.length < 2) { if (inp) flashClass(inp, 'shake'); return; }
    setSetting('hunterName', name);
    this.naming = false;
    this.game.submitAbyss();
    this.render();
    // the entry needs a moment to arrive
    setTimeout(() => { if (this.isOpen && this.tab === 'board') this.fetchBoard(); }, 1500);
  }

  async fetchBoard() {
    this.boardState = 'loading';
    this.render();
    try {
      this.board = await loadBoard();
      this.boardState = '';
    } catch (_) {
      this.boardState = 'error';
    }
    if (this.isOpen && this.tab === 'board') this.render();
  }

  // the leaderboard: the hunter name first, then the top 50 and the own place
  boardView() {
    const name = settings.hunterName;
    if (!name || this.naming) {
      return `<div class="lb-name"><h4>${t('lb.nameTitle')}</h4><p>${t('lb.nameHint')}</p>
        <div class="lb-form"><input type="text" maxlength="20" value="${esc(name)}" placeholder="${t('lb.namePh')}" aria-label="${t('lb.nameTitle')}" autocomplete="off">
        <button class="ap-btn go" data-act="saveName">${t('lb.save')}</button></div>
        <small>${t('lb.privacy')}</small></div>`;
    }
    if (this.boardState === 'loading' && !this.board) return `<div class="lb-msg"><i class="lb-spin"></i>${t('lb.loading')}</div>`;
    if (this.boardState === 'error' || !this.board) return `<div class="lb-msg">${t('lb.offline')}</div>`;
    const id = myId(), D = CONFIG.difficulty.levels;
    const row = (r, place) => `<div class="lb-row${r.user_id === id ? ' me' : ''}${place <= 3 ? ' top' + place : ''}"><em>${place}</em>
      <div><b>${esc(r.name)}</b><small>${t('lb.sub', { level: r.level, rank: esc(r.rank) })}${r.mastery ? ' · ' + t('lb.mastery', { n: fmt(r.mastery) }) : ''}${D[r.difficulty] ? ` · <i class="dif-${r.difficulty}">${t('diff.' + r.difficulty)}</i>` : ''}</small></div>
      <span>${t('lb.floor', { n: r.floor })}</span></div>`;
    const rows = this.board.rows.map((r, i) => row(r, i + 1)).join('') || `<div class="lb-msg">${t('lb.empty')}</div>`;
    const me = this.board.me;
    const mine = me
      ? (me.place > this.board.rows.length ? `<div class="lb-mine">${row(me.row, me.place)}</div>` : '')
      : `<p class="lb-note">${this.game.abyss.best ? t('lb.pending') : t('lb.notYet')}</p>`;
    return `<div class="lb"><div class="lb-head"><span>${t('lb.as', { name: esc(name) })}</span><button class="ap-btn small ghost" data-act="rename">${t('lb.rename')}</button></div>
      <div class="lb-list" data-scroll="lb">${rows}</div>${mine}</div>`;
  }

  render() {
    const game = this.game, A = game.abyss, M = CONFIG.modifiers, mods = game.mods;
    const n = mods.length;
    const mlist = Object.keys(M.list).map((id) => {
      const on = mods.includes(id);
      const full = !on && n >= M.max;
      return `<button class="ab-mod${on ? ' on' : ''}" data-act="mod" data-id="${id}"${full ? ' disabled' : ''}>
        <i>${MOD_ICONS[id] || '•'}</i><div><b>${t('mod.' + id)}</b><small>${t('modd.' + id)}</small></div></button>`;
    }).join('');
    const pct = Math.round(n * M.luck * 100), xp = Math.round(n * M.xp * 100);
    const count = n ? t('mods.count', { n, max: M.max, luck: pct, xp }) : t('mods.none');
    let head, side = '', buttons;
    const board = this.mode === 'abyss' && this.tab === 'board';
    if (this.mode === 'abyss') {
      const starts = A.starts(), k = starts.indexOf(this.start);
      head = `<h2>${t('abyss.name')}</h2><small>${A.best ? t('abyss.best', { n: A.best }) : t('abyss.bestNone')}</small>
        <div class="ab-tabs"><button class="seg${board ? '' : ' on'}" data-act="tab" data-v="run">${t('lb.tabRun')}</button><button class="seg${board ? ' on' : ''}" data-act="tab" data-v="board">${t('lb.tabBoard')}</button></div>`;
      side = `<div class="ab-side"><p>${t('abyss.info')}</p>
        <h4>${t('abyss.start')}</h4>
        <div class="ab-floor"><button class="ap-btn" data-act="floor" data-d="-1"${k <= 0 ? ' disabled' : ''}>−</button>
          <b>${this.start}</b><button class="ap-btn" data-act="floor" data-d="1"${k >= starts.length - 1 ? ' disabled' : ''}>+</button></div>
        <small>${t('abyss.startHint')}</small></div>`;
      buttons = board
        ? `<button class="ap-btn ghost" data-act="close">${t('menu.close')}</button><button class="ap-btn" data-act="refresh"${this.boardState === 'loading' || !settings.hunterName ? ' disabled' : ''}>${t('lb.refresh')}</button>`
        : `<button class="ap-btn ghost" data-act="close">${t('menu.close')}</button><button class="ap-btn go" data-act="enter">${t('abyss.enter')}</button>`;
    } else {
      head = `<h2>${t('mods.title')}</h2><small>${t('mods.hint')}</small>`;
      buttons = `<button class="ap-btn go" data-act="close">${t('mods.done')}</button>`;
    }
    const keep = this.el.querySelector('[data-scroll="lb"]');
    const top = keep ? keep.scrollTop : 0;
    const body = board ? this.boardView()
      : `${side}<div class="ab-mods"><h4>${t('mods.title')} <em>${count}</em></h4><div class="ab-grid">${mlist}</div></div>`;
    this.el.innerHTML = `<div class="ab-box ${this.mode}${board ? ' board' : ''}">
      <div class="ab-head">${head}</div>
      <div class="ab-body">${body}</div>
      <div class="ab-btns">${buttons}</div></div>`;
    const list = this.el.querySelector('[data-scroll="lb"]');
    if (list) list.scrollTop = top;
  }
}
