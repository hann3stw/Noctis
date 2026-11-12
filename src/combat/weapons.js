// Basic attacks. The equipped weapon decides the shape of the attack.
import { CONFIG } from '../config.js';

const DEG = Math.PI / 180;

function rollDamage(base) {
  const v = CONFIG.combat.damageVariance;
  return Math.round(base * (1 + (Math.random() * 2 - 1) * v));
}

function hitArc(game, w, dx, dz) {
  const P = game.player, E = game.enemies;
  const cosHalf = Math.cos(w.arcDeg * 0.5 * DEG);
  for (let k = 0; k < E.activeCount; k++) {
    const i = E.active[k];
    if (!E.alive[i]) continue;
    const ex = E.x[i] - P.x, ez = E.z[i] - P.z;
    const d = Math.sqrt(ex * ex + ez * ez);
    const r = E.radius[i];
    if (d - r > w.range) continue;
    // enemies touching the player are always hit, the rest must be in the arc
    if (d > r + 0.9 && (ex * dx + ez * dz) / d < cosHalf) continue;
    E.damage(i, rollDamage(w.damage), dx, dz);
  }
  game.effects.slash(P.x, P.z, Math.atan2(dx, dz), w.range, w.arcDeg);
}

export function fireWeapon(game, weaponId, dx, dz) {
  const w = CONFIG.weapons[weaponId];
  if (w.shape === 'arc') hitArc(game, w, dx, dz);
}
