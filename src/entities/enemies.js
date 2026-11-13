// All enemies live in flat typed arrays (no objects, no garbage). Only enemies
// near the player are simulated and drawn; one InstancedMesh per enemy type.
// Every enemy has a tier (0 normal, 1 elite, 2 champion, 3 boss) and the zone
// it belongs to, which scale its stats. Gate bosses and their summoned helpers
// use reserved slots that only come alive inside their arena.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { gfx } from '../core/settings.js';
import { mulberry32, hashSeed } from '../core/rng.js';
import { flatMaterial } from '../render/geo.js';
import { buildEnemyGeometry } from '../render/models/enemies.js';
import { arenaCenter } from '../world/gates.js';

export const ST_IDLE = 0, ST_CHASE = 1, ST_WINDUP = 2, ST_RETURN = 3, ST_CHARGE = 4;
const B_MELEE = 0, B_RANGED = 1, B_CHARGER = 2, B_BOSS = 3;
const BEHAVIOR = { melee: B_MELEE, ranged: B_RANGED, charger: B_CHARGER, boss: B_BOSS };
const MAX_VISIBLE = 128; // per type
const MAX_MARKERS = 96;
const DEATH_TIME = 0.28;
const MARK_COLORS = [0, 0xffc030, 0xff4050, 0xff2060];
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
      this.types.push({ id, def, mesh, n: 0, beh: BEHAVIOR[def.behavior] || 0 });
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
        if (world.nearGate(px, pz, 30)) continue;
        let ok = true;
        for (let p = first; p < this.packCount; p++) {
          const dx = this.packX[p] - px, dz = this.packZ[p] - pz;
          if (dx * dx + dz * dz < E.packSpacing * E.packSpacing) { ok = false; break; }
        }
        if (!ok) continue;
        const p = this.newPack(px, pz);
        const typeId = zone.enemyTypes[(rng() * zone.enemyTypes.length) | 0];
        if (placed < zone.champions) {
          // a champion with two escorts
          for (let k = 0; k < 3; k++) {
            const i = this.newEnemy(typeId, p, k === 0 ? 2 : 0, zi, rng);
            if (i >= 0) this.place(i);
          }
        } else {
          const size = E.packSize[0] + ((rng() * (E.packSize[1] - E.packSize[0] + 1)) | 0);
          const elite = rng() < E.eliteChance;
          for (let k = 0; k < size; k++) {
            const i = this.newEnemy(typeId, p, elite && k === 0 ? 1 : 0, zi, rng);
            if (i >= 0) this.place(i);
          }
        }
        placed++;
      }
    });

    // reserved slots for the gate bosses and their helpers (asleep until used)
    const maxAdds = CONFIG.bossPatterns.summon.maxAdds;
    world.gates.forEach((g, gi) => {
      const zone = CONFIG.world.zones[gi];
      const c = arenaCenter(gi);
      const p = this.newPack(c.x, c.z);
      const b = this.newEnemy(zone.boss, p, 3, gi, rng);
      this.arena[b] = gi + 1;
      this.alive[b] = 0;
      this.respawnT[b] = Infinity;
      this.arenaBoss.push(b);
      const adds = [];
      const addType = CONFIG.enemies.types[zone.boss].adds;
      for (let k = 0; k < maxAdds; k++) {
        const i = this.newEnemy(addType, p, 0, gi, rng);
        if (i < 0) break;
        this.arena[i] = gi + 1;
        this.alive[i] = 0;
        this.respawnT[i] = Infinity;
        adds.push(i);
      }
      this.arenaAdds.push(adds);
    });
  }

  // (re)spawns enemy i near its pack centre, or at (x, z) when given
  place(i, x, z) {
    const def = this.types[this.type[i]].def;
    const tier = this.tier[i];
    const T = CONFIG.enemies.tiers[tier];
    const zone = CONFIG.world.zones[this.zone[i]];
    const zm = def.boss ? { hp: 1, dmg: 1, xp: 1 } : zone;
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
    this.maxHp[i] = Math.round(def.hp * zm.hp * T.hp);
    this.hp[i] = this.maxHp[i];
    this.dmg[i] = def.damage * zm.dmg * T.dmg;
    this.xpv[i] = Math.round(def.xp * zm.xp * (def.boss ? 1 : T.xp));
    this.scale[i] = def.scale * T.scale;
    this.radius[i] = def.radius * this.scale[i];
    this.state[i] = ST_IDLE;
    this.timer[i] = Math.random() * 3;
    this.atkCd[i] = def.boss ? 1 : 0;
    this.flash[i] = 0;
    this.lunge[i] = 0;
    this.deathT[i] = 0;
    this.tgt[i] = -1;
    this.stun[i] = 0;
    this.retT[i] = Math.random() * 0.5;
    this.alive[i] = 1;
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

  // src: -1 = the player, otherwise the slot of the shadow that dealt the hit
  damage(i, amount, kx, kz, src = -1, crit = false) {
    if (!this.alive[i]) return;
    const fx = this.game.effects;
    this.hp[i] -= amount;
    this.flash[i] = 0.12;
    this.packAggro[this.pack[i]] = 1;
    if (this.state[i] === ST_RETURN || this.state[i] === ST_IDLE) this.state[i] = ST_CHASE;
    // heavy enemies are pushed less
    const kb = (CONFIG.combat.knockback * (src < 0 ? 1 : 0.25)) / (this.tier[i] === 3 ? 8 : 1 + this.tier[i]);
    this.x[i] += kx * kb;
    this.z[i] += kz * kb;
    if (src < 0) {
      fx.number(this.x[i], 2.2 * this.scale[i], this.z[i], String(amount), crit ? 'crit' : undefined);
      fx.burst(this.x[i], 1, this.z[i], 4, 0xe8dcff, 5, 0.14, 0.3);
    } else {
      fx.burst(this.x[i], 1, this.z[i], 2, 0xb48cff, 4, 0.12, 0.25);
    }
    if (this.hp[i] <= 0) this.kill(i, src);
  }

  kill(i, src = -1) {
    this.alive[i] = 0;
    this.deathT[i] = DEATH_TIME;
    this.respawnT[i] = this.arena[i] ? Infinity : CONFIG.sim.respawnTime;
    this.game.effects.burst(this.x[i], 0.9, this.z[i], 14 + this.tier[i] * 10, 0x6a4dbf, 5, 0.24, 0.6);
    this.game.onEnemyKilled(i, src);
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
    const campR = world.campRadius + 1.2;
    const leash2 = E.leash * E.leash;
    const respawnD2 = S.respawnMinPlayerDist * S.respawnMinPlayerDist;
    let nAct = 0;
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
      let st = this.state[i];
      let mvx = 0, mvz = 0, speed = 0;

      // ---- target: the player or the most threatening shadow nearby
      let tg = this.tgt[i];
      if (tg >= 0 && !army.targetable(army.units[tg])) tg = -1;
      this.retT[i] -= dt;
      if (this.retT[i] <= 0 && st !== ST_WINDUP && st !== ST_CHARGE) {
        this.retT[i] = 0.35 + Math.random() * 0.25;
        const s = army.pickTarget(this.x[i], this.z[i], E.targetRange);
        tg = s >= 0 && (!playerOk || army.pickW < pd2) ? s : -1;
      }
      this.tgt[i] = tg;
      let dx = pdx, dz = pdz, tr = P.radius, targetable = playerOk;
      if (tg >= 0) {
        const u = army.units[tg];
        dx = u.x - this.x[i];
        dz = u.z - this.z[i];
        tr = u.radius;
        targetable = true;
      }
      const dist = Math.sqrt(dx * dx + dz * dz);

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
            if (ty.beh === B_RANGED) {
              if (targetable && dist > 0.01) {
                game.shots.fire(this.x[i], this.z[i], dx / dist, dz / dist, def.shotSpeed, this.dmg[i], def.shotColor, def.attackRange * 1.5, 0.35);
              }
              st = ST_CHASE;
            } else if (ty.beh === B_CHARGER && dist > reach + 0.5 && dist > 0.01) {
              st = ST_CHARGE;
              this.cdx[i] = dx / dist;
              this.cdz[i] = dz / dist;
              this.timer[i] = def.chargeTime;
              this.hitDone[i] = 0;
            } else {
              if (targetable && dist <= reach + 0.9) this.hitTarget(tg, this.dmg[i]);
              st = ST_CHASE;
            }
          }
        } else if (st === ST_CHARGE) {
          this.timer[i] -= dt;
          mvx = this.cdx[i]; mvz = this.cdz[i]; speed = def.chargeSpeed;
          if (!this.hitDone[i] && targetable && dist < this.radius[i] + tr + 0.4) {
            this.hitDone[i] = 1;
            this.hitTarget(tg, this.dmg[i] * 1.4);
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
        x = world.rx; z = world.rz;
        const r2 = x * x + z * z;
        if (r2 < campR * campR && r2 > 1e-4) { const k = campR / Math.sqrt(r2); x *= k; z *= k; }
      }
      this.x[i] = x;
      this.z[i] = z;

      // ---- draw
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < renderR2 || this.tier[i] === 3) {
        const st = this.state[i];
        const tier = this.tier[i];
        this.draw(i, 1, this.flash[i] > 0 ? 1 : st === ST_WINDUP ? 2 : st === ST_CHARGE ? 4 : 0);
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

  // tint: 0 normal, 1 hit flash, 2 attack telegraph, 3 dying, 4 charging
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
    if (this.lunge[i] > 0) off = this.lunge[i] * 0.7;
    const o = n * 16;
    a[o] = cos * s; a[o + 1] = 0; a[o + 2] = -sin * s;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0;
    a[o + 8] = sin * s; a[o + 9] = 0; a[o + 10] = cos * s;
    a[o + 12] = this.x[i] + sin * off; a[o + 13] = y; a[o + 14] = this.z[i] + cos * off;
    const k = n * 3;
    const tier = this.tier[i];
    if (tint === 1) { c[k] = 3; c[k + 1] = 3; c[k + 2] = 3; }
    else if (tint === 2 || tint === 4) { c[k] = 2.4; c[k + 1] = 0.7; c[k + 2] = 0.7; }
    else if (tint === 3) { c[k] = 0.5; c[k + 1] = 0.3; c[k + 2] = 1.2; }
    else if (tier === 1) { c[k] = 1.3; c[k + 1] = 1.15; c[k + 2] = 0.8; }
    else if (tier === 2) { c[k] = 1.35; c[k + 1] = 0.85; c[k + 2] = 0.85; }
    else { c[k] = 1; c[k + 1] = 1; c[k + 2] = 1; }
  }
}
