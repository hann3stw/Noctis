// The choice of the main class: it opens when the hunter reaches rank D (the
// rank-up from E). Before that everyone is a neutral hunter. The class stays for
// this world. The classes that are not ready yet are shown, but cannot be picked.
// The game is paused while the panel is open.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { flashClass } from '../core/format.js';

export class ClassPanel {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'class-panel';
    root.appendChild(this.el);
    this.isOpen = false;
    this.sel = '';
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  open() {
    if (this.isOpen) return;
    const list = CONFIG.classes.list;
    this.sel = Object.keys(list).find((id) => list[id].ready) || '';
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
    play('ui');
    if (b.dataset.act === 'pick') this.sel = b.dataset.id;
    else if (b.dataset.act === 'confirm') {
      const id = this.sel;
      this.close();
      this.game.chooseClass(id);
      return;
    }
    this.render();
  }

  render() {
    const list = CONFIG.classes.list;
    const cards = Object.keys(list).map((id) => {
      const c = list[id], on = id === this.sel;
      return `<button class="cls-card${on ? ' on' : ''}${c.ready ? '' : ' soon'}" data-act="pick" data-id="${id}"${c.ready ? '' : ' disabled'}>
        <em>${t('mc.role.' + c.role)}</em><b>${t('mc.' + id)}</b><p>${t('mc.' + id + '.desc')}</p><small class="mech">${t('mc.' + id + '.mech')}</small>${c.ready ? '' : `<small>${t('mc.soon')}</small>`}</button>`;
    }).join('');
    this.el.innerHTML = `<div class="ab-box mods">
      <div class="ab-head"><h2>${t('mc.title')}</h2><small>${t('mc.hint')}</small></div>
      <div class="cls-grid">${cards}</div>
      <div class="ab-btns"><button class="ap-btn go" data-act="confirm"${this.sel ? '' : ' disabled'}>${this.sel ? t('mc.confirm', { name: t('mc.' + this.sel) }) : t('mc.pick')}</button></div></div>`;
  }
}
