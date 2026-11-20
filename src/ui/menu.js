// The in-game menu with four tabs: Gear (equipment and inventory), Stats
// (level and stat points), Skills and Army. The game is paused while it is
// open. Equipment, skills and the army can only be changed in the camp.
import { CONFIG } from '../config.js';
import { fmt, flashClass } from '../core/format.js';
import { t } from '../strings.js';
import { ArmyPanel } from './armyPanel.js';
import { ShadowStage } from './shadowStage.js';
import { TAB_ICONS, SKILL_ICONS, SET_ICONS, SET_CSS } from './icons.js';
import { gearIcon, WEAPON_ICONS } from './gearIcons.js';
import { msToMidnight, today } from '../core/quests.js';
import { TITLES } from '../core/titles.js';
import { play } from '../core/sfx.js';

const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V7a3 3 0 0 0-6 0z" fill="currentColor"/></svg>';
import { STAT_KEYS } from '../entities/player.js';
import { RANKS } from '../world/gates.js';
import { skillDef } from '../combat/skills.js';
import {
  EQUIP_SLOTS, RARITY_CSS, itemName, weaponDamage, weaponDps, armorDefense, armorBonus, bonusText,
  upgradeCost, dismantleValue, itemPower, slotOf, attuneLevel, attuneCost,
} from '../core/items.js';

const TABS = ['gear', 'stats', 'skills', 'path', 'army', 'quests', 'bestiary', 'look'];

const svg = (d) => `<svg viewBox="0 0 24 24"><path d="${d}" fill="currentColor"/></svg>`;
const ICONS = {
  sword: svg('M19 2h3v3L11 16l-3-3zM5 13l6 6-2 2-2-2-3 3-2-2 3-3-2-2z'),
  daggers: svg('M14 2l3 1-7 11-2-2zM10 2L7 3l7 11 2-2zM5 15l4 4-2 2-4-4zM19 15l-4 4 2 2 4-4z'),
  bow: svg('M6 2c8 2 12 8 12 10s-4 8-12 10l-1-2c6-2 10-6 10-8S11 6 5 4zM4 3h2v18H4z'),
  scythe: svg('M5 2h2v20H5zM7 3c7 0 12 3 14 9-4-4-8-5-14-5z'),
  staff: svg('M11 9h2v13h-2zM12 1l4 4-4 4-4-4z'),
  spear: svg('M22 2l-2 8-2-2L5 21l-2 1 1-2L17 7l-2-2z'),
  hammer: svg('M6 3h12v7h-4.500v12h-3V10H6z'),
  grimoire: svg('M5 3h12a2 2 0 0 1 2 2v16H7a2 2 0 0 1-2-2zm2 2v12h10V5zm5 2l1.200 2.600 2.800.400-2 2 .500 2.800L12 13.500l-2.500 1.300.500-2.800-2-2 2.800-.400z'),
  helmet: svg('M4 14a8 8 0 0 1 16 0v6h-5v-5H9v5H4z'),
  chest: svg('M4 4l4-2 4 2 4-2 4 2v6l-2 1v11H6V11l-2-1z'),
  gloves: svg('M7 22V12L5 9V5h2v4h1V3h2v6h1V2h2v7h1V4h2v9l-1 3v6z'),
  boots: svg('M7 2h6v12l7 4v4H5v-6l2-2z'),
};
ICONS.weapon = ICONS.sword; // empty weapon slot and the slot filter
const iconOf = (item) => gearIcon(item) || ICONS[item.type];
const FUNNEL = svg('M3 4h18l-7 8v6l-4 2v-8z');

// the filter of the inventory; sort: rarity, level, power, gain, newest
const SORTS = ['rarity', 'level', 'power', 'gain', 'newest'];
const newFilter = () => ({ slot: 'all', wtype: 'all', set: 'all', bonus: 'all', minR: 0, better: false, sort: 'rarity' });

const pct = (v) => Math.round(v * 100) + '%';

export class Menu {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'menu';
    root.appendChild(this.el);
    this.army = new ArmyPanel(game);
    // 3D view of the monster in the bestiary (the element stays while the tab is redrawn)
    this.beastStage = new ShadowStage();
    this.beastEl = document.createElement('div');
    this.beastEl.className = 'b-stage';
    this.tab = 'gear';
    this.isOpen = false;
    this.opens = 0; // how often it was opened (the tutorial waits for it)
    this.locked = false;
    this.selItem = null; // selected item (inventory or equipped)
    this.selSkill = null;
    this.confirmId = 0; // item waiting for a second tap on "Dismantle"
    this.bulk = false; // the "dismantle all" panel is shown
    this.bulkConfirm = -1; // rarity waiting for a second tap
    this.bulkDone = '';
    this.flt = newFilter(); // stays while the game runs
    this.fpanel = false; // the filter panel is shown
    this.selBeast = null; // monster shown in the bestiary
    this.qMode = 'quests'; // quests | shop
    this.qPick = -1; // quest whose reward is being picked
    this.qStone = -1; // Soul Stone whose monster kind is being picked
    this.el.addEventListener('click', (e) => this.onClick(e));
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    window.addEventListener('resize', () => { if (this.isOpen && this.el.isConnected) this.fitHead(); });
  }

  // hint: text shown in the army tab (army full while a soul waits)
  open(tab, hint) {
    if (this.isOpen) return;
    const P = this.game.player;
    this.isOpen = true;
    this.opens++;
    this.locked = !P.inCamp;
    this.army.locked = false; // the army can be changed anywhere
    this.army.reset();
    this.qPick = this.qStone = -1;
    this.army.hint = hint || '';
    // open where something new waits
    if (tab) this.tab = tab;
    else if (P.points > 0 || P.mastery.pts > 0) this.tab = 'stats';
    else if (P.inventory.some((it) => it.n)) this.tab = 'gear';
    else if (P.newSkills.length) this.tab = 'skills';
    this.selItem = null;
    this.selSkill = null;
    this.confirmId = 0;
    this.bulk = false;
    this.fpanel = false;
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
    if (tab === 'bestiary') this.game.bestiary.fresh.clear();
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
      this.fpanel = false;
    } else if (act === 'bulk') {
      this.bulk = !this.bulk;
      this.fpanel = false;
      this.bulkDone = '';
    } else if (act === 'fpanel') {
      this.fpanel = !this.fpanel;
      this.bulk = false;
    } else if (act === 'flt') {
      this.setFilter(target.dataset.k, target.dataset.v);
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
    } else if (act === 'attune' && item && !this.locked) {
      if (P.attuneItem(item, this.game.abyss.best)) {
        play('stage');
        this.game.hud.toast(t('uq.attunedNow', { level: item.level }));
        this.game.save();
      }
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
    } else if (act === 'claim') {
      this.qPick = Number(target.dataset.k); // the choice of one of three rewards
    } else if (act === 'pick') {
      this.game.quests.claim(this.qPick, Number(target.dataset.i));
      this.qPick = -1;
    } else if (act === 'qcancel') {
      this.qPick = this.qStone = -1;
    } else if (act === 'qmode') {
      this.qMode = target.dataset.v;
    } else if (act === 'stoneOpen') {
      this.qStone = Number(target.dataset.i);
    } else if (act === 'stoneUse') {
      if (this.game.quests.useStone(this.qStone, target.dataset.t)) this.qStone = -1;
    } else if (act === 'pathPick') {
      this.game.path.pick(target.dataset.id);
    } else if (act === 'titlePick') {
      this.game.titles.wear(target.dataset.id);
    } else if (act === 'pathRespec') {
      this.game.path.respec();
    } else if (act === 'useXp') {
      this.game.quests.useXp();
    } else if (act === 'useKey') {
      if (this.game.quests.useKey()) this.close();
    } else if (act === 'buy') {
      this.game.quests.buy(target.dataset.id);
    } else if (act === 'beast') {
      this.selBeast = target.dataset.id;
    } else if (act === 'stat') {
      P.spendPoint(target.dataset.stat);
    } else if (act === 'mastery') {
      P.spendMastery(target.dataset.k);
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
      stats: P.points + P.mastery.pts > 0 ? P.points + P.mastery.pts : '',
      gear: P.inventory.some((it) => it.n) ? '!' : '',
      skills: P.newSkills.length ? '!' : '',
      quests: this.game.quests.ready() || '',
      bestiary: this.game.bestiary.fresh.size ? '!' : '',
      path: this.game.path.due() ? '!' : '',
    };
    const tabs = TABS.map((id) => {
      const badge = news[id] ? `<i>${news[id]}</i>` : '';
      return `<button class="mn-tab${id === this.tab ? ' on' : ''}" data-act="tab" data-tab="${id}">${TAB_ICONS[id]}<span>${t('menu.' + id)}</span>${badge}</button>`;
    }).join('');
    const scroll = [...this.el.querySelectorAll('[data-scroll]')].map((l) => [l.dataset.scroll, l.scrollTop]);
    this.el.innerHTML = `
      <div class="mn-head">${tabs}<span class="mn-note">${this.locked && !['army', 'quests', 'bestiary', 'path'].includes(this.tab) ? t('menu.campOnly') : ''}</span>
        <button class="ap-btn ghost" data-act="close">${t('menu.close')}</button></div>
      <div class="mn-body"></div>`;
    this.fitHead();
    const body = this.el.querySelector('.mn-body');
    if (this.tab === 'army') {
      body.appendChild(this.army.el);
      this.army.render();
    } else {
      const views = { gear: () => this.gear(), stats: () => this.stats(), skills: () => this.skills(), look: () => this.look(),
        quests: () => this.questsView(), bestiary: () => this.bestiaryView(), path: () => this.pathView() };
      body.innerHTML = views[this.tab]();
      if (this.tab === 'bestiary') this.showBeast(body);
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
    // armour shows the emblem of its set in the corner
    const set = item.set ? `<u style="color:${SET_CSS[item.set]}">${SET_ICONS[item.set]}</u>` : '';
    return `<div class="tile r${item.rarity}${this.selItem === item ? ' sel' : ''}${item.n ? ' new' : ''}${extra}" data-act="item" data-id="${item.id}" style="--rc:${RARITY_CSS[item.rarity]}">
      ${iconOf(item)}${set}<small>${item.level}${item.up ? '+' + item.up : ''}</small>${better ? '<em>▲</em>' : ''}${item.n ? `<b class="nw">${t('menu.new')}</b>` : ''}</div>`;
  }

  // DPS for weapons, defence for armour
  mainStat(item) {
    return item.kind === 'weapon' ? Math.round(weaponDps(item)) : armorDefense(item);
  }

  // main value the item would have at another item level
  mainStatAt(item, level) {
    return this.mainStat({ ...item, level });
  }

  mainLabel(item) {
    return t(item.kind === 'weapon' ? 'item.dps' : 'item.defense');
  }

  diffOf(v, cur) {
    const d = Math.round(v - cur);
    return d === 0 ? '' : `<span class="${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${fmt(d)}</span>`;
  }

  detail(item) {
    const P = this.game.player, I = CONFIG.items;
    const slot = slotOf(item);
    const cur = P.equip[slot];
    const equipped = cur === item;
    const color = RARITY_CSS[item.rarity];
    const rows = [];
    const main = this.mainStat(item);
    const diff = equipped ? '' : this.diffOf(main, cur ? this.mainStat(cur) : 0);
    rows.push(`<div class="row main"><span>${this.mainLabel(item)}</span><b>${fmt(main)} ${diff}</b></div>`);
    if (item.kind === 'weapon') {
      const w = CONFIG.weapons[item.type];
      const hit = Math.round(weaponDamage(item));
      const hitDiff = equipped ? '' : this.diffOf(hit, cur ? Math.round(weaponDamage(cur)) : 0);
      rows.push(`<div class="row"><span>${t('item.hit')}</span><b>${fmt(hit)} ${hitDiff}</b></div>`);
      rows.push(`<div class="row"><span>${t('item.hits')}</span><b>${t('shape.' + w.shape, { n: w.jumps || 0 })}</b></div>`);
      rows.push(`<div class="row"><span>${t('item.reload')}</span><b>${w.reload}s</b></div>`);
      rows.push(`<div class="row"><span>${t('item.range')}</span><b>${w.range}</b></div>`);
      if (w.stun) rows.push(`<div class="row"><span>${t('item.stun')}</span><b>${w.stun}s</b></div>`);
      if (w.jumps) rows.push(`<div class="row"><span>${t('item.jumps')}</span><b>${w.jumps}</b></div>`);
      rows.push(`<p>${t('weapon.' + item.type + '.desc')}</p>`);
      rows.push(`<p class="hint">${t('item.dpsHint')}</p>`);
    } else {
      rows.push(`<p class="bonus">${bonusText(item.bonus, armorBonus(item))}</p>`);
      const have = P.setCount[item.set] || 0;
      rows.push(`<p class="set" style="color:${SET_CSS[item.set]}"><u>${SET_ICONS[item.set]}</u>${t('item.set', { set: t('set.' + item.set), n: have })}<small>${t('set.' + item.set + '.desc')}</small></p>`);
      const tiers = I.sets[item.set];
      for (const need in tiers) {
        const text = Object.keys(tiers[need]).map((k) => bonusText(k, tiers[need][k])).join(', ');
        rows.push(`<p class="setb${have >= Number(need) ? ' on' : ''}">${t('item.setBonus', { n: need, text })}</p>`);
      }
    }
    if (!equipped && cur) rows.push(`<p class="cmp">${t('item.equipped')}: <b style="color:${RARITY_CSS[cur.rarity]}">${itemName(cur)}</b> (${fmt(this.mainStat(cur))})</p>`);

    const maxed = item.up >= I.maxUpgrade;
    const cost = upgradeCost(item);
    const buttons = [];
    if (!equipped) buttons.push(`<button class="ap-btn" data-act="equip"${this.locked ? ' disabled' : ''}>${t('gear.equip')}</button>`);
    buttons.push(`<button class="ap-btn" data-act="upgrade"${maxed || P.essence < cost ? ' disabled' : ''}>${maxed ? t('gear.maxed') : t('gear.upgrade', { cost })}</button>`);
    if (!equipped) {
      const label = this.confirmId === item.id ? t('gear.confirm') : t('gear.dismantle', { n: dismantleValue(item) });
      buttons.push(`<button class="ap-btn danger" data-act="dismantle">${label}</button>`);
    }
    if (item.uq) {
      // attune: raise it to the deepest Abyss floor cleared (camp only)
      const best = this.game.abyss.best, lvl = attuneLevel(item, best);
      let att = '';
      if (lvl) {
        const cost = attuneCost(item, best), floor = best;
        const gain = Math.round((this.mainStatAt(item, lvl) / this.mainStat(item) - 1) * 100);
        att = `<div class="uq-att"><span>${t('uq.attuneText', { floor, level: lvl, pct: gain })}</span>
          <button class="ap-btn" data-act="attune"${this.locked || P.essence < cost ? ' disabled' : ''}>${t('uq.attune', { cost: fmt(cost) })}</button>
          ${this.locked ? `<small>${t('menu.campOnly')}</small>` : ''}</div>`;
      } else {
        att = `<div class="uq-att done"><span>${t('uq.attuned', { floor: best })}</span></div>`;
      }
      rows.unshift(`<p class="uq-box"><b>${t('item.unique')}</b>${t('uqd.' + item.uq)}</p>` + att);
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
        <div><b style="color:${RARITY_CSS[it.rarity]}">${itemName(it)}</b><small>${this.mainLabel(it)} ${fmt(this.mainStat(it))}</small></div></div>`;
    }).join('');
    const shown = this.filtered();
    const inv = shown.length ? shown.map((it) => this.tile(it)).join('')
      : P.inventory.length ? `<div class="g-none">${t('flt.none')}<button class="ap-btn small ghost" data-act="flt" data-k="reset">${t('flt.reset')}</button></div>`
        : `<div class="g-none">${t('gear.empty')}</div>`;
    const detail = this.bulk ? this.bulkPanel() : this.fpanel ? this.filterPanel()
      : this.selItem ? this.detail(this.selItem) : `<div class="g-none">${t('item.select')}</div>`;
    const full = P.inventory.length >= CONFIG.items.inventorySize;
    const n = this.filterCount();
    // quick filter by slot
    const quick = ['all', ...EQUIP_SLOTS].map((s) => `<button class="${this.flt.slot === s ? 'on' : ''}" data-act="flt" data-k="slot" data-v="${s}"
      aria-label="${s === 'all' ? t('flt.all') : t('slot.' + s)}">${s === 'all' ? t('flt.all') : ICONS[s]}</button>`).join('');
    return `<div class="gear">
      <div class="g-left" data-scroll="eq">${slots}<div class="g-ess">${t('gear.essence', { n: P.essence })}</div></div>
      <div class="g-mid"><div class="g-head"><h3 class="${full ? 'full' : ''}">${t('gear.bag', { n: P.inventory.length, max: CONFIG.items.inventorySize })}</h3>
        <div class="g-btns"><button class="ap-btn small ico${this.fpanel ? ' on' : ''}${n ? ' act' : ''}" data-act="fpanel" aria-label="${t('flt.btn')}">${FUNNEL}${n ? `<i>${n}</i>` : ''}</button>
        <button class="ap-btn small${this.bulk ? ' on' : ''}" data-act="bulk">${this.bulk ? t('gear.back') : t('gear.bulk')}</button></div></div>
        <div class="g-quick">${quick}</div>
        <div class="g-grid" data-scroll="inv">${inv}</div></div>
      <div class="g-right">${detail}</div></div>`;
  }

  // ---- filter -------------------------------------------------------------------
  setFilter(k, v) {
    const f = this.flt;
    if (k === 'reset') { this.flt = newFilter(); return; }
    if (k === 'better') { f.better = !f.better; return; }
    if (k === 'minR') { f.minR = Number(v); return; }
    f[k] = v;
    // weapon type and set / bonus exclude each other
    if (k === 'slot' && v === 'weapon') f.set = f.bonus = 'all';
    if (k === 'slot' && v !== 'weapon' && v !== 'all') f.wtype = 'all';
    if (k === 'wtype' && v !== 'all') { f.set = f.bonus = 'all'; if (f.slot !== 'all') f.slot = 'weapon'; }
    if ((k === 'set' || k === 'bonus') && v !== 'all') { f.wtype = 'all'; if (f.slot === 'weapon') f.slot = 'all'; }
  }

  // how many filters are on (slot and sorting not counted)
  filterCount() {
    const f = this.flt;
    return (f.wtype !== 'all') + (f.set !== 'all') + (f.bonus !== 'all') + (f.minR > 0) + f.better;
  }

  // the bag after the filter, sorted
  filtered() {
    const P = this.game.player, f = this.flt;
    // how much better than what is worn (x1.2 = 20 % better); empty slot = huge
    const gain = (it) => {
      const cur = P.equip[slotOf(it)];
      return cur ? itemPower(it) / Math.max(1e-6, itemPower(cur)) : 1e9;
    };
    const list = P.inventory.filter((it) => (f.slot === 'all' || slotOf(it) === f.slot)
      && it.rarity >= f.minR
      && (f.wtype === 'all' || (it.kind === 'weapon' && it.type === f.wtype))
      && (f.set === 'all' || it.set === f.set)
      && (f.bonus === 'all' || it.bonus === f.bonus)
      && (!f.better || gain(it) > 1));
    const kind = (a, b) => (a.kind === b.kind ? 0 : a.kind === 'weapon' ? -1 : 1);
    const by = {
      rarity: (a, b) => b.rarity - a.rarity || b.level - a.level,
      level: (a, b) => b.level - a.level || b.rarity - a.rarity,
      power: (a, b) => kind(a, b) || itemPower(b) - itemPower(a),
      gain: (a, b) => gain(b) - gain(a),
      newest: () => 0,
    }[f.sort] || (() => 0);
    return list.sort((a, b) => by(a, b) || b.id - a.id);
  }

  filterPanel() {
    const f = this.flt;
    const seg = (k, v, label, on, extra = '') => `<button class="seg${on ? ' on' : ''}${extra}" data-act="flt" data-k="${k}" data-v="${v}">${label}</button>`;
    const sorts = SORTS.map((s) => seg('sort', s, t('flt.s.' + s), f.sort === s)).join('');
    const rar = [seg('minR', 0, t('flt.all'), f.minR === 0)].concat(RARITY_CSS.slice(1).map((c, i) => {
      const r = i + 1;
      return `<button class="seg${f.minR === r ? ' on' : ''}" style="--rc:${c}" data-act="flt" data-k="minR" data-v="${r}">${t('rarity.' + r)}</button>`;
    })).join('');
    const parts = [`<h4 class="bk-auto">${t('flt.sort')}</h4><div class="segs bk-segs fl-segs">${sorts}</div>`,
      `<h4 class="bk-auto">${t('flt.rarity')}</h4><div class="segs bk-segs fl-segs">${rar}</div>`,
      `<div class="segs bk-segs fl-segs fl-one">${seg('better', 1, t('flt.better'), f.better)}</div>`];
    if (f.slot === 'all' || f.slot === 'weapon') {
      const types = Object.keys(CONFIG.weapons).map((w) => `<button class="seg ico${f.wtype === w ? ' on' : ''}" data-act="flt" data-k="wtype" data-v="${w}"
        title="${t('weapon.' + w)}" aria-label="${t('weapon.' + w)}">${WEAPON_ICONS[w]}</button>`).join('');
      parts.push(`<h4 class="bk-auto">${t('flt.weapon')}</h4><div class="segs bk-segs fl-segs">${seg('wtype', 'all', t('flt.all'), f.wtype === 'all')}${types}</div>`);
    }
    if (f.slot !== 'weapon') {
      const sets = Object.keys(CONFIG.items.sets).map((s) => `<button class="seg ico${f.set === s ? ' on' : ''}" style="color:${SET_CSS[s]}" data-act="flt" data-k="set" data-v="${s}"
        title="${t('set.' + s)}" aria-label="${t('set.' + s)}">${SET_ICONS[s]}</button>`).join('');
      const bonuses = Object.keys(CONFIG.items.bonuses).map((b) => seg('bonus', b, t('bname.' + b), f.bonus === b)).join('');
      parts.push(`<h4 class="bk-auto">${t('flt.set')}</h4><div class="segs bk-segs fl-segs">${seg('set', 'all', t('flt.all'), f.set === 'all')}${sets}</div>`);
      parts.push(`<h4 class="bk-auto">${t('flt.bonus')}</h4><div class="segs bk-segs fl-segs">${seg('bonus', 'all', t('flt.all'), f.bonus === 'all')}${bonuses}</div>`);
    }
    parts.push(`<button class="ap-btn small ghost fl-reset" data-act="flt" data-k="reset">${t('flt.reset')}</button>`);
    return `<h3>${t('flt.title')}</h3><div class="d-rows" data-scroll="flt">${parts.join('')}</div>`;
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

  // ---- mastery (after the last level) -------------------------------------------
  masteryRows() {
    const P = this.game.player, m = P.mastery, M = CONFIG.mastery.perPoint;
    if (P.level < CONFIG.levels.maxLevel) return '';
    const rows = Object.keys(M).map((k) => `<div class="s-row ms"><div><b>${t('mastery.' + k)}</b><small>${t('mastery.each', { v: Math.round(M[k] * 1000) / 10 })}</small></div>
      <span>${m.s[k]}</span><button class="ap-btn" data-act="mastery" data-k="${k}"${m.pts > 0 ? '' : ' disabled'}>+</button></div>`).join('');
    return `<div class="ms-head"><b>${t('mastery.title', { n: m.lv })}</b><span>${t('mastery.xp', { xp: fmt(Math.floor(m.xp)), need: fmt(P.masteryNeed()) })}</span>
      <em class="${m.pts > 0 ? 'on' : ''}">${t('mastery.points', { n: m.pts })}</em><small>${t('mastery.hint')}</small></div>${rows}`;
  }

  // ---- stats ------------------------------------------------------------------
  stats() {
    const P = this.game.player, K = CONFIG.progression.defenseK;
    const rows = STAT_KEYS.map((k) => `<div class="s-row"><div><b>${t('stat.' + k)}</b><small>${t('stat.' + k + '.desc')}</small></div>
      <span>${P.stats[k]}</span><button class="ap-btn" data-act="stat" data-stat="${k}"${P.points > 0 ? '' : ' disabled'}>+</button></div>`).join('') + this.masteryRows();
    const d = [
      ['hp', fmt(P.maxHp)], ['hpRegen', fmt(P.hpRegen)], ['mana', P.maxMana], ['manaRegen', P.manaRegen.toFixed(1)],
      ['damage', fmt(P.power())], ['dps', fmt(P.power() * (1 + P.crit * (P.critDmg - 1)) / P.reloadTime)], ['skill', fmt(P.skillPower())], ['crit', pct(P.crit)], ['critDmg', pct(P.critDmg)], ['defense', P.defense],
      ['reduction', pct(1 - P.takenFactor())], ['speed', P.speed.toFixed(1)], ['reload', P.reloadTime.toFixed(2) + 's'],
      ['charges', P.maxCharges],
      ['drop', '+' + pct(P.drop)], ['slots', this.game.army.maxDeployed()], ['armyRange', Math.round(this.game.army.huntRange())],
    ].map(([k, v]) => `<div class="row"><span>${t('derived.' + k)}</span><b>${v}</b></div>`).join('');
    // the rank and when the next one comes
    const L = CONFIG.levels.rankLevels, r = this.game.rankIndex;
    const rank = r + 1 < L.length
      ? this.game.trialDue() ? t('stats.trialRank', { rank: RANKS[r], next: RANKS[r + 1] }) : t('stats.nextRank', { rank: RANKS[r], next: RANKS[r + 1], level: L[r + 1] })
      : t('stats.maxRank', { rank: RANKS[r] });
    // deadly gate tiers reached per zone
    const tiers = this.game.gateTiers.map((n, zi) => (n > 0 ? t('zone.' + CONFIG.world.zones[zi].id) + ' +' + n : '')).filter(Boolean).join(' · ');
    return `<div class="stats">
      <div class="s-left" data-scroll="stats">
        <div class="s-head"><b>${t('hud.level', { level: P.level })}</b><span>${t('stats.xp', { xp: fmt(Math.floor(P.xp)), need: fmt(P.xpNeed()) })}</span>
          <small class="s-rank">${rank}</small>${tiers ? `<small class="s-rank">${t('stats.tiers', { list: tiers })}</small>` : ''}
          <em class="${P.points > 0 ? 'on' : ''}">${t('stats.points', { n: P.points })}</em></div>${rows}</div>
      <div class="s-right" data-scroll="derived">${d}</div></div>`;
  }

  // The tab row must fit (tablets have wide but short screens, phones narrow
  // ones): names of the closed tabs are hidden, then the tabs get narrower.
  fitHead() {
    const head = this.el.querySelector('.mn-head');
    if (!head) return;
    const over = () => head.scrollWidth > head.clientWidth + 1;
    this.el.classList.remove('compact', 'tiny', 'bare');
    for (const c of ['compact', 'tiny', 'bare']) if (over()) this.el.classList.add(c);
  }

  // ---- daily quests -------------------------------------------------------------
  // bonuses and rule of a path node, as lines of text
  pathLines(id) {
    const n = CONFIG.paths.nodes[id];
    const out = [];
    for (const k in n.bonus) {
      const v = n.bonus[k], flat = k === 'armySlots';
      const bad = k === 'damageTaken' ? v > 0 : v < 0;
      out.push(`<li class="${bad ? 'neg' : ''}">${t('path.b.' + k, { v: (v < 0 ? '-' : '+') + (flat ? Math.abs(v) : Math.round(Math.abs(v) * 100)) })}</li>`);
    }
    // rules: a text of its own for the node, else one text per rule
    const own = 'path.' + id + '.rule';
    if (n.rule) {
      if (t(own) !== own) out.push(`<li class="rule">${t(own)}</li>`);
      else for (const k in n.rule) { if (t('path.r.' + k) !== 'path.r.' + k && !['slotCapMax', 'slotCapPlus'].includes(k)) { const rv = n.rule[k], v = k === 'killMana' ? Math.round(rv * 100) : k === 'selfXp' || k === 'reviveCostMult' ? Math.round((rv - 1) * 100) : rv; out.push(`<li class="${['reviveCostMult', 'manaRegenMult', 'hpRegenMult'].includes(k) ? 'neg' : 'rule'}">${t('path.r.' + k, { v })}</li>`); } }
    }
    return out.join('');
  }

  // The Path of the Necromancer: the pick that is due (cards), and what was picked
  pathView() {
    const Pa = this.game.path, P = this.game.player, due = Pa.due();
    const card = (id, pick) => {
      const n = CONFIG.paths.nodes[id];
      const why = ''; // the offers come without comment: no reason, no hint what else would be offered
      return `<div class="pa-card l-${n.line}${pick ? ' pick' : ''}"><em>${t('path.line.' + n.line)}</em><b>${t('path.' + id)}</b><p>${t('path.' + id + '.desc')}</p>${why ? `<small class="pa-why">${why}</small>` : ''}<ul>${this.pathLines(id)}</ul>
        ${pick ? `<button class="ap-btn gold" data-act="pathPick" data-id="${id}"${this.game.path.canPick(id) ? '' : ' disabled'}>${this.game.path.canPick(id) ? t('path.choose') : t('path.armyTooBig', { n: n.rule.slotCapMax })}</button>` : ''}</div>`;
    };
    const cost = Pa.respecCost();
    const mine = Pa.chosen.length ? Pa.chosen.map((id) => card(id, false)).join('') : `<p class="pa-none">${t('path.none')}</p>`;
    return `<div class="path" data-scroll="path">
      <div class="pa-head"><b>${t('path.title')}</b><small>${due ? t('path.dueText') : t('path.hint')}</small></div>
      ${due ? `<div class="pa-row">${Pa.options().map((id) => card(id, true)).join('')}</div>` : ''}
      <div class="pa-sub">${t('path.yours')}</div><div class="pa-row">${mine}</div>
      ${Pa.chosen.length ? `<button class="ap-btn ghost" data-act="pathRespec"${P.essence >= cost ? '' : ' disabled'}>${t('path.respec', { n: fmt(cost) })}</button>` : ''}
      <div class="pa-sub">${t('title.heading')}</div><small class="pa-note">${t('title.hint')}</small>
      <div class="ttl-list">${Object.keys(TITLES).map((id) => {
        const has = this.game.titles.has(id), worn = this.game.titles.worn === id;
        return `<button class="ttl${has ? '' : ' lock'}${worn ? ' on' : ''}" data-act="titlePick" data-id="${id}"${has ? '' : ' disabled'}><b>${has ? t('title.' + id) : '???'}</b><small>${has ? t('title.' + id + '.how') : t('title.secret')}</small></button>`;
      }).join('')}</div></div>`;
  }

  // text of one reward of a daily quest
  rewardText(o) {
    if (o.kind === 'essence') return t('quest.o.essence', { n: o.n });
    if (o.kind === 'seals') return t('quest.o.seals', { n: o.n });
    if (o.kind === 'stone') return t('quest.o.stone', { tier: t('quest.tier.' + o.tier) });
    if (o.kind === 'xp') return t('quest.o.xp', { min: Math.round(CONFIG.quests.xpBoost.time / 60) });
    if (o.kind === 'key') return t('quest.o.key');
    return t('quest.o.item', { rarity: t('rarity.' + o.rarity) });
  }

  questsView() {
    const Q = this.game.quests, C = CONFIG.quests;
    const ms = msToMidnight(), h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    const shop = this.qMode === 'shop';
    const cards = Q.list.map((q, k) => {
      const w = Math.round((q.have / q.n) * 100);
      const btn = q.claimed ? `<span class="q-got">${t('quest.claimed')}</span>`
        : q.done ? `<button class="ap-btn" data-act="claim" data-k="${k}">${t('quest.claim')}</button>`
          : `<span class="q-n">${q.have} / ${q.n}</span>`;
      return `<div class="q-card d${q.d}${q.done ? ' done' : ''}${q.claimed ? ' got' : ''}">
        <em>${t('quest.d' + q.d)}</em><b>${Q.text(q)}</b>
        <div class="q-bar"><i style="width:${w}%"></i></div>
        <div class="q-foot"><small>${t('quest.reward', { n: C.seals[q.d] })}</small>${btn}</div></div>`;
    }).join('');
    const all = Q.list.filter((q) => q.claimed).length;
    const next = Q.nextStreak();
    const nextTxt = next ? t('quest.streakNext', { days: next.days, what: [next.seals ? t('quest.o.seals', { n: next.seals }) : '', next.item ? t('quest.o.item', { rarity: t('rarity.' + next.item) }) : '', next.stone !== undefined ? t('quest.o.stone', { tier: t('quest.tier.' + next.stone) }) : ''].filter(Boolean).join(' + ') }) : '';
    const claimedToday = Q.streakDay === today();
    const head = `<div class="q-head"><b>${t('quest.title')}</b><small>${t('quest.renew', { h, m })}</small>
        <span class="q-seals" title="${t('quest.sealsHint')}">${t('quest.sealsN', { n: Q.seals })}</span></div>
      <div class="q-streak"><b>${t('quest.streak', { n: Q.streak })}</b><small>${claimedToday ? t('quest.streakDone') : t('quest.streakOpen')}${nextTxt ? ' · ' + nextTxt : ''}</small></div>
      <div class="q-tabs"><button class="seg${shop ? '' : ' on'}" data-act="qmode" data-v="quests">${t('quest.tabQuests')}</button>
        <button class="seg${shop ? ' on' : ''}" data-act="qmode" data-v="shop">${t('quest.tabShop')}</button>
        ${Q.stones.length ? `<button class="ap-btn gold" data-act="stoneOpen" data-i="0">${t('quest.useStone', { n: Q.stones.length })}</button>` : ''}
        ${Q.xpTokens ? `<button class="ap-btn gold" data-act="useXp">${t('quest.useXp', { n: Q.xpTokens })}</button>` : ''}
        ${Q.keys ? `<button class="ap-btn gold" data-act="useKey"${this.game.gates.active >= 0 ? ' disabled' : ''}>${t('quest.useKey', { n: Q.keys })}</button>` : ''}</div>${this.game.xpBoostT > 0 ? `<div class="q-streak"><b>${t('quest.xpActive', { t: Math.floor(this.game.xpBoostT / 60) + ':' + String(Math.floor(this.game.xpBoostT % 60)).padStart(2, '0') })}</b></div>` : ''}`;
    let body;
    if (shop) {
      body = `<div class="q-list">${C.shop.map((o) => {
        const left = Q.shopLeft(o), ok = Q.seals >= o.cost && left > 0 && !(o.id === 'revive' && !this.game.army.deployed.some((u) => !u.alive)) && !(o.id === 'xp' && Q.xpTokens >= C.xpBoost.max) && !(o.id === 'key' && Q.keys >= C.keyGate.max);
        const desc = o.tier !== undefined ? t('quest.shop.stone', { tier: t('quest.tier.' + o.tier) })
          : o.id === 'essence' ? t('quest.shop.essence', { n: fmt(Q.shopEssence()) })
            : o.id === 'xp' ? t('quest.o.xp', { min: Math.round(C.xpBoost.time / 60) }) : o.id === 'key' ? t('quest.shop.key') : t('quest.shop.revive');
        return `<div class="q-card shop${ok ? '' : ' off'}"><em>${t('quest.sealsN', { n: o.cost })}</em><b>${desc}</b>
          <div class="q-foot"><small>${o.max ? t('quest.shopLeft', { n: left, max: o.max }) : ''}</small>
          <button class="ap-btn" data-act="buy" data-id="${o.id}"${ok ? '' : ' disabled'}>${t('quest.buy')}</button></div></div>`;
      }).join('')}</div>`;
    } else {
      body = `<div class="q-list">${cards}</div>
        <div class="q-bonus${Q.bonus ? ' got' : ''}">${Q.bonus ? t('quest.bonusDone') : t('quest.bonus', { n: all, seals: C.bonusSeals, rarity: t('rarity.' + C.bonus) })}</div>`;
    }
    // the choice of one of three rewards, or the kind of monster for a Soul Stone
    let modal = '';
    if (this.qPick >= 0 && Q.list[this.qPick] && Q.list[this.qPick].done && !Q.list[this.qPick].claimed) {
      const opts = Q.options(this.qPick);
      modal = `<div class="q-modal"><div class="q-box"><b>${t('quest.pick')}</b>
        <div class="q-opts">${opts.map((o, i) => `<button class="q-opt o-${o.kind}" data-act="pick" data-i="${i}"><i></i><span>${this.rewardText(o)}</span></button>`).join('')}</div>
        <button class="ap-btn ghost" data-act="qcancel">${t('quest.later')}</button></div></div>`;
    } else if (this.qStone >= 0 && Q.stones[this.qStone] !== undefined) {
      const tier = Q.stones[this.qStone];
      modal = `<div class="q-modal"><div class="q-box"><b>${t('quest.stoneTitle', { tier: t('quest.tier.' + tier) })}</b><small>${t('quest.stoneHint')}</small>
        <div class="q-opts">${Q.stoneTypes().map((id) => `<button class="q-opt o-stone" data-act="stoneUse" data-t="${id}"><i></i><span>${t('enemy.' + id)}<small>${t('role.' + CONFIG.enemies.types[id].shadowRole)}</small></span></button>`).join('')}</div>
        <button class="ap-btn ghost" data-act="qcancel">${t('quest.later')}</button></div></div>`;
    }
    return `<div class="quests" data-scroll="quests">${head}${body}${modal}</div>`;
  }

  // ---- bestiary ----------------------------------------------------------------
  // Left: every monster by zone (unknown ones as "???"). Right: the page of the
  // monster picked: what it is, how it fights (from step 2), mastery.
  bestiaryView() {
    const B = this.game.bestiary, zones = CONFIG.world.zones, all = CONFIG.enemies.types;
    const ids = Object.keys(all);
    const zoneOf = (id) => zones.findIndex((z) => z.enemyTypes.includes(id) || z.boss === id);
    if (!this.selBeast || !all[this.selBeast]) this.selBeast = ids.find((id) => B.step(id) > 0) || ids[0];
    const card = (id) => {
      const st = B.step(id), n = B.kills[id] || 0, nx = B.next(id);
      const prev = st > 0 ? B.steps(id)[st - 1] : 0;
      const w = nx ? Math.round(((n - prev) / (nx - prev)) * 100) : 100;
      const stars = [1, 2, 3].map((k) => `<s class="${st >= k ? 'on' : ''}"></s>`).join('');
      return `<div class="b-card st${st}${all[id].boss ? ' boss' : ''}${this.selBeast === id ? ' sel' : ''}" data-act="beast" data-id="${id}">
        <b>${st ? t('enemy.' + id) : '???'}</b><span class="b-stars">${stars}</span>
        <div class="b-bar"><i style="width:${w}%"></i></div>${B.fresh.has(id) ? `<b class="nw">${t('menu.new')}</b>` : ''}</div>`;
    };
    let list = '';
    zones.forEach((z, zi) => {
      const mine = ids.filter((id) => zoneOf(id) === zi);
      if (!mine.length) return;
      const known = this.game.knownZones.has(zi) || mine.some((id) => B.step(id) > 0);
      list += `<div class="b-zone"><h4>${known ? t('zone.' + z.id) : t('best.unknownZone', { rank: z.rank })}</h4><div class="b-grid">${mine.map(card).join('')}</div></div>`;
    });
    const rest = ids.filter((id) => zoneOf(id) < 0);
    if (rest.length) list += `<div class="b-zone"><h4>${t('best.other')}</h4><div class="b-grid">${rest.map(card).join('')}</div></div>`;
    const c = B.counts();
    return `<div class="bestiary"><div class="b-stage-slot"></div>
      <div class="b-left" data-scroll="bestiary"><div class="b-sum">${t('best.sum', { seen: c.seen, all: c.all, mastered: c.mastered })}</div>${list}</div>
      <div class="b-right" data-scroll="beast">${this.beastPage(this.selBeast, zoneOf(this.selBeast))}</div></div>`;
  }

  // the monster picked, in 3D on the left (a black outline until it was met)
  showBeast(body) {
    const slot = body.querySelector('.b-stage-slot');
    if (!slot) return;
    const id = this.selBeast, zones = CONFIG.world.zones, zi = zones.findIndex((z) => z.enemyTypes.includes(id) || z.boss === id);
    slot.replaceWith(this.beastEl);
    const known = this.game.bestiary.step(id) > 0;
    const ok = this.beastStage.show(this.beastEl, { id, mode: known ? 'enemy' : 'silhouette', aura: zi >= 0 ? zones[zi].gateColor : 0x8a4dff });
    if (!ok) this.beastEl.remove(); // no WebGL: no view
  }

  beastPage(id, zi) {
    const B = this.game.bestiary, def = CONFIG.enemies.types[id], st = B.step(id), n = B.kills[id] || 0;
    if (!st) return `<div class="b-page locked"><b>???</b><p>${t('best.locked')}</p></div>`;
    const zone = zi >= 0 ? t('zone.' + CONFIG.world.zones[zi].id) : t('best.other');
    const kind = def.boss ? t('best.b.boss') : t('best.b.' + def.behavior);
    const role = def.shadowRole ? t('best.role', { role: t('role.' + def.shadowRole) }) : '';
    let how = '';
    if (st >= 2) {
      how = def.trait
        ? `<h5>${t('tip.trait.' + def.trait)}</h5><p>${t('tip.trait.' + def.trait + '.text')}</p>`
        : `<h5>${t('best.how')}</h5><p>${t('best.tip.' + (def.boss ? 'boss' : def.behavior))}</p>`;
    } else {
      how = `<p class="b-more">${t('best.moreAt', { n: B.next(id) - n })}</p>`;
    }
    const mast = st >= 3
      ? `<div class="b-mast on">${t('best.masteredText', { pct: Math.round(CONFIG.bestiary.bonus * 100) })}</div>`
      : `<div class="b-mast">${t('best.masterAt', { n: B.steps(id)[2], pct: Math.round(CONFIG.bestiary.bonus * 100) })}</div>`;
    return `<div class="b-page${def.boss ? ' boss' : ''}"><b>${t('enemy.' + id)}</b>
      <small>${zone} · ${kind}</small>
      <div class="b-kills">${t('best.kills', { n })}</div>${role ? `<small>${role}</small>` : ''}
      ${how}${mast}</div>`;
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
    const meta = !known ? t('skills.locked') : ult ? t('skills.ultShort') : t('skills.short', { mana: def.mana, cd: this.cd(def) });
    const badge = used >= 0 ? `<em>${used === 2 ? 'U' : used + 1}</em>` : '';
    return `<div class="k-card ${cls}${ult ? ' ult' : ''}${known ? '' : ' locked'}${this.selSkill === id ? ' sel' : ''}" data-act="skill" data-id="${id}">
      <i>${known ? SKILL_ICONS[id] : LOCK}</i><div><b>${t('skill.' + id)}</b><small>${meta}</small></div>${badge}${P.newSkills.includes(id) ? `<b class="nw">${t('menu.new')}</b>` : ''}</div>`;
  }

  // cooldown of a skill with the player's bonuses, as text
  cd(def) {
    return Math.round(def.cooldown * this.game.player.cdMult * 10) / 10;
  }

  skillStats(id) {
    const def = skillDef(id), ult = !!CONFIG.ultimates[id], P = this.game.player;
    const rows = [];
    const row = (k, v) => rows.push(`<div class="row"><span>${t('ks.' + k)}</span><b>${v}</b></div>`);
    if (ult) row('charge', t('skills.ultCost'));
    else { row('mana', def.mana); row('cooldown', this.cd(def) + 's'); }
    // the real damage with the current weapon and stats
    if (def.power) row('damage', fmt(Math.round(P.skillPower() * def.power)) + (def.ticks ? ' × ' + def.ticks : ''));
    if (def.vuln) row('vuln', '+' + Math.round(def.vuln * 100) + '%');
    if (def.healSelf) row('healSelf', Math.round(def.healSelf * 100) + '%');
    if (def.healArmy) row('healArmy', Math.round(def.healArmy * 100) + '%');
    if (def.speed) row('speedUp', '+' + Math.round(def.speed * 100) + '%');
    if (def.range) row('range', def.range);
    if (def.radius) row('radius', def.radius);
    if (def.arcDeg) row('cone', def.arcDeg + '°');
    if (def.width) row('width', def.width);
    if (def.stun) row('stun', def.stun + 's');
    if (def.shield) row('shield', Math.round(def.shield * 100) + '%');
    if (def.heal) row('heal', Math.round(def.heal * 100) + '%');
    if (def.armyDamage) row('army', '+' + Math.round(def.armyDamage * 100) + '%');
    if (def.damage) row('damageUp', '+' + Math.round(def.damage * 100) + '%');
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
      const meta = k === 2 ? t('skills.ultShort') : t('skills.short', { mana: def.mana, cd: this.cd(def) });
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
