// Class progression from rank A to M (core/awakening.js covers D, C and B). Every playable class grows along a
// tree of six steps; the classes made from another one (the hybrids) use the tree of their base class.
//   A   Advanced Mastery     a first real improvement of the class mechanic + a pick of a skill modifier
//   S   Class Mastery        a pick between two ways to grow the core mechanic + an ultimate improvement
//   SS  Unique Evolution     opens when the affinities meet its need (then kept for good): a unique variant
//   SSS Transcendence        an extension of the core mechanic
//   L   Legendary Evolution  a pick between two legendary branches (how the class plays)
//   M   Mythic Evolution     the Mythic Class Trait and the last step of the ultimate or core
// Staying in the class is always the way forward: nothing here asks for a new class.
//
// A step changes the game through `ops`:
//   add / mul  { 'path.in.CONFIG': value }: numbers of the mechanics, skills and ultimates (core values come back
//              from a snapshot first, so changing class or loading never stacks anything)
//   bonus      { key: value }: bonuses of the hunter (entities/player.js recalc)
//   companion  true: the step is an upgrade of the companion (saved with it)
// The evolution classes also get guaranteed skills: their second skill comes by a class quest (mastery level of the
// first skill) or at the latest at rank A; loot can bring it earlier.
// No DOM, no three.js (node --test).
import { CONFIG } from '../config.js';

export const STEPS = [
  { key: 'A', rank: 4 },
  { key: 'S', rank: 5 },
  { key: 'SS', rank: 6 },
  { key: 'SSS', rank: 7 },
  { key: 'L', rank: 8 },
  { key: 'M', rank: 9 },
];

const o = (add, mul, bonus, extra) => ({ add: add || {}, mul: mul || {}, bonus: bonus || {}, ...(extra || {}) });

// The trees. Every step has ops (nothing is empty); `pick` = the two options of a choice; `needs` = the affinities a
// unique step asks for.
export const TREES = {
  // ---- the evolution classes ----------------------------------------------------------------------------------
  berserker: {
    A: { id: 'bloodlust', ops: o({ 'mechanics.berserkerMomentum.gap': -0.15, 'mechanics.berserkerMomentum.minRage': -10 }),
      pick: [{ id: 'wideCleave', ops: o({ 'skills.frenzyCleave.arcDeg': 40 }) }, { id: 'rendingCleave', ops: o({ 'skills.frenzyCleave.burn': 0.3 }) }] },
    S: { id: 'warMastery', ops: o({ 'ultimates.bloodstorm.ticks': 2 }),
      pick: [{ id: 'unstoppable', ops: o({ 'mechanics.berserkerMomentum.max': 2 }) }, { id: 'bloodFury', ops: o({ 'mechanics.berserkerMomentum.perStack': 0.03 }) }] },
    SS: { id: 'warlordOfRuin', needs: { might: 70 }, ops: o({ 'skills.recklessCharge.stunAll': 1, 'ultimates.bloodstorm.radius': 2 }) },
    SSS: { id: 'endlessRage', ops: o({ 'mechanics.berserkerMomentum.decay': 2 }, { 'warrior.decay': 0.4 }) },
    L: { id: 'legendBerserker', ops: o({}, {}, { hp: 0.05 }),
      pick: [{ id: 'executioner', ops: o({ 'skills.frenzyCleave.arcDeg': -50 }, { 'skills.frenzyCleave.power': 1.5 }) }, { id: 'whirlwindLord', ops: o({ 'skills.frenzyCleave.range': 2, 'skills.frenzyCleave.arcDeg': 80 }, { 'skills.frenzyCleave.power': 0.9 }) }] },
    M: { id: 'avatarOfCarnage', ops: o({ 'ultimates.bloodstorm.rageBonus': 0.5, 'mechanics.berserkerMomentum.max': 1 }, {}, { killHeal: 0.02 }) },
  },
  stormcaller: {
    A: { id: 'staticBuildup', ops: o({ 'mage.arcaneTime': 3, 'mechanics.stormOverload.range': 1 }),
      pick: [{ id: 'wideLance', ops: o({ 'skills.thunderLance.width': 0.8 }) }, { id: 'forkedLance', ops: o({ 'skills.thunderLance.jumps': 1 }) }] },
    S: { id: 'tempestMastery', ops: o({ 'ultimates.tempestAscension.ticks': 1 }),
      pick: [{ id: 'overcharge', ops: o({ 'mechanics.stormOverload.at.0': -1 }) }, { id: 'chainMastery', ops: o({ 'mechanics.stormOverload.jumps.0': 1, 'mechanics.stormOverload.jumps.1': 1 }) }] },
    SS: { id: 'stormSovereign', needs: { arcana: 70, control: 40 }, ops: o({ 'skills.stormfield.radius': 1.5, 'skills.stormfield.stun': 0.25, 'ultimates.tempestAscension.jumps': 2 }) },
    SSS: { id: 'livingTempest', ops: o({ 'mechanics.stormOverload.damage': 0.25, 'mage.arcaneMax': 1 }) },
    L: { id: 'legendStorm', ops: o({ 'mechanics.stormOverload.range': 1 }),
      pick: [{ id: 'thunderlord', ops: o({}, { 'skills.thunderLance.power': 1.4 }) }, { id: 'eyeOfTheStorm', ops: o({ 'skills.stormfield.ticks': 4 }) }] },
    M: { id: 'mythicStormCore', ops: o({ 'mechanics.stormOverload.refund': 1 }, { 'ultimates.tempestAscension.power': 1.25 }) },
  },
  beastmaster: {
    A: { id: 'protectiveBond', companion: true, ops: o({ 'mechanics.companionBond.guard': 0.3 }),
      pick: [{ id: 'longHunt', ops: o({ 'skills.preyMark.duration': 4 }) }, { id: 'huntersMarkFang', ops: o({ 'skills.preyMark.companionDamage': 0.3 }) }] },
    S: { id: 'packMastery', ops: o({ 'ultimates.primalApex.duration': 3 }),
      pick: [{ id: 'packLeader', ops: o({ 'mechanics.companionBond.perSec': 3, 'mechanics.companionBond.hit': 1 }) }, { id: 'feralBond', ops: o({ 'skills.packAssault.fullBond': 0.6 }) }] },
    SS: { id: 'primalHunt', needs: { dominion: 60, instinct: 50 }, ops: o({ 'skills.packAssault.markAround': 5, 'ultimates.primalApex.armyGuard': 0.2 }) },
    SSS: { id: 'soulOfTheBeast', companion: true, ops: o({ 'mechanics.companionBond.decay': -1 }, { 'mechanics.companionBond.revive': 0.5 }) },
    L: { id: 'legendBeast', companion: true, ops: o({}, {}, { companionHp: 0.2 }),
      pick: [{ id: 'alphaPredator', ops: o({}, {}, { companionDamage: 0.6 }) }, { id: 'guardianBeast', ops: o({ 'mechanics.companionBond.guard': 0.2 }, {}, { companionHp: 0.6 }) }] },
    M: { id: 'mythicApex', companion: true, ops: o({ 'ultimates.primalApex.armyDamage': 0.6, 'ultimates.primalApex.damage': 0.15, 'skills.preyMark.companionDamage': 0.4 }) },
  },
  sentinel: {
    A: { id: 'bulwarkOfLight', ops: o({ 'mechanics.aegis.perHit': 7, 'mechanics.aegis.perHp': 40 }),
      pick: [{ id: 'longOath', ops: o({ 'skills.aegisOath.duration': 3 }) }, { id: 'aegisGuard', ops: o({ 'skills.aegisOath.shield': 0.1 }) }] },
    S: { id: 'wardenMastery', ops: o({ 'ultimates.lastBastion.duration': 2 }),
      pick: [{ id: 'retribution', ops: o({}, { 'skills.radiantSweep.power': 1.3, 'skills.radiantSweep.healPerHit': 1.5 }) }, { id: 'ironVow', ops: o({ 'mechanics.aegis.decay': -1.5, 'mechanics.aegis.calm': 6 }) }] },
    SS: { id: 'sanctifiedWall', needs: { resilience: 70 }, ops: o({ 'ultimates.lastBastion.stun': 1, 'ultimates.lastBastion.radius': 3, 'ultimates.lastBastion.aegisCost': 30 }) },
    SSS: { id: 'undyingLight', ops: o({ 'skills.aegisOath.highAegis': 0.25, 'skills.radiantSweep.aegisGuard': 0.15 }) },
    L: { id: 'legendSentinel', ops: o({ 'mechanics.aegis.perHit': 5 }),
      pick: [{ id: 'bastion', ops: o({}, {}, { damageTaken: -0.1, hp: 0.15 }) }, { id: 'crusader', ops: o({ 'skills.radiantSweep.range': 2, 'skills.radiantSweep.arcDeg': 40 }, { 'skills.radiantSweep.power': 1.25 }) }] },
    M: { id: 'mythicAegis', ops: o({ 'mechanics.aegis.max': 50 }, { 'ultimates.lastBastion.shield': 1.5 }) },
  },
  // ---- the classes from before: they grow their own mechanic (no made-up new mechanics) ---------------------------
  warrior: {
    A: { id: 'battleHardened', ops: o({ 'warrior.rageHit': 1 }),
      pick: [{ id: 'wideCleaveW', ops: o({ 'skills.cleave.arcDeg': 30 }) }, { id: 'heavyBash', ops: o({ 'skills.shieldBash.stun': 0.6 }) }] },
    S: { id: 'rageMastery', ops: o({}, { 'ultimates.earthshatter.power': 1.2 }),
      pick: [{ id: 'ironHide', ops: o({ 'warrior.reduction': 0.001 }) }, { id: 'wrath', ops: o({ 'warrior.damage': 0.002 }) }] },
    SS: { id: 'warbringer', needs: { might: 65 }, ops: o({ 'skills.cleave.arcDeg': 40, 'skills.groundSlam.stun': 0.6 }) },
    SSS: { id: 'eternalRage', ops: o({}, { 'warrior.decay': 0.5 }) },
    L: { id: 'legendWarrior', ops: o({}, {}, { hp: 0.05 }),
      pick: [{ id: 'worldbreaker', ops: o({}, { 'ultimates.earthshatter.power': 1.4 }) }, { id: 'unyielding', ops: o({ 'ultimates.unbreakable.duration': 4 }) }] },
    M: { id: 'mythicWarlord', ops: o({ 'warrior.rageMax': 30 }) },
  },
  mage: {
    A: { id: 'arcaneFlow', ops: o({ 'mage.arcaneTime': 3 }),
      pick: [{ id: 'bigFireball', ops: o({ 'skills.fireball.radius': 1.5 }) }, { id: 'longChain', ops: o({ 'skills.chainLightning.jumps': 2 }) }] },
    S: { id: 'arcaneMastery', ops: o({}, { 'ultimates.cataclysm.power': 1.2 }),
      pick: [{ id: 'arcanePower', ops: o({ 'mage.arcaneDamage': 0.03 }) }, { id: 'deepCharges', ops: o({ 'mage.arcaneMax': 2 }) }] },
    SS: { id: 'archmagus', needs: { arcana: 65 }, ops: o({ 'skills.chainLightning.jumps': 3, 'skills.frostNova.radius': 1.5 }) },
    SSS: { id: 'boundlessMind', ops: o({}, {}, { cooldown: 0.1, mana: 0.15 }) },
    L: { id: 'legendMage', ops: o({ 'mage.arcaneTime': 2 }),
      pick: [{ id: 'starfall', ops: o({}, { 'skills.meteor.power': 1.4 }) }, { id: 'glacier', ops: o({ 'skills.frostNova.stun': 1 }) }] },
    M: { id: 'mythicArcanum', ops: o({ 'ultimates.timeStop.duration': 2 }, { 'ultimates.cataclysm.power': 1.3 }) },
  },
  rogue: {
    A: { id: 'quickHands', ops: o({ 'rogue.cpTime': 2 }),
      pick: [{ id: 'deepCuts', ops: o({ 'skills.backstab.combo': 1 }) }, { id: 'longSmoke', ops: o({ 'skills.smokeBomb.duration': 2 }) }] },
    S: { id: 'comboMastery', ops: o({ 'ultimates.deathBlossom.ticks': 3 }),
      pick: [{ id: 'keenEdge', ops: o({ 'rogue.critPerPoint': 0.02 }) }, { id: 'coupDeGrace', ops: o({ 'rogue.finisher': 0.15 }) }] },
    SS: { id: 'shadowAssassin', needs: { precision: 65, agility: 40 }, ops: o({ 'rogue.ambush': 0.4, 'skills.smokeBomb.duration': 2 }) },
    SSS: { id: 'endlessCombo', ops: o({ 'rogue.cpMax': 2 }) },
    L: { id: 'legendRogue', ops: o({ 'rogue.cpTime': 1 }),
      pick: [{ id: 'eviscerator', ops: o({}, { 'skills.eviscerate.power': 1.4 }) }, { id: 'bladeStorm', ops: o({ 'skills.fanOfKnives.radius': 2, 'skills.fanOfKnives.combo': 1 }) }] },
    M: { id: 'mythicShade', ops: o({ 'ultimates.deathBlossom.ticks': 4 }, { 'ultimates.assassinate.power': 1.3 }) },
  },
  ranger: {
    A: { id: 'sharpEye', ops: o({ 'ranger.rangeBonus': 0.15 }),
      pick: [{ id: 'trapper', ops: o({ 'ranger.traps': 3, 'ranger.trapLife': 15 }) }, { id: 'piercer', ops: o({ 'skills.piercingShot.width': 0.6 }, { 'skills.piercingShot.power': 1.2 }) }] },
    S: { id: 'huntMastery', ops: o({ 'ultimates.arrowStorm.ticks': 4 }),
      pick: [{ id: 'deadeye', ops: o({ 'ranger.rangeBonus': 0.15 }) }, { id: 'packHunter', companion: true, ops: o({}, {}, { companionDamage: 0.3, companionHp: 0.3 }) }] },
    SS: { id: 'apexTracker', needs: { precision: 60, instinct: 40 }, ops: o({ 'skills.explosiveTrap.radius': 1.5, 'skills.bearTrap.stun': 1 }) },
    SSS: { id: 'wildBond', companion: true, ops: o({}, {}, { companionDamage: 0.3, companionHp: 0.5 }) },
    L: { id: 'legendRanger', ops: o({ 'ranger.rangeFrom': -2 }),
      pick: [{ id: 'arrowRain', ops: o({ 'ultimates.arrowStorm.ticks': 6 }) }, { id: 'volley', ops: o({ 'skills.multiShot.arcDeg': 30 }, { 'skills.multiShot.power': 1.2 }) }] },
    M: { id: 'mythicHunter', ops: o({ 'ranger.rangeBonus': 0.2 }, { 'ultimates.primalFury.armyDamage': 1.3 }) },
  },
  cleric: {
    A: { id: 'devotion', ops: o({ 'cleric.faithHit': 1 }),
      pick: [{ id: 'longShield', ops: o({ 'skills.divineShield.duration': 2 }) }, { id: 'brightNova', ops: o({ 'skills.holyNova.radius': 1.5 }) }] },
    S: { id: 'faithMastery', ops: o({}, { 'ultimates.divineIntervention.healSelf': 1.25 }),
      pick: [{ id: 'mercy', ops: o({}, { 'cleric.hitHeal': 1.6 }) }, { id: 'zeal', ops: o({ 'cleric.damage': 0.001 }) }] },
    SS: { id: 'saint', needs: { resilience: 65 }, ops: o({ 'skills.divineShield.duration': 3, 'skills.divineShield.guard': 0.1 }) },
    SSS: { id: 'eternalFaith', ops: o({}, { 'cleric.decay': 0.4 }) },
    L: { id: 'legendCleric', ops: o({ 'cleric.faithHit': 1 }),
      pick: [{ id: 'judge', ops: o({}, { 'skills.judgement.power': 1.4 }) }, { id: 'hallowedGround', ops: o({ 'skills.consecration.ticks': 4 }) }] },
    M: { id: 'mythicGrace', ops: o({ 'cleric.faithMax': 30 }, { 'ultimates.divineIntervention.healSelf': 1.2 }) },
  },
  necromancer: {
    A: { id: 'shadowCommand', ops: o({}, { 'shadows.revive.cooldown': 0.7 }),
      pick: [{ id: 'darkPact', ops: o({ 'skills.darkMend.healArmy': 0.15 }) }, { id: 'warHorn', ops: o({ 'skills.warCry.duration': 4 }) }] },
    S: { id: 'monarchMastery', ops: o({ 'ultimates.legionsCall.duration': 3 }),
      pick: [{ id: 'sovereignMight', ops: o({}, { 'shadows.monarch.share': 1.2 }) }, { id: 'endlessLegion', ops: o({ 'shadows.baseSlots': 3 }) }] },
    SS: { id: 'lordOfTheDead', needs: { dominion: 70 }, ops: o({ 'ultimates.legionsCall.duration': 6, 'ultimates.legionsCall.armyDamage': 0.3 }) },
    SSS: { id: 'soulHarvest', ops: o({}, { 'shadows.xpShare': 1.5 }) },
    L: { id: 'legendMonarch', ops: o({ 'shadows.baseSlots': 1 }),
      pick: [{ id: 'warMarshal', ops: o({ 'skills.warCry.armyDamage': 0.3 }) }, { id: 'undeathMend', ops: o({ 'skills.darkMend.healArmy': 0.25 }) }] },
    M: { id: 'mythicMonarch', ops: o({ 'ultimates.legionsCall.armyDamage': 0.4 }, { 'shadows.monarch.share': 1.15 }) },
  },
};

// Guaranteed skills of the evolution classes: the second skill of the class by a class quest (mastery level of the
// first skill) or at the latest at `rank`; loot can bring it earlier.
export const GUARANTEED = {
  berserker: { skill: 'recklessCharge', quest: { mastery: 'frenzyCleave', level: 2 }, rank: 4 },
  stormcaller: { skill: 'stormfield', quest: { mastery: 'thunderLance', level: 2 }, rank: 4 },
  beastmaster: { skill: 'packAssault', quest: { mastery: 'preyMark', level: 2 }, rank: 4 },
  sentinel: { skill: 'radiantSweep', quest: { mastery: 'aegisOath', level: 2 }, rank: 4 },
};

// a readable name from an id: wideCleave -> Wide Cleave
export function titleOf(id) {
  return String(id).replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
}

// the shown name of a step or option: its own string (prog.<id>) or one made from the id
const NAMES = {
  wideCleaveW: 'Wide Cleave', huntersMarkFang: "Hunter's Fang", eyeOfTheStorm: 'Eye of the Storm',
  legendBerserker: 'Legendary Fury', legendStorm: 'Legendary Storm', legendBeast: 'Legendary Beast', legendSentinel: 'Legendary Ward',
  legendWarrior: 'Legendary Warlord', legendMage: 'Legendary Arcanum', legendRogue: 'Legendary Shade', legendRanger: 'Legendary Hunt',
  legendCleric: 'Legendary Grace', legendMonarch: 'Legendary Monarch', bigFireball: 'Great Fireball', longChain: 'Long Chain',
};
export function progName(id) {
  return NAMES[id] || titleOf(id);
}

// the tree a class grows along: its own, or the one of its base class (hybrids)
export function treeOf(cls) {
  if (TREES[cls]) return cls;
  const c = CONFIG.classes.list[cls];
  return c && c.base && TREES[c.base] ? c.base : '';
}

// ---- the numbers the trees touch, and their values before any step (taken once, when the module loads) ----
function resolve(path) {
  const parts = path.split('.');
  let obj = CONFIG;
  for (let i = 0; i < parts.length - 1; i++) { obj = obj ? obj[parts[i]] : undefined; }
  return { obj, key: parts[parts.length - 1] };
}
function opsOf(node, pick) {
  const out = [node.ops];
  if (pick) out.push(pick.ops);
  return out;
}
export const PATHS = new Set();
for (const tree of Object.values(TREES)) for (const k in tree) {
  const n = tree[k];
  for (const ops of [n.ops, ...(n.pick || []).map((p) => p.ops)]) for (const p of [...Object.keys(ops.add), ...Object.keys(ops.mul)]) PATHS.add(p);
}
const BASE = new Map();
for (const p of PATHS) { const r = resolve(p); BASE.set(p, r.obj ? r.obj[r.key] : undefined); }

// every path points into CONFIG (its parent exists) and holds a number or nothing yet: [] when all is well
export function validateTrees() {
  const errs = [];
  for (const p of PATHS) {
    const r = resolve(p);
    if (!r.obj || typeof r.obj !== 'object') errs.push('no such place: ' + p);
    else if (r.obj[r.key] !== undefined && typeof r.obj[r.key] !== 'number') errs.push('not a number: ' + p);
  }
  for (const id in TREES) {
    for (const s of STEPS) {
      const n = TREES[id][s.key];
      if (!n || !n.id) { errs.push(id + ': step ' + s.key + ' is missing'); continue; }
      const empty = (ops) => !Object.keys(ops.add).length && !Object.keys(ops.mul).length && !Object.keys(ops.bonus).length;
      if (empty(n.ops) && !(n.pick && n.pick.every((p) => !empty(p.ops)))) errs.push(id + ': step ' + s.key + ' does nothing');
      if (n.pick && (n.pick.length !== 2 || n.pick.some((p) => empty(p.ops)))) errs.push(id + ': step ' + s.key + ' needs two working options');
    }
  }
  for (const id in GUARANTEED) {
    const g = GUARANTEED[id];
    if (!CONFIG.skills[g.skill] || !CONFIG.skills[g.quest.mastery]) errs.push(id + ': guaranteed skill missing');
  }
  return errs;
}

// the steps of a tree and how far each is: 'active' | 'pick' (reached, a choice waits) | 'needs' (unique: the
// affinities are not there yet) | 'rank' (not reached yet)
export function stepsOf(tree, rank, aff, state) {
  const T = TREES[tree];
  if (!T) return [];
  const st = state || { picks: {}, uniques: {} };
  return STEPS.map((s) => {
    const n = T[s.key], picked = ((st.picks || {})[tree] || {})[s.key] || '';
    let status = 'rank', miss = [];
    if (rank >= s.rank) {
      if (n.needs && !((st.uniques || {})[tree] || {})[s.key]) {
        miss = Object.keys(n.needs).filter((a) => ((aff && aff[a]) || 0) < n.needs[a]);
        status = miss.length ? 'needs' : 'open';
      } else status = n.pick && !picked ? 'pick' : 'active';
    }
    return { key: s.key, rank: s.rank, node: n, status, picked, miss };
  });
}

// The state of the progression, saved with the world: picks = { tree: { step: option } },
// uniques = { tree: { step: true } } (a unique step stays once it opened).
export class ClassProgression {
  constructor(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    this.picks = {};
    this.uniques = {};
    this.granted = {}; // guaranteed skills already given: { class: true }
    for (const tree in s.picks || {}) if (TREES[tree]) for (const k in s.picks[tree]) {
      const n = TREES[tree][k];
      if (n && n.pick && n.pick.some((p) => p.id === s.picks[tree][k])) (this.picks[tree] || (this.picks[tree] = {}))[k] = s.picks[tree][k];
    }
    for (const tree in s.uniques || {}) if (TREES[tree]) for (const k in s.uniques[tree]) if (TREES[tree][k] && TREES[tree][k].needs) (this.uniques[tree] || (this.uniques[tree] = {}))[k] = true;
    for (const c in s.granted || {}) if (GUARANTEED[c]) this.granted[c] = true;
    this.sig = '';
    this.bonus = {};
    this.compUp = [];
  }

  serialize() {
    return { picks: JSON.parse(JSON.stringify(this.picks)), uniques: JSON.parse(JSON.stringify(this.uniques)), granted: { ...this.granted } };
  }

  // picks an option of a step that waits; true when taken
  pick(tree, key, id, rank) {
    const n = TREES[tree] && TREES[tree][key], s = STEPS.find((x) => x.key === key);
    if (!n || !n.pick || !s || rank < s.rank || !n.pick.some((p) => p.id === id)) return false;
    if (this.picks[tree] && this.picks[tree][key]) return false; // a pick is for good
    (this.picks[tree] || (this.picks[tree] = {}))[key] = id;
    return true;
  }

  // unique steps whose need is met now are opened for good; returns the newly opened ones
  openUniques(tree, rank, aff) {
    const out = [];
    for (const st of stepsOf(tree, rank, aff, this)) if (st.status === 'open') { (this.uniques[tree] || (this.uniques[tree] = {}))[st.key] = true; out.push(st); }
    return out;
  }

  // the ops in force for a tree at a rank
  activeOps(tree, rank, aff) {
    const out = [], ids = [];
    for (const st of stepsOf(tree, rank, aff, this)) {
      if (st.status !== 'active' && st.status !== 'pick') continue;
      const pick = st.picked ? st.node.pick.find((p) => p.id === st.picked) : null;
      for (const ops of opsOf(st.node, pick)) out.push(ops);
      ids.push(st.node.id + (pick ? ':' + pick.id : ''));
      if (st.node.companion) this.compUp.push(st.node.id);
      if (pick && pick.companion) this.compUp.push(pick.id);
    }
    return { ops: out, ids };
  }

  // Puts the numbers of CONFIG back to their base and applies the steps in force. Returns true when anything
  // changed (the caller then recalculates the hunter, the army and the skill numbers).
  apply(tree, rank, aff) {
    this.compUp = [];
    const { ops, ids } = this.activeOps(tree, rank, aff);
    const sig = tree + '|' + ids.join(',');
    if (sig === this.sig) return false;
    this.sig = sig;
    for (const [p, v] of BASE) { const r = resolve(p); if (r.obj) { if (v === undefined) delete r.obj[r.key]; else r.obj[r.key] = v; } }
    const bonus = {};
    for (const op of ops) {
      for (const p in op.add) { const r = resolve(p); if (r.obj) r.obj[r.key] = Math.round(((r.obj[r.key] || 0) + op.add[p]) * 10000) / 10000; }
      for (const p in op.bonus) bonus[p] = (bonus[p] || 0) + op.bonus[p];
    }
    // the factors after the sums (so the order of the steps does not matter)
    for (const op of ops) for (const p in op.mul) { const r = resolve(p); if (r.obj && typeof r.obj[r.key] === 'number') r.obj[r.key] = Math.round(r.obj[r.key] * op.mul[p] * 10000) / 10000; }
    this.bonus = bonus;
    return true;
  }
}
