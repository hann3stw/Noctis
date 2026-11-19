// Player damage: hit shapes shared by weapons and skills, and the basic attack
// of every weapon type.
import { CONFIG } from '../config.js';
import { play } from '../core/sfx.js';
import { SWEEP, EXPAND } from '../render/effects.js';

const DEG = Math.PI / 180;

// One hit of the player on enemy i: variance, crit, ultimate charge.
export function playerHit(game, i, base, kx, kz) {
  const P = game.player, E = game.enemies, U = P.uq;
  let dmg = base * (1 + (Math.random() * 2 - 1) * CONFIG.combat.damageVariance);
  // Last Rites: more damage on wounded enemies
  if (U.execute && E.hp[i] < E.maxHp[i] * U.execute.below) dmg *= 1 + U.execute.damage;
  const crit = Math.random() < P.crit;
  if (crit) dmg *= P.critDmg;
  P.onHit();
  play(crit ? 'crit' : 'hit', P.weapon); // every weapon sounds its own way
  const fx = game.effects;
  if (crit) {
    fx.flare(E.x[i], 1.1, E.z[i], 3.2, 0xffc040, 0.26, 1.6);
    fx.flare(E.x[i], 1.1, E.z[i], 1.4, 0xffffff, 0.14, 1.4);
    fx.sparks(E.x[i], 1, E.z[i], 10, 0xffd060, 7, 0.32, 0.45, 0.5);
    fx.light(E.x[i], 1.6, E.z[i], 0xffc040, 45, 7, 0.22);
    fx.ring(E.x[i], E.z[i], 0.4, 2.6, 0xffc040, 0.3, 0, 1.0);
    game.cam.shake(0.18, 0.15);
    game.hitStop(0.045);
  } else {
    fx.flare(E.x[i], 1.1, E.z[i], 1.9, 0xe8dcff, 0.18, 1.5);
    fx.ring(E.x[i], E.z[i], 0.3, 1.5, 0xffffff, 0.18, 0, 1.0);
  }
  const x = E.x[i], z = E.z[i];
  E.damage(i, Math.max(1, Math.round(dmg)), kx, kz, -1, crit);
  // Stormbinder: the hit may jump to enemies nearby
  if (U.storm && !zapping && Math.random() < U.storm.chance) zap(game, i, x, z, dmg * U.storm.damage, U.storm);
}

let zapping = false;
function zap(game, from, x, z, dmg, S) {
  const E = game.enemies, fx = game.effects;
  zapping = true;
  let n = 0;
  for (let k = 0; k < E.activeCount && n < S.jumps; k++) {
    const j = E.active[k];
    if (j === from || !E.alive[j]) continue;
    const dx = E.x[j] - x, dz = E.z[j] - z, d = Math.hypot(dx, dz);
    if (d > S.range || d < 0.01) continue;
    fx.beam(x, z, dx / d, dz / d, d, 0.25, 0x9fe8ff);
    E.damage(j, Math.max(1, Math.round(dmg)), dx / d, dz / d, -1, false);
    n++;
  }
  zapping = false;
}

// Echo of the Fallen: a shadow wave in the attack direction
export function echoWave(game, dx, dz, U) {
  const P = game.player, fx = game.effects;
  hitArc(game, P.x, P.z, dx, dz, U.range, U.arcDeg, P.skillPower() * U.power);
  const yaw = Math.atan2(dx, dz), aura = game.appearance ? game.appearance.aura : 0x8a4dff;
  fx.slash(P.x, P.z, yaw, U.range, U.arcDeg, aura, EXPAND, 1, 0.4);
  fx.slash(P.x, P.z, yaw, U.range * 0.75, U.arcDeg, 0xfff0c0, EXPAND, 1, 0.3);
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
    if (stun > 0) E.applyStun(i, stun);
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
    // the trail sweeps the way the arm swings (alternates every attack)
    const dir = P.combo ? -1 : 1;
    const color = weaponId === 'daggers' ? 0xe8dcff : 0xc9a8ff;
    fx.slash(P.x, P.z, Math.atan2(dx, dz), w.range, w.arcDeg, color, SWEEP, dir, weaponId === 'daggers' ? 0.16 : 0.26);
    fx.flare(P.x + dx * w.range * 0.55, 1, P.z + dz * w.range * 0.55, w.range * 0.8, color, 0.16, 1.3);
  } else if (w.shape === 'circle') {
    hitCircle(game, P.x, P.z, w.range, base);
    fx.slash(P.x, P.z, Math.atan2(dx, dz), w.range, 360, 0xc9a8ff, SWEEP, -1, 0.34);
    fx.ring(P.x, P.z, 1, w.range + 0.5, 0xb48cff, 0.3);
  } else if (w.shape === 'line') {
    game.projectiles.shoot(P.x + dx * 0.8, P.z + dz * 0.8, dx, dz, w.speed, w.range, base, w.width);
  } else if (w.shape === 'blast') {
    const d = w.range * Math.max(0.15, power);
    game.zones.add(P.x + dx * d, P.z + dz * d, w.radius, w.delay, 1, 0, base, 0, 0xc9a8ff);
  } else if (w.shape === 'thrust') {
    // spear: through everything in a short line
    hitLine(game, P.x, P.z, dx, dz, w.range, w.width, base);
    fx.beam(P.x + dx * 0.6, P.z + dz * 0.6, dx, dz, w.range - 0.6, w.width * 0.45, 0xe8dcff);
    fx.ring(P.x + dx * w.range, P.z + dz * w.range, 0.3, 1.4, 0xc9a8ff, 0.2);
  } else if (w.shape === 'slam') {
    // hammer: a heavy blow on the ground in front of the hunter
    const x = P.x + dx * w.range, z = P.z + dz * w.range;
    hitCircle(game, x, z, w.radius, base, w.stun);
    fx.slash(x, z, 0, w.radius, 360, 0xffd9a0, EXPAND, 1, 0.3);
    fx.flare(x, 0.6, z, w.radius * 1.6, 0xffb060, 0.3, 1.5);
    fx.light(x, 1.5, z, 0xffb060, 60, w.radius * 3 + 4, 0.3);
    fx.ring(x, z, 0.5, w.radius + 0.8, 0xffb060, 0.3);
    fx.burst(x, 0.3, z, 12, 0xd8c0a0, 6, 0.2, 0.4);
    game.cam.shake(0.14, 0.12);
  } else if (w.shape === 'chain') {
    chainBolt(game, w, dx, dz, base);
  }
}

// Grimoire: the bolt takes the enemy closest to the aim direction, then jumps
// on to enemies nearby. Every enemy is hit once.
function chainBolt(game, w, dx, dz, base) {
  const E = game.enemies, P = game.player, fx = game.effects;
  const cosHalf = Math.cos(w.coneDeg * 0.5 * DEG);
  let first = -1, best = -2;
  for (let k = 0; k < E.activeCount; k++) {
    const i = E.active[k];
    if (!E.alive[i]) continue;
    const ex = E.x[i] - P.x, ez = E.z[i] - P.z;
    const d = Math.sqrt(ex * ex + ez * ez) || 0.01;
    if (d - E.radius[i] > w.range) continue;
    const c = (ex * dx + ez * dz) / d;
    if (c < cosHalf && d > E.radius[i] + 1) continue;
    // straight ahead counts most, close a little
    const score = c - d / (w.range * 4);
    if (score > best) { best = score; first = i; }
  }
  if (first < 0) {
    // nothing there: the bolt fizzles out
    fx.beam(P.x + dx * 0.6, P.z + dz * 0.6, dx, dz, w.range * 0.6, 0.22, 0x9fd0ff);
    return;
  }
  const hit = [first];
  let x = P.x, z = P.z, cur = first, dmg = base;
  for (let j = 0; ; j++) {
    const tx = E.x[cur], tz = E.z[cur];
    let bx = tx - x, bz = tz - z;
    const len = Math.sqrt(bx * bx + bz * bz) || 0.01;
    bx /= len; bz /= len;
    fx.beam(x, z, bx, bz, len, 0.3, j ? 0x9fd0ff : 0xd8ecff);
    fx.burst(tx, 1.2, tz, 6, 0x9fd0ff, 4, 0.16, 0.3);
    playerHit(game, cur, dmg, bx, bz);
    if (j >= w.jumps) break;
    x = tx; z = tz;
    dmg *= w.jumpDamage;
    let next = -1, nd = w.jumpRange * w.jumpRange;
    for (let k = 0; k < E.activeCount; k++) {
      const i = E.active[k];
      if (!E.alive[i] || hit.includes(i)) continue;
      const ex = E.x[i] - x, ez = E.z[i] - z, d2 = ex * ex + ez * ez;
      if (d2 < nd) { nd = d2; next = i; }
    }
    if (next < 0) break;
    hit.push(next);
    cur = next;
  }
}
