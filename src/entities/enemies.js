// All enemies live in flat typed arrays (no objects, no garbage). Only enemies
// near the player are simulated and drawn; one InstancedMesh per enemy type.
// Every enemy has a tier (0 normal, 1 elite, 2 champion, 3 boss) and the zone
// it belongs to, which scale its stats. Gate bosses and their summoned helpers
// use reserved slots that only come alive inside their arena; the stages of
// normal gates share one pool of slots. Enemy types can have a trait (see
// CONFIG.traits), an extra behaviour on top of melee / ranged / charger.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { enemyPower, levelAt, rankHp } from '../core/levels.js';
import { gfx } from '../core/settings.js';
import { mulberry32, hashSeed } from '../core/rng.js';
import { flatMaterial } from '../render/geo.js';
import { buildEnemyGeometry } from '../render/models/enemies.js';
import { arenaCenter, gateDiff } from '../world/gates.js';
import { fmt } from '../core/format.js';
import { play } from '../core/sfx.js';

export const ST_IDLE = 0, ST_CHASE = 1, ST_WINDUP = 2, ST_RETURN = 3, ST_CHARGE = 4;
const B_MELEE = 0, B_RANGED = 1, B_CHARGER = 2, B_BOSS = 3;
const BEHAVIOR = { melee: B_MELEE, ranged: B_RANGED, charger: B_CHARGER, boss: B_BOSS };
const MAX_VISIBLE = 128; // per type
const MAX_MARKERS = 96;
const DEATH_TIME = 0.28;
const MARK_COLORS = [0, 0xffc030, 0xff4050, 0xff2060];
const TR = CONFIG.traits;
const BAR_WIDTH = [1.5, 2.1, 2.7, 0];
const _c = new THREE.Color();

export class Enemies {
  constructor(game) {
    this.game = game;
    const N = CONFIG.sim.maxEnemies, NP = CONFIG.sim.maxPacks;
    this.count = 0;
    this.alive = new Uint8Array(N);
    this.type = new Uint8Array(N);
    this.tier = new Uint8Array(N);
    this.zone = new Uint8Array(N);
    this.lvl = new Uint16Array(N); // level (from where the pack lives; gates: the zone's first level)
    this.arena = new Uint8Array(N); // gate index + 1 for boss and helper slots
    this.state = new Uint8Array(N);
    this.pack = new Uint16Array(N);
    this.x = new Float32Array(N);
    this.z = new Float32Array(N);
    this.yaw = new Float32Array(N);
    this.hp = new Float32Array(N);
    this.maxHp = new Float32Array(N);
    this.dmg = new Float32Array(N);
    this.xpv = new Float32Array(N);
    this.scale = new Float32Array(N);
    this.radius = new Float32Array(N);
    this.timer = new Float32Array(N);
    this.atkCd = new Float32Array(N);
    this.flash = new Float32Array(N);
    this.lunge = new Float32Array(N);
    this.phase = new Float32Array(N);
    this.moving = new Uint8Array(N);
    this.tx = new Float32Array(N); // roam target
    this.tz = new Float32Array(N);
    this.cdx = new Float32Array(N); // charge direction
    this.cdz = new Float32Array(N);
    this.hitDone = new Uint8Array(N); // the current charge already hit
    this.respawnT = new Float32Array(N);
    this.deathT = new Float32Array(N);
    this.tgt = new Int16Array(N).fill(-1); // -1 = the player, otherwise a shadow slot
    this.retT = new Float32Array(N); // time until the target is re-evaluated
    this.stun = new Float32Array(N); // seconds the enemy cannot act
    this.vuln = new Float32Array(N); // seconds the enemy takes more damage (Hunter's Mark)
    // traits
    this.kid = new Uint8Array(N); // a smaller copy left by a splitting enemy
    this.kidOf = new Int32Array(N).fill(-1); // world enemies that split: their first copy slot
    this.buff = new Float32Array(N); // seconds of rally (stronger and faster)
    this.tt = new Float32Array(N); // trait timer (heal, rally, raise, blink)
    this.atkN = new Uint8Array(N); // attacks so far (artillery: every second one)
    this.diedAt = new Float32Array(N); // clock at death (necro)
    this.revived = new Uint8Array(N); // raised again by a necro (only once)
    this.clock = 0;

    this.active = new Uint16Array(N);
    this.activeCount = 0;

    // packs
    this.packCount = 0;
    this.packX = new Float32Array(NP);
    this.packZ = new Float32Array(NP);
    this.packAggro = new Uint8Array(NP);

    // result of the boss brain (see Gates.think)
    this.mvx = 0;
    this.mvz = 0;
    this.mvs = 0;

    // types
    this.types = [];
    this.typeIndex = {};
    for (const id in CONFIG.enemies.types) {
      const def = CONFIG.enemies.types[id];
      const mesh = new THREE.InstancedMesh(buildEnemyGeometry(id), flatMaterial, MAX_VISIBLE);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_VISIBLE * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      const a = mesh.instanceMatrix.array;
      for (let i = 0; i < MAX_VISIBLE; i++) a[i * 16 + 15] = 1;
      game.scene.add(mesh);
      this.typeIndex[id] = this.types.length;
      this.types.push({ id, def, mesh, n: 0, beh: BEHAVIOR[def.behavior] || 0, trait: def.trait || '', tipped: false });
    }

    // coloured rings under elites, champions and bosses
    const ringGeo = new THREE.RingGeometry(0.85, 1.05, 24);
    ringGeo.rotateX(-Math.PI / 2);
    this.marks = new THREE.InstancedMesh(
      ringGeo,
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.85, depthWrite: false }),
      MAX_MARKERS,
    );
    this.marks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.marks.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_MARKERS * 3).fill(1), 3);
    this.marks.frustumCulled = false;
    this.marks.renderOrder = 1;
    this.marks.count = 0;
    const ma = this.marks.instanceMatrix.array;
    for (let i = 0; i < MAX_MARKERS; i++) { ma[i * 16 + 5] = 1; ma[i * 16 + 15] = 1; }
    game.scene.add(this.marks);
    this.nMarks = 0;

    this.arenaBoss = []; // per gate: slot of the boss
    this.arenaAdds = []; // per gate: slots of the helpers
    this.spawnWorld();
  }

  // ---- world population ---------------------------------------------------
  newPack(x, z) {
    const p = this.packCount++;
    this.packX[p] = x;
    this.packZ[p] = z;
    return p;
  }

  newEnemy(typeId, p, tier, zone, rng) {
    if (this.count >= CONFIG.sim.maxEnemies) return -1;
    const i = this.count++;
    this.type[i] = this.typeIndex[typeId];
    this.pack[i] = p;
    this.tier[i] = tier;
    this.zone[i] = zone;
    this.phase[i] = rng() * 6.28;
    return i;
  }

  // the copies a splitting enemy leaves (asleep until it dies; no rng, so the
  // packs of a world stay where they always were)
  newKids(i) {
    const T = TR.split, first = this.count;
    for (let k = 0; k < T.count && this.count < CONFIG.sim.maxEnemies; k++) {
      const j = this.count++;
      this.type[j] = this.type[i];
      this.pack[j] = this.pack[i];
      this.zone[j] = this.zone[i];
      this.phase[j] = Math.random() * 6.28;
      this.kid[j] = 1;
      this.alive[j] = 0;
      this.respawnT[j] = Infinity;
    }
    if (this.count > first) this.kidOf[i] = first;
  }

  spawnWorld() {
    const E = CONFIG.enemies, world = this.game.world;
    const rng = mulberry32(hashSeed(this.game.seed, 101, 202));
    const NP = CONFIG.sim.maxPacks - world.gates.length;
    CONFIG.world.zones.forEach((zone, zi) => {
      const first = this.packCount;
      const total = zone.packs + zone.champions;
      let placed = 0, tries = 0;
      while (placed < total && tries++ < total * 60 && this.packCount < NP) {
        // uniform by area inside the ring
        const rIn = zone.inner + 14, rOut = zone.outer - 8;
        const r = Math.sqrt(rIn * rIn + rng() * (rOut * rOut - rIn * rIn));
        const a = rng() * Math.PI * 2;
        const px = Math.cos(a) * r, pz = Math.sin(a) * r;
        if (world.nearGate(px, pz, 30) || world.nearSafe(px, pz, 30)) continue;
        let ok = true;
        for (let p = first; p < this.packCount; p++) {
          const dx = this.packX[p] - px, dz = this.packZ[p] - pz;
          if (dx * dx + dz * dz < E.packSpacing * E.packSpacing) { ok = false; break; }
        }
        if (!ok) continue;
        const p = this.newPack(px, pz);
        const typeId = zone.enemyTypes[(rng() * zone.enemyTypes.length) | 0];
        const split = E.types[typeId].trait === 'split';
        if (placed < zone.champions) {
          // a champion with two escorts
          for (let k = 0; k < 3; k++) {
            const i = this.newEnemy(typeId, p, k === 0 ? 2 : 0, zi, rng);
            if (i >= 0) { this.place(i); if (split) this.newKids(i); }
          }
        } else {
          const size = E.packSize[0] + ((rng() * (E.packSize[1] - E.packSize[0] + 1)) | 0);
          const elite = rng() < E.eliteChance;
          for (let k = 0; k < size; k++) {
            const i = this.newEnemy(typeId, p, elite && k === 0 ? 1 : 0, zi, rng);
            if (i >= 0) { this.place(i); if (split) this.newKids(i); }
          }
        }
        placed++;
      }
    });

    // every outpost is held by a guard pack (an elite and its guards)
    this.outpostPack = [];
    world.safes.forEach((s, si) => {
      if (s.zone < 0) return;
      const zone = CONFIG.world.zones[s.zone];
      const p = this.newPack(s.x, s.z);
      this.outpostPack[si] = p;
      const typeId = zone.enemyTypes[(rng() * zone.enemyTypes.length) | 0];
      for (let k = 0; k < CONFIG.outposts.guards; k++) {
        const i = this.newEnemy(typeId, p, k === 0 ? 1 : 0, s.zone, rng);
        if (i >= 0) this.place(i);
      }
    });

    // Reserved slots for the gate bosses (asleep until used). The stages and
    // the boss helpers of all normal gates share one pool (only one gate is
    // entered at a time, see usePool); the Abyss keeps its own.
    const sleep = (i, gi) => { this.arena[i] = gi + 1; this.alive[i] = 0; this.respawnT[i] = Infinity; };
    this.pool = null;
    this.poolPack = -1;
    world.gates.forEach((g, gi) => {
      const zone = CONFIG.world.zones[g.zone];
      const c = arenaCenter(gi);
      const p = this.newPack(c.x, c.z);
      const b = this.newEnemy(zone.boss, p, 3, g.zone, rng);
      sleep(b, gi);
      this.arenaBoss.push(b);
      const addType = CONFIG.enemies.types[zone.boss].adds;
      if (g.abyss) {
        const adds = [];
        for (let k = 0; k < CONFIG.abyss.pool; k++) {
          const i = this.newEnemy(addType, p, 0, g.zone, rng);
          if (i < 0) break;
          sleep(i, gi);
          adds.push(i);
        }
        this.arenaAdds.push(adds);
        return;
      }
      if (!this.pool) {
        this.pool = [];
        this.poolPack = this.newPack(c.x, c.z);
        for (let k = 0; k < CONFIG.gates.pool; k++) {
          const i = this.newEnemy(addType, this.poolPack, 0, g.zone, rng);
          if (i < 0) break;
          sleep(i, gi);
          this.pool.push(i);
        }
      }
      this.arenaAdds.push(this.pool);
    });
  }

  // the shared pool now belongs to gate gi (all asleep)
  usePool(gi) {
    if (!this.pool) return;
    const c = arenaCenter(gi);
    this.packX[this.poolPack] = c.x;
    this.packZ[this.poolPack] = c.z;
    for (const a of this.pool) { this.vanish(a); this.arena[a] = gi + 1; this.zone[a] = this.game.world.gates[gi].zone; }
  }

  // a sleeping arena slot joins the fight at (x, z) as typeId
  spawnAt(a, typeId, tier, x, z) {
    this.type[a] = this.typeIndex[typeId];
    this.tier[a] = tier;
    this.kid[a] = 0;
    this.place(a, x, z);
    this.packAggro[this.pack[a]] = 1;
    this.state[a] = ST_CHASE;
  }

  // a free slot of an arena pool (not alive, done dying), -1 if none
  freeSlot(pool) {
    for (const a of pool) if (!this.alive[a] && this.deathT[a] <= 0) return a;
    return -1;
  }

  // (re)spawns enemy i near its pack centre, or at (x, z) when given
  place(i, x, z) {
    const def = this.types[this.type[i]].def;
    const tier = this.tier[i];
    const T = CONFIG.enemies.tiers[tier];
    const p = this.pack[i];
    if (x === undefined) {
      const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3.5;
      x = this.packX[p] + Math.cos(a) * r;
      z = this.packZ[p] + Math.sin(a) * r;
    }
    this.x[i] = x;
    this.z[i] = z;
    this.tx[i] = x;
    this.tz[i] = z;
    this.yaw[i] = Math.random() * 6.28;
    const D = this.game.diff();
    // inside a gate: the gate's level and difficulty, bosses much tougher
    let lv, hpM = 1, dmgM = 1, xpM = 1, abyss = false;
    if (this.arena[i]) {
      const game = this.game, gate = game.world.gates[this.arena[i] - 1];
      abyss = !!gate.abyss;
      if (gate.abyss) {
        // the Abyss: enemies of the last level, stronger on every floor
        const A = CONFIG.abyss, pw = game.abyss.power();
        lv = A.unlockLevel;
        hpM = pw * (def.boss ? CONFIG.boss.hp * A.bossHp : 1);
        dmgM = pw;
        xpM = pw;
      } else {
        // a rank trial, or a gate difficulty (deadly gates: their tier on top)
        const gd = gateDiff(gate), GT = CONFIG.gateTiers, tier = gate.tier || 0;
        lv = gate.level;
        hpM = gd.hp * (def.boss ? CONFIG.boss.hp : 1) * Math.pow(GT.hp, tier);
        dmgM = gd.damage * Math.pow(GT.damage, tier);
      }
      const tough = game.modOn('tough');
      if (tough) hpM *= tough.hp;
      xpM *= 1 + game.gates.runMods.length * CONFIG.modifiers.xp;
    } else {
      lv = levelAt(Math.hypot(this.packX[p], this.packZ[p]));
    }
    this.lvl[i] = lv;
    const pw = enemyPower(lv);
    // later ranks: tougher normal enemies, gate bosses a share of it
    const rk = def.boss ? (abyss ? 1 : Math.pow(rankHp(lv), CONFIG.boss.rankHp)) : rankHp(lv);
    this.maxHp[i] = Math.round(def.hp * pw * T.hp * D.enemyHp * hpM * rk);
    this.hp[i] = this.maxHp[i];
    this.dmg[i] = def.damage * pw * T.dmg * D.enemyDamage * dmgM;
    this.xpv[i] = Math.round(def.xp * pw * T.xp * Math.sqrt(rk) * xpM);
    this.scale[i] = def.scale * T.scale;
    if (this.kid[i]) {
      const S = TR.split;
      this.maxHp[i] = Math.max(1, Math.round(this.maxHp[i] * S.hp));
      this.hp[i] = this.maxHp[i];
      this.dmg[i] *= S.damage;
      this.xpv[i] = Math.max(1, Math.round(this.xpv[i] * S.xp));
      this.scale[i] *= S.scale;
    }
    this.radius[i] = def.radius * this.scale[i];
    this.state[i] = ST_IDLE;
    this.timer[i] = Math.random() * 3;
    this.atkCd[i] = def.boss ? 1 : 0;
    this.flash[i] = 0;
    this.lunge[i] = 0;
    this.deathT[i] = 0;
    this.tgt[i] = -1;
    this.stun[i] = 0;
    this.vuln[i] = 0;
    this.buff[i] = 0;
    this.atkN[i] = 0;
    this.revived[i] = 0;
    const tr = def.trait && TR[def.trait];
    this.tt[i] = tr ? (tr.every || tr.cooldown || 0) * (0.3 + Math.random() * 0.7) : 0;
    this.retT[i] = Math.random() * 0.5;
    this.alive[i] = 1;
  }

  // The difficulty changed: every enemy gets the new health and damage.
  rescale(hpR, dmgR) {
    for (let i = 0; i < this.count; i++) {
      this.maxHp[i] = Math.round(this.maxHp[i] * hpR);
      this.hp[i] = Math.min(this.maxHp[i], this.hp[i] * hpR);
      this.dmg[i] *= dmgR;
    }
  }

  // After an outpost is taken its guards come back further out.
  freeOutpost(si) {
    const p = this.outpostPack[si];
    if (p === undefined) return;
    const x = this.packX[p], z = this.packZ[p], d = Math.hypot(x, z) || 1;
    this.packX[p] = x + (x / d) * 30;
    this.packZ[p] = z + (z / d) * 30;
  }

  // living enemies within r of (x, z) among the simulated ones
  countNear(x, z, r) {
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const i = this.active[k];
      if (!this.alive[i]) continue;
      const dx = this.x[i] - x, dz = this.z[i] - z;
      if (dx * dx + dz * dz < r * r) n++;
    }
    return n;
  }

  // removes an arena enemy without a soul or loot
  vanish(i) {
    this.alive[i] = 0;
    this.deathT[i] = 0;
    this.respawnT[i] = Infinity;
  }

  calmAll() {
    for (let p = 0; p < this.packCount; p++) this.packAggro[p] = 0;
  }

  // ---- queries ------------------------------------------------------------
  nearest(x, z, maxDist) {
    let best = -1, bd = maxDist * maxDist;
    for (let k = 0; k < this.activeCount; k++) {
      const i = this.active[k];
      if (!this.alive[i]) continue;
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const reach = maxDist + this.radius[i];
      const d2 = dx * dx + dz * dz;
      if (d2 < reach * reach && (best < 0 || d2 < bd)) { bd = d2; best = i; }
    }
    return best;
  }

  // nearest living enemy to (x, z) that is within `range` of the anchor point
  nearestAround(x, z, ax, az, range) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < this.activeCount; k++) {
      const i = this.active[k];
      if (!this.alive[i]) continue;
      const hx = this.x[i] - ax, hz = this.z[i] - az;
      const reach = range + this.radius[i];
      if (hx * hx + hz * hz > reach * reach) continue;
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    return best;
  }

  // Drags every enemy in the circle towards its centre (k = 0..1 of the way).
  // Bosses are too heavy to be pulled.
  pull(x, z, radius, k) {
    for (let n = 0; n < this.activeCount; n++) {
      const i = this.active[n];
      if (!this.alive[i] || this.tier[i] === 3) continue;
      const dx = x - this.x[i], dz = z - this.z[i];
      if (dx * dx + dz * dz > radius * radius) continue;
      this.x[i] += dx * k;
      this.z[i] += dz * k;
    }
  }

  // Shadow ability "taunt": enemies in the circle attack that shadow.
  taunt(x, z, radius, slot, duration) {
    for (let n = 0; n < this.activeCount; n++) {
      const i = this.active[n];
      if (!this.alive[i]) continue;
      const dx = x - this.x[i], dz = z - this.z[i];
      if (dx * dx + dz * dz > radius * radius) continue;
      this.tgt[i] = slot;
      this.retT[i] = duration;
      this.packAggro[this.pack[i]] = 1;
    }
  }

  // bosses shake off stuns faster
  applyStun(i, s) {
    if (this.tier[i] === 3) s *= CONFIG.boss.stunResist;
    if (s > this.stun[i]) this.stun[i] = s;
  }

  // Hunter's Mark: enemies in the circle take more damage for a while
  markArea(x, z, radius, duration) {
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const i = this.active[k];
      if (!this.alive[i]) continue;
      const dx = this.x[i] - x, dz = this.z[i] - z, r = radius + this.radius[i];
      if (dx * dx + dz * dz > r * r) continue;
      this.vuln[i] = duration;
      this.packAggro[this.pack[i]] = 1;
      n++;
    }
    return n;
  }

  // src: -1 = the player, otherwise the slot of the shadow that dealt the hit
  damage(i, amount, kx, kz, src = -1, crit = false) {
    if (!this.alive[i]) return;
    const fx = this.game.effects;
    if (this.vuln[i] > 0) amount = Math.round(amount * (1 + CONFIG.skills.huntersMark.vuln));
    // a monster mastered in the bestiary takes a little more
    const bm = this.game.bestiary ? this.game.bestiary.mult[this.type[i]] : 1;
    if (bm !== 1) amount = Math.round(amount * bm);
    // shield: hits from the front are blocked, unless it is attacking right now
    let blocked = false;
    const st = this.state[i];
    if (this.types[this.type[i]].trait === 'shield' && st !== ST_WINDUP && st !== ST_CHARGE && this.stun[i] <= 0) {
      const kl = Math.hypot(kx, kz);
      if (kl > 0.01 && -(Math.sin(this.yaw[i]) * kx + Math.cos(this.yaw[i]) * kz) / kl > TR.shield.front) {
        amount = Math.max(1, Math.round(amount * TR.shield.taken));
        blocked = true;
        fx.sparks(this.x[i] - kx / kl * this.radius[i], 1.2 * this.scale[i], this.z[i] - kz / kl * this.radius[i], 6, 0xcfe8ff, 4, 0.25, 0.3, 1);
        if (src < 0) play('block');
      }
    }
    // an exhausted boss takes more damage
    if (this.tier[i] === 3 && this.arena[i] && this.game.gates.b.tired > 0) {
      amount = Math.round(amount * (1 + CONFIG.boss.tired.damage));
      crit = true;
    }
    this.hp[i] -= amount;
    this.flash[i] = 0.12;
    this.packAggro[this.pack[i]] = 1;
    if (this.state[i] === ST_RETURN || this.state[i] === ST_IDLE) this.state[i] = ST_CHASE;
    // heavy enemies are pushed less
    const kb = (CONFIG.combat.knockback * (src < 0 ? 1 : 0.25)) / (this.tier[i] === 3 ? 8 : 1 + this.tier[i]);
    this.x[i] += kx * kb;
    this.z[i] += kz * kb;
    if (src < 0) {
      fx.number(this.x[i], 2.2 * this.scale[i], this.z[i], fmt(amount), blocked ? 'block' : crit ? 'crit' : undefined);
      fx.burst(this.x[i], 1, this.z[i], 4, 0xe8dcff, 5, 0.14, 0.3);
    } else {
      fx.burst(this.x[i], 1, this.z[i], 2, 0xb48cff, 4, 0.12, 0.25);
    }
    if (this.hp[i] <= 0) this.kill(i, src);
  }

  kill(i, src = -1) {
    this.alive[i] = 0;
    this.deathT[i] = DEATH_TIME;
    this.respawnT[i] = this.arena[i] || this.kid[i] ? Infinity : CONFIG.sim.respawnTime;
    this.diedAt[i] = this.clock;
    const fx = this.game.effects, x = this.x[i], z = this.z[i], t = this.tier[i];
    if (this.types[this.type[i]].trait === 'split' && !this.kid[i] && t < 3) this.split(i);
    fx.burst(x, 0.9, z, 14 + t * 10, 0x6a4dbf, 5, 0.24, 0.6);
    fx.flare(x, 1, z, 2.4 + t * 1.4, 0xb48cff, 0.34, 1.8);
    fx.flare(x, 1, z, 1.2 + t * 0.6, 0xffffff, 0.16, 1.5);
    fx.sparks(x, 0.8, z, 8 + t * 10, 0x9a6bff, 3.5 + t, 0.45, 1, 2.6);
    fx.ring(x, z, 0.3, 2 + t * 1.2, 0x8a4dff, 0.35);
    if (t >= 1 || src < 0) fx.light(x, 1.6, z, 0x9a6bff, 30 + t * 40, 7 + t * 3, 0.35 + t * 0.1);
    this.game.onEnemyKilled(i, src);
  }

  // split: smaller copies jump out of the dying enemy
  split(i) {
    const S = TR.split, kids = [];
    if (this.arena[i]) {
      const pool = this.arenaAdds[this.arena[i] - 1];
      for (const a of pool) if (a !== i && !this.alive[a] && this.deathT[a] <= 0 && kids.length < S.count) kids.push(a);
    } else if (this.kidOf[i] >= 0) {
      for (let k = 0; k < S.count; k++) if (!this.alive[this.kidOf[i] + k]) kids.push(this.kidOf[i] + k);
    }
    kids.forEach((k, n) => {
      const a = (n / kids.length) * Math.PI * 2 + Math.random();
      this.type[k] = this.type[i];
      this.zone[k] = this.zone[i];
      this.tier[k] = 0;
      this.kid[k] = 1;
      this.place(k, this.x[i] + Math.cos(a) * 1.3, this.z[i] + Math.sin(a) * 1.3);
      this.packAggro[this.pack[k]] = 1;
      this.state[k] = ST_CHASE;
      this.atkCd[k] = 0.8;
      this.game.effects.sparks(this.x[k], 1, this.z[k], 8, 0xd080ff, 5, 0.3, 0.5, 2);
    });
  }

  // attack damage: rally makes it stronger, hunters hit shadows harder
  atk(i, tg) {
    let d = this.dmg[i];
    if (this.buff[i] > 0) d *= 1 + TR.rally.damage;
    if (tg >= 0 && this.types[this.type[i]].trait === 'hunter') d *= TR.hunter.damage;
    return d;
  }

  // ---- traits that act on their own (while the enemy fights) ----------------
  // healer, rally and necro work on a timer; blink and the tips live in update
  traitTick(i, trait, dt) {
    this.tt[i] -= dt;
    if (this.tt[i] > 0) return;
    const game = this.game, fx = game.effects, x = this.x[i], z = this.z[i];
    const P = game.player, near = (P.x - x) ** 2 + (P.z - z) ** 2 < 400;
    if (trait === 'healer') {
      const H = TR.healer, r2 = H.radius * H.radius;
      let n = 0;
      for (let k = 0; k < this.activeCount; k++) {
        const j = this.active[k];
        if (!this.alive[j] || this.tier[j] === 3 || this.hp[j] >= this.maxHp[j]) continue;
        if ((this.x[j] - x) ** 2 + (this.z[j] - z) ** 2 > r2) continue;
        this.hp[j] = Math.min(this.maxHp[j], this.hp[j] + this.maxHp[j] * H.heal);
        fx.burst(this.x[j], 1.2, this.z[j], 5, 0x70ff90, 3, 0.18, 0.5);
        n++;
      }
      this.tt[i] = n ? H.every : 1;
      if (n) {
        fx.ring(x, z, 0.5, H.radius, 0x70ff90, 0.5);
        if (near) play('enemyHeal');
      }
    } else if (trait === 'rally') {
      const R = TR.rally, r2 = R.radius * R.radius;
      this.tt[i] = R.every;
      for (let k = 0; k < this.activeCount; k++) {
        const j = this.active[k];
        if (j === i || !this.alive[j] || this.tier[j] === 3) continue;
        if ((this.x[j] - x) ** 2 + (this.z[j] - z) ** 2 > r2) continue;
        this.buff[j] = R.time;
        fx.burst(this.x[j], 1.4, this.z[j], 4, 0xffc030, 3, 0.18, 0.4);
      }
      fx.ring(x, z, 0.5, R.radius, 0xffc030, 0.5);
      if (near) play('rally');
    } else if (trait === 'necro') {
      const N = TR.necro, r2 = N.radius * N.radius;
      this.tt[i] = N.every;
      let n = 0;
      for (let j = 0; j < this.count && n < N.max; j++) {
        if (this.alive[j] || this.deathT[j] > 0 || this.pack[j] !== this.pack[i] || this.revived[j] || this.tier[j] === 3) continue;
        if (this.arena[j] !== this.arena[i] || this.clock - this.diedAt[j] > N.within || this.diedAt[j] <= 0) continue;
        if ((this.x[j] - x) ** 2 + (this.z[j] - z) ** 2 > r2) continue;
        this.place(j, this.x[j], this.z[j]);
        this.hp[j] = Math.round(this.maxHp[j] * N.hp);
        this.revived[j] = 1;
        this.packAggro[this.pack[j]] = 1;
        this.state[j] = ST_CHASE;
        fx.burst(this.x[j], 0.4, this.z[j], 14, 0x80ff90, 4, 0.22, 0.7);
        fx.ring(this.x[j], this.z[j], 0.3, 2.4, 0x80ff90, 0.5);
        n++;
      }
      if (n) {
        fx.flare(x, 1.6, z, 3, 0x80ff90, 0.4, 1.6);
        if (near) play('revive');
      } else this.tt[i] = 1.5;
    }
  }

  // blink: appear behind the target and strike. True when it blinked.
  blink(i, tg, dx, dz, dist) {
    const B = TR.blink, game = this.game;
    if (this.tt[i] > 0 || dist < B.minDist) return false;
    let bx, bz;
    if (tg < 0) {
      const P = game.player;
      bx = P.x - P.dirX * B.behind;
      bz = P.z - P.dirZ * B.behind;
    } else {
      const u = game.army.units[tg];
      bx = u.x + (dx / dist) * B.behind;
      bz = u.z + (dz / dist) * B.behind;
    }
    const fx = game.effects;
    fx.burst(this.x[i], 1, this.z[i], 14, 0xb070ff, 5, 0.24, 0.5);
    fx.flare(this.x[i], 1, this.z[i], 2.4, 0xb070ff, 0.25, 1.8);
    this.x[i] = bx;
    this.z[i] = bz;
    fx.burst(bx, 1, bz, 14, 0xb070ff, 5, 0.24, 0.5);
    fx.ring(bx, bz, 2.4, 0.3, 0xb070ff, 0.3);
    this.tt[i] = B.cooldown;
    play('blink');
    return true;
  }

  // hits whatever the enemy is attacking (tg = shadow slot or -1 = player)
  hitTarget(tg, amount) {
    if (tg >= 0) this.game.army.damage(tg, amount);
    else this.game.player.damage(amount);
  }

  // ---- simulation ---------------------------------------------------------
  update(dt) {
    const game = this.game, P = game.player, world = game.world, S = CONFIG.sim, E = CONFIG.enemies;
    const gates = game.gates;
    const px = P.x, pz = P.z;
    const army = game.army;
    const playerOk = !P.dead && !P.inCamp;
    const activeR2 = S.activeRadius * S.activeRadius;
    const renderR2 = gfx.renderRadius * gfx.renderRadius;
    const leash2 = E.leash * E.leash;
    const respawnD2 = S.respawnMinPlayerDist * S.respawnMinPlayerDist;
    let nAct = 0;
    this.clock += dt;
    for (let t = 0; t < this.types.length; t++) this.types[t].n = 0;
    this.nMarks = 0;

    for (let i = 0; i < this.count; i++) {
      if (!this.alive[i]) {
        if (this.deathT[i] > 0) {
          this.deathT[i] -= dt;
          if (this.deathT[i] > 0) this.draw(i, this.deathT[i] / DEATH_TIME, 3);
        }
        this.respawnT[i] -= dt;
        if (this.respawnT[i] <= 0) {
          const p = this.pack[i];
          const dx = this.packX[p] - px, dz = this.packZ[p] - pz;
          if (dx * dx + dz * dz > respawnD2) this.place(i);
          else this.respawnT[i] = 2;
        }
        continue;
      }
      const pdx = px - this.x[i], pdz = pz - this.z[i];
      const pd2 = pdx * pdx + pdz * pdz;
      if (pd2 > activeR2) continue;
      this.active[nAct++] = i;

      const ty = this.types[this.type[i]];
      const def = ty.def;
      const p = this.pack[i];
      if (this.atkCd[i] > 0) this.atkCd[i] -= dt;
      if (this.flash[i] > 0) this.flash[i] -= dt;
      if (this.lunge[i] > 0) this.lunge[i] -= dt * 5;
      if (this.buff[i] > 0) this.buff[i] -= dt;
      let st = this.state[i];
      const trait = ty.trait;
      let mvx = 0, mvz = 0, speed = 0;

      // ---- target: the player or the most threatening shadow nearby
      let tg = this.tgt[i];
      if (tg >= 0 && !army.targetable(army.units[tg])) tg = -1;
      this.retT[i] -= dt;
      if (this.retT[i] <= 0 && st !== ST_WINDUP && st !== ST_CHARGE) {
        this.retT[i] = 0.35 + Math.random() * 0.25;
        const s = army.pickTarget(this.x[i], this.z[i], E.targetRange);
        // hunters always go for a shadow when one is near
        tg = s >= 0 && (trait === 'hunter' || !playerOk || army.pickW < pd2) ? s : -1;
      }
      this.tgt[i] = tg;
      let dx = pdx, dz = pdz, tr = P.radius, targetable = playerOk;
      // (dx, dz may change below when a blink moves the enemy)
      if (tg >= 0) {
        const u = army.units[tg];
        dx = u.x - this.x[i];
        dz = u.z - this.z[i];
        tr = u.radius;
        targetable = true;
      }
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (this.vuln[i] > 0) {
        this.vuln[i] -= dt;
        // a red sign above marked enemies
        if (Math.random() < dt * 5) game.effects.burst(this.x[i], 2.4 * this.scale[i], this.z[i], 1, 0xff4060, 0.6, 0.2, 0.5);
      }
      if (this.stun[i] > 0) {
        this.stun[i] -= dt;
        if (st === ST_WINDUP || st === ST_CHARGE) this.state[i] = ST_CHASE;
        this.moving[i] = 0;
        continue;
      }

      if (ty.beh === B_BOSS) {
        // the gate decides what its boss does
        gates.think(i, dt, dx, dz, dist, tg, targetable);
        mvx = this.mvx; mvz = this.mvz; speed = this.mvs;
        st = this.state[i];
      } else {
        if (st === ST_IDLE) {
          if (targetable && dist < def.aggroRange) this.packAggro[p] = 1;
          if (this.packAggro[p] && targetable) {
            st = ST_CHASE;
          } else {
            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              const a = Math.random() * 6.28, r = Math.random() * E.roamRadius;
              this.tx[i] = this.packX[p] + Math.cos(a) * r;
              this.tz[i] = this.packZ[p] + Math.sin(a) * r;
              this.timer[i] = 2 + Math.random() * 4;
            }
            mvx = this.tx[i] - this.x[i];
            mvz = this.tz[i] - this.z[i];
            speed = mvx * mvx + mvz * mvz > 0.3 ? def.speed * 0.35 : 0;
          }
        }
        if (trait && st === ST_CHASE && targetable) {
          if (trait === 'healer' || trait === 'rally' || trait === 'necro') this.traitTick(i, trait, dt);
          else if (trait === 'blink') {
            if (this.tt[i] > 0) this.tt[i] -= dt;
            else if (dist < def.chargeRange * 1.6 && this.blink(i, tg, dx, dz, dist)) {
              st = ST_WINDUP;
              this.timer[i] = def.attackWindup + 0.15;
              dx = (tg < 0 ? px : army.units[tg].x) - this.x[i];
              dz = (tg < 0 ? pz : army.units[tg].z) - this.z[i];
              this.yaw[i] = Math.atan2(dx, dz);
            }
          }
          // the first time you meet a trait: a short tip
          if (!ty.tipped && pd2 < 400 && game.tips) { ty.tipped = true; game.tips.show('trait.' + trait); }
        }
        if (st === ST_CHASE) {
          const ax = this.x[i] - this.packX[p], az = this.z[i] - this.packZ[p];
          if (!targetable || ax * ax + az * az > leash2) this.packAggro[p] = 0;
          if (!this.packAggro[p]) {
            st = ST_RETURN;
          } else if (ty.beh === B_RANGED) {
            // keep a distance, shoot when in range
            if (dist > def.attackRange * 0.9) { mvx = dx; mvz = dz; speed = def.speed; }
            else if (dist < def.attackRange * 0.45) { mvx = -dx; mvz = -dz; speed = def.speed * 0.8; }
            else if (dist > 0.01) this.yaw[i] = Math.atan2(dx, dz);
            if (dist <= def.attackRange && this.atkCd[i] <= 0) {
              st = ST_WINDUP;
              this.timer[i] = def.attackWindup;
            }
          } else {
            const reach = def.attackRange + tr;
            if (ty.beh === B_CHARGER && this.atkCd[i] <= 0 && dist < def.chargeRange && dist > reach * 0.7) {
              st = ST_WINDUP; // rams after the telegraph
              this.timer[i] = def.attackWindup;
              this.yaw[i] = Math.atan2(dx, dz);
            } else {
              if (dist > reach * 0.85) { mvx = dx; mvz = dz; speed = def.speed; }
              else if (dist > 0.01) this.yaw[i] = Math.atan2(dx, dz);
              if (dist <= reach && this.atkCd[i] <= 0) {
                st = ST_WINDUP;
                this.timer[i] = ty.beh === B_CHARGER ? 0.35 : def.attackWindup;
                this.yaw[i] = Math.atan2(dx, dz);
              }
            }
          }
        } else if (st === ST_WINDUP) {
          this.timer[i] -= dt;
          if (dist > 0.01) this.yaw[i] = Math.atan2(dx, dz);
          if (this.timer[i] <= 0) {
            const reach = def.attackRange + tr;
            this.lunge[i] = 1;
            this.atkCd[i] = def.attackCooldown * (0.85 + Math.random() * 0.3);
            this.atkN[i]++;
            if (ty.beh === B_RANGED) {
              if (trait === 'artillery' && this.atkN[i] % TR.artillery.every === 0 && targetable) {
                // a strike from above where the target stands
                const A = TR.artillery, tx = this.x[i] + dx, tz = this.z[i] + dz;
                if (this.arena[i]) { gates.clamp(tx, tz, 0); game.hazards.add(gates.cx, gates.cz, A.radius, A.delay, this.atk(i, tg) * A.damage, def.shotColor); }
                else game.hazards.add(tx, tz, A.radius, A.delay, this.atk(i, tg) * A.damage, def.shotColor);
                game.effects.flare(this.x[i], 2, this.z[i], 2.2, def.shotColor, 0.3, 1.8);
              } else if (targetable && dist > 0.01) {
                game.shots.fire(this.x[i], this.z[i], dx / dist, dz / dist, def.shotSpeed, this.atk(i, tg), def.shotColor, def.attackRange * 1.5, 0.35, trait === 'chill' ? 1 : 0);
              }
              st = ST_CHASE;
            } else if (ty.beh === B_CHARGER && dist > reach + 0.5 && dist > 0.01) {
              st = ST_CHARGE;
              this.cdx[i] = dx / dist;
              this.cdz[i] = dz / dist;
              this.timer[i] = def.chargeTime;
              this.hitDone[i] = 0;
            } else {
              if (targetable && dist <= reach + 0.9) this.hitTarget(tg, this.atk(i, tg));
              st = ST_CHASE;
            }
          }
        } else if (st === ST_CHARGE) {
          this.timer[i] -= dt;
          mvx = this.cdx[i]; mvz = this.cdz[i]; speed = def.chargeSpeed;
          if (!this.hitDone[i] && targetable && dist < this.radius[i] + tr + 0.4) {
            this.hitDone[i] = 1;
            this.hitTarget(tg, this.atk(i, tg) * 1.4);
            this.timer[i] = Math.min(this.timer[i], 0.08);
          }
          if (this.timer[i] <= 0) st = ST_CHASE;
        }
        if (st === ST_RETURN) {
          mvx = this.packX[p] - this.x[i];
          mvz = this.packZ[p] - this.z[i];
          speed = def.speed * 1.3;
          if (this.hp[i] < this.maxHp[i]) this.hp[i] = Math.min(this.maxHp[i], this.hp[i] + this.maxHp[i] * 0.5 * dt);
          if (mvx * mvx + mvz * mvz < 16) { st = ST_IDLE; this.timer[i] = 0; }
        }
      }
      this.state[i] = st;
      if (this.buff[i] > 0) speed *= 1 + TR.rally.speed;
      // Swift: faster enemies in gates and the Abyss
      if (speed > 0 && this.arena[i]) {
        const sw = game.modOn('swift');
        if (sw) speed *= sw.speed;
      }

      this.moving[i] = 0;
      if (speed > 0) {
        const l = Math.sqrt(mvx * mvx + mvz * mvz);
        if (l > 0.001) {
          mvx /= l; mvz /= l;
          this.x[i] += mvx * speed * dt;
          this.z[i] += mvz * speed * dt;
          // turn smoothly (charges keep their direction)
          let diff = Math.atan2(mvx, mvz) - this.yaw[i];
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          this.yaw[i] += diff * Math.min(1, dt * (st === ST_CHARGE ? 30 : 10));
          this.phase[i] += dt * speed * 2.2;
          this.moving[i] = 1;
        }
      }
    }
    this.activeCount = nAct;

    // ---- keep enemies apart, out of obstacles and out of the camp
    const act = this.active;
    for (let a = 0; a < nAct; a++) {
      const i = act[a];
      for (let b = a + 1; b < nAct; b++) {
        const j = act[b];
        const dx = this.x[j] - this.x[i], dz = this.z[j] - this.z[i];
        const min = this.radius[i] + this.radius[j];
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-5) {
          // the bigger one is pushed less
          const d = Math.sqrt(d2), k = (min - d) / d;
          const wi = this.radius[j] / min;
          this.x[i] -= dx * k * wi; this.z[i] -= dz * k * wi;
          this.x[j] += dx * k * (1 - wi); this.z[j] += dz * k * (1 - wi);
        }
      }
      let x, z;
      if (this.arena[i]) {
        gates.clamp(this.x[i], this.z[i], this.radius[i]);
        x = gates.cx; z = gates.cz;
      } else {
        world.resolve(this.x[i], this.z[i], this.radius[i]);
        world.pushOutOfSafe(world.rx, world.rz, this.radius[i]);
        x = world.rx; z = world.rz;
      }
      this.x[i] = x;
      this.z[i] = z;

      // ---- draw
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < renderR2 || this.tier[i] === 3) {
        const st = this.state[i];
        const tier = this.tier[i];
        const tired = tier === 3 && gates.b.tired > 0;
        this.draw(i, 1, this.flash[i] > 0 ? 1 : st === ST_WINDUP ? 2 : st === ST_CHARGE ? 4 : tired ? 6 : this.buff[i] > 0 ? 5 : 0);
        game.effects.blob(x, z, this.radius[i] * 1.1);
        if (tier > 0) this.mark(i);
        if (tier < 3 && this.hp[i] < this.maxHp[i]) {
          game.effects.bar(x, 2.1 * this.scale[i], z, this.hp[i] / this.maxHp[i], BAR_WIDTH[tier]);
        }
      }
    }

    for (let t = 0; t < this.types.length; t++) {
      const ty = this.types[t];
      ty.mesh.count = ty.n;
      ty.mesh.visible = ty.n > 0;
      if (ty.n > 0) {
        ty.mesh.instanceMatrix.needsUpdate = true;
        ty.mesh.instanceColor.needsUpdate = true;
      }
    }
    this.marks.count = this.nMarks;
    this.marks.instanceMatrix.needsUpdate = true;
    this.marks.instanceColor.needsUpdate = true;
  }

  mark(i) {
    if (this.nMarks >= MAX_MARKERS) return;
    const n = this.nMarks++;
    const a = this.marks.instanceMatrix.array, c = this.marks.instanceColor.array;
    const s = this.radius[i] * 1.35;
    const o = n * 16;
    a[o] = s; a[o + 10] = s;
    a[o + 12] = this.x[i]; a[o + 13] = 0.07; a[o + 14] = this.z[i];
    _c.setHex(MARK_COLORS[this.tier[i]]);
    c[n * 3] = _c.r; c[n * 3 + 1] = _c.g; c[n * 3 + 2] = _c.b;
  }

  // tint: 0 normal, 1 hit flash, 2 attack telegraph, 3 dying, 4 charging,
  // 5 rallied, 6 exhausted boss
  draw(i, scale, tint) {
    const ty = this.types[this.type[i]];
    if (ty.n >= MAX_VISIBLE) return;
    const n = ty.n++;
    const a = ty.mesh.instanceMatrix.array, c = ty.mesh.instanceColor.array;
    const s = this.scale[i] * scale;
    const yaw = this.yaw[i];
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    let sy = s, y = 0, off = 0;
    if (this.moving[i]) y = Math.abs(Math.sin(this.phase[i])) * 0.16;
    if (tint === 2) { sy = s * 0.85; off = -0.25; } // crouch before the attack
    let sx = s;
    if (this.flash[i] > 0) { sy *= 0.84; sx *= 1.12; } // squashed by the hit
    if (this.lunge[i] > 0) off = this.lunge[i] * 0.7;
    const o = n * 16;
    a[o] = cos * sx; a[o + 1] = 0; a[o + 2] = -sin * sx;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0;
    a[o + 8] = sin * sx; a[o + 9] = 0; a[o + 10] = cos * sx;
    a[o + 12] = this.x[i] + sin * off; a[o + 13] = y; a[o + 14] = this.z[i] + cos * off;
    const k = n * 3;
    const tier = this.tier[i];
    if (tint === 1) { c[k] = 3; c[k + 1] = 3; c[k + 2] = 3; }
    else if (tint === 2 || tint === 4) { c[k] = 2.4; c[k + 1] = 0.7; c[k + 2] = 0.7; }
    else if (tint === 3) { c[k] = 0.5; c[k + 1] = 0.3; c[k + 2] = 1.2; }
    else if (tint === 5) { c[k] = 1.7; c[k + 1] = 1.35; c[k + 2] = 0.55; }
    else if (tint === 6) { c[k] = 0.75; c[k + 1] = 0.95; c[k + 2] = 1.9; }
    else if (tier === 1) { c[k] = 1.3; c[k + 1] = 1.15; c[k + 2] = 0.8; }
    else if (tier === 2) { c[k] = 1.35; c[k + 1] = 0.85; c[k + 2] = 0.85; }
    else { c[k] = 1; c[k + 1] = 1; c[k + 2] = 1; }
  }
}
