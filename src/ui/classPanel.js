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
    // pointerup as well as click: a tap on a phone must work even when the click does not come through
    this.last = 0;
    this.el.addEventListener('pointerup', (e) => { this.last = performance.now(); this.onClick(e); });
    this.el.addEventListener('click', (e) => { if (performance.now() - this.last > 500) this.onClick(e); });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  // mode: 'group' = the first choice (fighter, ranged, mage, necromancer); 'spec' = the class or its sibling
  open(mode = 'group') {
    if (this.isOpen) return;
    this.mode = mode;
    this.sel = mode === 'spec' ? this.game.mainClass : 'fighter';
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
      if (this.mode === 'spec') this.game.changeClass(id);
      else this.game.chooseClass(CONFIG.classes.groups[id].class);
      return;
    }
    this.render();
  }

  render() {
    const list = CONFIG.classes.list, spec = this.mode === 'spec';
    // first choice: the four groups (their emblem is the one of their first class); second: the class or its sibling
    const ids = spec ? CONFIG.classes.spec[this.game.mainClass] : Object.keys(CONFIG.classes.groups);
    const cards = ids.map((id) => {
      const cid = spec ? id : CONFIG.classes.groups[id].class, c = list[cid], on = id === this.sel;
      const name = spec ? t('mc.' + id) : t('mc.group.' + id);
      const desc = spec ? t('mc.' + id + '.desc') : t('mc.group.' + id + '.desc');
      const mech = spec ? t('mc.' + id + '.mech') : t('mc.group.' + id + '.mech');
      return `<button class="cls-card${on ? ' on' : ''}" data-act="pick" data-id="${id}">
        <i class="emb" data-c="${cid}"></i><em>${t('mc.role.' + c.role)}</em><b>${name}</b><p>${desc}</p><small class="mech">${mech}</small></button>`;
    }).join('');
    const name = this.sel ? (spec ? t('mc.' + this.sel) : t('mc.group.' + this.sel)) : '';
    this.el.innerHTML = `<div class="ab-box mods">
      <div class="ab-head"><h2>${spec ? t('mc.specTitle') : t('mc.title')}</h2><small>${spec ? t('mc.specHint') : t('mc.hint')}</small></div>
      <div class="cls-grid">${cards}</div>
      <div class="ab-btns"><button class="ap-btn go" data-act="confirm"${this.sel ? '' : ' disabled'}>${this.sel ? t('mc.confirm', { name }) : t('mc.pick')}</button></div></div>`;
  }
}
