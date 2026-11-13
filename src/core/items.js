// Items: weapons and armour. An item is a small plain object so it can be
// saved as it is:
//   weapon: { id, kind: 'weapon', type: 'sword', rarity, level, up }
//   armour: { id, kind: 'armor', type: 'helmet', set: 'stalker', bonus: 'hp', rarity, level, up }
// Skills drop as { kind: 'skill', type: 'shadowStep' } and are learned at once.
import { CONFIG } from '../config.js';
import { itemLevelPower, rankProgress, rankOf } from './levels.js';
import { t } from '../strings.js';

// common, uncommon, rare, epic, legendary, mythic
export const RARITY_COLORS = [0xb8b8c8, 0x5cd65c, 0x4aa3ff, 0xb45cff, 0xffb02e, 0xff4a6e];
export const RARITY_CSS = ['#b8b8c8', '#6ee06e', '#4aa3ff', '#c07cff', '#ffb02e', '#ff5a7a'];
export const RARITIES = RARITY_CSS.length;
export const ARMOR_SLOTS = ['helmet', 'chest', 'gloves', 'boots'];
export const EQUIP_SLOTS = ['weapon', 'helmet', 'chest', 'gloves', 'boots'];

let nextId = 1;
export function setNextItemId(n) {
  nextId = n;
}
export function getNextItemId() {
  return nextId;
}

function pick(list) {
  return list[(Math.random() * list.length) | 0];
}

function weighted(weights) {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += weights[i];
  let r = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

// The rank of the item level decides which rarities can drop; luck (0..)
// shifts the roll towards the better ones. min never goes above the best
// rarity of the rank.
export function rollRarity(luck = 0, min = 0, level = 1) {
  const I = CONFIG.items;
  const base = I.rarityWeights[Math.min(I.rarityWeights.length - 1, rankOf(level))];
  const k = 1 + Math.max(0, luck);
  const w = base.map((v, r) => v * Math.pow(k, r * I.luckStep));
  let top = 0;
  for (let r = 0; r < base.length; r++) if (base[r] > 0) top = r;
  const r = weighted(w);
  return Math.max(r, Math.min(min, top));
}

export function makeWeapon(type, rarity, level) {
  return { id: nextId++, kind: 'weapon', type, rarity, level, up: 0 };
}

export function makeArmor(type, set, bonus, rarity, level) {
  return { id: nextId++, kind: 'armor', type, set, bonus, rarity, level, up: 0 };
}

// Rolls one drop. `known` = ids of skills and ultimates the player already has.
export function rollLoot(level, luck, known, minRarity = 0, gearOnly = false) {
  const W = CONFIG.loot.weights;
  const kind = weighted([W.weapon, W.armor, gearOnly ? 0 : W.skill]);
  if (kind === 2) {
    const open = [];
    for (const id in CONFIG.skills) if (!known.includes(id)) open.push(id);
    for (const id in CONFIG.ultimates) if (!known.includes(id)) open.push(id);
    if (open.length) return { kind: 'skill', type: pick(open), rarity: 3 };
  }
  const rarity = rollRarity(luck, minRarity, level);
  if (kind === 0) return makeWeapon(pick(Object.keys(CONFIG.weapons)), rarity, level);
  return makeArmor(pick(ARMOR_SLOTS), pick(Object.keys(CONFIG.items.sets)), pick(Object.keys(CONFIG.items.bonuses)), rarity, level);
}

// ---- stats ------------------------------------------------------------------
function factor(item) {
  const I = CONFIG.items;
  return itemLevelPower(item.level) * I.rarityStat[item.rarity] * (1 + I.upgradeBonus * item.up);
}

export function weaponDamage(item) {
  return CONFIG.weapons[item.type].damage * factor(item);
}

export function armorDefense(item) {
  return Math.round(CONFIG.items.armor[item.type].defense * factor(item));
}

// value of the armour bonus: flat for hp/mana, a fraction for the others
export function armorBonus(item) {
  const I = CONFIG.items;
  const base = I.bonuses[item.bonus] * (1 + I.bonusRarity * item.rarity);
  return base;
}

export function upgradeCost(item) {
  return CONFIG.items.upgradeCost[item.rarity] * (item.up + 1);
}

export function dismantleValue(item) {
  return Math.round(CONFIG.items.dismantle[item.rarity] * (1 + 0.5 * item.up) * (1 + 1.2 * rankProgress(item.level)));
}

// rough single number to compare two items of the same slot
export function itemPower(item) {
  return item.kind === 'weapon' ? weaponDamage(item) : armorDefense(item);
}

// ---- text -------------------------------------------------------------------
export function itemName(item) {
  if (item.kind === 'skill') return t('skill.' + item.type);
  const base = item.kind === 'weapon'
    ? t('weapon.' + item.type)
    : t('item.armorName', { set: t('set.' + item.set), slot: t('slot.' + item.type) });
  return item.up > 0 ? base + ' +' + item.up : base;
}

export function bonusText(key, value) {
  const flat = key === 'armySlots';
  const v = flat ? value : Math.round(Math.abs(value) * 100);
  return t('bonus.' + key, { v });
}

export function slotOf(item) {
  return item.kind === 'weapon' ? 'weapon' : item.type;
}
