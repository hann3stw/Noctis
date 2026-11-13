// Player damage: hit shapes shared by weapons and skills, and the basic attack
// of every weapon type.
import { CONFIG } from '../config.js';
import { play } from '../core/sfx.js';

const DEG = Math.PI / 180;

// One hit of the player on enemy i: variance, crit, ultimate charge.
export function playerHit(game, i, base, kx, kz) {
  const P = game.player, C = CONFIG.progression;
  let dmg = base * (1 + (Math.random() * 2 - 1) * CONFIG.combat.damageVariance);
  const crit = Math.random() < P.crit;
  if (crit) dmg *= P.critDmg;
  P.ult = Math.min(C.ultCharge.max, P.ult + C.ultCharge.perHit);
  play(crit ? 'crit' : 'hit');
  game.enemies.damage(i, Math.max(1, Math.round(dmg)), kx, kz, -1, crit);
}

// All of these return the number of enemies hit.
export function hitArc(game, x, z, dx, dz, range, arcDeg, base) {
  const E = game.enemies;
  const cosHalf = Math.cos(arcDeg * 0.5 * DEG);
  let n = 0;
  for (let k = 0; k < E.activeCount; k++) {
    const i = E.active[k];
    if (!E.alive[i]) continue;
    const ex = E.x[i] - x, ez = E.z[i] - z;
    const d = Math.sqrt(ex * ex + ez * ez);
    const r = E.radius[i];
    if (d - r > range) continue;
    // enemies touching the origin are always hit, the rest must be in the arc
    if (d > r + 0.9 && (ex * dx + ez * dz) / d < cosHalf) continue;
    playerHit(game, i, base, dx, dz);
    n++;
  }
  return n;
}

export function hitCircle(game, x, z, radius, base, stun = 0) {
  const E = game.enemies;
  let n = 0;
  for (let k = 0; k < E.activeCount; k++) {
    const i = E.active[k];
    if (!E.alive[i]) continue;
    const ex = E.x[i] - x, ez = E.z[i] - z;
    const d = Math.sqrt(ex * ex + ez * ez);
    if (d - E.radius[i] > radius) continue;
    if (stun > E.stun[i]) E.stun[i] = stun;
    const inv = d > 0.01 ? 1 / d : 0;
    if (base > 0) playerHit(game, i, base, ex * inv, ez * inv);
    n++;
  }
  return n;
}

export function hitLine(game, x, z, dx, dz, len, width, base) {
  const E = game.enemies;
  let n = 0;
  for (let k = 0; k < E.activeCount; k++) {
    const i = E.active[k];
    if (!E.alive[i]) continue;
    const ex = E.x[i] - x, ez = E.z[i] - z;
    const along = ex * dx + ez * dz;
    const r = E.radius[i];
    if (along < -r || along > len + r) continue;
    const side = Math.abs(ex * dz - ez * dx);
    if (side > width * 0.5 + r) continue;
    playerHit(game, i, base, dx, dz);
    n++;
  }
  return n;
}

// power (0..1) = how far the stick was dragged, used by aimed area attacks
export function fireWeapon(game, weaponId, dx, dz, power) {
  const w = CONFIG.weapons[weaponId];
  const P = game.player, fx = game.effects;
  const base = P.power();
  if (w.shape === 'arc') {
    hitArc(game, P.x, P.z, dx, dz, w.range, w.arcDeg, base);
    fx.slash(P.x, P.z, Math.atan2(dx, dz), w.range, w.arcDeg);
  } else if (w.shape === 'circle') {
    hitCircle(game, P.x, P.z, w.range, base);
    fx.slash(P.x, P.z, 0, w.range, 360);
  } else if (w.shape === 'line') {
    game.projectiles.shoot(P.x + dx * 0.8, P.z + dz * 0.8, dx, dz, w.speed, w.range, base, w.width);
  } else if (w.shape === 'blast') {
    const d = w.range * Math.max(0.15, power);
    game.zones.add(P.x + dx * d, P.z + dz * d, w.radius, w.delay, 1, 0, base, 0, 0xc9a8ff);
  }
}
