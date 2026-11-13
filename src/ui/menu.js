// The in-game menu with four tabs: Gear (equipment and inventory), Stats
// (level and stat points), Skills and Army. The game is paused while it is
// open. Equipment, skills and the army can only be changed in the camp.
import { CONFIG } from '../config.js';
import { fmt } from '../core/format.js';
import { t } from '../strings.js';
import { ArmyPanel } from './armyPanel.js';
import { TAB_ICONS } from './icons.js';
import { STAT_KEYS } from '../entities/player.js';
import { skillDef } from '../combat/skills.js';
import {
  EQUIP_SLOTS, RARITY_CSS, itemName, weaponDamage, armorDefense, armorBonus, bonusText,
  upgradeCost, dismantleValue, itemPower, slotOf,
} from '../core/items.js';

const TABS = ['gear', 'stats', 'skills', 'army', 'look'];

const svg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}" fill="currentColor"/></svg>`;
const ICONS = {
  sword: svg('M19 2h3v3L11 16l-3-3zM5 13l6 6-2 2-2-2-3 3-2-2 3-3-2-2z'),
  daggers: svg('M14 2l3 1-7 11-2-2zM10 2L7 3l7 11 2-2zM5 15l4 4-2 2-4-4zM19 15l-4 4 2 2 4-4z'),
  bow: svg('M6 2c8 2 12 8 12 10s-4 8-12 10l-1-2c6-2 10-6 10-8S11 6 5 4zM4 3h2v18H4z'),
  scythe: svg('M5 2h2v20H5zM7 3c7 0 12 3 14 9-4-4-8-5-14-5z'),
  staff: svg('M11 9h2v13h-2zM12 1l4 4-4 4-4-4z'),
  helmet: svg('M4 14a8 8 0 0 1 16 0v6h-5v-5H9v5H4z'),
  chest: svg('M4 4l4-2 4 2 4-2 4 2v6l-2 1v11H6V11l-2-1z'),
  gloves: svg('M7 22V12L5 9V5h2v4h1V3h2v6h1V2h2v7h1V4h2v9l-1 3v6z'),
  boots: svg('M7 2h6v12l7 4v4H5v-6l2-2z'),
};
const iconOf = (item) => ICONS[item.kind === 'weapon' ? item.type : item.type];

const pct = (v) => Math.round(v * 100) + '%';

export class Menu {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'menu';
    root.appendChild(this.el);
    this.army = new ArmyPanel(game);
    this.tab = 'gear';
    this.isOpen = false;
    this.locked = false;
    this.selItem = null; // selected item (inventory or equipped)
    this.selSkill = null;
    this.confirmId = 0; // item waiting for a second tap on "Dismantle"
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  // hint: text shown in the army tab (army full while a soul waits)
  open(tab, hint) {
    if (this.isOpen) return;
    const P = this.game.player;
    this.isOpen = true;
    this.locked = !P.inCamp;
    this.army.locked = false; // the army can be changed anywhere
    this.army.reset();
    this.army.hint = hint || '';
    if (tab) this.tab = tab;
    else if (P.points > 0) this.tab = 'stats';
    this.selItem = null;
    this.selSkill = null;
    this.confirmId = 0;
    this.game.setPaused(true);
    this.el.classList.add('on');
    this.render();
  }

  close() {
    this.isOpen = false;
    this.el.classList.remove('on');
    this.game.hud.syncSkills();
    this.game.setPaused(false);
  }

  findItem(id) {
    const P = this.game.player;
    for (const it of P.inventory) if (it.id === id) return it;
    for (const slot of EQUIP_SLOTS) if (P.equip[slot] && P.equip[slot].id === id) return P.equip[slot];
    return null;
  }

  onClick(e) {
    const target = e.target.closest('[data-act]');
    if (!target || target.disabled) return;
    const P = this.game.player;
    const act = target.dataset.act;
    if (act === 'close') { this.close(); return; }
    if (act === 'editor') {
      if (this.locked) return;
      this.close();
      this.game.app.openEditorInCamp();
      return;
    }
    if (this.army.el.contains(target)) return; // handled by the army tab itself
    const item = this.selItem;
    if (act !== 'dismantle') this.confirmId = 0;
    if (act === 'tab') {
      this.tab = target.dataset.tab;
    } else if (act === 'item') {
      this.selItem = this.findItem(Number(target.dataset.id));
    } else if (act === 'equip' && item && !this.locked) {
      P.equipItem(item);
    } else if (act === 'upgrade' && item) {
      P.upgradeItem(item);
    } else if (act === 'dismantle' && item) {
      if (item.rarity >= 2 && this.confirmId !== item.id) {
        this.confirmId = item.id;
      } else {
        P.dismantleItem(item);
        this.selItem = null;
        this.confirmId = 0;
      }
    } else if (act === 'stat') {
      P.spendPoint(target.dataset.stat);
    } else if (act === 'skill') {
      this.selSkill = target.dataset.id;
    } else if (act === 'slot' && this.selSkill && !this.locked) {
      P.setSlot(Number(target.dataset.slot), this.selSkill);
    }
    this.render();
  }

  render() {
    const tabs = TABS.map((id) => {
      const badge = id === 'stats' && this.game.player.points > 0 ? `<i>${this.game.player.points}</i>` : '';
      return `<button class="mn-tab${id === this.tab ? ' on' : ''}" data-act="tab" data-tab="${id}">${TAB_ICONS[id]}<span>${t('menu.' + id)}</span>${badge}</button>`;
    }).join('');
    const scroll = [...this.el.querySelectorAll('[data-scroll]')].map((l) => [l.dataset.scroll, l.scrollTop]);
    this.el.innerHTML = `
      <div class="mn-head">${tabs}<span class="mn-note">${this.locked && this.tab !== 'army' ? t('menu.campOnly') : ''}</span>
        <button class="ap-btn ghost" data-act="close">${t('menu.close')}</button></div>
      <div class="mn-body"></div>`;
    const body = this.el.querySelector('.mn-body');
    if (this.tab === 'army') {
      body.appendChild(this.army.el);
      this.army.render();
    } else {
      const views = { gear: () => this.gear(), stats: () => this.stats(), skills: () => this.skills(), look: () => this.look() };
      body.innerHTML = views[this.tab]();
    }
    for (const [key, top] of scroll) {
      const l = this.el.querySelector(`[data-scroll="${key}"]`);
      if (l) l.scrollTop = top;
    }
  }

  // ---- gear -------------------------------------------------------------------
  tile(item, extra = '') {
    const P = this.game.player;
    const cur = P.equip[slotOf(item)];
    const better = cur !== item && (!cur || itemPower(item) > itemPower(cur));
    return `<div class="tile r${item.rarity}${this.selItem === item ? ' sel' : ''}${extra}" data-act="item" data-id="${item.id}" style="--rc:${RARITY_CSS[item.rarity]}">
      ${iconOf(item)}<small>${item.level}${item.up ? '+' + item.up : ''}</small>${better ? '<em>▲</em>' : ''}</div>`;
  }

  mainStat(item) {
    return item.kind === 'weapon' ? Math.round(weaponDamage(item)) : armorDefense(item);
  }

  detail(item) {
    const P = this.game.player, I = CONFIG.items;
    const slot = slotOf(item);
    const cur = P.equip[slot];
    const equipped = cur === item;
    const color = RARITY_CSS[item.rarity];
    const rows = [];
    const main = this.mainStat(item);
    let diff = '';
    if (!equipped) {
      const d = main - (cur ? this.mainStat(cur) : 0);
      diff = d === 0 ? '' : `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`;
    }
    rows.push(`<div class="row"><span>${t(item.kind === 'weapon' ? 'item.damage' : 'item.defense')}</span><b>${main} ${diff}</b></div>`);
    if (item.kind === 'weapon') {
      const w = CONFIG.weapons[item.type];
      rows.push(`<div class="row"><span>${t('item.reload')}</span><b>${w.reload}s</b></div>`);
      rows.push(`<div class="row"><span>${t('item.range')}</span><b>${w.range}</b></div>`);
      rows.push(`<p>${t('weapon.' + item.type + '.desc')}</p>`);
    } else {
      rows.push(`<p class="bonus">${bonusText(item.bonus, armorBonus(item))}</p>`);
      const have = P.setCount[item.set] || 0;
      rows.push(`<p class="set">${t('item.set', { set: t('set.' + item.set), n: have })}</p>`);
      const tiers = I.sets[item.set];
      for (const need in tiers) {
        const text = Object.keys(tiers[need]).map((k) => bonusText(k, tiers[need][k])).join(', ');
        rows.push(`<p class="setb${have >= Number(need) ? ' on' : ''}">${t('item.setBonus', { n: need, text })}</p>`);
      }
    }
    if (!equipped && cur) rows.push(`<p class="cmp">${t('item.equipped')}: <b style="color:${RARITY_CSS[cur.rarity]}">${itemName(cur)}</b> (${this.mainStat(cur)})</p>`);

    const maxed = item.up >= I.maxUpgrade;
    const cost = upgradeCost(item);
    const buttons = [];
    if (!equipped) buttons.push(`<button class="ap-btn" data-act="equip"${this.locked ? ' disabled' : ''}>${t('gear.equip')}</button>`);
    buttons.push(`<button class="ap-btn" data-act="upgrade"${maxed || P.essence < cost ? ' disabled' : ''}>${maxed ? t('gear.maxed') : t('gear.upgrade', { cost })}</button>`);
    if (!equipped) {
      const label = this.confirmId === item.id ? t('gear.confirm') : t('gear.dismantle', { n: dismantleValue(item) });
      buttons.push(`<button class="ap-btn danger" data-act="dismantle">${label}</button>`);
    }
    return `<h3 style="color:${color}">${itemName(item)}</h3>
      <small class="sub">${t('rarity.' + item.rarity)} · ${t('item.level', { level: item.level })}${equipped ? ' · ' + t('item.equipped') : ''}</small>
      <div class="d-rows" data-scroll="detail">${rows.join('')}</div><div class="d-btns">${buttons.join('')}</div>`;
  }

  gear() {
    const P = this.game.player;
    const slots = EQUIP_SLOTS.map((slot) => {
      const it = P.equip[slot];
      if (!it) return `<div class="g-slot empty"><div class="tile none">${ICONS[slot] || ''}</div><div><b>${t('slot.' + slot)}</b><small>—</small></div></div>`;
      return `<div class="g-slot${this.selItem === it ? ' sel' : ''}" data-act="item" data-id="${it.id}">${this.tile(it)}
        <div><b style="color:${RARITY_CSS[it.rarity]}">${itemName(it)}</b><small>${t(it.kind === 'weapon' ? 'item.damage' : 'item.defense')} ${this.mainStat(it)}</small></div></div>`;
    }).join('');
    const inv = P.inventory.length
      ? P.inventory.map((it) => this.tile(it)).join('')
      : `<div class="g-none">${t('gear.empty')}</div>`;
    const detail = this.selItem ? this.detail(this.selItem) : `<div class="g-none">${t('item.select')}</div>`;
    return `<div class="gear">
      <div class="g-left" data-scroll="eq">${slots}<div class="g-ess">${t('gear.essence', { n: P.essence })}</div></div>
      <div class="g-mid"><h3>${t('gear.bag', { n: P.inventory.length, max: CONFIG.items.inventorySize })}</h3><div class="g-grid" data-scroll="inv">${inv}</div></div>
      <div class="g-right">${detail}</div></div>`;
  }

  // ---- stats ------------------------------------------------------------------
  stats() {
    const P = this.game.player, K = CONFIG.progression.defenseK;
    const rows = STAT_KEYS.map((k) => `<div class="s-row"><div><b>${t('stat.' + k)}</b><small>${t('stat.' + k + '.desc')}</small></div>
      <span>${P.stats[k]}</span><button class="ap-btn" data-act="stat" data-stat="${k}"${P.points > 0 ? '' : ' disabled'}>+</button></div>`).join('');
    const d = [
      ['hp', fmt(P.maxHp)], ['hpRegen', fmt(P.hpRegen)], ['mana', P.maxMana], ['manaRegen', P.manaRegen.toFixed(1)],
      ['damage', fmt(P.power())], ['crit', pct(P.crit)], ['critDmg', pct(P.critDmg)], ['defense', P.defense],
      ['reduction', pct(1 - P.takenFactor())], ['speed', P.speed.toFixed(1)], ['reload', P.reloadTime.toFixed(2) + 's'],
      ['drop', '+' + pct(P.drop)], ['slots', this.game.army.maxDeployed()],
    ].map(([k, v]) => `<div class="row"><span>${t('derived.' + k)}</span><b>${v}</b></div>`).join('');
    return `<div class="stats">
      <div class="s-left" data-scroll="stats">
        <div class="s-head"><b>${t('hud.level', { level: P.level })}</b><span>${t('stats.xp', { xp: Math.floor(P.xp), need: P.xpNeed() })}</span>
          <em class="${P.points > 0 ? 'on' : ''}">${t('stats.points', { n: P.points })}</em></div>${rows}</div>
      <div class="s-right" data-scroll="derived">${d}</div></div>`;
  }

  // ---- appearance ---------------------------------------------------------------
  look() {
    return `<div class="look"><p>${t('look.text')}</p>
      <button class="ap-btn big" data-act="editor"${this.locked ? ' disabled' : ''}>${t('look.open')}</button>
      ${this.locked ? `<small>${t('menu.campOnly')}</small>` : ''}</div>`;
  }

  // ---- skills -----------------------------------------------------------------
  skills() {
    const P = this.game.player;
    const slots = [0, 1, 2].map((k) => `<div class="k-slot${k === 2 ? ' ult' : ''}"><small>${t('skills.slot' + k)}</small><b>${P.slots[k] ? t('skill.' + P.slots[k]) : t('skills.none')}</b></div>`).join('');
    const list = P.known.map((id) => {
      const ult = !!CONFIG.ultimates[id];
      const used = P.slots.indexOf(id);
      return `<div class="k-item${ult ? ' ult' : ''}${this.selSkill === id ? ' sel' : ''}" data-act="skill" data-id="${id}">
        <b>${t('skill.' + id)}</b><small>${used >= 0 ? t('skills.slot' + used) : ''}</small></div>`;
    }).join('');
    let detail = `<div class="g-none">${t('skills.select')}</div>`;
    if (this.selSkill) {
      const id = this.selSkill, def = skillDef(id), ult = !!CONFIG.ultimates[id];
      const off = this.locked ? ' disabled' : '';
      const btns = ult
        ? `<button class="ap-btn" data-act="slot" data-slot="2"${off}>${t('skills.to2')}</button>`
        : `<button class="ap-btn" data-act="slot" data-slot="0"${off}>${t('skills.to0')}</button><button class="ap-btn" data-act="slot" data-slot="1"${off}>${t('skills.to1')}</button>`;
      detail = `<h3>${t('skill.' + id)}</h3>
        <small class="sub">${ult ? t('skills.ultCost') : t('skills.cost', { mana: def.mana, cd: def.cooldown })}</small>
        <div class="d-rows"><p>${t('skill.' + id + '.desc')}</p></div><div class="d-btns">${btns}</div>`;
    }
    return `<div class="skills">
      <div class="k-left"><div class="k-slots">${slots}</div><div class="k-list" data-scroll="skills">${list}</div></div>
      <div class="g-right">${detail}</div></div>`;
  }
}
