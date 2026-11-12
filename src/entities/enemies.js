// All enemies live in flat typed arrays (no objects, no garbage). Only enemies
// near the player are simulated and drawn; one InstancedMesh per enemy type.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32, hashSeed } from '../core/rng.js';
import { flatMaterial } from '../render/geo.js';
import { buildEnemyGeometry } from '../render/models/enemies.js';

const ST_IDLE = 0, ST_CHASE = 1, ST_WINDUP = 2, ST_RETURN = 3;
const MAX_VISIBLE = 128; // per type
const DEATH_TIME = 0.28;

export class Enemies {
  constructor(game) {
    this.game = game;
    const N = CONFIG.sim.maxEnemies;
    this.count = 0;
    this.alive = new Uint8Array(N);
    this.type = new Uint8Array(N);
    this.state = new Uint8Array(N);
    this.pack = new Uint16Array(N);
    this.x = new Float32Array(N);
    this.z = new Float32Array(N);
    this.yaw = new Float32Array(N);
    this.hp = new Float32Array(N);
    this.maxHp = new Float32Array(N);
    this.radius = new Float32Array(N);
    this.timer = new Float32Array(N);
    this.atkCd = new Float32Array(N);
    this.flash = new Float32Array(N);
    this.lunge = new Float32Array(N);
    this.phase = new Float32Array(N);
    this.moving = new Uint8Array(N);
    this.tx = new Float32Array(N); // roam target
    this.tz = new Float32Array(N);
    this.respawnT = new Float32Array(N);
    this.deathT = new Float32Array(N);

    this.active = new Uint16Array(N);
    this.activeCount = 0;

    // packs
    this.packCount = 0;
    this.packX = new Float32Array(256);
    this.packZ = new Float32Array(256);
    this.packAggro = new Uint8Array(256);

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
      const a = mesh.instanceMatrix.array;
      for (let i = 0; i < MAX_VISIBLE; i++) a[i * 16 + 15] = 1;
      game.scene.add(mesh);
      this.typeIndex[id] = this.types.length;
      this.types.push({ id, def, mesh, n: 0 });
    }

    this.spawnWorld();
  }

  // ---- world population ---------------------------------------------------
  spawnWorld() {
    const E = CONFIG.enemies;
    const rng = mulberry32(hashSeed(this.game.seed, 101, 202));
    for (const zone of CONFIG.world.zones) {
      let placed = 0, tries = 0;
      const first = this.packCount;
      while (placed < zone.packs && tries++ < zone.packs * 60 && this.packCount < 256) {
        // uniform by area inside the ring
        const rIn = zone.inner + 14, rOut = zone.outer - 8;
        const r = Math.sqrt(rIn * rIn + rng() * (rOut * rOut - rIn * rIn));
        const a = rng() * Math.PI * 2;
        const px = Math.cos(a) * r, pz = Math.sin(a) * r;
        let ok = true;
        for (let p = first; p < this.packCount; p++) {
          const dx = this.packX[p] - px, dz = this.packZ[p] - pz;
          if (dx * dx + dz * dz < E.packSpacing * E.packSpacing) { ok = false; break; }
        }
        if (!ok) continue;
        const p = this.packCount++;
        this.packX[p] = px;
        this.packZ[p] = pz;
        const typeId = zone.enemyTypes[(rng() * zone.enemyTypes.length) | 0];
        const size = E.packSize[0] + ((rng() * (E.packSize[1] - E.packSize[0] + 1)) | 0);
        for (let k = 0; k < size && this.count < CONFIG.sim.maxEnemies; k++) {
          const i = this.count++;
          this.type[i] = this.typeIndex[typeId];
          this.pack[i] = p;
          this.phase[i] = rng() * 6.28;
          this.place(i);
        }
        placed++;
      }
    }
  }

  // (re)spawns enemy i near its pack centre
  place(i) {
    const def = this.types[this.type[i]].def;
    const p = this.pack[i];
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 3.5;
    this.x[i] = this.packX[p] + Math.cos(a) * r;
    this.z[i] = this.packZ[p] + Math.sin(a) * r;
    this.tx[i] = this.x[i];
    this.tz[i] = this.z[i];
    this.yaw[i] = Math.random() * 6.28;
    this.maxHp[i] = def.hp;
    this.hp[i] = def.hp;
    this.radius[i] = def.radius * def.scale;
    this.state[i] = ST_IDLE;
    this.timer[i] = Math.random() * 3;
    this.atkCd[i] = 0;
    this.flash[i] = 0;
    this.lunge[i] = 0;
    this.deathT[i] = 0;
    this.alive[i] = 1;
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

  damage(i, amount, kx, kz) {
    if (!this.alive[i]) return;
    const fx = this.game.effects;
    this.hp[i] -= amount;
    this.flash[i] = 0.12;
    this.packAggro[this.pack[i]] = 1;
    if (this.state[i] === ST_RETURN || this.state[i] === ST_IDLE) this.state[i] = ST_CHASE;
    const kb = CONFIG.combat.knockback;
    this.x[i] += kx * kb;
    this.z[i] += kz * kb;
    fx.number(this.x[i], 2.2, this.z[i], String(amount));
    fx.burst(this.x[i], 1, this.z[i], 4, 0xe8dcff, 5, 0.14, 0.3);
    if (this.hp[i] <= 0) this.kill(i);
  }

  kill(i) {
    this.alive[i] = 0;
    this.deathT[i] = DEATH_TIME;
    this.respawnT[i] = CONFIG.sim.respawnTime;
    this.game.effects.burst(this.x[i], 0.9, this.z[i], 14, 0x6a4dbf, 5, 0.24, 0.6);
    this.game.onEnemyKilled(i);
  }

  // ---- simulation ---------------------------------------------------------
  update(dt) {
    const game = this.game, P = game.player, world = game.world, S = CONFIG.sim, E = CONFIG.enemies;
    const px = P.x, pz = P.z;
    const targetable = !P.dead && !P.inCamp;
    const activeR2 = S.activeRadius * S.activeRadius;
    const renderR2 = S.renderRadius * S.renderRadius;
    const campR = world.campRadius + 1.2;
    const leash2 = E.leash * E.leash;
    const respawnD2 = S.respawnMinPlayerDist * S.respawnMinPlayerDist;
    let nAct = 0;
    for (let t = 0; t < this.types.length; t++) this.types[t].n = 0;

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
      let dx = px - this.x[i], dz = pz - this.z[i];
      const d2 = dx * dx + dz * dz;
      if (d2 > activeR2) continue;
      this.active[nAct++] = i;

      const def = this.types[this.type[i]].def;
      const p = this.pack[i];
      const dist = Math.sqrt(d2);
      if (this.atkCd[i] > 0) this.atkCd[i] -= dt;
      if (this.flash[i] > 0) this.flash[i] -= dt;
      if (this.lunge[i] > 0) this.lunge[i] -= dt * 5;
      let st = this.state[i];
      let mvx = 0, mvz = 0, speed = 0;

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
        } else {
          const reach = def.attackRange + P.radius;
          if (dist > reach * 0.85) { mvx = dx; mvz = dz; speed = def.speed; }
          else if (dist > 0.01) this.yaw[i] = Math.atan2(dx, dz);
          if (dist <= reach && this.atkCd[i] <= 0) {
            st = ST_WINDUP;
            this.timer[i] = def.attackWindup;
            this.yaw[i] = Math.atan2(dx, dz);
          }
        }
      } else if (st === ST_WINDUP) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) {
          this.lunge[i] = 1;
          this.atkCd[i] = def.attackCooldown * (0.85 + Math.random() * 0.3);
          if (dist <= def.attackRange + P.radius + 0.9) P.damage(def.damage);
          st = ST_CHASE;
        }
      }
      if (st === ST_RETURN) {
        mvx = this.packX[p] - this.x[i];
        mvz = this.packZ[p] - this.z[i];
        speed = def.speed * 1.3;
        if (this.hp[i] < this.maxHp[i]) this.hp[i] = Math.min(this.maxHp[i], this.hp[i] + this.maxHp[i] * 0.5 * dt);
        if (mvx * mvx + mvz * mvz < 16) { st = ST_IDLE; this.timer[i] = 0; }
      }
      this.state[i] = st;

      this.moving[i] = 0;
      if (speed > 0) {
        const l = Math.sqrt(mvx * mvx + mvz * mvz);
        if (l > 0.001) {
          mvx /= l; mvz /= l;
          this.x[i] += mvx * speed * dt;
          this.z[i] += mvz * speed * dt;
          // turn smoothly
          let diff = Math.atan2(mvx, mvz) - this.yaw[i];
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          this.yaw[i] += diff * Math.min(1, dt * 10);
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
          const d = Math.sqrt(d2), k = ((min - d) / d) * 0.5;
          this.x[i] -= dx * k; this.z[i] -= dz * k;
          this.x[j] += dx * k; this.z[j] += dz * k;
        }
      }
      world.resolve(this.x[i], this.z[i], this.radius[i]);
      let x = world.rx, z = world.rz;
      const r2 = x * x + z * z;
      if (r2 < campR * campR && r2 > 1e-4) { const k = campR / Math.sqrt(r2); x *= k; z *= k; }
      this.x[i] = x;
      this.z[i] = z;

      // ---- draw
      const dx = x - px, dz = z - pz;
      if (dx * dx + dz * dz < renderR2) {
        const st = this.state[i];
        this.draw(i, 1, this.flash[i] > 0 ? 1 : st === ST_WINDUP ? 2 : 0);
        game.effects.blob(x, z, this.radius[i] * 1.1);
        if (this.hp[i] < this.maxHp[i]) game.effects.bar(x, 2.1, z, this.hp[i] / this.maxHp[i]);
      }
    }

    for (let t = 0; t < this.types.length; t++) {
      const ty = this.types[t];
      ty.mesh.count = ty.n;
      ty.mesh.instanceMatrix.needsUpdate = true;
      ty.mesh.instanceColor.needsUpdate = true;
    }
  }

  // tint: 0 normal, 1 hit flash, 2 attack telegraph, 3 dying
  draw(i, scale, tint) {
    const ty = this.types[this.type[i]];
    if (ty.n >= MAX_VISIBLE) return;
    const n = ty.n++;
    const a = ty.mesh.instanceMatrix.array, c = ty.mesh.instanceColor.array;
    const s = ty.def.scale * scale;
    const yaw = this.yaw[i];
    const sin = Math.sin(yaw), cos = Math.cos(yaw);
    let sy = s, y = 0, off = 0;
    if (this.moving[i]) y = Math.abs(Math.sin(this.phase[i])) * 0.16;
    if (tint === 2) { sy = s * 0.85; off = -0.25; } // crouch before the bite
    if (this.lunge[i] > 0) off = this.lunge[i] * 0.7;
    const o = n * 16;
    a[o] = cos * s; a[o + 1] = 0; a[o + 2] = -sin * s;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0;
    a[o + 8] = sin * s; a[o + 9] = 0; a[o + 10] = cos * s;
    a[o + 12] = this.x[i] + sin * off; a[o + 13] = y; a[o + 14] = this.z[i] + cos * off;
    const k = n * 3;
    if (tint === 1) { c[k] = 3; c[k + 1] = 3; c[k + 2] = 3; }
    else if (tint === 2) { c[k] = 2.4; c[k + 1] = 0.7; c[k + 2] = 0.7; }
    else if (tint === 3) { c[k] = 0.5; c[k + 1] = 0.3; c[k + 2] = 1.2; }
    else { c[k] = 1; c[k + 1] = 1; c[k + 2] = 1; }
  }
}
