// What the way you play says about you: measures from 0 to 1 (core/profile.js counts the play), and from them
// the classes that fit best at the second choice (rank C). A hybrid class is only offered when it fits.
import { CONFIG } from '../config.js';

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

// [{ id, fit, why, stay }]: the classes to offer to a hunter of class game.mainClass
export function classOffers(game) {
  const C = CONFIG.classes, s = styleOf(game), cur = game.mainClass;
  const out = [];
  for (const id of C.spec[cur] || []) {
    const w = C.fit[id] || {}, c = C.list[id];
    let fit = 0, why = '', best = 0;
    for (const k in w) {
      const v = (s[k] || 0) * w[k];
      fit += v;
      if (k !== 'calm' && v > best) { best = v; why = k; }
    }
    const stay = id === cur;
    if (c.hybrid && fit < (c.minFit || C.minFit)) continue; // does not fit the way you play: not offered
    out.push({ id, fit, why, stay });
  }
  // the plain classes first, then the hybrids by how well they fit
  out.sort((a, b) => (CONFIG.classes.list[a.id].hybrid ? 1 : 0) - (CONFIG.classes.list[b.id].hybrid ? 1 : 0) || b.fit - a.fit);
  return out.slice(0, 4);
}
