// The shadow army. Every shadow is one plain object that lives as long as the
// shadow exists (created on Arise, so nothing is allocated per frame). The
// whole army is either summoned (out) or rests in the shadows; summoned it
// either attacks on its own or protects the player.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { enemyPower, hunterXpNeed } from '../core/levels.js';
import { gfx } from '../core/settings.js';
import { flatMaterial } from '../render/geo.js';
import { buildShadowGeometry } from '../render/models/enemies.js';
import { t } from '../strings.js';
import { FLASH, EXPAND } from '../render/effects.js';

export const BEHAVIORS = ['attack', 'guard'];
const B_ATTACK = 0;
const MAX_UNITS = 128;
const MAX_VISIBLE = 64; // per type
// The companion of the Ranger line is not a shadow: it lives outside the roster (units) under this slot number
// (the enemies and the projectiles name their target / source by slot; 1000+ are co-op hunters)
export const COMP_SLOT = 999;

const _ac = new THREE.Color();
// the glowing outline: a slightly bigger copy of the body, drawn from the inside
const GLOW_SIZE = 1.1;
const TAU = Math.PI * 2;

export class Army {
  constructor(game) {
    this.game = game;
    const S = CONFIG.shadows;
    this.units = new Array(MAX_UNITS).fill(null);
    this.deployed = []; // the shadows in the fight: the roster when the class may lead the army, otherwise none
    // Two states of the army: active (the class has army access: the shadows fight, learn, can be hit) and
    // inactive (the shadows stay saved in units, untouched, but take no part in anything). rebuild() decides.
    this.active = false;
    this.comp = null; // the companion of the Ranger line (its own unit, its own data; core/ranger.js keeps it)
    this.compOn = false; // the class has a companion
    this.fighters = []; // what the update moves and draws: deployed + the companion
    this.version = 0; // goes up on every roster change (for the UI)
    this.pickW = 0;
    this.claims = new Map(); // enemy index -> shadows on it (see update)
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
      // rank aura: the same body a bit bigger, only its back faces, glowing
      const glow = new THREE.InstancedMesh(mesh.geometry, new THREE.MeshBasicMaterial({
        side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }), MAX_VISIBLE);
      glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_VISIBLE * 3).fill(1), 3);
      glow.instanceColor.setUsage(THREE.DynamicDrawUsage);
      glow.frustumCulled = false;
      glow.count = 0;
      game.scene.add(glow);
      this.types.push({ id: et.id, def: et.def, mesh, n: 0, glow, g: 0 });
    }

    this.time = 0;

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
    for (let i = 0; i < MAX_UNITS; i++) if (this.units[i]) units.push(this.unitData(this.units[i])); // the companion is saved apart (core/ranger.js)
    // in a duel the army is out of it: saved as it was before
    const g = this.game.gates;
    return { units, behavior: this.behavior, out: g && g.solo ? g.armyOut : this.out };
  }

  restore(data) {
    if (!data) return;
    if (typeof data.behavior === 'number') this.behavior = data.behavior === 0 ? 0 : 1;
    if (typeof data.out === 'boolean') this.out = data.out;
    const P = this.game.player;
    let slot = 0;
    for (const d of data.units || []) {
      if (slot >= MAX_UNITS || !CONFIG.enemies.types[d.type]) continue;
      this.units[slot] = this.makeUnit(d, slot);
      slot++;
    }
    this.rebuild();
    this.checkRanks();
    for (let i = 0; i < MAX_UNITS; i++) if (this.units[i]) this.recalc(this.units[i]);
    // the army appears in formation around the player (only an active one)
    for (const u of this.deployed) if (u.alive) this.placeAtHome(u, false);
  }

  // a shadow or the companion by its slot (null when there is none)
  unit(slot) {
    return slot === COMP_SLOT ? this.comp : slot >= 0 ? this.units[slot] : null;
  }

  // the companion from its saved form (core/ranger.js)
  makeCompanion(d) {
    const u = this.makeUnit(d, COMP_SLOT);
    u.comp = true;
    this.recalc(u);
    if (u.alive && u.hp <= 0) u.hp = u.maxHp;
    return u;
  }

  // The class changed (or the game loaded): the army and the companion follow the class rights at once.
  // Nothing is deleted; shadows that become active rise around the hunter.
  syncAccess() {
    const was = this.active;
    this.rebuild();
    if (this.active && !was) for (const u of this.deployed) if (u.alive) this.placeAtHome(u, true);
    if (!this.active) for (let i = 0; i < MAX_UNITS; i++) { const u = this.units[i]; if (u) { u.target = -1; u.windup = 0; } }
    if (this.comp && this.compOn && this.comp.alive) this.placeAtHome(this.comp, true);
  }

  // the saved form of one shadow
  unitData(u) {
    return {
      type: u.type, role: u.role, tier: u.tier, zone: u.zone, plv: u.plv, level: u.level, xp: u.xp, totalXp: u.totalXp,
      stage: u.stage, alive: u.alive, hp: u.hp, reviveT: u.reviveT, rank: u.rank, nick: u.nick, olv: u.olv || 0, oxp: u.oxp || 0,
    };
  }

  // a shadow from its saved form (slot -1: not in the army, like in the barracks)
  makeUnit(d, slot) {
    const P = this.game.player;
    const u = {
      slot, type: d.type, ti: this.game.enemies.typeIndex[d.type], role: d.role, tier: d.tier, zone: d.zone || 0,
      plv: d.plv || (CONFIG.world.zones[d.zone || 0] || CONFIG.world.zones[0]).level,
      abT: 2, tauntT: 0,
      level: d.level, xp: d.xp, totalXp: d.totalXp || 0, stage: d.stage,
      rank: Math.max(0, Math.min(CONFIG.shadows.ranks.length - 1, d.rank | 0)),
      nick: typeof d.nick === 'string' ? d.nick.slice(0, CONFIG.shadows.nameMaxLength) : '',
      olv: d.olv || 0, oxp: d.oxp || 0,
      alive: d.alive, hp: d.hp, maxHp: 1, dmg: 1, radius: 0.7, scale: 1, speed: 5,
      x: P.x, z: P.z, yaw: Math.random() * TAU, ox: 0, oz: 0,
      target: -1, tgtT: Math.random() * 0.3, atkCd: 0, windup: 0, block: 0, pd: 1e9, chase: -1,
      reviveT: d.reviveT || 0, riseT: 0, flash: 0, lunge: 0, phase: Math.random() * TAU, moving: false,
    };
    this.recalc(u);
    if (u.alive && u.hp <= 0) u.hp = u.maxHp;
    return u;
  }

  // takes a shadow out of the army (into the barracks): the hunter gets no XP for it
  detach(slot) {
    const u = this.units[slot];
    if (!u) return null;
    this.units[slot] = null;
    this.rebuild();
    return u;
  }

  // puts a shadow back into the army; false when there is no room
  attach(u) {
    let slot = -1;
    for (let i = 0; i < MAX_UNITS; i++) if (!this.units[i]) { slot = i; break; }
    if (slot < 0 || !this.hasRoom()) return false;
    u.slot = slot;
    this.units[slot] = u;
    this.recalc(u);
    if (u.alive && u.hp <= 0) u.hp = u.maxHp;
    this.rebuild();
    if (this.out && u.alive) this.placeAtHome(u, true);
    return true;
  }

  // a shadow trains for some hours: rate = levels worth of XP per hour (the barracks)
  train(u, hours, rate) {
    const S = CONFIG.shadows;
    if (this.isOfficer(u)) {
      const max = CONFIG.levels.maxLevel;
      if (this.powerLevel(u) >= max) return;
      if (!(u.olv > 0)) u.olv = u.plv;
      u.oxp = (u.oxp || 0) + this.officerNeed(u) * rate * hours;
      while (u.olv < max && u.oxp >= this.officerNeed(u)) {
        u.oxp -= this.officerNeed(u);
        u.olv = Math.max(u.olv, u.plv) + 1;
      }
    } else {
      let h = hours;
      while (h > 0 && u.level < S.maxLevel) {
        const need = this.xpNeed(u.level, u), perHour = need * rate, left = need - u.xp, tt = left / perHour;
        if (h >= tt) { h -= tt; u.level++; u.xp = 0; } else { u.xp += perHour * h; h = 0; }
      }
      let stage = 0;
      for (let s = 0; s < S.evolveLevels.length; s++) if (u.level >= S.evolveLevels[s]) stage = s + 1;
      u.stage = stage;
    }
    this.recalc(u);
    if (u.alive) u.hp = u.maxHp;
  }

  // ---- roster ---------------------------------------------------------------
  // how far around the player "Attack" hunts: grows with Perception
  huntRange() {
    const S = CONFIG.shadows;
    return Math.min(S.attackRangeMax, S.attackRange + this.game.player.stats.per * CONFIG.progression.stats.per.armyRange);
  }

  maxDeployed() {
    if (!this.game.hasArmy()) return 0; // the companion of the Ranger line is not part of the army
    // Intelligence decides how big the army can be
    const P = this.game.player, S = CONFIG.shadows;
    const n = S.baseSlots + Math.floor(P.stats.int * CONFIG.progression.stats.int.slots) + P.armySlots;
    return Math.min(this.game.path ? this.game.path.slotCap() : S.maxSlots, n);
  }

  totalCount() {
    return this.deployed.length;
  }

  hasRoom() {
    return this.deployed.length < this.maxDeployed();
  }

  name(u) {
    if (u.comp) return t('companion.name', { name: t('enemy.' + u.type) });
    if (u.nick) return u.nick;
    const base = t('enemy.' + u.type);
    const name = u.tier === 1 || u.tier === 2 ? t('tier.' + u.tier, { name: base }) : base;
    return t('shadow.stage.' + u.stage, { name });
  }

  // ---- ranks ------------------------------------------------------------------
  rankDef(u) {
    return CONFIG.shadows.ranks[u.rank || 0];
  }

  // officers (General and above): a name, no level cap, they level like the hunter
  isOfficer(u) {
    return !!this.rankDef(u).officer;
  }

  // the level a shadow's strength comes from
  powerLevel(u) {
    return this.isOfficer(u) ? Math.max(u.plv, u.olv || 0) : u.plv;
  }

  // the level shown for a shadow: officers show their own (hunter scale) level
  shownLevel(u) {
    return this.isOfficer(u) ? this.powerLevel(u) : u.level;
  }

  // XP an officer needs for its next level (the hunter's curve)
  officerNeed(u) {
    return hunterXpNeed(this.powerLevel(u));
  }

  // share of the way to the next level (0..1)
  xpShare(u) {
    if (this.isOfficer(u)) return this.powerLevel(u) >= CONFIG.levels.maxLevel ? 1 : Math.min(1, (u.oxp || 0) / this.officerNeed(u));
    return u.level >= CONFIG.shadows.maxLevel ? 1 : Math.min(1, u.xp / this.xpNeed(u.level, u));
  }

  // one number for sorting and comparing
  power(u) {
    return Math.round(Math.sqrt(u.maxHp * u.dmg));
  }

  rankCount(r) {
    let n = 0;
    for (const u of this.deployed) if ((u.rank || 0) === r) n++;
    return n;
  }

  // why rank r cannot go to this shadow ('' = it can)
  rankBlock(u, r) {
    const R = CONFIG.shadows.ranks[r];
    if (!R) return 'none';
    if ((u.rank || 0) === r) return 'has';
    if (r === 0) return '';
    if (u.level < R.level) return 'level';
    if (this.rankCount(r) >= R.max) return 'full';
    return '';
  }

  setRank(u, r) {
    if (this.rankBlock(u, r)) return false;
    u.rank = r;
    // an officer starts its own levels where its strength came from
    if (this.isOfficer(u) && !(u.olv > 0)) { u.olv = u.plv; u.oxp = 0; }
    this.afterRank(u);
    return true;
  }

  rename(u, name) {
    u.nick = String(name || '').replace(/\s+/g, ' ').trim().slice(0, CONFIG.shadows.nameMaxLength);
    this.version++;
  }

  rankColor(u) {
    return this.rankDef(u).color;
  }

  afterRank(u) {
    this.recalc(u);
    if (u.alive) u.hp = u.maxHp;
    this.version++;
    if (u.alive && this.out) {
      const c = this.rankColor(u);
      this.game.effects.burst(u.x, 1.2, u.z, 30, c, 7, 0.24, 0.9);
      this.game.effects.ring(u.x, u.z, 0.4, 3, c, 0.5);
    }
  }

  // a broken save may hold more of a rank than allowed: the extra ones become Normal
  checkRanks() {
    const R = CONFIG.shadows.ranks;
    for (let r = 1; r < R.length; r++) {
      let n = 0;
      for (const u of this.deployed) if (u.rank === r && ++n > R[r].max) u.rank = 0;
    }
  }

  recalc(u) {
    const S = CONFIG.shadows, role = S.roles[u.role];
    const def = CONFIG.enemies.types[u.type];
    const tier = S.tierFactor[u.tier] * (1 + u.stage * S.evolveBonus) * this.rankDef(u).mult;
    const plv = this.powerLevel(u);
    // shadows are as strong as the enemy they were raised from
    const pw = enemyPower(plv);
    const baseHp = (def.boss ? def.shadowBase.hp : def.hp) * pw;
    const baseDmg = (def.boss ? def.shadowBase.damage : def.damage) * pw;
    const lv = Math.pow(S.levelGrowth, u.level - 1);
    const P = this.game.player, Mo = S.monarch;
    // the companion has its own bonuses (companionHp), never the army's
    u.maxHp = Math.round(baseHp * S.hpFactor * role.hp * tier * lv * (1 + (u.comp ? P.companionHp || 0 : P.armyHp)));
    // damage: from the hunter (see CONFIG.shadows.monarch)
    const fresh = Math.min(Mo.freshMax, Math.max(Mo.freshMin, Math.pow(pw / enemyPower(P.level), Mo.freshPower)));
    u.dmg = P.monarchPower() * Mo.share * role.damage * tier * (1 + Mo.levelBonus * (u.level - 1)) * fresh;
    u.scale = (def.boss ? def.scale * 0.55 : def.scale) * S.scale * (1 + u.stage * S.evolveScale) * (1 + u.tier * 0.15);
    u.radius = def.radius * u.scale;
    u.speed = def.speed * S.combatSpeedFactor;
    if (u.hp > u.maxHp) u.hp = u.maxHp;
  }

  // called when the player's equipment changes (set bonuses for the army)
  recalcAll() {
    for (let i = 0; i < MAX_UNITS; i++) if (this.units[i]) this.recalc(this.units[i]);
    if (this.comp) this.recalc(this.comp);
  }

  // temporary damage bonus for every shadow (War Cry, Legion's Call)
  buff(damage, duration) {
    this.buffDamage = damage;
    this.buffT = duration;
  }

  // Dark Mend: every living deployed shadow gets back a share of its health
  healAll(share) {
    for (const u of this.fighters) {
      if (!u.alive) continue;
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * share);
      this.game.effects.burst(u.x, 1.2, u.z, 6, 0x5cf08a, 3, 0.16, 0.5);
    }
  }

  // revives every fallen deployed shadow at once, free of charge
  reviveAll() {
    for (let i = 0; i < this.fighters.length; i++) {
      const u = this.fighters[i];
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
    if (this.comp && this.compOn && this.comp.alive) this.placeAtHome(this.comp, true);
    if (!this.out) return;
    for (const u of this.deployed) if (u.alive) this.placeAtHome(u, true);
  }

  // Summons the whole army out of the shadows, or sends it back.
  toggleSummon() {
    if (this.summonCd > 0 || (this.game.gates && this.game.gates.solo)) return false;
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
      fx.ring(u.x, u.z, 1, ab.radius, 0x5cf08a, 0.5);
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
      fx.ring(u.x, u.z, 1, ab.radius, 0xff6070, 0.45);
      fx.burst(u.x, 1.5, u.z, 16, 0xff6070, 5, 0.2, 0.5);
    } else if (ab.name === 'cleave') {
      fx.slash(u.x, u.z, u.yaw, ab.radius, 360, this.auraHex, EXPAND, 1, 0.3);
      fx.burst(u.x, 1, u.z, 14, this.auraHex, 6, 0.2, 0.5);
    } else {
      fx.burst(u.x, 1.6, u.z, 10, this.auraHex, 3, 0.16, 0.4);
    }
    u.lunge = 1;
    u.abT = ab.cooldown;
  }

  // Creates a shadow. Returns the unit, or null when there is no room at all.
  add(type, tier, x, z, role, zone = 0, plv = 0) {
    const S = CONFIG.shadows;
    let slot = -1;
    for (let i = 0; i < MAX_UNITS; i++) if (!this.units[i]) { slot = i; break; }
    if (slot < 0 || !this.hasRoom()) return null;
    const u = {
      slot, type, ti: this.game.enemies.typeIndex[type],
      role: role || CONFIG.enemies.types[type].shadowRole,
      tier, zone, plv: plv || CONFIG.world.zones[zone].level, level: 1, xp: 0, totalXp: 0, stage: 0, rank: 0, nick: '', olv: 0, oxp: 0,
      abT: 2, tauntT: 0,
      alive: true, hp: 1, maxHp: 1, dmg: 1, radius: 0.7, scale: 1, speed: 5,
      x, z, yaw: Math.random() * TAU, ox: 0, oz: 0,
      target: -1, tgtT: Math.random() * 0.3, atkCd: 0, windup: 0, block: 0, pd: 1e9, chase: -1,
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
    this.active = this.game.hasArmy();
    this.compOn = !!this.game.hasCompanion && this.game.hasCompanion();
    this.deployed.length = 0;
    if (this.active) for (let i = 0; i < MAX_UNITS; i++) if (this.units[i]) this.deployed.push(this.units[i]);
    this.assignRings(this.deployed);
    this.fighters.length = 0;
    for (const u of this.deployed) this.fighters.push(u);
    if (this.comp && this.compOn) { this.comp.ox = 1.6; this.comp.oz = -1.2; this.fighters.push(this.comp); }
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
    return Math.round((R.cost + R.costPerLevel * u.level) * CONFIG.shadows.tierFactor[u.tier] * this.game.path.mult('reviveCostMult'));
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
      this.game.profile.revived++;
      n++;
    }
    if (n) this.version++;
    return n;
  }

  // ---- used by the enemies ---------------------------------------------------
  targetable(u) {
    if (!u || !u.alive || u.riseT > 0 || u.safe) return false;
    return u.comp ? this.compOn && u === this.comp : this.active && this.out && this.units[u.slot] === u;
  }

  // Most attractive shadow for an enemy at (x, z): close and threatening
  // (tanks draw attacks). Returns the slot or -1; pickW is the weighted
  // squared distance, comparable with the squared distance to the player.
  pickTarget(x, z, range) {
    const roles = CONFIG.shadows.roles;
    this.pickW = 1e9;
    if (!this.out && !this.compOn) return -1;
    const r2 = range * range;
    let best = -1, bw = 1e9;
    for (let i = 0; i < this.fighters.length; i++) {
      const u = this.fighters[i];
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
    const u = this.unit(slot);
    if (!u || !u.alive || (u.comp ? !this.compOn || u !== this.comp : !this.active)) return; // an inactive shadow cannot be hurt
    if (u.tauntT > 0) amount *= 1 - CONFIG.shadows.abilities.tank.reduction;
    if (u.apexT > 0) amount *= 1 - (u.apexGuard || 0); // Primal Apex
    if (u.comp) amount *= 1 - CONFIG.mechanics.companionBond.guard; // Protective Bond (class progression)
    u.hp -= amount;
    u.flash = 0.12;
    if (u.hp <= 0) {
      const R = CONFIG.shadows.revive;
      u.hp = 0;
      u.alive = false;
      if (!u.comp) this.game.profile.shadowsLost++;
      u.target = -1;
      u.windup = 0;
      u.reviveT = (R.cooldown + R.cooldownPerLevel * u.level) * (u.comp ? CONFIG.mechanics.companionBond.revive : 1);
      this.game.effects.burst(u.x, 0.9, u.z, 16, this.auraHex, 5, 0.24, 0.7);
      this.version++;
    }
  }

  // ---- experience -----------------------------------------------------------
  xpNeed(level, u) {
    const S = CONFIG.shadows;
    const pw = enemyPower(u ? this.powerLevel(u) : 1);
    return Math.round(S.xpBase * pw * Math.pow(S.xpGrowth, level - 1));
  }

  // killer = slot of the shadow that landed the kill (-1 = the player)
  grantXp(killer, xp) {
    const S = CONFIG.shadows;
    // resting or inactive shadows learn nothing; the companion learns while its class has it
    const list = this.out ? this.fighters : this.compOn && this.comp ? [this.comp] : null;
    if (!list) return;
    for (let i = 0; i < list.length; i++) {
      const u = list[i];
      if (!u.alive) continue;
      const gain = u.slot === killer ? xp : xp * S.xpShare;
      if (this.isOfficer(u)) { this.officerXp(u, gain); continue; }
      if (u.level >= S.maxLevel) continue;
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

  officerXp(u, gain) {
    const max = CONFIG.levels.maxLevel;
    u.totalXp += gain;
    if (this.powerLevel(u) >= max) return;
    if (!(u.olv > 0)) u.olv = u.plv;
    u.oxp = (u.oxp || 0) + gain;
    let ups = 0;
    while (u.olv < max && u.oxp >= this.officerNeed(u)) {
      u.oxp -= this.officerNeed(u);
      u.olv = Math.max(u.olv, u.plv) + 1;
      ups++;
    }
    if (!ups) return;
    this.recalc(u);
    u.hp = u.maxHp;
    this.game.effects.burst(u.x, 1.2, u.z, 12, this.rankColor(u), 5, 0.2, 0.7);
    this.version++;
  }

  // The enemy a fighter goes for: the closest one, but every shadow already on
  // an enemy makes it look `crowd` units further away (its own target not
  // counted), so the army spreads over the enemies instead of piling up.
  pickEnemy(u, ax, az, range, crowd) {
    const E = this.game.enemies, claims = this.claims;
    let best = -1, bs = 1e9;
    for (let k = 0; k < E.activeCount; k++) {
      const i = E.active[k];
      if (!E.alive[i]) continue;
      const hx = E.x[i] - ax, hz = E.z[i] - az;
      const reach = range + E.radius[i];
      if (hx * hx + hz * hz > reach * reach) continue;
      const dx = E.x[i] - u.x, dz = E.z[i] - u.z;
      let c = claims.get(i) || 0;
      if (i === u.target) c--;
      const s = Math.sqrt(dx * dx + dz * dz) + crowd * Math.max(0, c);
      if (s < bs) { bs = s; best = i; }
    }
    return best;
  }

  // ---- simulation -----------------------------------------------------------
  update(dt) {
    const game = this.game, P = game.player, E = game.enemies, fx = game.effects, world = game.world;
    const S = CONFIG.shadows, roles = S.roles;
    const D = this.fighters; // the active shadows and the companion; inactive shadows are not touched
    const tele2 = S.teleportDist * S.teleportDist;
    // during Shadow Step the shadows run as fast as the hunter
    const follow = P.sprint ? Math.max(S.followSpeed, P.speed * P.sprintMult() * 1.1) : S.followSpeed;
    const huntRange = this.huntRange();
    const variance = CONFIG.combat.damageVariance;
    if (this.buffT > 0) this.buffT -= dt;
    const weak = game.modOn('weakArmy');
    const buff = this.buffT > 0 ? this.buffDamage : 0;
    const armyMult = (1 + P.armyDamage + buff) * (weak ? weak.damage : 1);
    const compMult = 1 + (P.companionDamage || 0) + buff; // the companion: its own bonuses, not the army's

    if (this.summonCd > 0) this.summonCd -= dt;
    this.total = this.alive = this.ready = this.readyCost = 0;
    this.nextReady = 0;
    for (let t2 = 0; t2 < this.types.length; t2++) { this.types[t2].n = 0; this.types[t2].g = 0; }
    this.time += dt;
    const out = this.out || !this.active; // without an active army only the companion is here, and it is always out
    // how many shadows are on each enemy (spreads the army over the enemies)
    const claims = this.claims;
    claims.clear();
    if (out) {
      for (let n = 0; n < D.length; n++) {
        const u = D[n];
        if (u.alive && u.target >= 0) claims.set(u.target, (claims.get(u.target) || 0) + 1);
      }
    }

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
      // the companion's orders (Beastmaster: Prey Mark, Pack Assault, Primal Apex; combat/abilities.js)
      let um = 1;
      if (u.cmdT > 0) { u.cmdT -= dt; um += u.cmdDmg; }
      if (u.preyT > 0) u.preyT -= dt;
      if (u.apexT > 0) {
        um += u.apexDmg;
        if (Math.random() < dt * 6) fx.burst(u.x, 1.2 * u.scale, u.z, 2, 0xff8a3a, 3, 0.2, 0.5, 2);
        if ((u.apexT -= dt) <= 0) { u.apexT = 0; this.recalc(u); u.hp = Math.min(u.hp, u.maxHp); } // back to its own form
      }
      const dmgMult = (u.comp ? compMult : armyMult) * um;
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
      const range = this.behavior === B_ATTACK ? huntRange : S.guardRange;

      // never get lost: shadows far behind are pulled to the player
      const fxd = u.x - P.x, fzd = u.z - P.z;
      if (fxd * fxd + fzd * fzd > tele2) this.placeAtHome(u, true);
      u.safe = game.gates.active < 0 && world.safeIndexAt(u.x, u.z) >= 0;
      if (u.hp < u.maxHp && u.safe) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * S.campRegen * dt);
      }

      let mvx = 0, mvz = 0, speed = 0;

      if (role.heal) {
        // ---- healer: mends the most wounded ally; with nobody to heal it
        // walks into reach of the nearest enemy and shoots weak bolts
        if (u.chase >= 0 && !E.alive[u.chase]) u.chase = -1;
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
            u.chase = -1;
          } else {
            // nobody to heal: a weak bolt at the nearest enemy in reach
            const tg = E.nearestAround(u.x, u.z, ax, az, range);
            u.chase = tg;
            if (tg >= 0) {
              const dx = E.x[tg] - u.x, dz = E.z[tg] - u.z;
              const reach = role.range + E.radius[tg];
              if (dx * dx + dz * dz <= reach * reach) {
                const dmg = Math.max(1, Math.round(u.dmg * dmgMult * (1 + (Math.random() * 2 - 1) * variance)));
                game.projectiles.fire(u.x, u.z, tg, role.projectileSpeed, dmg, u.slot);
                u.yaw = Math.atan2(dx, dz);
                u.lunge = 1;
                u.atkCd = role.cooldown * (0.85 + Math.random() * 0.3);
              }
            }
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
          tg = this.pickEnemy(u, ax, az, range, role.projectileSpeed ? S.crowd.ranged : S.crowd.melee);
        }
        if (tg !== u.target) {
          if (u.target >= 0) claims.set(u.target, (claims.get(u.target) || 1) - 1);
          if (tg >= 0) claims.set(tg, (claims.get(tg) || 0) + 1);
          u.block = 0;
          u.pd = 1e9;
        }
        u.target = tg;

        if (tg >= 0) {
          const dx = E.x[tg] - u.x, dz = E.z[tg] - u.z;
          const d = Math.sqrt(dx * dx + dz * dz) || 0.001;
          const reach = role.range + E.radius[tg] + u.radius;
          // no closer than a moment ago although walking: others are in the way
          if (u.windup <= 0 && d > reach * 0.9 && u.pd - d < u.speed * dt * 0.3) u.block += dt;
          else u.block = 0;
          u.pd = d;
          const blocked = u.block > S.blockedTime && d <= reach + S.blockedReach;
          if (u.windup > 0) {
            u.windup -= dt;
            u.yaw = Math.atan2(dx, dz);
            if (u.windup <= 0) {
              u.lunge = 1;
              u.atkCd = role.cooldown * (0.85 + Math.random() * 0.3);
              if (d <= reach + S.blockedReach + 0.6) {
                const dmg = Math.max(1, Math.round(u.dmg * dmgMult * (u.preyT > 0 && E.vuln[tg] > 0 ? 1 + u.preyDmg : 1) * (1 + (Math.random() * 2 - 1) * variance)));
                if (role.projectileSpeed) game.projectiles.fire(u.x, u.z, tg, role.projectileSpeed, dmg, u.slot);
                else E.damage(tg, dmg, dx / d, dz / d, u.slot);
              }
            }
          } else if (d > reach * 0.9 && !blocked) {
            mvx = dx; mvz = dz; speed = u.speed;
            // stuck behind others: slide sideways around the enemy
            if (u.block > 0.1) {
              const side = u.slot % 2 ? 1 : -1;
              mvx = dx / d + (-dz / d) * side * 1.2;
              mvz = dz / d + (dx / d) * side * 1.2;
            }
          } else {
            u.yaw = Math.atan2(dx, dz);
            if (u.atkCd <= 0) u.windup = role.windup;
          }
        }
      }

      // a healer with nobody to heal walks into reach of its enemy
      let chasing = false;
      if (role.heal && u.chase >= 0) {
        const dx = E.x[u.chase] - u.x, dz = E.z[u.chase] - u.z;
        const reach = role.range * 0.85 + E.radius[u.chase];
        if (dx * dx + dz * dz > reach * reach) { mvx = dx; mvz = dz; speed = u.speed; chasing = true; }
      }

      // ---- nothing to fight: back into formation
      if ((u.target < 0 || role.heal) && !chasing) {
        mvx = ax + u.ox - u.x;
        mvz = az + u.oz - u.z;
        const d2 = mvx * mvx + mvz * mvz;
        speed = d2 > 0.16 ? Math.min(follow, Math.sqrt(d2) * 4) : 0;
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
      ty.glow.count = ty.g;
      ty.glow.visible = ty.g > 0;
      if (ty.g > 0) {
        ty.glow.instanceMatrix.needsUpdate = true;
        ty.glow.instanceColor.needsUpdate = true;
      }
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
    // rank aura: none below Elite Knight, a faint one for Elite Knights,
    // a bright pulsing one for officers
    const r = u.rank || 0;
    if (r < 2 || u.riseT > 0 || ty.g >= MAX_VISIBLE) return;
    const gn = ty.g++, ga = ty.glow.instanceMatrix.array, go = gn * 16;
    for (let q = 0; q < 16; q++) ga[go + q] = a[o + q];
    const gs = GLOW_SIZE + (r >= 3 ? 0.04 : 0);
    for (const q of [0, 1, 2, 4, 5, 6, 8, 9, 10]) ga[go + q] *= gs;
    ga[go + 13] -= 0.04 * s; // the outline reaches a little under the feet too
    const k2 = r === 2 ? 0.08 : 0.75 + Math.sin(this.time * 4 + u.slot) * 0.2;
    _ac.setHex(this.rankColor(u));
    const gc = ty.glow.instanceColor.array;
    gc[gn * 3] = _ac.r * k2; gc[gn * 3 + 1] = _ac.g * k2; gc[gn * 3 + 2] = _ac.b * k2;
  }
}
