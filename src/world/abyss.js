// The Abyss: an endless gate in the camp, open from the last level on. It uses
// the arena system of the gates (its gate is the last entry of world.gates)
// with a pool of enemy slots whose type changes every wave. Every floor has
// waves of enemies from all zones, every bossEvery-th floor a zone boss.
// Every floor makes the enemies stronger; the deepest cleared floor is saved.
// Unique items drop only here.
import { CONFIG } from '../config.js';
import { arenaCenter } from './gates.js';
import { ST_CHASE } from '../entities/enemies.js';
import { rollLoot, makeUnique } from '../core/items.js';
import { hashSeed } from '../core/rng.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

export class Abyss {
  constructor(game, saved) {
    this.game = game;
    this.best = (saved && saved.best) || 0; // deepest floor cleared
    this.floor = 0; // current floor (0 = not inside)
    this.wave = 0;
    this.waves = 0; // waves of this floor (0 on boss floors)
    this.waveT = 0; // pause before the next wave
    this.cleared = false;
    this.timeLeft = 0; // Against the Clock
    this.gi = game.world.gates.findIndex((g) => g.abyss);
    // every normal enemy type of every zone, and the zone bosses
    const types = new Set();
    for (const z of CONFIG.world.zones) for (const id of z.enemyTypes) types.add(id);
    this.types = [...types];
    this.bosses = CONFIG.world.zones.map((z) => z.boss);
  }

  get on() {
    return this.gi >= 0 && this.game.gates.active === this.gi;
  }

  get unlocked() {
    return this.game.player.level >= CONFIG.abyss.unlockLevel;
  }

  serialize() {
    return { best: this.best };
  }

  // strength of the enemies on a floor (floor 1 = x1)
  power(floor = this.floor) {
    return Math.pow(CONFIG.abyss.floorPower, Math.max(0, floor - 1));
  }

  isBoss(floor) {
    return floor % CONFIG.abyss.bossEvery === 0;
  }

  // floors a run can start at: 1 and the floor after every cleared boss floor
  starts() {
    const out = [1], B = CONFIG.abyss.bossEvery;
    for (let f = B; f <= this.best; f += B) out.push(f + 1);
    return out;
  }

  // called by Gates.enter once the player is in the arena
  begin(floor) {
    this.floor = Math.max(1, floor);
    this.startFloor();
  }

  end() {
    this.floor = 0;
    this.cleared = false;
    this.timeLeft = 0;
  }

  startFloor() {
    const game = this.game, E = game.enemies, A = CONFIG.abyss, gi = this.gi, gates = game.gates;
    this.cleared = false;
    this.wave = 0;
    this.waveT = 0;
    const tl = game.modOn('timeLimit');
    this.timeLeft = tl ? tl.floor : 0;
    const pool = E.arenaAdds[gi], b = E.arenaBoss[gi];
    E.vanish(b);
    for (const a of pool) E.vanish(a);
    game.shots.clear();
    game.hazards.clear();
    gates.exitOpen = false;
    gates.exit.visible = false;
    if (this.isBoss(this.floor)) {
      // a zone boss, with its helpers in the pool for its summons
      const bossId = this.bosses[hashSeed(game.seed, 4400, this.floor) % this.bosses.length];
      E.type[b] = E.typeIndex[bossId];
      const adds = CONFIG.enemies.types[bossId].adds, el = game.modOn('elites');
      for (const a of pool) { E.type[a] = E.typeIndex[adds]; E.tier[a] = el ? 1 : 0; }
      const c = arenaCenter(gi);
      E.place(b, c.x, c.z - 3);
      E.packAggro[E.pack[b]] = 1;
      E.state[b] = ST_CHASE;
      E.yaw[b] = 0;
      gates.resetBrain();
      this.waves = 0;
      game.hud.banner(t('abyss.bossFloor', { n: this.floor }), t('enemy.' + bossId));
    } else {
      this.waves = A.waves;
      this.spawnWave();
      game.hud.banner(t('abyss.floor', { n: this.floor }), t('abyss.wave', { n: 1, max: this.waves }));
    }
    play('arise');
  }

  spawnWave() {
    const game = this.game, E = game.enemies, P = game.player, A = CONFIG.abyss, gi = this.gi;
    this.wave++;
    const n = Math.min(A.waveSize[1], A.waveSize[0] + Math.floor((this.floor - 1) / 3));
    const el = game.modOn('elites');
    const eliteChance = el ? el.chance : A.eliteChance;
    const c = arenaCenter(gi), R = CONFIG.gates.arenaRadius;
    const pool = E.arenaAdds[gi];
    // two kinds of enemies per wave, from any zone
    const k1 = this.types[(Math.random() * this.types.length) | 0];
    const k2 = this.types[(Math.random() * this.types.length) | 0];
    for (let k = 0; k < n && k < pool.length; k++) {
      const a = pool[k];
      E.type[a] = E.typeIndex[k % 2 ? k2 : k1];
      E.tier[a] = Math.random() < eliteChance ? 1 : 0;
      // somewhere in the arena, not right next to the hunter
      let x = c.x, z = c.z;
      for (let tries = 0; tries < 10; tries++) {
        const ang = Math.random() * Math.PI * 2, r = R * (0.35 + Math.random() * 0.5);
        x = c.x + Math.cos(ang) * r;
        z = c.z + Math.sin(ang) * r;
        if ((x - P.x) ** 2 + (z - P.z) ** 2 > 64) break;
      }
      E.place(a, x, z);
      E.packAggro[E.pack[a]] = 1;
      E.state[a] = ST_CHASE;
      game.effects.burst(x, 0.5, z, 10, 0xb070ff, 4, 0.2, 0.5);
    }
    if (this.wave > 1) game.hud.toast(t('abyss.wave', { n: this.wave, max: this.waves }));
  }

  alive() {
    const E = this.game.enemies;
    let n = E.alive[E.arenaBoss[this.gi]] ? 1 : 0;
    for (const a of E.arenaAdds[this.gi]) if (E.alive[a]) n++;
    return n;
  }

  update(dt) {
    if (!this.on || this.cleared || this.game.player.dead) return;
    if (this.timeLeft > 0) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.game.hud.toast(t('abyss.timeUp'));
        this.game.gates.leave(false);
        return;
      }
    }
    if (this.alive() > 0) { this.waveT = 1.2; return; }
    if (this.waveT > 0) { this.waveT -= dt; return; }
    if (this.wave < this.waves) this.spawnWave();
    else this.floorCleared();
  }

  floorCleared() {
    const game = this.game, P = game.player, A = CONFIG.abyss, c = arenaCenter(this.gi);
    this.cleared = true;
    this.timeLeft = 0;
    const record = this.floor > this.best;
    if (record) { this.best = this.floor; game.submitRecords(); }
    for (let k = 0; k < A.clearItems; k++) this.dropLoot(c.x + k * 2, c.z, false);
    // one chance per floor for a unique item (more on boss floors)
    if (Math.random() < this.uniqueChance(this.isBoss(this.floor))) {
      const item = makeUnique(this.itemLevel());
      game.loot.drop(c.x, c.z + 2, item);
      game.hud.uniqueDrop(item, c.x, c.z + 2);
    }
    const ess = Math.round(A.essencePerFloor * this.floor * (1 + game.gates.runMods.length * CONFIG.modifiers.luck));
    P.essence += ess;
    game.hud.banner(t('abyss.cleared', { n: this.floor }), record && this.floor > 1 ? t('abyss.record', { n: this.floor }) : t('toast.essence', { n: ess }));
    game.gates.exitOpen = true;
    game.gates.exit.visible = true;
    play('levelup');
    game.save();
  }

  next() {
    if (!this.cleared) return;
    this.floor++;
    this.startFloor();
  }

  // ---- loot ---------------------------------------------------------------------
  itemLevel() {
    return CONFIG.abyss.unlockLevel + this.floor * CONFIG.abyss.itemLevelPerFloor;
  }

  luck() {
    return this.game.player.drop + CONFIG.abyss.luckPerFloor * this.floor + this.game.gates.runMods.length * CONFIG.modifiers.luck;
  }

  uniqueChance(boss) {
    const U = CONFIG.abyss.unique;
    const f = (1 + U.perFloor * (this.floor - 1)) * (1 + U.perModifier * this.game.gates.runMods.length);
    return boss ? Math.min(U.bossMax, U.bossChance * f) : Math.min(U.max, U.chance * f);
  }

  dropLoot(x, z, boss) {
    const game = this.game, P = game.player;
    game.loot.drop(x, z, rollLoot(this.itemLevel(), this.luck(), P.known, boss ? 3 : 1, !boss));
  }

  onKill(i, tier) {
    const E = this.game.enemies;
    if (tier === 3) { this.onBossKilled(E.x[i], E.z[i]); return; }
    const chance = CONFIG.abyss.dropChance * (tier ? 3 : 1) * (1 + this.game.player.drop);
    if (Math.random() < chance) this.dropLoot(E.x[i], E.z[i], false);
  }

  onBossKilled(x, z) {
    const game = this.game, E = game.enemies, n = CONFIG.abyss.bossItems;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      this.dropLoot(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5, true);
    }
    for (const a of E.arenaAdds[this.gi]) {
      if (!E.alive[a]) continue;
      game.effects.burst(E.x[a], 1, E.z[a], 10, 0x6a4dbf, 4, 0.2, 0.5);
      E.vanish(a);
    }
    game.shots.clear();
    game.hazards.clear();
    game.effects.burst(x, 2, z, 60, 0xb070ff, 10, 0.3, 1.2);
  }
}
