// Class building blocks. A class of CONFIG.classes.list that has `components` is put together from the blocks
// below; installClasses fills in the plain fields the rest of the game reads (weapons, army, companion,
// spellForge, cores, bonus, skillFrom). The playable classes stay hand made: the blocks only make them easy to
// build and to check. No class is ever made at random.
//
//  family      the wider kind of class (a label for the menus and the Awakening; not a Path, not a class)
//  weapon      the weapon group it likes (melee | ranged | magic | neutral): loot leans towards it
//  mechanic    its own mechanic (core/classMechanics.js) on top of the one of its base class
//  passive     bonuses it always has (keys of the player's bonus, see entities/player.js recalc)
//  skillPackage its skills and ultimate (they drop only for it and its children)
//  capabilities what it may use: the shadow army, a companion, the Spell Forge, special mechanics
//  pathAccess  the Path cores it gets (only the six existing ones)
// No DOM and no three.js here: the module is also loaded by the tests (node --test).
import { CONFIG } from '../config.js';

export const FAMILIES = {
  vanguard: { color: '#ff7a5a' }, // the front line: strength and toughness
  predator: { color: '#d8d2ff' }, // precision, ambush, speed
  arcanist: { color: '#8aa8ff' }, // spells and their power
  warden: { color: '#7fd6a0' }, // nature, beasts, protection
  dominion: { color: '#b27cff' }, // commands an army
  abyssal: { color: '#ff2850' }, // void and rifts (prepared for later)
};

// the families of the classes that are not built from blocks
export const CLASS_FAMILY = {
  warrior: 'vanguard', paladin: 'vanguard', deathKnight: 'vanguard',
  rogue: 'predator', skirmisher: 'predator',
  mage: 'arcanist', spellblade: 'arcanist', warlock: 'arcanist', arcaneArcher: 'arcanist',
  ranger: 'warden', cleric: 'warden', boneArcher: 'dominion',
  necromancer: 'dominion', commander: 'dominion',
};

export const WEAPON_BLOCKS = ['melee', 'ranged', 'magic', 'neutral'];

// The combat identity of every playable class: how it deals damage (channel), how it stays alive (defense), how
// it moves (mobility) and its main trade-off (weakness). Shown in the evolution tree; the numbers live elsewhere.
export const IDENTITY = {
  warrior: { channel: 'melee', defense: 'armor', mobility: 'mid', weakness: 'reach' },
  rogue: { channel: 'melee', defense: 'evasion', mobility: 'high', weakness: 'fragile' },
  mage: { channel: 'spell', defense: 'distance', mobility: 'mid', weakness: 'fragile' },
  cleric: { channel: 'spell', defense: 'heal', mobility: 'low', weakness: 'burst' },
  ranger: { channel: 'ranged', defense: 'distance', mobility: 'high', weakness: 'close' },
  necromancer: { channel: 'summons', defense: 'army', mobility: 'mid', weakness: 'alone' },
  spellblade: { channel: 'melee', defense: 'armor', mobility: 'mid', weakness: 'mana' },
  paladin: { channel: 'melee', defense: 'heal', mobility: 'low', weakness: 'burst' },
  arcaneArcher: { channel: 'ranged', defense: 'distance', mobility: 'mid', weakness: 'mana' },
  skirmisher: { channel: 'ranged', defense: 'evasion', mobility: 'high', weakness: 'fragile' },
  deathKnight: { channel: 'melee', defense: 'army', mobility: 'mid', weakness: 'reach' },
  boneArcher: { channel: 'ranged', defense: 'army', mobility: 'mid', weakness: 'close' },
  warlock: { channel: 'spell', defense: 'army', mobility: 'low', weakness: 'mana' },
  commander: { channel: 'summons', defense: 'army', mobility: 'low', weakness: 'alone' },
  berserker: { channel: 'melee', defense: 'rage', mobility: 'high', weakness: 'reach' },
  stormcaller: { channel: 'spell', defense: 'control', mobility: 'mid', weakness: 'fragile' },
  beastmaster: { channel: 'companion', defense: 'distance', mobility: 'mid', weakness: 'alone' },
  sentinel: { channel: 'melee', defense: 'shield', mobility: 'low', weakness: 'burst' },
};

export function identityOf(id) {
  return IDENTITY[id] || null;
}

// The mechanics. The first six exist since long (they live in entities/player.js, core/ranger.js and the army);
// the last four are the evolution mechanics (core/classMechanics.js). resource = what the HUD shows.
export const MECHANICS = {
  rage: { resource: 'rage', of: 'warrior' },
  arcane: { resource: 'arcane', of: 'mage' },
  combo: { resource: 'combo', of: 'rogue' },
  faith: { resource: 'faith', of: 'cleric' },
  rangerCompanion: { resource: '', of: 'ranger' },
  shadowArmy: { resource: '', of: 'necromancer' },
  berserkerMomentum: { resource: 'momentum', needs: 'rage', evolution: true },
  stormOverload: { resource: 'overload', needs: 'arcane', evolution: true },
  companionBond: { resource: 'bond', needs: 'rangerCompanion', evolution: true },
  aegis: { resource: 'aegis', needs: 'faith', evolution: true },
};

// the mechanic of a base class
export const BASE_MECHANIC = { warrior: 'rage', mage: 'arcane', rogue: 'combo', cleric: 'faith', ranger: 'rangerCompanion', necromancer: 'shadowArmy' };

// passive bonuses (shares, like the class bonuses and the armour sets)
export const PASSIVES = {
  berserkerFury: { damage: 0.3, hp: 0.1, killHeal: 0.01 },
  stormAttunement: { skillDamage: 0.55, mana: 0.2, cooldown: 0.1 },
  packInstinct: { damage: 0.12, crit: 0.05, speed: 0.06, companionDamage: 0.45, companionHp: 0.45 }, // for the companion, not an army
  bulwarkFaith: { hp: 0.25, damageTaken: -0.1, skillDamage: 0.1 },
};

// the skills of a class: they are found as loot (from unlockRank on), the first one comes with the class
export const SKILL_PACKAGES = {
  berserker: { skills: ['frenzyCleave', 'recklessCharge'], ultimate: 'bloodstorm' },
  stormcaller: { skills: ['thunderLance', 'stormfield'], ultimate: 'tempestAscension' },
  beastmaster: { skills: ['preyMark', 'packAssault'], ultimate: 'primalApex' },
  sentinel: { skills: ['aegisOath', 'radiantSweep'], ultimate: 'lastBastion' },
};

// what a class may use. A companion is not an army: they are separate rights.
export const CAPABILITIES = ['armyAccess', 'companionAccess', 'spellForgeAccess', 'specialMechanics'];

export const PATH_CORES = ['blade', 'commander', 'mage', 'tank', 'slayer', 'delver'];

// every class a class grows from (parents and skillFrom, all the way up), without itself; safe against loops
export function ancestors(id, list = CONFIG.classes.list) {
  const out = [], seen = new Set([id]), todo = [id];
  while (todo.length) {
    const c = list[todo.pop()];
    if (!c) continue;
    for (const p of [...(c.parents || []), ...(c.skillFrom || [])]) {
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
      todo.push(p);
    }
  }
  return out;
}

export function familyOf(id) {
  const c = CONFIG.classes.list[id];
  return (c && c.family) || CLASS_FAMILY[id] || '';
}

// the own mechanic of a class: an evolution mechanic or the one of its base
export function mechanicOf(id) {
  const c = CONFIG.classes.list[id];
  if (!c) return '';
  return c.mechanic || BASE_MECHANIC[c.base || id] || '';
}

// fills in the plain fields of the classes built from blocks (runs once, when the module loads)
export function installClasses(C = CONFIG) {
  const list = C.classes.list;
  for (const id in list) {
    const c = list[id], k = c.components;
    if (!k) continue;
    const caps = k.capabilities || [];
    c.weapons = k.weapon === 'neutral' ? '' : k.weapon;
    c.army = caps.includes('armyAccess');
    c.companion = caps.includes('companionAccess');
    c.spellForge = caps.includes('spellForgeAccess');
    c.cores = [...(k.pathAccess || [])];
    c.bonus = {};
    for (const p of k.passive || []) for (const b in PASSIVES[p] || {}) c.bonus[b] = (c.bonus[b] || 0) + PASSIVES[p][b];
    c.skillFrom = ancestors(id, list).filter((a) => list[a] && !list[a].evolution);
    if (!c.skillFrom.length) c.skillFrom = [...(c.parents || [])];
  }
  return list;
}

// Checks every class built from blocks; returns a list of the faults found ([] = all fine).
export function validateClasses(C = CONFIG) {
  const list = C.classes.list, errs = [];
  for (const id in list) {
    const c = list[id], k = c.components;
    if (!k) continue;
    const bad = (what) => errs.push(id + ': ' + what);
    for (const f of c.families || [c.family]) if (!FAMILIES[f]) bad('unknown family ' + f);
    if (!WEAPON_BLOCKS.includes(k.weapon)) bad('unknown weapon block ' + k.weapon);
    for (const p of c.parents || []) if (!list[p]) bad('unknown parent ' + p);
    if (ancestors(id, list).includes(id)) bad('inherits from itself');
    if (c.base && !BASE_MECHANIC[c.base]) bad('base is not a base class: ' + c.base);
    for (const p of k.pathAccess || []) if (!PATH_CORES.includes(p) || !(C.paths && C.paths.cores && C.paths.cores[p])) bad('unknown path core ' + p);
    for (const cap of k.capabilities || []) if (!CAPABILITIES.includes(cap)) bad('unknown capability ' + cap);
    for (const p of k.passive || []) if (!PASSIVES[p]) bad('unknown passive ' + p);
    if (!c.ready) continue; // prepared classes need no skills yet
    if (!c.mechanic || !MECHANICS[c.mechanic]) bad('unknown mechanic ' + c.mechanic);
    const pk = SKILL_PACKAGES[k.skillPackage];
    if (!pk) { bad('unknown skill package ' + k.skillPackage); continue; }
    for (const s of pk.skills) if (!C.skills[s]) bad('missing skill ' + s);
    if (!C.ultimates[k.ultimate]) bad('missing ultimate ' + k.ultimate);
    if (pk.ultimate !== k.ultimate) bad('ultimate differs from its skill package');
    for (const s of c.startSkills || []) if (!pk.skills.includes(s)) bad('start skill not in its package: ' + s);
    if (c.startUltimate !== k.ultimate) bad('start ultimate is not its ultimate');
  }
  return errs;
}

installClasses();
