// Main classes (CONFIG.classes): which skills a class can use. A skill or ultimate
// with a `for` list (in CONFIG.skills / CONFIG.ultimates) belongs to those classes
// only; one without it is for everybody (also for a hunter without a class yet).
// A class can use the skills of every class it grows from (its parents and skillFrom, all the way up:
// a Sentinel uses Cleric, Paladin and Warrior skills). Evolution classes are built in core/classComponents.js.
import { CONFIG } from '../config.js';
import { ancestors } from './classComponents.js';

// the class whose mechanic (Rage, Arcane Charges, Faith, Combo Points, companion, army) a class uses
export function baseOf(cls) {
  const c = CONFIG.classes.list[cls];
  return (c && c.base) || cls;
}

const lineCache = new Map();
// the class and every class it grows from
export function lineOf(cls) {
  let l = lineCache.get(cls);
  if (!l) { l = [cls, ...ancestors(cls)]; lineCache.set(cls, l); }
  return l;
}

export function skillOk(id, cls) {
  const def = CONFIG.skills[id] || CONFIG.ultimates[id];
  if (!def) return false;
  if (!def.for) return true;
  return lineOf(cls).some((c) => def.for.includes(c));
}

// a skill can drop at this rank (skills of the evolution classes open later)
export function skillOpenAt(id, rank) {
  const def = CONFIG.skills[id] || CONFIG.ultimates[id];
  return !!def && (def.unlockRank || 0) <= rank;
}

// the class may use the Spell Forge (the Mage and the classes that grow from it with that right)
export function canForge(cls) {
  const c = CONFIG.classes.list[cls];
  return !!c && !!c.spellForge;
}
