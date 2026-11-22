// The Ranger (a main class, CONFIG.ranger): a loyal companion at its side and traps on the ground.
//  - The companion is one shadow of the army machinery (the Ranger has no army otherwise): it fights,
//    grows with the hunter, and stands up again by itself after a while.
//  - A trap waits where it was set and goes off when an enemy comes near.
import { CONFIG } from '../config.js';
import { makeWeapon } from './items.js';
import { t } from '../strings.js';

export class Ranger {
  constructor(game) {
    this.game = game;
    this.traps = []; // { x, z, r, dmg, stun, color, life }
    this.t = 1; // time until the companion is looked after
    this.pulse = 0;
  }

  // the Ranger is chosen: a first bow in the bag
  welcome() {
    const P = this.game.player;
    const bow = makeWeapon('bow', 1, Math.max(1, P.level));
    if (!P.addItem(bow)) this.game.loot.drop(P.x, P.z, bow);
    this.game.hud.toast(t('ranger.bow'));
  }

  companion() {
    return this.game.army.deployed[0] || null;
  }

  // a trap of a skill: it waits for an enemy
  addTrap(x, z, def, dmg) {
    const R = CONFIG.ranger;
    if (this.traps.length >= R.traps) this.traps.shift();
    this.traps.push({ x, z, r: def.radius, dmg, stun: def.stun || 0, color: def.stun ? 0x7fd6a0 : 0xff9040, life: R.trapLife });
  }

  update(dt) {
    const g = this.game, R = CONFIG.ranger;
    if (g.mech !== 'ranger') return;
    // the companion
    if ((this.t -= dt) <= 0) {
      this.t = 3;
      const A = g.army, u = this.companion();
      if (!u) {
        if (A.hasRoom()) {
          const P = g.player, z = CONFIG.world.zones[Math.min(g.rankIndex, CONFIG.world.zones.length - 1)];
          A.add(R.companionType, R.companionTier, P.x + 2, P.z + 2, undefined, 0, z.level);
        }
      } else {
        if (!u.alive && u.reviveT <= 0) { // it stands up again
          u.alive = true;
          u.hp = u.maxHp;
          if (A.out) A.placeAtHome(u, true);
          A.version++;
        }
        // it grows with the zone of your rank
        const z = CONFIG.world.zones[Math.min(g.rankIndex, CONFIG.world.zones.length - 1)];
        if (u.plv < z.level) { u.plv = z.level; A.recalc(u); u.hp = u.maxHp; }
      }
    }
    // the traps
    if (!this.traps.length) return;
    const E = g.enemies, fx = g.effects;
    const pulse = (this.pulse += dt) > 0.7;
    if (pulse) this.pulse = 0;
    for (let k = this.traps.length - 1; k >= 0; k--) {
      const tr = this.traps[k];
      tr.life -= dt;
      if (tr.life <= 0) { this.traps.splice(k, 1); continue; }
      if (pulse) fx.ring(tr.x, tr.z, 0.2, 1.2, tr.color, 0.6);
      const trig = Math.max(1.4, tr.r * 0.6), t2 = trig * trig;
      let hit = false;
      for (let m = 0; m < E.activeCount && !hit; m++) {
        const i = E.active[m];
        if (!E.alive[i]) continue;
        const dx = E.x[i] - tr.x, dz = E.z[i] - tr.z;
        if (dx * dx + dz * dz <= t2) hit = true;
      }
      if (!hit) continue;
      this.traps.splice(k, 1);
      g.zones.add(tr.x, tr.z, tr.r, 0.05, 1, 0, tr.dmg, tr.stun, tr.color);
      fx.ring(tr.x, tr.z, 0.4, tr.r + 1, tr.color, 0.4);
      fx.burst(tr.x, 1, tr.z, 24, tr.color, 7, 0.24, 0.7);
      g.cam.shake(0.15, 0.15);
    }
  }
}
