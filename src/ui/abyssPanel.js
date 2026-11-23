// The panel in front of the Abyss (start floor, modifiers, Enter, and the
// online leaderboard) and in front of a normal gate (modifiers only). The game
// is paused while it is open. The chosen modifiers stay until the player
// changes them (game.mods, saved).
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { flashClass } from '../core/format.js';
import { Board } from './board.js';

const MOD_ICONS = {
  explode: '💥', noHeal: '✚', timeLimit: '⏱', swift: '»', weakArmy: '☍', elites: '♛', tough: '⛨', manaCurse: '✦', brutal: '⚔', glass: '❖',
};

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
    this.board = new Board(() => { if (this.isOpen && this.tab === 'board') this.render(); }, () => game.submitRecords(), 'abyss');
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.addEventListener('keydown', (e) => {
      e.stopPropagation(); // typing a name must not move the hunter
      if (e.key === 'Enter' && e.target.closest('.lb-name')) this.board.saveName(this.el);
    });
  }

  open(mode) {
    if (this.isOpen) return;
    this.mode = mode;
    this.tab = 'run';
    this.board.naming = false;
    this.board.kind = 'abyss';
    this.board.data = this.board.all.abyss || null;
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
    if (this.board.handle(act, this.el, b.dataset.v)) return;
    if (act === 'tab') {
      this.tab = b.dataset.v;
      if (this.tab === 'board') { this.board.fetch(); return; }
    } else if (act === 'mod') {
      const id = b.dataset.id, k = mods.indexOf(id);
      if (k >= 0) mods.splice(k, 1);
      else if (mods.length < game.modsMax(this.mode === 'abyss')) mods.push(id);
    } else if (act === 'floor') {
      const starts = game.abyss.starts();
      const k = Math.max(0, Math.min(starts.length - 1, starts.indexOf(this.start) + Number(b.dataset.d)));
      this.start = starts[k];
    }
    this.render();
  }

  render() {
    const game = this.game, A = game.abyss, M = CONFIG.modifiers, mods = game.mods;
    const abyssMode = this.mode === 'abyss', max = game.modsMax(abyssMode), lm = !abyssMode && max > M.max ? CONFIG.contracts.luck : 1;
    const n = Math.min(mods.length, max);
    const mlist = Object.keys(M.list).map((id) => {
      const on = mods.includes(id);
      const full = !on && n >= max;
      return `<button class="ab-mod${on ? ' on' : ''}" data-act="mod" data-id="${id}"${full ? ' disabled' : ''}>
        <i>${MOD_ICONS[id] || '•'}</i><div><b>${t('mod.' + id)}${id === game.goals.featured() ? ` <em class="ab-feat">★ ${t('goal.weekly')}</em>` : ''}</b><small>${t('modd.' + id)}</small></div></button>`;
    }).join('');
    const nl = game.goals.modCount(mods.slice(0, max)); // the weekly featured modifier counts double
    const pct = Math.round(nl * M.luck * lm * 100), xp = Math.round(nl * M.xp * 100);
    const count = n ? t('mods.count', { n, max, luck: pct, xp }) : t('mods.none');
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
        ? `<button class="ap-btn ghost" data-act="close">${t('menu.close')}</button><button class="ap-btn" data-act="lbRefresh"${this.board.canRefresh() ? '' : ' disabled'}>${t('lb.refresh')}</button>`
        : `<button class="ap-btn ghost" data-act="close">${t('menu.close')}</button><button class="ap-btn go" data-act="enter">${t('abyss.enter')}</button>`;
    } else {
      head = `<h2>${t('mods.title')}</h2><small>${t('mods.hint')}${max > M.max ? ' ' + t('mods.contracts') : ''}</small>`;
      buttons = `<button class="ap-btn go" data-act="close">${t('mods.done')}</button>`;
    }
    const keep = this.el.querySelector('[data-scroll="lb"]');
    const top = keep ? keep.scrollTop : 0;
    const body = board ? this.board.html(this.board.kind === 'level' || A.best > 0)
      : `${side}<div class="ab-mods"><h4>${t('mods.title')} <em>${count}</em></h4><div class="ab-grid">${mlist}</div></div>`;
    this.el.innerHTML = `<div class="ab-box ${this.mode}${board ? ' board' : ''}">
      <div class="ab-head">${head}</div>
      <div class="ab-body">${body}</div>
      <div class="ab-btns">${buttons}</div></div>`;
    const list = this.el.querySelector('[data-scroll="lb"]');
    if (list) list.scrollTop = top;
  }
}
