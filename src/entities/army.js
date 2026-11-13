// The shadow army. Every shadow is one plain object that lives as long as the
// shadow exists (created on Arise, so nothing is allocated per frame). Deployed
// shadows belong to squad 0-2 (A, B, C), the reserve is squad -1.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flatMaterial } from '../render/geo.js';
import { buildShadowGeometry } from '../render/models/enemies.js';
import { t } from '../strings.js';

export const BEHAVIORS = ['attack', 'guard', 'hold'];
const B_ATTACK = 0, B_HOLD = 2;
const MAX_UNITS = 128;
const MAX_VISIBLE = 64; // per type
const TAU = Math.PI * 2;
const _list = [];

export class Army {
  constructor(game) {
    this.game = game;
    const S = CONFIG.shadows;
    this.units = new Array(MAX_UNITS).fill(null);
    this.deployed = []; // rebuilt whenever the roster changes
    this.reserveCount = 0;
    this.version = 0; // goes up on every roster change (for the UI)
    this.pickW = 0;
    this.buffDamage = 0;
    this.buffT = 0;
    this.squads = [0, 1, 2].map((k) => ({
      behavior: Math.max(0, BEHAVIORS.indexOf(S.defaultBehaviors[k])),
      holdX: 0, holdZ: 0,
      total: 0, alive: 0, ready: 0, readyCost: 0, nextReady: 0,
    }));

    // aura tint, applied per instance on top of the near-black model
    const c = new THREE.Color(game.appearance.aura);
    const m = Math.max(c.r, c.g, c.b, 0.001);
    this.tr = 0.3 + (c.r / m) * 0.7;
    this.tg = 0.3 + (c.g / m) * 0.7;
    this.tb = 0.3 + (c.b / m) * 0.7;
    this.auraHex = game.appearance.aura;

    this.types = [];
    for (const et of game.enemies.types) {
      const mesh = new THREE.InstancedMesh(buildShadowGeometry(et.id), flatMaterial, MAX_VISIBLE);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_VISIBLE * 3).fill(1), 3);
      mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      const a = mesh.instanceMatrix.array;
      for (let i = 0; i < MAX_VISIBLE; i++) a[i * 16 + 15] = 1;
      game.scene.add(mesh);
      this.types.push({ id: et.id, def: et.def, mesh, n: 0 });
    }

    // ground rings that mark the position of squads set to "Hold"
    this.holdMarks = [];
    const ringGeo = new THREE.RingGeometry(1.5, 1.8, 28);
    ringGeo.rotateX(-Math.PI / 2);
    for (let k = 0; k < 3; k++) {
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.6, depthWrite: false }));
      ring.position.y = 0.06;
      ring.visible = false;
      game.scene.add(ring);
      this.holdMarks.push(ring);
    }
  }

  // ---- roster ---------------------------------------------------------------
  maxDeployed() {
    return CONFIG.shadows.baseSlots + CONFIG.shadows.slotsPerRank * this.game.rankIndex + this.game.player.armySlots;
  }

  totalCount() {
    return this.deployed.length + this.reserveCount;
  }

  hasRoom() {
    return this.deployed.length < this.maxDeployed() || this.reserveCount < CONFIG.shadows.reserveMax;
  }

  name(u) {
    return t('shadow.stage.' + u.stage, { name: t('enemy.' + u.type) });
  }

  recalc(u) {
    const S = CONFIG.shadows, role = S.roles[u.role];
    const def = CONFIG.enemies.types[u.type];
    const tier = S.tierFactor[u.tier] * (1 + u.stage * S.evolveBonus);
    u.maxHp = Math.round(def.hp * S.hpFactor * role.hp * tier * (1 + (u.level - 1) * S.hpPerLevel) * (1 + this.game.player.armyHp));
    u.dmg = def.damage * S.damageFactor * role.damage * tier * (1 + (u.level - 1) * S.damagePerLevel);
    u.scale = def.scale * S.scale * (1 + u.stage * S.evolveScale) * (1 + u.tier * 0.15);
    u.radius = def.radius * u.scale;
    u.speed = def.speed * S.combatSpeedFactor;
    if (u.hp > u.maxHp) u.hp = u.maxHp;
  }

  // called when the player's equipment changes (set bonuses for the army)
  recalcAll() {
    for (let i = 0; i < MAX_UNITS; i++) if (this.units[i]) this.recalc(this.units[i]);
  }

  // temporary damage bonus for every shadow (War Cry, Legion's Call)
  buff(damage, duration) {
    this.buffDamage = damage;
    this.buffT = duration;
  }

  // revives every fallen deployed shadow at once, free of charge
  reviveAll() {
    for (let i = 0; i < this.deployed.length; i++) {
      const u = this.deployed[i];
      if (u.alive) continue;
      u.alive = true;
      u.hp = u.maxHp;
      u.reviveT = 0;
      this.placeAtHome(u, true);
    }
    this.version++;
  }

  // Creates a shadow. Returns the unit, or null when there is no room at all.
  add(type, tier, x, z, role) {
    const S = CONFIG.shadows;
    let slot = -1;
    for (let i = 0; i < MAX_UNITS; i++) if (!this.units[i]) { slot = i; break; }
    if (slot < 0 || !this.hasRoom()) return null;
    let squad = -1;
    if (this.deployed.length < this.maxDeployed()) {
      // the squad with the fewest members
      const n = [0, 0, 0];
      for (let i = 0; i < this.deployed.length; i++) n[this.deployed[i].squad]++;
      squad = n[1] < n[0] ? (n[2] < n[1] ? 2 : 1) : n[2] < n[0] ? 2 : 0;
    }
    const u = {
      slot, type, ti: this.game.enemies.typeIndex[type],
      role: role || CONFIG.enemies.types[type].shadowRole,
      tier, level: 1, xp: 0, totalXp: 0, stage: 0, squad,
      alive: true, hp: 1, maxHp: 1, dmg: 1, radius: 0.7, scale: 1, speed: 5,
      x, z, yaw: Math.random() * TAU, ox: 0, oz: 0,
      target: -1, tgtT: Math.random() * 0.3, atkCd: 0, windup: 0,
      reviveT: 0, riseT: 1, flash: 0, lunge: 0, phase: Math.random() * TAU, moving: false,
    };
    this.recalc(u);
    u.hp = u.maxHp;
    this.units[slot] = u;
    this.rebuild();
    return u;
  }

  // Moves a shadow to squad 0-2 or to the reserve (-1). False if the army is full.
  move(slot, squad) {
    const u = this.units[slot];
    if (!u || u.squad === squad) return false;
    if (squad >= 0 && u.squad < 0 && this.deployed.length >= this.maxDeployed()) return false;
    if (squad < 0 && this.reserveCount >= CONFIG.shadows.reserveMax) return false;
    const wasReserve = u.squad < 0;
    u.squad = squad;
    u.target = -1;
    u.windup = 0;
    this.rebuild();
    if (squad >= 0 && wasReserve) this.placeAtHome(u, true);
    return true;
  }

  // Dismissing a shadow for good hands part of its XP to the player.
  dismiss(slot) {
    const u = this.units[slot];
    if (!u) return;
    this.units[slot] = null;
    this.rebuild();
    this.game.player.addXp(Math.round(u.totalXp * CONFIG.progression.dismissXpShare));
  }

  dismissReserve() {
    let xp = 0;
    for (let i = 0; i < MAX_UNITS; i++) {
      const u = this.units[i];
      if (u && u.squad < 0) { xp += u.totalXp; this.units[i] = null; }
    }
    this.rebuild();
    this.game.player.addXp(Math.round(xp * CONFIG.progression.dismissXpShare));
  }

  rebuild() {
    this.deployed.length = 0;
    this.reserveCount = 0;
    for (let k = 0; k < 3; k++) {
      for (let i = 0; i < MAX_UNITS; i++) {
        const u = this.units[i];
        if (u && u.squad === k) this.deployed.push(u);
      }
    }
    for (let i = 0; i < MAX_UNITS; i++) if (this.units[i] && this.units[i].squad < 0) this.reserveCount++;
    this.layout();
    this.version++;
  }

  // ---- formation ------------------------------------------------------------
  // Squads that follow the player share rings around the player; a squad on
  // "Hold" forms its own rings around the held position.
  layout() {
    _list.length = 0;
    for (let i = 0; i < this.deployed.length; i++) {
      if (this.squads[this.deployed[i].squad].behavior !== B_HOLD) _list.push(this.deployed[i]);
    }
    this.assignRings(_list);
    for (let k = 0; k < 3; k++) {
      if (this.squads[k].behavior !== B_HOLD) continue;
      _list.length = 0;
      for (let i = 0; i < this.deployed.length; i++) if (this.deployed[i].squad === k) _list.push(this.deployed[i]);
      this.assignRings(_list);
    }
    _list.length = 0;
  }

  assignRings(list) {
    const F = CONFIG.shadows.formation;
    let start = 0, ring = 0, cap = F.firstCount;
    while (start < list.length) {
      const n = Math.min(cap, list.length - start);
      const r = F.firstRadius + ring * F.ringGap;
      for (let j = 0; j < n; j++) {
        const a = (j / n) * TAU + ring * 0.6 + Math.PI / 2;
        list[start + j].ox = Math.cos(a) * r;
        list[start + j].oz = Math.sin(a) * r;
      }
      start += n;
      ring++;
      cap += F.countStep;
    }
  }

  placeAtHome(u, rise) {
    const sq = this.squads[u.squad], P = this.game.player;
    const hold = sq.behavior === B_HOLD;
    u.x = (hold ? sq.holdX : P.x) + u.ox;
    u.z = (hold ? sq.holdZ : P.z) + u.oz;
    u.target = -1;
    u.windup = 0;
    if (rise) {
      u.riseT = 1;
      this.game.effects.burst(u.x, 0.2, u.z, 10, this.auraHex, 3, 0.2, 0.6);
    }
  }

  // ---- squads ---------------------------------------------------------------
  setBehavior(k, b) {
    const sq = this.squads[k];
    sq.behavior = b;
    if (b === B_HOLD) {
      sq.holdX = this.game.player.x;
      sq.holdZ = this.game.player.z;
    }
    this.layout();
    this.version++;
  }

  cycleBehavior(k) {
    this.setBehavior(k, (this.squads[k].behavior + 1) % BEHAVIORS.length);
  }

  reviveCost(u) {
    const R = CONFIG.shadows.revive;
    return Math.round((R.cost + R.costPerLevel * u.level) * CONFIG.shadows.tierFactor[u.tier]);
  }

  // Revives every fallen shadow of the squad that is ready, as far as the mana
  // lasts. Returns how many came back.
  reviveSquad(k) {
    const P = this.game.player;
    let n = 0;
    for (let i = 0; i < this.deployed.length; i++) {
      const u = this.deployed[i];
      if (u.squad !== k || u.alive || u.reviveT > 0) continue;
      const cost = this.reviveCost(u);
      if (P.mana < cost) continue;
      P.mana -= cost;
      u.alive = true;
      u.hp = u.maxHp;
      this.placeAtHome(u, true);
      n++;
    }
    if (n) this.version++;
    return n;
  }

  // ---- used by the enemies ---------------------------------------------------
  targetable(u) {
    if (!u || !u.alive || u.squad < 0 || u.riseT > 0) return false;
    const cr = this.game.world.campRadius;
    return u.x * u.x + u.z * u.z > cr * cr;
  }

  // Most attractive shadow for an enemy at (x, z): close and threatening
  // (tanks draw attacks). Returns the slot or -1; pickW is the weighted
  // squared distance, comparable with the squared distance to the player.
  pickTarget(x, z, range) {
    const roles = CONFIG.shadows.roles;
    const r2 = range * range;
    let best = -1, bw = 1e9;
    for (let i = 0; i < this.deployed.length; i++) {
      const u = this.deployed[i];
      if (!this.targetable(u)) continue;
      const dx = u.x - x, dz = u.z - z;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      const th = roles[u.role].threat;
      const w = d2 / (th * th);
      if (w < bw) { bw = w; best = u.slot; }
    }
    this.pickW = bw;
    return best;
  }

  damage(slot, amount) {
    const u = this.units[slot];
    if (!u || !u.alive) return;
    u.hp -= amount;
    u.flash = 0.12;
    if (u.hp <= 0) {
      const R = CONFIG.shadows.revive;
      u.hp = 0;
      u.alive = false;
      u.target = -1;
      u.windup = 0;
      u.reviveT = R.cooldown + R.cooldownPerLevel * u.level;
      this.game.effects.burst(u.x, 0.9, u.z, 16, this.auraHex, 5, 0.24, 0.7);
      this.version++;
    }
  }

  // ---- experience -----------------------------------------------------------
  xpNeed(level) {
    return Math.round(CONFIG.shadows.xpBase * Math.pow(level, CONFIG.shadows.xpGrowth));
  }

  // killer = slot of the shadow that landed the kill (-1 = the player)
  grantXp(killer, xp) {
    const S = CONFIG.shadows;
    for (let i = 0; i < this.deployed.length; i++) {
      const u = this.deployed[i];
      if (!u.alive || u.level >= S.maxLevel) continue;
      const gain = u.slot === killer ? xp : xp * S.xpShare;
      u.xp += gain;
      u.totalXp += gain;
      let leveled = false;
      while (u.level < S.maxLevel && u.xp >= this.xpNeed(u.level)) {
        u.xp -= this.xpNeed(u.level);
        u.level++;
        leveled = true;
      }
      if (!leveled) continue;
      let stage = 0;
      for (let s = 0; s < S.evolveLevels.length; s++) if (u.level >= S.evolveLevels[s]) stage = s + 1;
      const evolved = stage > u.stage;
      u.stage = stage;
      this.recalc(u);
      u.hp = u.maxHp;
      this.game.effects.burst(u.x, 1.2, u.z, evolved ? 26 : 8, evolved ? 0xffffff : 0xb48cff, evolved ? 7 : 4, 0.2, 0.7);
      if (evolved) this.game.hud.toast(t('toast.evolved', { name: this.name(u) }));
      this.version++;
    }
  }

  // ---- simulation -----------------------------------------------------------
  update(dt) {
    const game = this.game, P = game.player, E = game.enemies, fx = game.effects, world = game.world;
    const S = CONFIG.shadows, roles = S.roles;
    const D = this.deployed;
    const camp2 = world.campRadius * world.campRadius;
    const tele2 = S.teleportDist * S.teleportDist;
    const variance = CONFIG.combat.damageVariance;
    if (this.buffT > 0) this.buffT -= dt;
    const dmgMult = 1 + P.armyDamage + (this.buffT > 0 ? this.buffDamage : 0);

    for (let k = 0; k < 3; k++) {
      const sq = this.squads[k];
      sq.total = sq.alive = sq.ready = sq.readyCost = 0;
      sq.nextReady = 0;
    }
    for (let t2 = 0; t2 < this.types.length; t2++) this.types[t2].n = 0;

    for (let n = 0; n < D.length; n++) {
      const u = D[n];
      const sq = this.squads[u.squad];
      sq.total++;
      if (!u.alive) {
        if (u.reviveT > 0) u.reviveT -= dt;
        if (u.reviveT <= 0) { sq.ready++; sq.readyCost += this.reviveCost(u); }
        else if (sq.nextReady === 0 || u.reviveT < sq.nextReady) sq.nextReady = u.reviveT;
        continue;
      }
      sq.alive++;
      if (u.flash > 0) u.flash -= dt;
      if (u.lunge > 0) u.lunge -= dt * 5;
      if (u.atkCd > 0) u.atkCd -= dt;
      u.moving = false;
      if (u.riseT > 0) { u.riseT -= dt / S.riseTime; continue; }

      const role = roles[u.role];
      const beh = sq.behavior;
      const hold = beh === B_HOLD;
      const ax = hold ? sq.holdX : P.x, az = hold ? sq.holdZ : P.z;
      const range = beh === B_ATTACK ? S.attackRange : hold ? S.holdRange : S.guardRange;

      // never get lost: followers far behind are pulled to the player
      if (!hold) {
        const fxd = u.x - P.x, fzd = u.z - P.z;
        if (fxd * fxd + fzd * fzd > tele2) this.placeAtHome(u, true);
      }
      if (u.hp < u.maxHp && u.x * u.x + u.z * u.z < camp2) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * S.campRegen * dt);
      }

      let mvx = 0, mvz = 0, speed = 0;

      if (role.heal) {
        // ---- healer: stays in formation and mends the most wounded ally
        if (u.atkCd <= 0) {
          u.atkCd = 0.4;
          const r2 = role.range * role.range;
          let best = null, bf = 0.95, healPlayer = false;
          for (let j = 0; j < D.length; j++) {
            const o = D[j];
            if (!o.alive || o.riseT > 0) continue;
            const dx = o.x - u.x, dz = o.z - u.z;
            if (dx * dx + dz * dz > r2) continue;
            const f = o.hp / o.maxHp;
            if (f < bf) { bf = f; best = o; }
          }
          if (!P.dead) {
            const dx = P.x - u.x, dz = P.z - u.z;
            if (dx * dx + dz * dz <= r2 && P.hp / P.maxHp < bf) { healPlayer = true; best = null; }
          }
          if (best || healPlayer) {
            const amount = Math.round(role.heal * S.tierFactor[u.tier] * (1 + u.stage * S.evolveBonus) * (1 + (u.level - 1) * role.healPerLevel));
            const tx = healPlayer ? P.x : best.x, tz = healPlayer ? P.z : best.z;
            if (healPlayer) P.heal(amount);
            else best.hp = Math.min(best.maxHp, best.hp + amount);
            u.yaw = Math.atan2(tx - u.x, tz - u.z);
            u.lunge = 0.6;
            u.atkCd = role.cooldown;
            fx.burst(tx, 1.4, tz, 6, 0x5cf08a, 2.5, 0.16, 0.6);
          }
        }
      } else {
        // ---- fighters: pick a target inside the squad's range
        let tg = u.target;
        if (tg >= 0) {
          if (!E.alive[tg]) tg = -1;
          else {
            const hx = E.x[tg] - ax, hz = E.z[tg] - az, lim = range + 4;
            if (hx * hx + hz * hz > lim * lim) tg = -1;
          }
          if (tg < 0) u.windup = 0;
        }
        u.tgtT -= dt;
        if (u.tgtT <= 0 && u.windup <= 0) {
          u.tgtT = 0.3 + Math.random() * 0.2;
          tg = E.nearestAround(u.x, u.z, ax, az, range);
        }
        u.target = tg;

        if (tg >= 0) {
          const dx = E.x[tg] - u.x, dz = E.z[tg] - u.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
          const reach = role.range + E.radius[tg] + u.radius;
          if (u.windup > 0) {
            u.windup -= dt;
            u.yaw = Math.atan2(dx, dz);
            if (u.windup <= 0) {
              u.lunge = 1;
              u.atkCd = role.cooldown * (0.85 + Math.random() * 0.3);
              if (d <= reach + 1.2) {
                const dmg = Math.max(1, Math.round(u.dmg * dmgMult * (1 + (Math.random() * 2 - 1) * variance)));
                if (role.projectileSpeed) game.projectiles.fire(u.x, u.z, tg, role.projectileSpeed, dmg, u.slot);
                else E.damage(tg, dmg, dx / d, dz / d, u.slot);
              }
            }
          } else if (d > reach * 0.9) {
            mvx = dx; mvz = dz; speed = u.speed;
          } else {
            u.yaw = Math.atan2(dx, dz);
            if (u.atkCd <= 0) u.windup = role.windup;
          }
        }
      }

      // ---- nothing to fight: back into formation
      if (u.target < 0 || role.heal) {
        mvx = ax + u.ox - u.x;
        mvz = az + u.oz - u.z;
        const d2 = mvx * mvx + mvz * mvz;
        speed = d2 > 0.16 ? Math.min(S.followSpeed, Math.sqrt(d2) * 4) : 0;
      }

      if (speed > 0) {
        const l = Math.sqrt(mvx * mvx + mvz * mvz);
        if (l > 0.001) {
          mvx /= l; mvz /= l;
          u.x += mvx * speed * dt;
          u.z += mvz * speed * dt;
          let diff = Math.atan2(mvx, mvz) - u.yaw;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          u.yaw += diff * Math.min(1, dt * 10);
          u.phase += dt * speed * 2.2;
          u.moving = speed > 1;
        }
      }
    }

    // ---- keep shadows apart and out of obstacles, then draw
    const renderR2 = CONFIG.sim.renderRadius * CONFIG.sim.renderRadius;
    for (let a = 0; a < D.length; a++) {
      const u = D[a];
      if (!u.alive) continue;
      if (u.riseT <= 0) {
        for (let b = a + 1; b < D.length; b++) {
          const o = D[b];
          if (!o.alive || o.riseT > 0) continue;
          const dx = o.x - u.x, dz = o.z - u.z;
          const min = (u.radius + o.radius) * 0.9;
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-5) {
            const d = Math.sqrt(d2), k = ((min - d) / d) * 0.5;
            u.x -= dx * k; u.z -= dz * k;
            o.x += dx * k; o.z += dz * k;
          }
        }
        world.resolve(u.x, u.z, u.radius);
        u.x = world.rx;
        u.z = world.rz;
      }
      const dx = u.x - P.x, dz = u.z - P.z;
      if (dx * dx + dz * dz > renderR2) continue;
      this.draw(u);
      const rise = u.riseT > 0 ? u.riseT : 0;
      fx.blob(u.x, u.z, u.radius * (1.1 + rise * 1.6));
      if (rise > 0) {
        if (Math.random() < dt * 30) fx.burst(u.x, 0.1, u.z, 1, this.auraHex, 2, 0.16, 0.5);
      } else if (u.hp < u.maxHp) {
        fx.bar(u.x, 1.9 * u.scale + 0.4, u.z, u.hp / u.maxHp, 1.2, true);
      }
    }

    for (let t2 = 0; t2 < this.types.length; t2++) {
      const ty = this.types[t2];
      ty.mesh.count = ty.n;
      ty.mesh.instanceMatrix.needsUpdate = true;
      ty.mesh.instanceColor.needsUpdate = true;
    }

    for (let k = 0; k < 3; k++) {
      const sq = this.squads[k], mark = this.holdMarks[k];
      mark.visible = sq.behavior === B_HOLD && sq.total > 0;
      if (mark.visible) mark.position.set(sq.holdX, 0.06, sq.holdZ);
    }
  }

  draw(u) {
    const ty = this.types[u.ti];
    if (ty.n >= MAX_VISIBLE) return;
    const n = ty.n++;
    const a = ty.mesh.instanceMatrix.array, c = ty.mesh.instanceColor.array;
    const s = u.scale;
    const sin = Math.sin(u.yaw), cos = Math.cos(u.yaw);
    let sy = s, y = 0, off = 0;
    if (u.moving) y = Math.abs(Math.sin(u.phase)) * 0.16;
    if (u.windup > 0) { sy = s * 0.88; off = -0.2; }
    if (u.lunge > 0) off = u.lunge * 0.6;
    if (u.riseT > 0) { y = -1.9 * s * u.riseT; sy = s * (1.25 - u.riseT * 0.25); } // rises out of the ground
    const o = n * 16;
    a[o] = cos * s; a[o + 1] = 0; a[o + 2] = -sin * s;
    a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0;
    a[o + 8] = sin * s; a[o + 9] = 0; a[o + 10] = cos * s;
    a[o + 12] = u.x + sin * off; a[o + 13] = y; a[o + 14] = u.z + cos * off;
    const k = n * 3;
    if (u.flash > 0) { c[k] = 2.5; c[k + 1] = 0.6; c[k + 2] = 0.8; }
    else {
      const b = 1 + u.stage * 0.45; // evolved shadows glow brighter
      c[k] = this.tr * b; c[k + 1] = this.tg * b; c[k + 2] = this.tb * b;
    }
  }
}
