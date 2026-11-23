// What the way you play says about you: measures from 0 to 1 (core/profile.js counts the play), and from them
// the classes that fit best at the second choice (rank C). A hybrid class is only offered when it fits.
import { CONFIG } from '../config.js';
import { specAllowed } from './classes.js';

const clamp = (v) => Math.max(0, Math.min(1, v));

export function styleOf(game) {
  const pf = game.profile, P = game.player;
  const atk = pf.atkMelee + pf.atkRanged + pf.atkMagic;
  const share = (v) => (atk < 40 ? 1 / 3 : v / atk);
  const minutes = Math.max(1, pf.time / 60);
  return {
    melee: share(pf.atkMelee),
    ranged: share(pf.atkRanged),
    magic: share(pf.atkMagic),
    caster: clamp(pf.castRate() / 8), // skills per minute
    dodge: clamp(pf.dodgeRate() / 8),
    crit: clamp(pf.critRate() / 0.3),
    tank: clamp(pf.takenPerMin() / (P.maxHp * 0.6)), // damage taken per minute against your health
    calm: 1 - clamp(pf.takenPerMin() / (P.maxHp * 0.6)),
    heal: clamp(pf.healed / minutes / (P.maxHp * 0.5)), // health healed per minute against your health
    army: game.hasArmy() ? clamp(1 - pf.dmgShare()) : 0, // share of the damage done by the shadows
  };
}

export const MEASURES = ['melee', 'ranged', 'magic', 'caster', 'dodge', 'crit', 'tank', 'heal', 'army'];

// The offers of the Specialization (rank C), from the affinities (core/affinities.js), the one system that steers
// every class offer. [{ id, fit, why, stay, open }]: only classes that can really be taken now (core/classes.js
// specAllowed): the class itself (stay), the plain sibling, and the hybrids that are ready and unlocked. Locked
// classes are left out completely (no card, no hint). fit = how much the affinities lean to it. At most four.
export function classOffers(game) {
  const C = CONFIG.classes, cur = game.mainClass, aff = game.aff ? game.aff.values() : {};
  const held = new Set(game.awakening ? game.awakening.history.map((h) => h.id) : []);
  const out = [];
  for (const id of C.spec[cur] || []) {
    const c = C.list[id];
    if (!specAllowed(cur, id, aff, held)) continue; // locked or not ready: never offered
    const needs = c.needs || {};
    let w = 0, v = 0, why = '', best = -1;
    for (const a in needs) {
      w += needs[a];
      v += needs[a] * (aff[a] || 0) / 100;
      if ((aff[a] || 0) > best) { best = aff[a] || 0; why = a; }
    }
    out.push({ id, fit: w ? v / w : 0, why, stay: id === cur, open: true });
  }
  // the class itself first, then by fit; at most four offers
  out.sort((a, b) => (b.stay - a.stay) || b.fit - a.fit);
  return out.slice(0, 4);
}

// the open offers of the Specialization (what can really be picked)
export function openOffers(game) {
  return classOffers(game).filter((o) => o.open);
}
