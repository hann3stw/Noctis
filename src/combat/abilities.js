// Behaviour blocks of the skills. The older skills are cases in combat/skills.js; a skill with a `behaviors` list
// (CONFIG.skills / CONFIG.ultimates) is run from these blocks instead, in the order given. Every block has the same
// shape: block(c) with c = the cast (see runAbility); a block may read and write c.n (enemies hit), c.cx / c.cz /
// c.cr (where the cast landed) and c.last (an enemy to start a chain from). The ids are fixed: nothing from a
// save is ever run as code.
import { CONFIG } from '../config.js';
import { hitArc, hitCircle, hitLine, chainHit, lineLast } from './weapons.js';
import { SWEEP, EXPAND, FLASH } from '../render/effects.js';


// moves the hunter towards (tx, tz) inside the world or the gate (the same rules as Shield Rush)
function moveTo(game, tx, tz) {
  const P = game.player;
  if (game.gates.active >= 0) {
    game.gates.clamp(tx, tz, P.radius);
    P.x = game.gates.cx;
    P.z = game.gates.cz;
  } else {
    const lim = game.world.radius - 1.5, r = Math.sqrt(tx * tx + tz * tz);
    if (r > lim) { tx *= lim / r; tz *= lim / r; }
    game.world.resolve(tx, tz, P.radius);
    P.x = game.world.rx;
    P.z = game.world.rz;
  }
}

// the Beastmaster's (and Ranger's) companion, or null
function companion(game) {
  return game.ranger ? game.ranger.companion() : null;
}

export const BEHAVIORS = {
  // a wide hit in front of the hunter
  arcHit(c) {
    const { game, P, def, fx } = c;
    c.n += hitArc(game, P.x, P.z, c.dx, c.dz, def.range, def.arcDeg, c.base, def.stun || 0);
    fx.slash(P.x, P.z, c.yaw, def.range, def.arcDeg, def.color, SWEEP, P.combo ? -1 : 1, 0.35);
    fx.slash(P.x, P.z, c.yaw, def.range * 0.7, def.arcDeg, 0xffffff, SWEEP, P.combo ? -1 : 1, 0.25);
    c.cx = P.x + c.dx * def.range * 0.5; c.cz = P.z + c.dz * def.range * 0.5; c.cr = def.range * 0.5;
    game.cam.shake(0.2, 0.18);
  },
  // a beam along the aim
  lineHit(c) {
    const { game, P, def, fx } = c;
    c.n += hitLine(game, P.x, P.z, c.dx, c.dz, def.range, def.width, c.base);
    c.last = lineLast;
    fx.beam(P.x, P.z, c.dx, c.dz, def.range, def.width, def.color);
    fx.beam(P.x, P.z, c.dx, c.dz, def.range, def.width * 0.35, 0xffffff);
    c.cx = P.x + c.dx * def.range * 0.5; c.cz = P.z + c.dz * def.range * 0.5; c.cr = def.range * 0.4;
    game.cam.shake(0.14, 0.12);
  },
  // a blast at the target point after a short delay
  pointExplosion(c) {
    const { game, def, fx } = c;
    game.zones.add(c.tx, c.tz, def.radius, 0.35, 1, 0, c.base, def.stun || 0, def.color);
    fx.ring(c.tx, c.tz, def.radius + 1, 0.4, def.color, 0.4);
    c.cx = c.tx; c.cz = c.tz; c.cr = def.radius;
  },
  // a burst around the hunter
  selfNova(c) {
    const { game, P, def, fx } = c;
    c.n += hitCircle(game, P.x, P.z, def.radius, c.base, def.stun || 0);
    fx.slash(P.x, P.z, 0, def.radius, 360, def.color, EXPAND, 1, 0.5);
    fx.ring(P.x, P.z, 1, def.radius + 2, 0xffffff, 0.5);
    fx.burst(P.x, 1.2, P.z, 40, def.color, 9, 0.26, 0.8);
    c.cx = P.x; c.cz = P.z; c.cr = def.radius;
    game.cam.shake(0.35, 0.3);
  },
  // rushes to the target, hits all on the way, and a short blast where it ends (elites and bosses there are stunned)
  dashStrike(c) {
    const { game, P, E, def, fx } = c;
    const len = Math.max(2, c.dist);
    c.n += hitLine(game, P.x, P.z, c.dx, c.dz, len, def.width, c.base);
    fx.beam(P.x, P.z, c.dx, c.dz, len, def.width, def.color);
    fx.beam(P.x, P.z, c.dx, c.dz, len, def.width * 0.4, 0xffffff);
    moveTo(game, c.tx, c.tz);
    P.invuln = Math.max(P.invuln, 0.35);
    const end = c.base * (def.endPower || 1) / (def.power || 1);
    c.n += hitCircle(game, P.x, P.z, def.radius, end, 0);
    if (def.eliteStun) {
      for (let k = 0; k < E.activeCount; k++) {
        const i = E.active[k];
        if (!E.alive[i] || (E.tier[i] < 1 && !def.stunAll)) continue; // stunAll (Warlord of Ruin): every enemy there
        const ex = E.x[i] - P.x, ez = E.z[i] - P.z, r = def.radius + E.radius[i];
        if (ex * ex + ez * ez <= r * r) E.applyStun(i, def.eliteStun);
      }
    }
    fx.slash(P.x, P.z, 0, def.radius, 360, def.color, EXPAND, 1, 0.35);
    fx.burst(P.x, 1, P.z, 24, def.color, 7, 0.24, 0.6);
    c.cx = P.x; c.cz = P.z; c.cr = def.radius;
    game.cam.shake(0.3, 0.22);
    game.hitStop(0.05);
  },
  // an area that hits again and again (at the target, or around the hunter for self skills); single = only one of it
  areaTicks(c) {
    const { game, P, def, fx } = c;
    const self = def.aim === 'self', x = self ? P.x : c.tx, z = self ? P.z : c.tz;
    if (def.single) game.zones.killOwner(c.id); // only one of it at a time
    game.zones.add(x, z, def.radius, 0.3, def.ticks, def.interval, c.base, def.stun || 0, def.color, false, def.single ? { owner: c.id } : null);
    fx.ring(x, z, def.radius + 1, 0.4, def.color, 0.45);
    fx.burst(x, 1.4, z, 30, def.color, 8, 0.24, 0.7);
    c.cx = x; c.cz = z; c.cr = def.radius;
    if (c.last < 0) c.last = game.enemies.nearest(x, z, def.radius);
  },
  // a whirl of blows that stays on the hunter
  whirl(c) {
    const { game, P, def, fx } = c;
    game.zones.add(P.x, P.z, def.radius, 0.1, def.ticks, def.interval, c.base, def.stun || 0, def.color, false, { follow: true });
    fx.slash(P.x, P.z, 0, def.radius, 360, def.color, SWEEP, 1, 0.5);
    fx.slash(P.x, P.z, 0, def.radius * 0.7, 360, 0x200008, SWEEP, -1, 0.45);
    fx.ring(P.x, P.z, 1, def.radius + 2, def.color, 0.55);
    fx.burst(P.x, 1.4, P.z, 50, def.color, 10, 0.28, 0.9);
    c.cx = P.x; c.cz = P.z; c.cr = def.radius;
    game.cam.shake(0.45, 0.4);
    game.hitStop(0.07);
  },
  // lightning that leaps from enemy to enemy (own jumps + Storm Overload)
  chainHit(c) {
    const { game, P, def } = c;
    const jumps = (def.jumps || 0) + c.extraJumps;
    if (jumps <= 0) return;
    const start = c.last >= 0 && game.enemies.alive[c.last] ? c.last : game.enemies.nearest(c.cx, c.cz, Math.max(c.cr, def.jumpRange || 6));
    if (start < 0) return;
    const range = (def.jumpRange || 6) + (c.extraJumps ? CONFIG.mechanics.stormOverload.range : 0);
    const dmg = c.base * (def.aim === 'line' ? CONFIG.mechanics.stormOverload.damage : 0.5);
    // a beam already hit the first enemy of the chain: the chain only starts from it
    const fromBeam = def.aim === 'line' && start === c.last;
    c.n += chainHit(game, start, P.x, P.z, dmg, jumps, range, def.color, fromBeam);
  },
  // the hunter hits harder for a while
  damageBuff(c) {
    const { P, def, fx } = c;
    P.buffT = def.duration;
    P.buffV = def.damage || 0;
    fx.ring(P.x, P.z, 0.5, 4, def.color, 0.45);
  },
  // takes less damage for a while
  guard(c) {
    const { P, def } = c;
    P.guardT = def.duration;
    P.guardV = Math.max(def.guard || 0, P.guardT > 0 ? P.guardV || 0 : 0);
    if (def.aegisShield) P.aegisT = def.duration;
  },
  defensiveBuff(c) { BEHAVIORS.guard(c); },
  // a shield (the Sentinel's shields make Aegis and grow with it)
  shield(c) {
    const { game, P, def, fx } = c;
    let k = 1;
    if (def.highAegis && P.aegis >= 50) k += def.highAegis; // Aegis Oath: stronger with high Aegis
    if (def.aegisCost && game.mechImpl && game.mechImpl.spend && game.classMechanic === 'aegis') k += game.mechImpl.spend(game, P, def.aegisCost) / 100; // Last Bastion
    P.shield = P.shieldMax = Math.round(P.maxHp * def.shield * k);
    P.shieldT = def.duration;
    if (def.aegisShield) P.aegisT = def.duration;
    fx.ring(P.x, P.z, 0.5, (def.radius || 2) + 1, def.color, 0.45);
    fx.burst(P.x, 1.2, P.z, 22, def.color, 4, 0.18, 0.6);
  },
  heal(c) {
    const { P, def, fx } = c;
    P.heal(P.maxHp * (def.healSelf || 0));
    fx.burst(P.x, 1.4, P.z, 14, 0x5cf08a, 4, 0.18, 0.6);
  },
  // heals by the enemies the cast hit (capped); Radiant Sweep: Aegis buys a short guard on top
  healOnHit(c) {
    const { game, P, def, fx } = c;
    if (c.n > 0) { P.heal(P.maxHp * Math.min(def.healCap, c.n * def.healPerHit)); fx.burst(P.x, 1.4, P.z, 12, 0xfff0a0, 4, 0.18, 0.6); }
    if (def.aegisCost && game.classMechanic === 'aegis' && P.aegis >= def.aegisCost) {
      game.mechImpl.spend(game, P, def.aegisCost);
      P.guardT = Math.max(P.guardT, 3);
      P.guardV = Math.max(P.guardV || 0, def.aegisGuard);
      fx.ring(P.x, P.z, 0.5, 3, 0xffd86a, 0.4);
    }
  },
  // pushes the enemies around where the cast landed away
  knockback(c) {
    const n = c.game.enemies.push(c.cx, c.cz, c.cr, c.def.knock || 4);
    if (n && c.game.aff) c.game.aff.record('controlApplied');
  },
  // enemies take more damage (Hunter's Mark): from the hunter and the companion
  mark(c) {
    const { game, def, fx } = c;
    const n = game.enemies.markArea(c.tx, c.tz, def.radius, def.duration);
    if (n && game.aff) game.aff.record('controlApplied');
    fx.ring(c.tx, c.tz, def.radius + 1, 0.5, def.color, 0.4);
    fx.ring(c.tx, c.tz, def.radius, def.radius * 0.96, def.color, 0.7, 0.1);
    fx.burst(c.tx, 1.5, c.tz, 16, def.color, 3, 0.2, 0.7);
    c.cx = c.tx; c.cz = c.tz; c.cr = def.radius;
  },
  // the companion hits marked enemies harder for a while
  companionBuff(c) {
    const u = companion(c.game);
    if (!u || !u.alive) return;
    u.preyT = c.def.duration;
    u.preyDmg = c.def.companionDamage || 0;
    c.fx.ring(u.x, u.z, 0.3, 2.4, c.def.color, 0.35);
  },
  // Pack Assault: Bond is spent for a strong attack order; the companion is healed or stands up again
  companionCommand(c) {
    const { game, P, def, fx } = c;
    const u = companion(game);
    if (!u) return;
    const full = P.bond >= CONFIG.mechanics.companionBond.max;
    const paid = Math.min(P.bond, def.bondCost || 0);
    P.bond -= paid;
    const k = full ? def.fullBond || 1 : 0.6 + 0.4 * (paid / Math.max(1, def.bondCost || 1));
    if (!u.alive) { // it stands up at once
      u.alive = true;
      u.reviveT = 0;
      u.hp = 0;
      if (game.army.out) game.army.placeAtHome(u, true);
      game.army.version++;
    }
    u.hp = Math.min(u.maxHp, u.hp + u.maxHp * def.healArmy * k);
    u.cmdT = def.duration;
    u.cmdDmg = def.armyDamage * k;
    if (def.markAround) game.enemies.markArea(u.x, u.z, def.markAround, def.duration); // Primal Hunt: the prey around it is marked
    fx.ring(u.x, u.z, 0.4, 4, def.color, 0.45);
    fx.burst(u.x, 1.2, u.z, full ? 40 : 20, def.color, 7, 0.22, 0.7);
    if (game.aff) game.aff.record('companionHit');
  },
  // Primal Apex: the companion becomes huge and mighty for a while (core/army update turns it back)
  companionApex(c) {
    const { game, def, fx } = c;
    const u = companion(game);
    if (!u) return;
    if (!u.alive) { u.alive = true; u.reviveT = 0; if (game.army.out) game.army.placeAtHome(u, true); game.army.version++; }
    u.hp = u.maxHp;
    if (!(u.apexT > 0)) u.scale *= 1.45;
    u.apexT = def.duration;
    u.apexDmg = def.armyDamage;
    u.apexGuard = def.armyGuard || 0;
    fx.ring(u.x, u.z, 1, 6, def.color, 0.6);
    fx.burst(u.x, 1.4, u.z, 50, def.color, 9, 0.26, 0.9);
    fx.light(u.x, 2, u.z, def.color, 160, 18, 0.6);
    game.cam.shake(0.35, 0.3);
  },
};

// Runs a skill made of blocks. base = its damage (skill power x power).
export function runAbility(game, id, def, base, dx, dz, tx, tz, yaw, dist) {
  const P = game.player;
  const c = { game, id, def, P, E: game.enemies, fx: game.effects, base, dx, dz, tx, tz, yaw, dist, n: 0, cx: P.x, cz: P.z, cr: def.radius || 4, last: -1, extraJumps: 0 };
  const m = game.mechImpl;
  if (m && m.spend && game.classMechanic === 'berserkerMomentum') c.base *= m.spend(game, P, def); // Momentum
  if (m && m.spend && game.classMechanic === 'stormOverload') c.extraJumps = m.spend(game, P, def); // Storm Overload
  if (def.rageBonus) c.base *= 1 + def.rageBonus * (P.rage / CONFIG.warrior.rageMax); // Bloodstorm: more with Rage
  for (const b of def.behaviors) {
    if (b === 'rageOnHit') { if (c.n > 0) P.addRage(def.rageOnHit || 0); continue; }
    const f = BEHAVIORS[b];
    if (f) f(c);
  }
  // a bleed (Rending Cleave): the enemies where it landed burn for 3 s (burn x the damage over that time)
  if (def.burn && c.n > 0) game.enemies.burnArea(c.cx, c.cz, c.cr, (c.base * def.burn) / 3, 3);
  return c;
}
