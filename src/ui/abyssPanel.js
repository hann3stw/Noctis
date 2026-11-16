// The panel in front of the Abyss (start floor, modifiers, Enter) and in front
// of a normal gate (modifiers only). The game is paused while it is open. The
// chosen modifiers stay until the player changes them (game.mods, saved).
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { flashClass } from '../core/format.js';

const MOD_ICONS = {
  explode: '💥', noHeal: '✚', timeLimit: '⏱', swift: '»', weakArmy: '☍', elites: '♛', tough: '⛨', manaCurse: '✦',
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
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  open(mode) {
    if (this.isOpen) return;
    this.mode = mode;
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
    if (act === 'mod') {
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
    if (this.mode === 'abyss') {
      const starts = A.starts(), k = starts.indexOf(this.start);
      head = `<h2>${t('abyss.name')}</h2><small>${A.best ? t('abyss.best', { n: A.best }) : t('abyss.bestNone')}</small>`;
      side = `<div class="ab-side"><p>${t('abyss.info')}</p>
        <h4>${t('abyss.start')}</h4>
        <div class="ab-floor"><button class="ap-btn" data-act="floor" data-d="-1"${k <= 0 ? ' disabled' : ''}>−</button>
          <b>${this.start}</b><button class="ap-btn" data-act="floor" data-d="1"${k >= starts.length - 1 ? ' disabled' : ''}>+</button></div>
        <small>${t('abyss.startHint')}</small></div>`;
      buttons = `<button class="ap-btn ghost" data-act="close">${t('menu.close')}</button><button class="ap-btn go" data-act="enter">${t('abyss.enter')}</button>`;
    } else {
      head = `<h2>${t('mods.title')}</h2><small>${t('mods.hint')}</small>`;
      buttons = `<button class="ap-btn go" data-act="close">${t('mods.done')}</button>`;
    }
    this.el.innerHTML = `<div class="ab-box ${this.mode}">
      <div class="ab-head">${head}</div>
      <div class="ab-body">${side}<div class="ab-mods"><h4>${t('mods.title')} <em>${count}</em></h4><div class="ab-grid">${mlist}</div></div></div>
      <div class="ab-btns">${buttons}</div></div>`;
  }
}
