// Main classes (CONFIG.classes): which skills a class can use. A skill or ultimate
// with a `for` list (in CONFIG.skills / CONFIG.ultimates) belongs to those classes
// only; one without it is for everybody (also for a hunter without a class yet).
// A hybrid class (spellblade ...) can use the skills of its parents (skillFrom).
import { CONFIG } from '../config.js';

// the class whose mechanic (Rage, Arcane Charges, Faith, Combo Points, companion, army) a class uses
export function baseOf(cls) {
  const c = CONFIG.classes.list[cls];
  return (c && c.base) || cls;
}

export function skillOk(id, cls) {
  const def = CONFIG.skills[id] || CONFIG.ultimates[id];
  if (!def) return false;
  if (!def.for) return true;
  const c = CONFIG.classes.list[cls], from = (c && c.skillFrom) || [];
  return def.for.includes(cls) || from.some((f) => def.for.includes(f));
}
