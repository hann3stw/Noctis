// Army tab of the menu: move shadows between the squads and the reserve,
// dismiss single shadows or the whole reserve. Changes are only possible in
// the camp (menu.locked). Re-rendered after every change.
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
    this.confirm = null; // null | 'one' | 'reserve'
    this.locked = false;
    this.el.addEventListener('click', (e) => this.onClick(e));
  }

  reset() {
    this.selected = -1;
    this.confirm = null;
  }

  onClick(e) {
    const target = e.target.closest('[data-act],[data-slot]');
    if (!target) return;
    const army = this.game.army;
    const act = target.dataset.act;
    if (!act) {
      const slot = Number(target.dataset.slot);
      this.selected = this.selected === slot ? -1 : slot;
      this.confirm = null;
    } else if (this.locked) {
      return;
    } else if (act === 'move') {
      army.move(this.selected, Number(target.dataset.sq));
    } else if (act === 'dismiss') {
      this.confirm = 'one';
    } else if (act === 'dismissReserve') {
      this.confirm = 'reserve';
    } else if (act === 'no') {
      this.confirm = null;
    } else if (act === 'yes') {
      if (this.confirm === 'one') {
        army.dismiss(this.selected);
        this.selected = -1;
      } else if (this.confirm === 'reserve') {
        army.dismissReserve();
        if (this.selected >= 0 && !army.units[this.selected]) this.selected = -1;
      }
      this.confirm = null;
    }
    this.render();
  }

  card(u) {
    const army = this.game.army;
    const state = u.alive ? t('role.' + u.role) : t('army.fallen');
    const xp = u.level >= CONFIG.shadows.maxLevel ? 100 : Math.round((u.xp / army.xpNeed(u.level)) * 100);
    return `<div class="ap-card${u.slot === this.selected ? ' sel' : ''}${u.alive ? '' : ' dead'}" data-slot="${u.slot}">
      <b>${esc(army.name(u))}</b><small>${t('army.level', { level: u.level })} · ${state}</small><i style="--p:${xp}%"></i></div>`;
  }

  render() {
    const army = this.game.army;
    const lists = [[], [], [], []];
    for (const u of army.units) if (u) lists[u.squad < 0 ? 3 : u.squad].push(u);
    const max = army.maxDeployed();
    const sel = this.selected >= 0 ? army.units[this.selected] : null;
    const full = army.deployed.length >= max;
    const off = this.locked ? ' disabled' : '';

    const cols = lists
      .map((list, k) => {
        const title = k < 3 ? t('army.squad', { name: t('squad.' + k) }) : t('army.reserve');
        const count = k < 3 ? list.length : list.length + '/' + CONFIG.shadows.reserveMax;
        const body = list.length ? list.map((u) => this.card(u)).join('') : `<div class="ap-empty">${t('army.empty')}</div>`;
        return `<div class="ap-col"><h3>${title}<small>${count}</small></h3><div class="ap-list">${body}</div></div>`;
      })
      .join('');

    const info = t('army.deployed', { n: army.deployed.length, max });
    let bar;
    if (this.locked) {
      bar = `<div class="grow">${info} · ${t('army.campOnly')}</div>`;
    } else if (this.confirm) {
      const text = this.confirm === 'one'
        ? t('army.confirmOne', { name: sel ? army.name(sel) : '' })
        : t('army.confirmReserve', { n: lists[3].length });
      bar = `<div class="grow">${esc(text)}</div>
        <button class="ap-btn danger" data-act="yes">${t('army.yes')}</button>
        <button class="ap-btn ghost" data-act="no">${t('army.no')}</button>`;
    } else if (sel) {
      const moves = [0, 1, 2, -1]
        .map((sq) => {
          const no = sq === sel.squad || (sq >= 0 && sel.squad < 0 && full) || (sq < 0 && army.reserveCount >= CONFIG.shadows.reserveMax);
          const label = sq >= 0 ? t('squad.' + sq) : t('army.reserve');
          return `<button class="ap-btn" data-act="move" data-sq="${sq}"${no ? ' disabled' : ''}>${label}</button>`;
        })
        .join('');
      bar = `<div class="grow">${sel.squad < 0 && full ? t('army.full') : t('army.moveTo')}</div>${moves}
        <button class="ap-btn danger" data-act="dismiss"${off}>${t('army.dismiss')}</button>`;
    } else {
      bar = `<div class="grow">${info} · ${t('army.select')}</div>
        <button class="ap-btn danger" data-act="dismissReserve"${lists[3].length ? '' : ' disabled'}>${t('army.dismissReserve')}</button>`;
    }

    // keep the scroll positions of the columns across re-renders
    const scroll = [...this.el.querySelectorAll('.ap-list')].map((l) => l.scrollTop);
    this.el.innerHTML = `<div class="ap-cols">${cols}</div><div class="ap-bar">${bar}</div>`;
    this.el.querySelectorAll('.ap-list').forEach((l, i) => { l.scrollTop = scroll[i] || 0; });
  }
}
