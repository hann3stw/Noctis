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

// The one check whether class `id` can be offered to (and taken by) a hunter of class `from` at the
// Specialization. Used by the offers (core/style.js classOffers, core/awakening.js specOffers), the class panel and
// game.changeClass, so no way around it exists.
//  - the class exists in CONFIG.classes.list and is ready (ready === true; anything else is locked)
//  - it is the class itself (continuation), or one of CONFIG.classes.spec[from]
//  - a hybrid must be unlocked: its affinity needs (`needs`, the fit limit of the Specialization) are met, or the
//    hunter held it before; a hybrid without valid needs is never taken as unlocked
// aff = the affinity values, held = a Set of the classes held before (may be empty).
export function specAllowed(from, id, aff, held) {
  const C = CONFIG.classes, c = C.list[id];
  if (!c || c.ready !== true) return false;
  if (id === from) return !!C.list[from];
  if (!C.list[from] || !(C.spec[from] || []).includes(id)) return false;
  if (!c.hybrid) return true;
  if (held && held.has(id)) return true;
  const needs = c.needs;
  if (!needs || typeof needs !== 'object' || !Object.keys(needs).length) return false;
  return Object.keys(needs).every((a) => Number.isFinite(needs[a]) && ((aff && aff[a]) || 0) >= needs[a]);
}

// the class may use the Spell Forge (the Mage and the classes that grow from it with that right)
export function canForge(cls) {
  const c = CONFIG.classes.list[cls];
  return !!c && !!c.spellForge;
}
