// The shadow army. Every shadow is one plain object that lives as long as the
// shadow exists (created on Arise, so nothing is allocated per frame). The
// whole army is either summoned (out) or rests in the shadows; summoned it
// either attacks on its own or protects the player.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { gfx } from '../core/settings.js';
import { flatMaterial } from '../render/geo.js';
import { buildShadowGeometry } from '../render/models/enemies.js';
import { t } from '../strings.js';

export const BEHAVIORS = ['attack', 'guard'];
const B_ATTACK = 0;
const MAX_UNITS = 128;
const MAX_VISIBLE = 64; // per type
const TAU = Math.PI * 2;

export class Army {
  constructor(game) {
    this.game = game;
    const S = CONFIG.shadows;
    this.units = new Array(MAX_UNITS).fill(null);
    this.deployed = []; // every shadow, rebuilt whenever the roster changes
    this.version = 0; // goes up on every roster change (for the UI)
    this.pickW = 0;
    this.buffDamage = 0;
    this.buffT = 0;
    this.behavior = B_ATTACK;
    this.out = true; // summoned
    this.summonCd = 0;
    // counts for the HUD
    this.total = 0;
    this.alive = 0;
    this.ready = 0; // fallen shadows that can be revived
    this.readyCost = 0;
    this.nextReady = 0;

    this.setAura(game.appearance.aura);

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

  }

  // aura tint, applied per instance on top of the near-black model
  setAura(hex) {
    const c = new THREE.Color(hex);
    const m = Math.max(c.r, c.g, c.b, 0.001);
    this.tr = 0.3 + (c.r / m) * 0.7;
    this.tg = 0.3 + (c.g / m) * 0.7;
    this.tb = 0.3 + (c.b / m) * 0.7;
    this.auraHex = hex;
  }

  // ---- saving ---------------------------------------------------------------
  serialize() {
    const units = [];
    for (const u of this.units) {
      if (!u) continue;
      units.push({
        type: u.type, role: u.role, tier: u.tier, zone: u.zone, level: u.level, xp: u.xp, totalXp: u.totalXp,
        stage: u.stage, alive: u.alive, hp: u.hp, reviveT: u.reviveT,
      });
    }
    return { units, behavior: this.behavior, out: this.out };
  }

  restore(data) {
    if (!data) return;
    if (typeof data.behavior === 'number') this.behavior = data.behavior === 0 ? 0 : 1;
    if (typeof data.out === 'boolean') this.out = data.out;
    const P = this.game.player;
    let slot = 0;
    for (const d of data.units || []) {
      if (slot >= MAX_UNITS || !CONFIG.enemies.types[d.type]) continue;
      const u = {
        slot, type: d.type, ti: this.game.enemies.typeIndex[d.type], role: d.role, tier: d.tier, zone: d.zone || 0,
        abT: 2, tauntT: 0,
        level: d.level, xp: d.xp, totalXp: d.totalXp || 0, stage: d.stage,
        alive: d.alive, hp: d.hp, maxHp: 1, dmg: 1, radius: 0.7, scale: 1, speed: 5,
        x: P.x, z: P.z, yaw: Math.random() * TAU, ox: 0, oz: 0,
        target: -1, tgtT: Math.random() * 0.3, atkCd: 0, windup: 0,
        reviveT: d.reviveT || 0, riseT: 0, flash: 0, lunge: 0, phase: Math.random() * TAU, moving: false,
      };
      this.recalc(u);
      if (u.alive && u.hp <= 0) u.hp = u.maxHp;
      this.units[slot++] = u;
    }
    this.rebuild();
    // the army appears in formation around the player
    for (const u of this.deployed) if (u.alive) this.placeAtHome(u, false);
  }

  // ---- roster ---------------------------------------------------------------
  maxDeployed() {
    // Intelligence decides how big the army can be
    const P = this.game.player, S = CONFIG.shadows;
    const n = S.baseSlots + Math.floor(P.stats.int * CONFIG.progression.stats.int.slots) + P.armySlots;
    return Math.min(S.maxSlots, n);
  }

  totalCount() {
    return this.deployed.length;
  }

  hasRoom() {
    return this.deployed.length < this.maxDeployed();
  }

  name(u) {
    const base = t('enemy.' + u.type);
    const name = u.tier === 1 || u.tier === 2 ? t('tier.' + u.tier, { name: base }) : base;
    return t('shadow.stage.' + u.stage, { name });
  }

  recalc(u) {
    const S = CONFIG.shadows, role = S.roles[u.role];
    const def = CONFIG.enemies.types[u.type];
    const zone = CONFIG.world.zones[u.zone] || CONFIG.world.zones[0];
    const tier = S.tierFactor[u.tier] * (1 + u.stage * S.evolveBonus);
    // shadows are as strong as the zone they were raised in
    const baseHp = (def.boss ? def.shadowBase.hp : def.hp) * zone.power;
    const baseDmg = (def.boss ? def.shadowBase.damage : def.damage) * zone.power;
    const lv = Math.pow(S.levelGrowth, u.level - 1);
    u.maxHp = Math.round(baseHp * S.hpFactor * role.hp * tier * lv * (1 + this.game.player.armyHp));
    u.dmg = baseDmg * S.damageFactor * role.damage * tier * lv;
    u.scale = (def.boss ? def.scale * 0.55 : def.scale) * S.scale * (1 + u.stage * S.evolveScale) * (1 + u.tier * 0.15);
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

  // The player teleported (gate, travel): the summoned army follows.
  relocate() {
    if (!this.out) return;
    for (const u of this.deployed) if (u.alive) this.placeAtHome(u, true);
  }

  // Summons the whole army out of the shadows, or sends it back.
  toggleSummon() {
    if (this.summonCd > 0) return false;
    this.summonCd = CONFIG.shadows.summonCooldown;
    this.out = !this.out;
    const fx = this.game.effects;
    for (const u of this.deployed) {
      if (!u.alive) continue;
      if (this.out) this.placeAtHome(u, true);
      else {
        u.target = -1;
        u.windup = 0;
        fx.burst(u.x, 0.6, u.z, 8, this.auraHex, 3, 0.2, 0.5);
      }
    }
    this.version++;
    return true;
  }

  // Ability of elite, champion and boss shadows (role decides which).
  ability(u, dmgMult) {
    const game = this.game, E = game.enemies, fx = game.effects, P = game.player, S = CONFIG.shadows;
    const ab = S.abilities[u.role];
    const pw = 1 + S.tierPower * (u.tier - 1);
    u.abT = 1; // try again soon when there is nothing to do
    if (ab.name === 'mend') {
      const r2 = ab.radius * ab.radius;
      let hurt = false;
      for (const o of this.deployed) if (o.alive && o.hp < o.maxHp * 0.8 && (o.x - u.x) ** 2 + (o.z - u.z) ** 2 < r2) hurt = true;
      const pHurt = !P.dead && P.hp < P.maxHp * 0.8 && (P.x - u.x) ** 2 + (P.z - u.z) ** 2 < r2;
      if (!hurt && !pHurt) return;
      for (const o of this.deployed) {
        if (!o.alive || (o.x - u.x) ** 2 + (o.z - u.z) ** 2 > r2) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * ab.heal * pw);
      }
      if (pHurt) P.heal(P.maxHp * ab.heal * pw);
      fx.slash(u.x, u.z, 0, ab.radius, 360, 0x5cf08a);
      fx.burst(u.x, 1.5, u.z, 20, 0x5cf08a, 4, 0.2, 0.7);
      u.abT = ab.cooldown;
      return;
    }
    const range = ab.name === 'volley' ? S.roles.ranged.range + 4 : ab.radius;
    const r2 = range * range;
    let n = 0;
    for (let k = 0; k < E.activeCount; k++) {
      const i = E.active[k];
      if (!E.alive[i]) continue;
      const dx = E.x[i] - u.x, dz = E.z[i] - u.z, d2 = dx * dx + dz * dz;
      if (d2 > r2) continue;
      if (ab.name === 'cleave') {
        const d = Math.sqrt(d2) || 1;
        E.damage(i, Math.round(u.dmg * dmgMult * ab.power * pw), dx / d, dz / d, u.slot);
      } else if (ab.name === 'volley') {
        if (n >= ab.shots) break;
        game.projectiles.fire(u.x, u.z, i, S.roles.ranged.projectileSpeed, Math.round(u.dmg * dmgMult * ab.power * pw), u.slot);
      }
      n++;
    }
    if (n === 0) return;
    if (ab.name === 'taunt') {
      E.taunt(u.x, u.z, ab.radius, u.slot, ab.duration * pw);
      u.tauntT = ab.duration * pw;
      fx.slash(u.x, u.z, 0, ab.radius, 360, 0xff6070);
      fx.burst(u.x, 1.5, u.z, 16, 0xff6070, 5, 0.2, 0.5);
    } else if (ab.name === 'cleave') {
      fx.slash(u.x, u.z, 0, ab.radius, 360, this.auraHex);
      fx.burst(u.x, 1, u.z, 14, this.auraHex, 6, 0.2, 0.5);
    } else {
      fx.burst(u.x, 1.6, u.z, 10, this.auraHex, 3, 0.16, 0.4);
    }
    u.lunge = 1;
    u.abT = ab.cooldown;
  }

  // Creates a shadow. Returns the unit, or null when there is no room at all.
  add(type, tier, x, z, role, zone = 0) {
    const S = CONFIG.shadows;
    let slot = -1;
    for (let i = 0; i < MAX_UNITS; i++) if (!this.units[i]) { slot = i; break; }
    if (slot < 0 || !this.hasRoom()) return null;
    const u = {
      slot, type, ti: this.game.enemies.typeIndex[type],
      role: role || CONFIG.enemies.types[type].shadowRole,
      tier, zone, level: 1, xp: 0, totalXp: 0, stage: 0,
      abT: 2, tauntT: 0,
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

  // Dismissing a shadow for good hands part of its XP to the player.
  dismiss(slot) {
    const u = this.units[slot];
    if (!u) return;
    this.units[slot] = null;
    this.rebuild();
    this.game.player.addXp(Math.round(u.totalXp * CONFIG.progression.dismissXpShare));
  }

  rebuild() {
    this.deployed.length = 0;
    for (let i = 0; i < MAX_UNITS; i++) if (this.units[i]) this.deployed.push(this.units[i]);
    this.assignRings(this.deployed);
    this.version++;
  }

  // ---- formation ------------------------------------------------------------
  // The army stands in rings around the player.
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
    const P = this.game.player;
    u.x = P.x + u.ox;
    u.z = P.z + u.oz;
    u.target = -1;
    u.windup = 0;
    if (rise) {
      u.riseT = 1;
      this.game.effects.burst(u.x, 0.2, u.z, 10, this.auraHex, 3, 0.2, 0.6);
    }
  }

  // ---- behaviour --------------------------------------------------------------
  toggleBehavior() {
    this.behavior = this.behavior === B_ATTACK ? 1 : B_ATTACK;
    this.version++;
  }

  reviveCost(u) {
    const R = CONFIG.shadows.revive;
    return Math.round((R.cost + R.costPerLevel * u.level) * CONFIG.shadows.tierFactor[u.tier]);
  }

  // Revives every fallen shadow that is ready, as far as the mana lasts.
  // Returns how many came back.
  reviveReady() {
    const P = this.game.player;
    let n = 0;
    for (let i = 0; i < this.deployed.length; i++) {
      const u = this.deployed[i];
      if (u.alive || u.reviveT > 0) continue;
      const cost = this.reviveCost(u);
      if (P.mana < cost) continue;
      P.mana -= cost;
      u.alive = true;
      u.hp = u.maxHp;
      if (this.out) this.placeAtHome(u, true);
      n++;
    }
    if (n) this.version++;
    return n;
  }

  // ---- used by the enemies ---------------------------------------------------
  targetable(u) {
    return !!u && this.out && u.alive && u.riseT <= 0 && !u.safe;
  }

  // Most attractive shadow for an enemy at (x, z): close and threatening
  // (tanks draw attacks). Returns the slot or -1; pickW is the weighted
  // squared distance, comparable with the squared distance to the player.
  pickTarget(x, z, range) {
    const roles = CONFIG.shadows.roles;
    this.pickW = 1e9;
    if (!this.out) return -1;
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
    if (u.tauntT > 0) amount *= 1 - CONFIG.shadows.abilities.tank.reduction;
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
  xpNeed(level, u) {
    const S = CONFIG.shadows;
    const zone = CONFIG.world.zones[(u && u.zone) || 0];
    return Math.round(S.xpBase * zone.power * Math.pow(S.xpGrowth, level - 1));
  }

  // killer = slot of the shadow that landed the kill (-1 = the player)
  grantXp(killer, xp) {
    const S = CONFIG.shadows;
    if (!this.out) return; // resting shadows learn nothing
    for (let i = 0; i < this.deployed.length; i++) {
      const u = this.deployed[i];
      if (!u.alive || u.level >= S.maxLevel) continue;
      const gain = u.slot === killer ? xp : xp * S.xpShare;
      u.xp += gain;
      u.totalXp += gain;
      let leveled = false;
      while (u.level < S.maxLevel && u.xp >= this.xpNeed(u.level, u)) {
        u.xp -= this.xpNeed(u.level, u);
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
    const tele2 = S.teleportDist * S.teleportDist;
    const variance = CONFIG.combat.damageVariance;
    if (this.buffT > 0) this.buffT -= dt;
    const dmgMult = 1 + P.armyDamage + (this.buffT > 0 ? this.buffDamage : 0);

    if (this.summonCd > 0) this.summonCd -= dt;
    this.total = this.alive = this.ready = this.readyCost = 0;
    this.nextReady = 0;
    for (let t2 = 0; t2 < this.types.length; t2++) this.types[t2].n = 0;
    const out = this.out;

    for (let n = 0; n < D.length; n++) {
      const u = D[n];
      this.total++;
      if (!u.alive) {
        if (u.reviveT > 0) u.reviveT -= dt;
        if (u.reviveT <= 0) { this.ready++; this.readyCost += this.reviveCost(u); }
        else if (this.nextReady === 0 || u.reviveT < this.nextReady) this.nextReady = u.reviveT;
        continue;
      }
      this.alive++;
      if (!out) {
        // resting in the shadows: slowly healed
        if (u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * S.campRegen * 0.2 * dt);
        continue;
      }
      if (u.flash > 0) u.flash -= dt;
      if (u.lunge > 0) u.lunge -= dt * 5;
      if (u.atkCd > 0) u.atkCd -= dt;
      u.moving = false;
      if (u.riseT > 0) { u.riseT -= dt / S.riseTime; continue; }
      if (u.tier > 0) {
        if (u.tauntT > 0) u.tauntT -= dt;
        u.abT -= dt;
        if (u.abT <= 0) this.ability(u, dmgMult);
      }

      const role = roles[u.role];
      const ax = P.x, az = P.z;
      const range = this.behavior === B_ATTACK ? S.attackRange : S.guardRange;

      // never get lost: shadows far behind are pulled to the player
      const fxd = u.x - P.x, fzd = u.z - P.z;
      if (fxd * fxd + fzd * fzd > tele2) this.placeAtHome(u, true);
      u.safe = game.gates.active < 0 && world.safeIndexAt(u.x, u.z) >= 0;
      if (u.hp < u.maxHp && u.safe) {
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
            // heals a share of the target's max health (stronger for elite healers)
            const share = role.heal * (1 + (S.tierFactor[u.tier] - 1) * 0.3) * (1 + u.stage * 0.15);
            const tx = healPlayer ? P.x : best.x, tz = healPlayer ? P.z : best.z;
            if (healPlayer) P.heal(P.maxHp * share);
            else best.hp = Math.min(best.maxHp, best.hp + best.maxHp * share);
            u.yaw = Math.atan2(tx - u.x, tz - u.z);
            u.lunge = 0.6;
            u.atkCd = role.cooldown;
            fx.burst(tx, 1.4, tz, 6, 0x5cf08a, 2.5, 0.16, 0.6);
          }
        }
      } else {
        // ---- fighters: pick a target in range (Attack: wide, Protect: close)
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
    const renderR2 = gfx.renderRadius * gfx.renderRadius;
    for (let a = 0; a < D.length; a++) {
      const u = D[a];
      if (!u.alive || !out) continue;
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
        if (game.gates.active >= 0) {
          game.gates.clamp(u.x, u.z, u.radius);
          u.x = game.gates.cx;
          u.z = game.gates.cz;
        } else {
          world.resolve(u.x, u.z, u.radius);
          u.x = world.rx;
          u.z = world.rz;
        }
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
      ty.mesh.visible = ty.n > 0;
      if (ty.n > 0) {
        ty.mesh.instanceMatrix.needsUpdate = true;
        ty.mesh.instanceColor.needsUpdate = true;
      }
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
