// Skills and ultimates. Every skill is one case below; its numbers live in
// CONFIG.skills / CONFIG.ultimates.
import { CONFIG } from '../config.js';
import { hitArc, hitCircle, hitLine } from './weapons.js';

export function skillDef(id) {
  return CONFIG.skills[id] || CONFIG.ultimates[id];
}

// dx, dz = aim direction, power (0..1) = distance for skills aimed at a point
export function castSkill(game, id, dx, dz, power) {
  const def = skillDef(id);
  const P = game.player, E = game.enemies, fx = game.effects, army = game.army;
  const aura = game.appearance.aura;
  const base = P.power() * (def.power || 0);
  const dist = (def.range || 0) * Math.max(0.15, power);
  let tx = P.x + dx * dist, tz = P.z + dz * dist;
  const yaw = Math.atan2(dx, dz);

  switch (id) {
    case 'shadowStep': {
      fx.burst(P.x, 1, P.z, 16, aura, 4, 0.22, 0.5);
      const lim = game.world.radius - 1.5, r = Math.sqrt(tx * tx + tz * tz);
      if (r > lim) { tx *= lim / r; tz *= lim / r; }
      game.world.resolve(tx, tz, P.radius);
      P.x = game.world.rx;
      P.z = game.world.rz;
      P.invuln = Math.max(P.invuln, 0.4);
      hitCircle(game, P.x, P.z, def.radius, base);
      fx.slash(P.x, P.z, 0, def.radius, 360, aura);
      fx.burst(P.x, 1, P.z, 16, aura, 6, 0.22, 0.5);
      break;
    }
    case 'shadowWave':
      hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, aura);
      fx.slash(P.x, P.z, yaw, def.range * 0.6, def.arcDeg, 0xffffff);
      break;
    case 'rulersGrasp':
      E.pull(tx, tz, def.radius, 0.8);
      hitCircle(game, tx, tz, def.radius, base, def.stun);
      fx.slash(tx, tz, 0, def.radius, 360, aura);
      fx.burst(tx, 1, tz, 20, aura, 3, 0.24, 0.7);
      break;
    case 'umbralShield':
      P.shield = Math.round(P.maxHp * def.shield);
      P.shieldT = def.duration;
      fx.slash(P.x, P.z, 0, def.radius, 360, 0x6aa8ff);
      break;
    case 'daggerRain':
      game.zones.add(tx, tz, def.radius, 0.25, def.ticks, def.interval, base, 0, 0xd8d2ff);
      break;
    case 'warCry':
      army.buff(def.armyDamage, def.duration);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xff6070);
      fx.burst(P.x, 1.5, P.z, 24, 0xff6070, 8, 0.2, 0.6);
      break;
    case 'lifeLeech': {
      const n = hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, 0x5cf08a);
      if (n > 0) {
        P.heal(Math.min(P.maxHp * 0.4, base * def.heal * n));
        fx.burst(P.x, 1.4, P.z, 10, 0x5cf08a, 3, 0.18, 0.6);
      }
      break;
    }
    case 'nightLance':
      hitLine(game, P.x, P.z, dx, dz, def.range, def.width, base);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width, aura);
      break;

    // ---- ultimates
    case 'nightfall':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      fx.slash(P.x, P.z, 0, def.radius, 360, aura);
      fx.slash(P.x, P.z, 0, def.radius * 0.6, 360, 0xffffff);
      fx.burst(P.x, 1, P.z, 60, aura, 12, 0.3, 0.9);
      break;
    case 'legionsCall':
      army.reviveAll();
      army.buff(def.armyDamage, def.duration);
      fx.slash(P.x, P.z, 0, def.radius, 360, aura);
      fx.burst(P.x, 1, P.z, 40, aura, 9, 0.26, 0.9);
      break;
    case 'eclipse':
      P.eclipseT = def.duration;
      P.charges = P.maxCharges;
      fx.slash(P.x, P.z, 0, 5, 360, 0xffd24a);
      fx.burst(P.x, 1.4, P.z, 40, 0xffd24a, 8, 0.24, 0.8);
      break;
  }
}
