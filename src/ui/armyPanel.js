// Army tab of the menu: every shadow of the army, with level, role and XP.
// A shadow can be dismissed for good (after a confirmation), which hands part
// of its XP to the player. Changes are only possible in a safe place.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

export class ArmyPanel {
  constructor(game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.className = 'ap-root';
    this.selected = -1;
    this.confirm = false;
    this.locked = false;
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  reset() {
    this.selected = -1;
    this.confirm = false;
  }

  onClick(e) {
    const target = e.target.closest('[data-act],[data-slot]');
    if (!target || target.disabled) return;
    const army = this.game.army;
    const act = target.dataset.act;
    if (!act) {
      const slot = Number(target.dataset.slot);
      this.selected = this.selected === slot ? -1 : slot;
      this.confirm = false;
    } else if (this.locked) {
      return;
    } else if (act === 'dismiss') {
      this.confirm = true;
    } else if (act === 'no') {
      this.confirm = false;
    } else if (act === 'yes') {
      army.dismiss(this.selected);
      this.selected = -1;
      this.confirm = false;
    }
    this.render();
  }

  card(u) {
    const army = this.game.army;
    const state = u.alive ? t('role.' + u.role) : t('army.fallen');
    const xp = u.level >= CONFIG.shadows.maxLevel ? 100 : Math.round((u.xp / army.xpNeed(u.level, u)) * 100);
    const zone = CONFIG.world.zones[u.zone || 0];
    return `<div class="ap-card${u.slot === this.selected ? ' sel' : ''}${u.alive ? '' : ' dead'}" data-slot="${u.slot}">
      <b>${esc(army.name(u))}</b><small>${t('army.level', { level: u.level })} · ${zone.rank} · ${state}</small><i style="--p:${xp}%"></i></div>`;
  }

  render() {
    const army = this.game.army;
    const list = army.units.filter(Boolean);
    const sel = this.selected >= 0 ? army.units[this.selected] : null;
    const head = t('army.count', { n: list.length, max: army.maxDeployed() });
    const body = list.length ? list.map((u) => this.card(u)).join('') : `<div class="ap-empty">${t('army.none')}</div>`;
    let bar;
    if (this.locked) {
      bar = `<div class="grow">${head} · ${t('army.campOnly')}</div>`;
    } else if (this.confirm && sel) {
      bar = `<div class="grow">${esc(t('army.confirmOne', { name: army.name(sel) }))}</div>
        <button class="ap-btn danger" data-act="yes">${t('army.yes')}</button>
        <button class="ap-btn ghost" data-act="no">${t('army.no')}</button>`;
    } else if (sel) {
      bar = `<div class="grow">${esc(army.name(sel))}</div>
        <button class="ap-btn danger" data-act="dismiss">${t('army.dismiss')}</button>`;
    } else {
      bar = `<div class="grow">${head} · ${t('army.select')}</div>`;
    }
    const scroll = this.el.querySelector('.ap-grid');
    const top = scroll ? scroll.scrollTop : 0;
    this.el.innerHTML = `<div class="ap-grid" data-scroll="army">${body}</div><div class="ap-bar">${bar}</div>`;
    this.el.querySelector('.ap-grid').scrollTop = top;
  }
}
