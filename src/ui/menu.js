// The in-game menu with four tabs: Gear (equipment and inventory), Stats
// (level and stat points), Skills and Army. The game is paused while it is
// open. Equipment, skills and the army can only be changed in the camp.
import { CONFIG } from '../config.js';
import { fmt, flashClass } from '../core/format.js';
import { t } from '../strings.js';
import { ArmyPanel } from './armyPanel.js';
import { TAB_ICONS, SKILL_ICONS } from './icons.js';

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" fill="currentColor"/></svg>';
import { STAT_KEYS } from '../entities/player.js';
import { RANKS } from '../world/gates.js';
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
    this.bulk = false; // the "dismantle all" panel is shown
    this.bulkConfirm = -1; // rarity waiting for a second tap
    this.bulkDone = '';
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
    // open where something new waits
    if (tab) this.tab = tab;
    else if (P.points > 0) this.tab = 'stats';
    else if (P.inventory.some((it) => it.n)) this.tab = 'gear';
    else if (P.newSkills.length) this.tab = 'skills';
    this.selItem = null;
    this.selSkill = null;
    this.confirmId = 0;
    this.bulk = false;
    this.bulkDone = '';
    this.game.setPaused(true);
    this.el.classList.add('on');
    this.render();
    flashClass(this.el, 'enter');
  }

  // what was shown in a tab is not new any more once the player leaves it
  markSeen(tab) {
    const P = this.game.player;
    if (tab === 'gear') for (const it of P.inventory) delete it.n;
    if (tab === 'skills') P.newSkills.length = 0;
  }

  close() {
    this.markSeen(this.tab);
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
    if (act !== 'bulkGo') this.bulkConfirm = -1;
    if (act === 'tab') {
      if (target.dataset.tab !== this.tab) {
        this.markSeen(this.tab);
        flashClass(this.el, 'enter-tab');
      }
      this.tab = target.dataset.tab;
    } else if (act === 'item') {
      this.selItem = this.findItem(Number(target.dataset.id));
      this.bulk = false;
    } else if (act === 'bulk') {
      this.bulk = !this.bulk;
      this.bulkDone = '';
    } else if (act === 'bulkGo') {
      // epic and better: a second tap confirms
      const r = Number(target.dataset.r), list = P.bulkList(r);
      if (r >= 3 && this.bulkConfirm !== r) {
        this.bulkConfirm = r;
      } else if (list.length) {
        const e = P.dismantleMany(list);
        if (this.selItem && !P.inventory.includes(this.selItem)) this.selItem = null;
        this.bulkDone = t('gear.bulkDone', { n: list.length, e });
        this.bulkConfirm = -1;
      }
    } else if (act === 'auto') {
      P.autoSalvage = Number(target.dataset.r);
    } else if (act === 'equip' && item && !this.locked) {
      P.equipItem(item);
    } else if (act === 'upgrade' && item) {
      P.upgradeItem(item);
    } else if (act === 'dismantle' && item) {
      if (item.rarity >= 3 && this.confirmId !== item.id) {
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
    const P = this.game.player;
    const news = {
      stats: P.points > 0 ? P.points : '',
      gear: P.inventory.some((it) => it.n) ? '!' : '',
      skills: P.newSkills.length ? '!' : '',
    };
    const tabs = TABS.map((id) => {
      const badge = news[id] ? `<i>${news[id]}</i>` : '';
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
    return `<div class="tile r${item.rarity}${this.selItem === item ? ' sel' : ''}${item.n ? ' new' : ''}${extra}" data-act="item" data-id="${item.id}" style="--rc:${RARITY_CSS[item.rarity]}">
      ${iconOf(item)}<small>${item.level}${item.up ? '+' + item.up : ''}</small>${better ? '<em>▲</em>' : ''}${item.n ? `<b class="nw">${t('menu.new')}</b>` : ''}</div>`;
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
    // best first: rarity, then item level
    const sorted = [...P.inventory].sort((a, b) => b.rarity - a.rarity || b.level - a.level || b.id - a.id);
    const inv = sorted.length
      ? sorted.map((it) => this.tile(it)).join('')
      : `<div class="g-none">${t('gear.empty')}</div>`;
    const detail = this.bulk ? this.bulkPanel()
      : this.selItem ? this.detail(this.selItem) : `<div class="g-none">${t('item.select')}</div>`;
    const full = P.inventory.length >= CONFIG.items.inventorySize;
    return `<div class="gear">
      <div class="g-left" data-scroll="eq">${slots}<div class="g-ess">${t('gear.essence', { n: P.essence })}</div></div>
      <div class="g-mid"><div class="g-head"><h3 class="${full ? 'full' : ''}">${t('gear.bag', { n: P.inventory.length, max: CONFIG.items.inventorySize })}</h3>
        <button class="ap-btn small${this.bulk ? ' on' : ''}" data-act="bulk">${this.bulk ? t('gear.back') : t('gear.bulk')}</button></div>
        <div class="g-grid" data-scroll="inv">${inv}</div></div>
      <div class="g-right">${detail}</div></div>`;
  }

  // dismantle every item of one rarity at once, and the auto-dismantle setting
  bulkPanel() {
    const P = this.game.player;
    const rows = RARITY_CSS.map((c, r) => {
      const list = P.bulkList(r);
      const e = list.reduce((s, it) => s + dismantleValue(it), 0);
      const label = this.bulkConfirm === r ? t('gear.confirm') : t('gear.bulkGo');
      return `<div class="bk-row" style="--rc:${c}"><i></i><div><b>${t('rarity.' + r)}</b><small>${list.length ? t(list.length === 1 ? 'gear.bulkRow1' : 'gear.bulkRow', { n: list.length, e }) : t('gear.bulkNone')}</small></div>
        <button class="ap-btn danger small" data-act="bulkGo" data-r="${r}"${list.length ? '' : ' disabled'}>${label}</button></div>`;
    }).join('');
    const autos = [-1, 0, 1, 2].map((r) => `<button class="seg${P.autoSalvage === r ? ' on' : ''}" data-act="auto" data-r="${r}"
      ${r >= 0 ? `style="--rc:${RARITY_CSS[r]}"` : ''}>${r < 0 ? t('gear.autoOff') : t('rarity.' + r)}</button>`).join('');
    return `<h3>${t('gear.bulkTitle')}</h3>
      <div class="d-rows" data-scroll="bulk"><p class="bk-hint">${t('gear.bulkHint')}</p>${rows}
        <p class="bk-done">${this.bulkDone || ''}</p>
        <h4 class="bk-auto">${t('gear.auto')}</h4><div class="segs bk-segs">${autos}</div></div>`;
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
      ['drop', '+' + pct(P.drop)], ['slots', this.game.army.maxDeployed()], ['armyRange', Math.round(this.game.army.huntRange())],
    ].map(([k, v]) => `<div class="row"><span>${t('derived.' + k)}</span><b>${v}</b></div>`).join('');
    // the rank and when the next one comes
    const L = CONFIG.levels.rankLevels, r = this.game.rankIndex;
    const rank = r + 1 < L.length
      ? t('stats.nextRank', { rank: RANKS[r], next: RANKS[r + 1], level: L[r + 1] })
      : t('stats.maxRank', { rank: RANKS[r] });
    return `<div class="stats">
      <div class="s-left" data-scroll="stats">
        <div class="s-head"><b>${t('hud.level', { level: P.level })}</b><span>${t('stats.xp', { xp: fmt(Math.floor(P.xp)), need: fmt(P.xpNeed()) })}</span>
          <small class="s-rank">${rank}</small>
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
  // Left: the three equipped slots. Middle: every skill and ultimate (the ones
  // not found yet are shown locked). Right: details and where to equip it.
  skillCard(id, cls) {
    const P = this.game.player;
    const known = P.known.includes(id);
    const used = P.slots.indexOf(id);
    const def = skillDef(id), ult = !!CONFIG.ultimates[id];
    const meta = !known ? t('skills.locked') : ult ? t('skills.ultShort') : t('skills.short', { mana: def.mana, cd: def.cooldown });
    const badge = used >= 0 ? `<em>${used === 2 ? 'U' : used + 1}</em>` : '';
    return `<div class="k-card ${cls}${ult ? ' ult' : ''}${known ? '' : ' locked'}${this.selSkill === id ? ' sel' : ''}" data-act="skill" data-id="${id}">
      <i>${known ? SKILL_ICONS[id] : LOCK}</i><div><b>${t('skill.' + id)}</b><small>${meta}</small></div>${badge}${P.newSkills.includes(id) ? `<b class="nw">${t('menu.new')}</b>` : ''}</div>`;
  }

  skillStats(id) {
    const def = skillDef(id), ult = !!CONFIG.ultimates[id];
    const rows = [];
    const row = (k, v) => rows.push(`<div class="row"><span>${t('ks.' + k)}</span><b>${v}</b></div>`);
    if (ult) row('charge', t('skills.ultCost'));
    else { row('mana', def.mana); row('cooldown', def.cooldown + 's'); }
    if (def.power) row('damage', t('ks.damageV', { v: def.power }) + (def.ticks ? ' × ' + def.ticks : ''));
    if (def.range) row('range', def.range);
    if (def.radius) row('radius', def.radius);
    if (def.arcDeg) row('cone', def.arcDeg + '°');
    if (def.width) row('width', def.width);
    if (def.stun) row('stun', def.stun + 's');
    if (def.shield) row('shield', Math.round(def.shield * 100) + '%');
    if (def.heal) row('heal', Math.round(def.heal * 100) + '%');
    if (def.armyDamage) row('army', '+' + Math.round(def.armyDamage * 100) + '%');
    if (def.damage && ult) row('damageUp', '+' + Math.round(def.damage * 100) + '%');
    if (def.duration) row('duration', def.duration + 's');
    return rows.join('');
  }

  skills() {
    const P = this.game.player;
    if (!this.selSkill) this.selSkill = P.slots[0] || P.known[0];
    const slots = [0, 1, 2].map((k) => {
      const id = P.slots[k];
      if (!id) return `<div class="k-slot empty${k === 2 ? ' ult' : ''}"><i></i><div><small>${t('skills.slot' + k)}</small><b>${t('skills.none')}</b></div></div>`;
      const def = skillDef(id);
      const meta = k === 2 ? t('skills.ultShort') : t('skills.short', { mana: def.mana, cd: def.cooldown });
      return `<div class="k-slot${k === 2 ? ' ult' : ''}${this.selSkill === id ? ' sel' : ''}" data-act="skill" data-id="${id}">
        <i>${SKILL_ICONS[id]}</i><div><small>${t('skills.slot' + k)}</small><b>${t('skill.' + id)}</b><span>${meta}</span></div></div>`;
    }).join('');
    const skillIds = Object.keys(CONFIG.skills), ultIds = Object.keys(CONFIG.ultimates);
    const count = (ids) => ids.filter((id) => P.known.includes(id)).length;
    // found ones first
    const order = (ids) => [...ids].sort((x, y) => P.known.includes(y) - P.known.includes(x));
    const list = `<h4>${t('skills.listSkills', { n: count(skillIds), max: skillIds.length })}</h4>
      <div class="k-grid">${order(skillIds).map((id) => this.skillCard(id, '')).join('')}</div>
      <h4>${t('skills.listUlts', { n: count(ultIds), max: ultIds.length })}</h4>
      <div class="k-grid">${order(ultIds).map((id) => this.skillCard(id, '')).join('')}</div>`;

    let detail = `<div class="g-none">${t('skills.select')}</div>`;
    const id = this.selSkill;
    if (id) {
      const ult = !!CONFIG.ultimates[id], known = P.known.includes(id);
      let btns = '';
      if (!known) {
        btns = `<p class="k-hint">${t('skills.findIt')}</p>`;
      } else {
        const targets = ult ? [2] : [0, 1];
        btns = targets.map((k) => {
          const cur = P.slots[k];
          const here = cur === id;
          const label = here ? t('skills.inSlot', { slot: t('skills.slot' + k) })
            : cur ? t('skills.replace', { slot: t('skills.slot' + k), name: t('skill.' + cur) })
              : t('skills.equipTo', { slot: t('skills.slot' + k) });
          return `<button class="ap-btn${here ? ' ghost' : ''}" data-act="slot" data-slot="${k}"${here || this.locked ? ' disabled' : ''}>${label}</button>`;
        }).join('');
        if (this.locked) btns += `<p class="k-hint">${t('menu.campOnly')}</p>`;
      }
      detail = `<div class="k-head${ult ? ' ult' : ''}${known ? '' : ' locked'}"><i>${known ? SKILL_ICONS[id] : LOCK}</i>
          <div><h3>${t('skill.' + id)}</h3><small class="sub">${ult ? t('skills.typeUlt') : t('skills.typeSkill')}</small></div></div>
        <div class="d-rows" data-scroll="kd"><p>${t('skill.' + id + '.desc')}</p>${this.skillStats(id)}</div>
        <div class="d-btns k-btns">${btns}</div>`;
    }
    return `<div class="skills">
      <div class="k-left"><h4>${t('skills.equipped')}</h4>${slots}</div>
      <div class="k-mid" data-scroll="skills">${list}</div>
      <div class="g-right">${detail}</div></div>`;
  }

}
