// The Ranger (a main class, CONFIG.ranger) and its line (the Beastmaster): a loyal companion at its side and traps
// on the ground.
//  - The companion is NOT a shadow. It has its own identity and data (saved here as `companion`, apart from the
//    army), and lives in the army only as one extra unit outside the roster (army.comp, slot COMP_SLOT), so it
//    moves and fights with the same machinery. It never takes a place of the army, never gets the army's bonuses
//    (it has companionDamage / companionHp), and a shadow is never mistaken for it. It fights, grows with the
//    hunter, learns from kills, and stands up again by itself after a while. When the class has no companion it
//    rests: nothing of it is lost, and it comes back as it was.
//  - A trap waits where it was set and goes off when an enemy comes near.
import { CONFIG } from '../config.js';
import { makeWeapon } from './items.js';
import { t } from '../strings.js';

// the saved form of the companion: { id, kind, type, tier, level, xp, totalXp, stage, plv, alive, hp, reviveT, upgrades }
function cleanCompanion(d) {
  if (!d || typeof d !== 'object' || !CONFIG.enemies.types[d.type]) return null;
  const num = (v, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Number(v)) : min);
  return {
    id: typeof d.id === 'string' && d.id ? d.id.slice(0, 24) : 'cmp-' + Math.random().toString(36).slice(2, 10),
    kind: 'beast', type: d.type, tier: Math.max(0, Math.min(2, d.tier | 0)), role: CONFIG.shadows.roles[d.role] ? d.role : CONFIG.enemies.types[d.type].shadowRole, zone: d.zone | 0,
    level: Math.max(1, d.level | 0), xp: num(d.xp), totalXp: num(d.totalXp), stage: Math.max(0, d.stage | 0), plv: num(d.plv, 1),
    alive: d.alive !== false, hp: num(d.hp), reviveT: num(d.reviveT),
    upgrades: Array.isArray(d.upgrades) ? d.upgrades.filter((k) => typeof k === 'string').slice(0, 16) : [],
  };
}

export class Ranger {
  constructor(game, saved) {
    this.game = game;
    this.traps = []; // { x, z, r, dmg, stun, color, life }
    this.data = cleanCompanion(saved); // the companion as saved (also while the class has none)
    if (this.data) this.game.army.comp = this.game.army.makeCompanion(this.data);
    this.game.army.rebuild();
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

  // the companion when the class has one (never a shadow of the army)
  companion() {
    const A = this.game.army;
    return A.compOn ? A.comp : null;
  }

  serialize() {
    const u = this.game.army.comp;
    if (!u) return this.data;
    const d = this.game.army.unitData(u);
    return { id: this.data ? this.data.id : 'cmp-' + Math.random().toString(36).slice(2, 10), kind: 'beast', ...d, nick: undefined, rank: undefined, olv: undefined, oxp: undefined, upgrades: this.upgrades() };
  }

  // the companion upgrades of the class progression that are active (core/classProgression.js)
  upgrades() {
    const p = this.game.progression;
    return p ? [...p.compUp] : (this.data ? this.data.upgrades : []);
  }

  // a trap of a skill: it waits for an enemy
  addTrap(x, z, def, dmg) {
    const R = CONFIG.ranger;
    if (this.traps.length >= R.traps) this.traps.shift();
    this.traps.push({ x, z, r: def.radius, dmg, stun: def.stun || 0, color: def.stun ? 0x7fd6a0 : 0xff9040, life: R.trapLife });
  }

  update(dt) {
    const g = this.game, R = CONFIG.ranger;
    if (!g.hasCompanion()) return;
    // the companion
    if ((this.t -= dt) <= 0) {
      this.t = 3;
      const A = g.army;
      if (!A.comp) {
        // the first companion: its own new identity
        const z = CONFIG.world.zones[Math.min(g.rankIndex, CONFIG.world.zones.length - 1)];
        this.data = cleanCompanion({ type: R.companionType, tier: R.companionTier, level: 1, plv: z.level, alive: true });
        A.comp = A.makeCompanion(this.data);
        A.comp.hp = A.comp.maxHp;
        A.rebuild();
        A.placeAtHome(A.comp, true);
      }
      const u = this.companion();
      if (u) {
        if (!u.alive && u.reviveT <= 0) { // it stands up again
          u.alive = true;
          u.hp = u.maxHp;
          A.placeAtHome(u, true);
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
