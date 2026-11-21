// Fortified Outposts, a mechanic of the Tank core (Path). A captured outpost can be
// fortified with essence (three levels). In a fortified outpost you heal faster, and
// when you leave it you stay Fortified for a while: you take less damage. At the top
// level the fallen shadows stand up when you arrive.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

const F = () => CONFIG.fortify;

export class Fort {
  constructor(game, saved) {
    this.game = game;
    this.lv = {}; // outpost index -> level
    if (saved) for (const si in saved) { const l = saved[si] | 0; if (l > 0) this.lv[si] = Math.min(F().max, l); }
    this.inside = -1; // the fortified outpost the hunter is in
  }

  serialize() {
    return { ...this.lv };
  }

  level(si) {
    return this.lv[si] || 0;
  }

  // the captured outposts, nearest to the camp first
  outposts() {
    const W = this.game.world;
    return [...this.game.discovered].filter((si) => si > 0 && W.safes[si] && W.safes[si].captured && W.safes[si].zone >= 0)
      .sort((a, b) => Math.hypot(W.safes[a].x, W.safes[a].z) - Math.hypot(W.safes[b].x, W.safes[b].z));
  }

  cost(si) {
    const lv = this.level(si);
    return lv >= F().max ? 0 : F().cost[lv] * (this.game.world.safes[si].zone + 1);
  }

  upgrade(si) {
    const P = this.game.player, cost = this.cost(si);
    if (!cost || P.essence < cost || !this.outposts().includes(si)) return false;
    P.essence -= cost;
    this.lv[si] = this.level(si) + 1;
    this.game.hud.toast(t('fort.done', { name: this.game.safeName(si), n: this.lv[si] }));
    play('levelup');
    this.game.save();
    return true;
  }

  // in a fortified outpost the hunter heals faster and becomes Fortified (the buff runs out after leaving)
  update(dt) {
    const g = this.game, P = g.player, si = P.safeIndex, lv = si > 0 && !P.dead ? this.level(si) : 0;
    if (lv > 0) {
      P.fortT = F().time;
      P.fortLv = lv;
      P.hp = Math.min(P.maxHp, P.hp + P.maxHp * F().regen[lv - 1] * dt);
      P.mana = Math.min(P.maxMana, P.mana + P.maxMana * F().regen[lv - 1] * dt);
      if (this.inside !== si) {
        this.inside = si;
        if (lv >= F().max) g.army.reviveAll(); // the fallen stand up
      }
    } else {
      this.inside = -1;
      if (P.fortT > 0) P.fortT = Math.max(0, P.fortT - dt);
    }
  }
}
