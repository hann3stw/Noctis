// The mechanics of the evolution classes (ids in core/classComponents.js MECHANICS, numbers in
// CONFIG.mechanics). They run on top of the mechanic of the base class, which stays as it was
// (game.mech): a Berserker keeps the Warrior's Rage, a Stormcaller the Mage's Arcane Charges, a Beastmaster
// the Ranger's companion, a Sentinel the Cleric's Faith. game.classMechanic says which one is active.
//
// Every mechanic has: reset (class change, death), update (once per frame, cheap), the event handlers the
// game calls (hit, skill, companion hit, prevented damage) and display (what the HUD shows). The values live
// on the player (momentum, bond, aegis); Bond and Aegis are saved, Momentum is a short fight state.
import { CONFIG } from '../config.js';

const M = () => CONFIG.mechanics;

export const MECHANIC_IMPL = {
  // ---- Berserker: Momentum stacks from melee hits while Rage is high; the next melee skill spends them
  berserkerMomentum: {
    reset(P) { P.momentum = 0; P.momGap = 0; P.momDecay = 0; },
    update(game, P, dt) {
      const B = M().berserkerMomentum;
      if (P.momGap > 0) P.momGap -= dt;
      if (P.momentum > 0 && P.calmT > B.calm && (P.momDecay -= dt) <= 0) { P.momentum--; P.momDecay = B.decay; }
    },
    // a hit that landed (melee = by a melee weapon or a melee skill)
    onHit(game, P, melee) {
      const B = M().berserkerMomentum;
      if (!melee || P.rage < B.minRage || P.momGap > 0 || P.momentum >= B.max) return;
      P.momentum++;
      P.momGap = B.gap;
      P.momDecay = B.decay;
      if (P.momentum === B.max) game.effects.ring(P.x, P.z, 0.3, 2.2, 0xff3040, 0.3);
    },
    // a melee skill takes all stacks: the damage factor for it
    spend(game, P, def) {
      if (!def.melee || !P.momentum) return 1;
      const B = M().berserkerMomentum, n = P.momentum;
      P.momentum = 0;
      return 1 + n * (B.perStack + (def.momentumBonus || 0));
    },
    display(P) { return { kind: 'momentum', pips: P.momentum, max: M().berserkerMomentum.max }; },
  },

  // ---- Stormcaller: a lightning skill with 3 / 5 Arcane Charges jumps to 1 / 2 more enemies; the charges are spent
  stormOverload: {
    reset(P) { P.overload = 0; },
    update() {},
    // the extra jumps of this cast (and the charges it spends); called once per cast
    spend(game, P, def) {
      const S = M().stormOverload;
      if (!def.lightning) return 0;
      let j = 0;
      if (P.arcane >= S.at[1]) { j = S.jumps[1]; P.arcane -= S.at[1]; } else if (P.arcane >= S.at[0]) { j = S.jumps[0]; P.arcane -= S.at[0]; }
      P.overload = j;
      if (j) game.effects.flare(P.x, 1.6, P.z, 3 + j, 0xfff07a, 0.35, 1.6);
      return j;
    },
    display(P) { return { kind: 'overload', on: P.arcane >= M().stormOverload.at[0], full: P.arcane >= M().stormOverload.at[1] }; },
  },

  // ---- Beastmaster: Bond grows with the hits and kills of the companion (capped per second), fades out of a fight
  companionBond: {
    reset(P) { P.bondSec = 0; P.bondGot = 0; P.bondCalm = 0; },
    update(game, P, dt) {
      const B = M().companionBond;
      P.bondCalm += dt;
      // it fades only when neither the hunter nor the companion has fought for a while
      if (P.bond > 0 && P.calmT > B.calm && P.bondCalm > B.calm) P.bond = Math.max(0, P.bond - B.decay * dt);
    },
    onCompanion(game, P, kill) {
      const B = M().companionBond, sec = Math.floor(game.playTime || 0);
      P.bondCalm = 0;
      if (P.bondSec !== sec) { P.bondSec = sec; P.bondGot = 0; }
      const add = Math.min(kill ? B.kill : B.hit, B.perSec - P.bondGot);
      if (add <= 0) return;
      P.bondGot += add;
      P.bond = Math.min(B.max, P.bond + add);
    },
    display(P) { return { kind: 'bond', value: P.bond / M().companionBond.max }; },
  },

  // ---- Sentinel: Aegis from damage the Sentinel's own shields and guards really prevented
  aegis: {
    reset(P) { P.aegisT = 0; },
    update(game, P, dt) {
      const A = M().aegis;
      if (P.aegisT > 0) P.aegisT -= dt;
      if (P.aegis > 0 && P.calmT > A.calm) P.aegis = Math.max(0, P.aegis - A.decay * dt);
    },
    onPrevented(game, P, amount) {
      const A = M().aegis;
      if (P.aegisT <= 0 || !(amount > 0)) return;
      const add = Math.min(A.perHit, (amount / P.maxHp) * A.perHp);
      P.aegis = Math.min(A.max, P.aegis + add);
      if (game.aff) game.aff.record('damagePrevented', { amount: amount / P.maxHp });
    },
    // spends up to n Aegis; returns what was spent
    spend(game, P, n) {
      const k = Math.min(P.aegis, n);
      P.aegis -= k;
      return k;
    },
    display(P) { return { kind: 'aegis', value: P.aegis / M().aegis.max }; },
  },
};

// the mechanic object of the hunter's class (or null)
export function mechOf(game) {
  return MECHANIC_IMPL[game.classMechanic] || null;
}

// everything temporary goes (class change, death); Bond and Aegis stay only through a death if keep is set
export function resetMechanics(P, keep = false) {
  for (const k in MECHANIC_IMPL) MECHANIC_IMPL[k].reset(P);
  if (!keep) { P.bond = 0; P.aegis = 0; }
}
