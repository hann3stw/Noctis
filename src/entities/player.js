// The player: movement, dodge, attack charges, skills, health, mana, levels,
// stat points, equipment and inventory.
import { CONFIG } from '../config.js';
import { fmt } from '../core/format.js';
import { input } from '../input/input.js';
import { createPlayerModel } from '../render/models/player.js';
import { fireWeapon } from '../combat/weapons.js';
import { castSkill, skillDef } from '../combat/skills.js';
import {
  makeWeapon, weaponDamage, armorDefense, armorBonus, upgradeCost, dismantleValue, slotOf, itemName, ARMOR_SLOTS,
} from '../core/items.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

const ANIM = { moving: false, attack: 0, weapon: 'sword', combo: 0, cast: 0, dodging: false, dead: false };
// how fast the attack animation plays per weapon (1 / seconds)
const SWING_RATE = { daggers: 8, sword: 4.5, bow: 4, scythe: 3.4, staff: 3.4 };
export const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'per'];

export class Player {
  constructor(game, appearance) {
    this.game = game;
    const c = CONFIG.player;
    this.x = 0;
    this.z = 5;
    this.dirX = 0; // facing
    this.dirZ = 1;
    this.radius = c.radius;

    // ---- progression (everything in this block is saved later)
    this.level = 1;
    this.xp = 0;
    this.points = 0;
    this.stats = { str: 0, agi: 0, vit: 0, int: 0, per: 0 };
    this.essence = 0; // upgrade material from dismantled items
    this.inventory = [];
    this.equip = { weapon: makeWeapon(c.startWeapon, 0, 1), helmet: null, chest: null, gloves: null, boots: null };
    this.known = [...c.startSkills, c.startUltimate]; // learned skills and ultimates
    this.slots = [c.startSkills[0] || null, c.startSkills[1] || null, c.startUltimate]; // skill 1, skill 2, ultimate

    // ---- derived values, see recalc()
    this.bonus = {};
    this.setCount = {};
    this.maxHp = c.baseHp;
    this.maxMana = c.baseMana;
    this.manaRegen = c.manaRegen;
    this.speed = c.baseSpeed;
    this.reloadTime = 1;
    this.crit = 0;
    this.drop = 0;
    this.damageMult = 1;
    this.defense = 0;
    this.taken = 1;
    this.armyDamage = 0;
    this.armyHp = 0;
    this.armySlots = 0;

    this.charges = c.charges.max;
    this.maxCharges = c.charges.max;
    this.reloadT = 0; // 0..1 progress of the charge being reloaded
    this.atkCd = 0;
    this.attackAnim = 0;
    this.castAnim = 0;
    this.combo = 0;
    this.pendingFire = false;
    this.pendingAuto = false;
    this.pendingX = 0;
    this.pendingZ = 1;
    this.pendingP = 1;
    this.noAmmoFlash = 0;

    this.cds = [0, 0]; // skill cooldowns
    this.ult = 0; // ultimate charge
    this.shield = 0;
    this.shieldT = 0;
    this.eclipseT = 0;

    this.dodgeT = 0;
    this.dodgeCd = 0;
    this.dodgeX = 0;
    this.dodgeZ = 0;
    this.invuln = 0;

    this.dead = false;
    this.respawnT = 0;
    this.inCamp = true;
    this.safeIndex = 0;
    this.hpRegen = 0;
    this.critDmg = 1.8;
    this.dodgeCdMax = c.dodge.cooldown;
    this.takenBonus = 1;
    this.levelMult = 1;
    this.moving = false;
    this.hurtFlash = 0;

    this.model = createPlayerModel(appearance);
    game.scene.add(this.model.root);
    this.recalc();
    this.hp = this.maxHp;
    this.mana = this.maxMana;
  }

  get weapon() {
    return this.equip.weapon.type;
  }

  // ---- saving ---------------------------------------------------------------
  serialize() {
    return {
      x: this.x, z: this.z, hp: this.hp, mana: this.mana, ult: this.ult,
      level: this.level, xp: this.xp, points: this.points, stats: { ...this.stats }, essence: this.essence,
      inventory: this.inventory.map((it) => ({ ...it })),
      equip: Object.fromEntries(Object.entries(this.equip).map(([k, v]) => [k, v ? { ...v } : null])),
      known: [...this.known], slots: [...this.slots],
    };
  }

  restore(d) {
    if (!d) return;
    this.level = d.level || 1;
    this.xp = d.xp || 0;
    this.points = d.points || 0;
    for (const k of STAT_KEYS) this.stats[k] = (d.stats && d.stats[k]) || 0;
    this.essence = d.essence || 0;
    this.inventory = (d.inventory || []).filter((it) => it && (it.kind !== 'weapon' || CONFIG.weapons[it.type]));
    for (const slot in this.equip) {
      const it = d.equip && d.equip[slot];
      if (it && (it.kind !== 'weapon' || CONFIG.weapons[it.type])) this.equip[slot] = it;
      else if (slot !== 'weapon') this.equip[slot] = null;
    }
    const valid = (id) => CONFIG.skills[id] || CONFIG.ultimates[id];
    if (d.known) this.known = d.known.filter(valid);
    if (d.slots) this.slots = d.slots.map((id) => (id && valid(id) ? id : null));
    this.ult = d.ult || 0;
    this.recalc();
    // the camp is safe: start there when the saved spot is unknown
    if (typeof d.x === 'number' && typeof d.z === 'number') { this.x = d.x; this.z = d.z; }
    this.hp = Math.min(this.maxHp, d.hp > 0 ? d.hp : this.maxHp);
    this.mana = Math.min(this.maxMana, d.mana >= 0 ? d.mana : this.maxMana);
  }

  // Swaps the character model (skin editor in the camp).
  setAppearance(appearance) {
    const old = this.model.root;
    this.game.scene.remove(old);
    old.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    this.model = createPlayerModel(appearance);
    this.model.setEquipment(this.equip);
    this.model.root.rotation.y = old.rotation.y;
    this.game.scene.add(this.model.root);
  }

  // ---- derived values -------------------------------------------------------
  recalc() {
    const c = CONFIG.player, G = CONFIG.progression, S = G.stats, st = this.stats;
    const b = this.bonus;
    b.hp = b.speed = b.mana = b.crit = b.reload = b.damage = b.damageTaken = b.armyDamage = b.armyHp = b.armySlots = 0;
    for (const set in CONFIG.items.sets) this.setCount[set] = 0;
    let def = 0;
    for (const slot of ARMOR_SLOTS) {
      const it = this.equip[slot];
      if (!it) continue;
      def += armorDefense(it);
      b[it.bonus] += armorBonus(it);
      this.setCount[it.set]++;
    }
    for (const set in CONFIG.items.sets) {
      const tiers = CONFIG.items.sets[set];
      for (const need in tiers) {
        if (this.setCount[set] >= Number(need)) for (const k in tiers[need]) b[k] += tiers[need][k];
      }
    }
    const oldMax = this.maxHp;
    // every level and every Vitality point multiply the health
    this.levelMult = Math.pow(G.levelGrowth, this.level - 1);
    this.maxHp = Math.round(c.baseHp * this.levelMult * Math.pow(1 + S.vit.hp, st.vit) * (1 + b.hp));
    this.hpRegen = st.vit * S.vit.regen * this.maxHp;
    if (this.hp !== undefined && this.maxHp > oldMax && !this.dead) this.hp += this.maxHp - oldMax;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    this.maxMana = Math.round((c.baseMana + st.int * S.int.mana) * (1 + b.mana));
    if (this.mana > this.maxMana) this.mana = this.maxMana;
    this.manaRegen = c.manaRegen + st.int * S.int.manaRegen;
    this.speed = c.baseSpeed * (1 + st.agi * S.agi.speed + b.speed);
    this.reloadTime = CONFIG.weapons[this.weapon].reload / (1 + st.agi * S.agi.reload + b.reload);
    this.crit = G.baseCrit + st.per * S.per.crit + b.crit;
    this.critDmg = G.critDamage + st.per * S.per.critDamage;
    this.dodgeCdMax = c.dodge.cooldown / (1 + st.agi * S.agi.dodge);
    this.drop = st.per * S.per.drop;
    this.damageMult = this.levelMult * Math.pow(1 + S.str.damage, st.str) * (1 + b.damage);
    this.defense = def;
    this.takenBonus = 1 + b.damageTaken;
    this.armyDamage = b.armyDamage;
    this.armyHp = b.armyHp;
    this.armySlots = b.armySlots;
    this.model.setEquipment(this.equip);
    if (this.game.army) this.game.army.recalcAll();
  }

  // Share of damage that gets through. Armour counts less in stronger zones
  // (K grows with the zone's power), so new zones need new armour.
  takenFactor() {
    const zi = Math.max(0, this.game.curZone);
    const K = CONFIG.progression.defenseK * Math.pow(CONFIG.items.levelGrowth, CONFIG.world.zones[zi].level - 1);
    return (K / (K + this.defense)) * this.takenBonus;
  }

  // damage of one basic attack before variance and crit
  power() {
    let p = weaponDamage(this.equip.weapon) * this.damageMult;
    if (this.eclipseT > 0) p *= 1 + CONFIG.ultimates.eclipse.damage;
    return p;
  }

  // ---- levels ---------------------------------------------------------------
  xpNeed() {
    const G = CONFIG.progression;
    return Math.round(G.xpBase * Math.pow(G.xpGrowth, this.level - 1));
  }

  addXp(amount) {
    const G = CONFIG.progression;
    if (this.level >= G.maxLevel) return;
    this.xp += amount;
    let gained = 0;
    while (this.level < G.maxLevel && this.xp >= this.xpNeed()) {
      this.xp -= this.xpNeed();
      this.level++;
      this.points += G.pointsPerLevel;
      gained += G.pointsPerLevel;
    }
    if (!gained) return;
    this.recalc();
    if (!this.dead) { this.hp = this.maxHp; this.mana = this.maxMana; }
    this.game.effects.burst(this.x, 1.5, this.z, 36, 0xffd24a, 8, 0.22, 0.9);
    this.game.effects.ring(this.x, this.z, 0.5, 5, 0xffd24a, 0.6);
    this.game.effects.ring(this.x, this.z, 0.5, 3, 0xfff0b0, 0.5, 0.15);
    play('levelup');
    this.game.hud.toast(t('toast.levelUp', { level: this.level, points: gained }));
    this.game.checkRank();
  }

  spendPoint(stat) {
    if (this.points <= 0) return false;
    this.points--;
    this.stats[stat]++;
    this.recalc();
    return true;
  }

  // ---- items ----------------------------------------------------------------
  // Takes a dropped item. Skills are learned at once. False = inventory full.
  addItem(item) {
    const hud = this.game.hud;
    if (item.kind === 'skill') {
      if (this.known.includes(item.type)) {
        this.essence += 5;
        hud.toast(t('toast.essence', { n: 5 }));
      } else {
        this.learn(item.type);
        hud.toast(t('toast.learned', { name: itemName(item) }));
      }
      return true;
    }
    if (this.inventory.length >= CONFIG.items.inventorySize) return false;
    this.inventory.push(item);
    hud.toast(t('toast.found', { name: t('rarity.' + item.rarity) + ' ' + itemName(item) }));
    return true;
  }

  learn(id) {
    if (this.known.includes(id)) return;
    this.known.push(id);
    // new skills go straight into a free slot
    if (CONFIG.ultimates[id]) { if (!this.slots[2]) this.slots[2] = id; }
    else if (!this.slots[0]) this.slots[0] = id;
    else if (!this.slots[1]) this.slots[1] = id;
  }

  // slot: 0 / 1 = skills, 2 = ultimate
  setSlot(slot, id) {
    if (!this.known.includes(id)) return;
    const isUlt = !!CONFIG.ultimates[id];
    if (isUlt !== (slot === 2)) return;
    if (slot < 2) {
      const other = 1 - slot;
      if (this.slots[other] === id) this.slots[other] = this.slots[slot]; // swap
    }
    this.slots[slot] = id;
  }

  equipItem(item) {
    const i = this.inventory.indexOf(item);
    if (i < 0) return;
    const slot = slotOf(item);
    const old = this.equip[slot];
    if (old) this.inventory[i] = old;
    else this.inventory.splice(i, 1);
    this.equip[slot] = item;
    this.recalc();
  }

  upgradeItem(item) {
    const cost = upgradeCost(item);
    if (item.up >= CONFIG.items.maxUpgrade || this.essence < cost) return false;
    this.essence -= cost;
    item.up++;
    this.recalc();
    return true;
  }

  dismantleItem(item) {
    const i = this.inventory.indexOf(item);
    if (i < 0) return;
    this.inventory.splice(i, 1);
    this.essence += dismantleValue(item);
  }

  // ---- health ---------------------------------------------------------------
  heal(amount) {
    if (this.dead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  damage(amount) {
    if (this.dead || this.invuln > 0) return;
    const fx = this.game.effects;
    let d = amount * this.takenFactor();
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, d);
      this.shield -= absorbed;
      d -= absorbed;
      fx.burst(this.x, 1.2, this.z, 4, 0x6aa8ff, 4, 0.14, 0.3);
      if (d < 0.5) return;
    }
    d = Math.max(1, Math.round(d));
    this.hp -= d;
    this.hurtFlash = 1;
    play('hurt');
    if (d > this.maxHp * 0.15) this.game.cam.shake(0.25, 0.2);
    fx.number(this.x, 2.6, this.z, fmt(d), 'hurt');
    fx.burst(this.x, 1.2, this.z, 5, 0xff4a5a, 4, 0.14, 0.35);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.shield = 0;
      this.eclipseT = 0;
      this.respawnT = CONFIG.player.respawnDelay;
      play('death');
      fx.burst(this.x, 1.2, this.z, 24, 0x8a4dff, 6, 0.22, 0.8);
    }
  }

  respawn() {
    this.dead = false;
    const sp = this.game.respawnSpot();
    this.x = sp.x;
    this.z = sp.z;
    this.dirX = 0;
    this.dirZ = 1;
    this.hp = this.maxHp;
    this.charges = this.maxCharges;
    this.reloadT = 0;
    this.invuln = 1;
    this.pendingFire = false;
    this.game.onPlayerRespawn();
  }

  // ---- per frame ------------------------------------------------------------
  update(dt) {
    const c = CONFIG.player;
    const game = this.game;
    const sticks = input.sticks;
    if (this.hurtFlash > 0) this.hurtFlash -= dt * 2.5;
    if (this.noAmmoFlash > 0) this.noAmmoFlash -= dt;

    if (this.dead) {
      input.dodge = false;
      for (let k = 0; k < 4; k++) sticks[k].fire = false;
      this.moving = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      this.sync(dt);
      return;
    }

    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt * (SWING_RATE[this.weapon] || 4.5);
    if (this.castAnim > 0) this.castAnim -= dt * 3;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.cds[0] > 0) this.cds[0] -= dt;
    if (this.cds[1] > 0) this.cds[1] -= dt;
    if (this.eclipseT > 0) this.eclipseT -= dt;
    if (this.shieldT > 0) {
      this.shieldT -= dt;
      if (this.shieldT <= 0) this.shield = 0;
    }

    // ---- movement
    let mx = input.touchX + input.keyX, mz = input.touchZ + input.keyZ;
    const ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    this.moving = ml > 0.01;

    if (input.dodge) {
      input.dodge = false;
      if (this.dodgeCd <= 0 && this.dodgeT <= 0) {
        if (this.moving) { this.dodgeX = mx / Math.min(ml, 1); this.dodgeZ = mz / Math.min(ml, 1); }
        else { this.dodgeX = this.dirX; this.dodgeZ = this.dirZ; }
        this.dirX = this.dodgeX;
        this.dirZ = this.dodgeZ;
        this.dodgeT = c.dodge.duration;
        this.dodgeCd = this.dodgeCdMax;
        this.invuln = Math.max(this.invuln, c.dodge.invuln);
        game.effects.burst(this.x, 0.6, this.z, 10, 0x8a4dff, 3, 0.2, 0.4);
        game.effects.ring(this.x, this.z, 0.4, 2.2, 0x9fd0ff, 0.25);
      }
    }

    let nx = this.x, nz = this.z;
    if (this.dodgeT > 0) {
      const step = Math.min(dt, this.dodgeT);
      const v = c.dodge.distance / c.dodge.duration;
      nx += this.dodgeX * v * step;
      nz += this.dodgeZ * v * step;
      this.dodgeT -= dt;
      this.moving = true;
    } else if (this.moving) {
      nx += mx * this.speed * dt;
      nz += mz * this.speed * dt;
    }

    // world edge and obstacles
    const lim = game.world.radius - 1.5;
    const r2 = nx * nx + nz * nz;
    if (r2 > lim * lim && game.gates.active < 0) { const k = lim / Math.sqrt(r2); nx *= k; nz *= k; }
    if (game.gates.active >= 0) {
      game.gates.clamp(nx, nz, this.radius);
      this.x = game.gates.cx;
      this.z = game.gates.cz;
    } else {
      game.world.resolve(nx, nz, this.radius);
      this.x = game.world.rx;
      this.z = game.world.rz;
    }
    // camp or outpost: safe, heals, equipment can be changed
    this.safeIndex = game.gates.active >= 0 ? -1 : game.world.safeIndexAt(this.x, this.z);
    this.inCamp = this.safeIndex >= 0;

    // ---- charges reload one after another
    if (this.charges < this.maxCharges) {
      this.reloadT += dt / this.reloadTime;
      if (this.reloadT >= 1) { this.charges++; this.reloadT = this.charges < this.maxCharges ? this.reloadT - 1 : 0; }
    }

    // ---- basic attack
    const s0 = sticks[0];
    if (s0.fire) {
      s0.fire = false;
      this.pendingFire = true;
      this.pendingAuto = s0.auto;
      this.pendingX = s0.fx;
      this.pendingZ = s0.fz;
      this.pendingP = s0.fp;
    }
    if (this.pendingFire) {
      if (this.charges <= 0 && this.eclipseT <= 0) {
        this.pendingFire = false;
        this.noAmmoFlash = 0.3;
      } else if (this.atkCd <= 0 && this.dodgeT <= 0) {
        this.pendingFire = false;
        this.attack();
      }
    }

    // ---- skills and ultimate
    for (let k = 1; k < 4; k++) {
      const s = sticks[k];
      if (!s.fire) continue;
      s.fire = false;
      this.cast(k - 1, s.auto, s.fx, s.fz, s.fp);
    }

    // ---- facing
    let aim = null;
    for (let k = 0; k < 4; k++) if (sticks[k].aiming) { aim = sticks[k]; break; }
    if (aim) { this.dirX = aim.x; this.dirZ = aim.z; }
    else if (this.attackAnim <= 0 && this.dodgeT <= 0 && ml > 0.01) { this.dirX = mx / ml; this.dirZ = mz / ml; }

    // ---- camp heals, mana comes back on its own
    if (this.hp < this.maxHp) {
      const regen = this.hpRegen + (this.inCamp ? this.maxHp * c.campRegen : 0);
      this.hp = Math.min(this.maxHp, this.hp + regen * dt);
    }
    if (this.mana < this.maxMana) {
      const regen = this.manaRegen + (this.inCamp ? c.campManaRegenPerSec : 0);
      this.mana = Math.min(this.maxMana, this.mana + regen * dt);
    }

    this.sync(dt);
  }

  // Auto aim: direction to the nearest enemy, result in pendingX/Z/P.
  autoAim(range) {
    const E = this.game.enemies;
    const i = E.nearest(this.x, this.z, range + CONFIG.player.autoAimExtraRange);
    if (i < 0) {
      this.pendingX = this.dirX;
      this.pendingZ = this.dirZ;
      this.pendingP = 0.6;
      return;
    }
    const dx = E.x[i] - this.x, dz = E.z[i] - this.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    this.pendingX = dx / d;
    this.pendingZ = dz / d;
    this.pendingP = Math.min(1, d / range);
  }

  attack() {
    const w = CONFIG.weapons[this.weapon];
    if (this.pendingAuto) this.autoAim(w.range);
    this.dirX = this.pendingX;
    this.dirZ = this.pendingZ;
    if (this.eclipseT <= 0) this.charges--;
    this.atkCd = w.cooldown;
    this.combo ^= 1;
    this.attackAnim = 1;
    play('swing');
    fireWeapon(this.game, this.weapon, this.pendingX, this.pendingZ, this.pendingP);
  }

  // slot 0 / 1 = skills, 2 = ultimate
  cast(slot, auto, dx, dz, power) {
    const id = this.slots[slot];
    if (!id || this.dodgeT > 0) return;
    const def = skillDef(id);
    const hud = this.game.hud;
    if (slot === 2) {
      if (this.ult < CONFIG.progression.ultCharge.max) { hud.deny(slot); return; }
    } else {
      if (this.cds[slot] > 0) { hud.deny(slot); return; }
      if (this.mana < def.mana) { hud.deny(slot); hud.toast(t('toast.noMana')); return; }
    }
    this.pendingX = dx;
    this.pendingZ = dz;
    this.pendingP = power;
    if (def.aim === 'self') { this.pendingX = this.dirX; this.pendingZ = this.dirZ; }
    else if (auto) this.autoAim(def.range);
    if (slot === 2) this.ult = 0;
    else { this.mana -= def.mana; this.cds[slot] = def.cooldown; }
    this.dirX = this.pendingX;
    this.dirZ = this.pendingZ;
    this.castAnim = 1;
    play(slot === 2 ? 'ult' : 'skill');
    castSkill(this.game, id, this.pendingX, this.pendingZ, this.pendingP);
    if (slot === 2) this.ult = 0; // the ultimate does not charge itself
  }

  sync(dt) {
    const root = this.model.root;
    root.position.set(this.x, 0, this.z);
    // turn smoothly towards the facing direction
    const target = Math.atan2(this.dirX, this.dirZ);
    let diff = target - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    root.rotation.y += diff * Math.min(1, dt * 22);
    ANIM.moving = this.moving;
    ANIM.attack = this.attackAnim > 0 ? this.attackAnim : 0;
    ANIM.cast = this.castAnim > 0 ? this.castAnim : 0;
    ANIM.weapon = this.weapon;
    ANIM.combo = this.combo;
    ANIM.dodging = this.dodgeT > 0;
    ANIM.dead = this.dead;
    this.model.animate(dt, ANIM);
    this.game.effects.blob(this.x, this.z, 0.75);
    if (this.shield > 0) this.game.effects.showBubble(this.x, this.z, Math.min(1, this.shield / (this.maxHp * 0.4)));
  }
}
