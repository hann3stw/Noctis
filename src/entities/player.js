// The player: movement, dodge, attack charges, skills, health, mana, levels,
// stat points, equipment and inventory.
import { CONFIG } from '../config.js';
import { playerPower, playerHpPower, enemyPower, rankOf, hunterXpNeed } from '../core/levels.js';
import { fmt } from '../core/format.js';
import { input } from '../input/input.js';
import { createPlayerModel } from '../render/models/player.js';
import { fireWeapon, echoWave } from '../combat/weapons.js';
import { castSkill, skillDef } from '../combat/skills.js';
import { makeWeapon, weaponDamage, skillDamage, armorDefense, armorBonus, upgradeCost, dismantleValue, slotOf, itemName, ARMOR_SLOTS, itemPower, uniqueDef, attuneLevel, attuneCost } from '../core/items.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

const ANIM = { moving: false, attack: 0, weapon: 'sword', combo: 0, cast: 0, dodging: false, dead: false, rate: 1 };
// how fast the attack animation plays per weapon (1 / seconds)
const SWING_RATE = { daggers: 8, sword: 4.5, bow: 4, scythe: 3.4, staff: 3.4, spear: 5, hammer: 2.8, grimoire: 4 };
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
    this.autoSalvage = -1; // items up to this rarity are dismantled on pickup (-1 = off)
    this.inventory = [];
    this.newSkills = []; // skills found but not looked at yet
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
    this.luck = 0;
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
    this.cdMax = [1, 1]; // what they started at (for the HUD)
    this.ult = 0; // ultimate charge
    this.ultLockT = 0; // > 0: an ultimate is active, hits do not charge the next one
    this.shield = 0;
    this.shieldMax = 1;
    this.shieldT = 0;
    // after the last level: mastery levels and points (s = points spent per kind)
    this.mastery = { lv: 0, xp: 0, pts: 0, s: { damage: 0, hp: 0, armyDamage: 0, armyHp: 0, loot: 0, crit: 0 } };
    this.uq = {}; // effects of the worn unique items: id -> values
    this.frenzy = 0; // Frenzy Grips: faster reload
    this.frenzyT = 0;
    this.bastionCd = 0; // Bastion of Night: time until the next shield
    this.eclipseT = 0;
    this.rageT = 0; // Blood Rage
    this.chillT = 0; // slowed by a chilling shot
    this.counts = { attack: 0, dodge: 0, cast: 0 }; // for the tutorial

    this.dodgeT = 0;
    this.dodgeCd = 0;
    this.dodgeX = 0;
    this.dodgeZ = 0;
    this.sprint = false; // Shadow Step on
    this.calmT = 99; // seconds since the last hit, attack or skill
    this.idleT = 0;
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
      level: this.level, xp: this.xp, points: this.points, stats: { ...this.stats }, essence: this.essence, autoSalvage: this.autoSalvage,
      inventory: this.inventory.map((it) => ({ ...it })),
      equip: Object.fromEntries(Object.entries(this.equip).map(([k, v]) => [k, v ? { ...v } : null])),
      known: [...this.known], slots: [...this.slots], newSkills: [...this.newSkills],
      mastery: { lv: this.mastery.lv, xp: this.mastery.xp, pts: this.mastery.pts, s: { ...this.mastery.s } },
    };
  }

  restore(d) {
    if (!d) return;
    this.level = d.level || 1;
    this.xp = d.xp || 0;
    this.points = d.points || 0;
    for (const k of STAT_KEYS) this.stats[k] = (d.stats && d.stats[k]) || 0;
    this.essence = d.essence || 0;
    this.autoSalvage = typeof d.autoSalvage === 'number' ? d.autoSalvage : -1;
    // items this version does not know (from a newer or broken save) are left out
    const ok = (it) => it && (it.kind === 'weapon' ? !!CONFIG.weapons[it.type]
      : !!(CONFIG.items.armor[it.type] && CONFIG.items.sets[it.set] && CONFIG.items.bonuses[it.bonus]));
    this.inventory = (d.inventory || []).filter(ok);
    for (const slot in this.equip) {
      const it = d.equip && d.equip[slot];
      if (ok(it)) this.equip[slot] = it;
      else if (slot !== 'weapon') this.equip[slot] = null;
    }
    const valid = (id) => CONFIG.skills[id] || CONFIG.ultimates[id];
    if (d.known) this.known = d.known.filter(valid);
    if (d.slots) this.slots = d.slots.map((id) => (id && valid(id) ? id : null));
    this.newSkills = (d.newSkills || []).filter(valid);
    this.ult = d.ult || 0;
    if (d.mastery) {
      const m = this.mastery;
      m.lv = d.mastery.lv || 0;
      m.xp = d.mastery.xp || 0;
      m.pts = d.mastery.pts || 0;
      for (const k in m.s) m.s[k] = (d.mastery.s && d.mastery.s[k]) || 0;
    }
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
    b.skillDamage = b.ultCharge = b.charges = b.cooldown = b.killHeal = b.hitHeal = 0;
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
    if (this.game.path) this.game.path.apply(b); // the Path of the Necromancer
    // mastery points (after the last level)
    const M = CONFIG.mastery.perPoint, ms = this.mastery.s;
    // effects of unique items
    this.uq = {};
    for (const slot in this.equip) {
      const it = this.equip[slot];
      if (it && it.uq) { const u = uniqueDef(it.uq); if (u) this.uq[it.uq] = u; }
    }
    const oldMax = this.maxHp;
    // levels multiply health and damage, Vitality and Strength add to them
    this.levelMult = playerPower(this.level);
    this.maxHp = Math.round(c.baseHp * playerHpPower(this.level) * (1 + S.vit.hp * st.vit) * (1 + b.hp) * (1 + M.hp * ms.hp));
    this.hpRegen = st.vit * S.vit.regen * this.maxHp;
    if (this.hp !== undefined && this.maxHp > oldMax && !this.dead) this.hp += this.maxHp - oldMax;
    if (this.hp > this.maxHp) this.hp = this.maxHp;
    this.maxMana = Math.round((c.baseMana + st.int * S.int.mana) * (1 + b.mana));
    if (this.mana > this.maxMana) this.mana = this.maxMana;
    this.manaRegen = c.manaRegen + st.int * S.int.manaRegen;
    this.speed = c.baseSpeed * (1 + st.agi * S.agi.speed + b.speed);
    this.reloadTime = CONFIG.weapons[this.weapon].reload / (1 + st.agi * S.agi.reload + b.reload);
    this.crit = Math.min(G.critMax, G.baseCrit + st.per * S.per.crit + b.crit + M.crit * ms.crit);
    this.critDmg = G.critDamage + st.per * S.per.critDamage + (this.uq.insight ? this.uq.insight.critDamage : 0);
    this.dodgeCdMax = c.dodge.cooldown / (1 + st.agi * S.agi.dodge);
    // drop = extra drop chance, luck = better rarities (Perception's part capped)
    const diffLuck = this.game.diff ? this.game.diff().luck : 0;
    this.drop = st.per * S.per.drop + diffLuck + M.loot * ms.loot;
    this.luck = Math.min(G.perLuckCap, st.per * S.per.drop) + diffLuck + M.loot * ms.loot;
    this.damageMult = this.levelMult * (1 + S.str.damage * st.str) * (1 + b.damage) * (1 + M.damage * ms.damage);
    this.defense = def;
    this.takenBonus = 1 + b.damageTaken;
    this.maxCharges = c.charges.max + b.charges;
    if (this.charges > this.maxCharges) this.charges = this.maxCharges;
    this.skillMult = 1 + b.skillDamage;
    this.cdMult = 1 / (1 + b.cooldown);
    this.ultRate = 1 + b.ultCharge;
    this.killHeal = b.killHeal;
    this.hitHeal = b.hitHeal;
    this.armyDamage = b.armyDamage + M.armyDamage * ms.armyDamage;
    this.armyHp = b.armyHp + M.armyHp * ms.armyHp;
    this.armySlots = b.armySlots;
    this.model.setEquipment(this.equip);
    if (this.game.army) this.game.army.recalcAll();
  }

  // Share of damage that gets through. Armour counts less in stronger zones
  // (K grows with the zone's power), so new zones need new armour.
  takenFactor() {
    const zi = Math.max(0, this.game.curZone);
    const K = CONFIG.progression.defenseK * Math.pow(CONFIG.levels.itemRank, zi);
    return (K / (K + this.defense)) * this.takenBonus;
  }

  // Eclipse and Blood Rage: more damage while they last
  tempMult() {
    let m = 1;
    if (this.eclipseT > 0) m *= 1 + CONFIG.ultimates.eclipse.damage;
    if (this.rageT > 0) m *= 1 + CONFIG.skills.bloodRage.damage;
    return m;
  }

  // damage of one basic attack before variance and crit
  power() {
    return weaponDamage(this.equip.weapon) * this.damageMult * this.tempMult();
  }

  // the power the shadows draw from: the hunter's skill base without buffs
  monarchPower() {
    return skillDamage(this.equip.weapon) * this.damageMult;
  }

  // damage of a skill with power 1: the same with every weapon type
  skillPower() {
    return skillDamage(this.equip.weapon) * this.damageMult * this.skillMult * this.tempMult();
  }

  // an enemy was hit: the ultimate charges (not while one is active)
  onHit() {
    const U = CONFIG.progression.ultCharge;
    if (this.ultLockT <= 0) this.ult = Math.min(U.max, this.ult + U.perHit * this.ultRate);
    if (this.hitHeal > 0) this.heal(this.maxHp * this.hitHeal);
    const F = this.uq.frenzy;
    if (F) { this.frenzy = Math.min(F.max, this.frenzy + F.perHit); this.frenzyT = F.time; }
  }

  onKill() {
    if (this.killHeal > 0) this.heal(this.maxHp * this.killHeal);
    const R = this.uq.reaper;
    if (R) {
      this.heal(this.maxHp * R.heal);
      if (this.charges < this.maxCharges) this.charges++;
    }
  }

  // ---- levels ---------------------------------------------------------------
  // XP for the next mastery level (after the last level)
  masteryNeed() {
    return Math.round(this.xpNeed() * (1 + CONFIG.mastery.growth * this.mastery.lv));
  }

  addMasteryXp(amount) {
    const m = this.mastery;
    m.xp += amount;
    let ups = 0;
    for (let guard = 0; guard < 1000 && m.xp >= this.masteryNeed(); guard++) {
      m.xp -= this.masteryNeed();
      m.lv++;
      m.pts++;
      ups++;
    }
    if (!ups) return;
    this.game.effects.burst(this.x, 1.5, this.z, 30, 0x7df0ff, 8, 0.22, 0.9);
    this.game.effects.ring(this.x, this.z, 0.5, 5, 0x7df0ff, 0.6);
    play('levelup');
    this.game.hud.toast(t('mastery.up', { n: m.lv }));
    this.game.submitRecords();
  }

  spendMastery(key) {
    const m = this.mastery;
    if (m.pts <= 0 || !(key in m.s)) return;
    m.s[key]++;
    m.pts--;
    this.recalc();
  }

  xpNeed() {
    return hunterXpNeed(this.level);
  }

  addXp(amount) {
    const G = CONFIG.progression;
    const max = CONFIG.levels.maxLevel;
    if (this.level >= max) { this.addMasteryXp(amount); return; }
    this.xp += amount;
    // the last level of a rank waits for the rank trial (game.levelCap)
    const cap = Math.min(max, this.game.levelCap());
    let gained = 0, ups = 0;
    while (this.level < cap && this.xp >= this.xpNeed()) {
      this.xp -= this.xpNeed();
      this.level++;
      ups++;
      // points per level depend on the rank (0.5 = one every second level)
      const rate = G.pointsPerLevel[rankOf(this.level - 1)];
      const pts = Math.floor(this.level * rate) - Math.floor((this.level - 1) * rate);
      this.points += pts;
      gained += pts;
    }
    // at the cap the bar stays full until the trial is passed
    if (this.level >= cap && this.xp > this.xpNeed()) this.xp = this.xpNeed();
    if (!ups) return;
    this.recalc();
    if (!this.dead) { this.hp = this.maxHp; this.mana = this.maxMana; }
    this.game.effects.burst(this.x, 1.5, this.z, 36, 0xffd24a, 8, 0.22, 0.9);
    this.game.effects.ring(this.x, this.z, 0.5, 5, 0xffd24a, 0.6);
    this.game.effects.ring(this.x, this.z, 0.5, 3, 0xfff0b0, 0.5, 0.15);
    this.game.effects.light(this.x, 2.5, this.z, 0xffd24a, 90, 16, 0.7);
    this.game.effects.flare(this.x, 1.4, this.z, 3.8, 0xffd24a, 0.5, 1.7);
    this.game.effects.sparks(this.x, 0.5, this.z, 40, 0xffe080, 4, 0.45, 1.4, 5);
    play('levelup');
    this.game.submitRecords();
    this.game.hud.toast(gained ? t('toast.levelUp', { level: this.level, points: gained }) : t('toast.levelUpNoPts', { level: this.level }));
    this.game.checkRank();
    if (this.game.trialDue()) this.game.announceTrial();
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
  // something new to look at in the menu?
  hasNews() {
    if (this.points > 0 || this.newSkills.length || this.mastery.pts > 0) return true;
    for (let i = 0; i < this.inventory.length; i++) if (this.inventory[i].n) return true;
    return false;
  }

  addItem(item) {
    const hud = this.game.hud;
    if (item.kind === 'skill') {
      if (this.known.includes(item.type)) {
        this.essence += 5;
        hud.toast(t('toast.essence', { n: 5 }));
      } else {
        this.learn(item.type);
        if (!this.newSkills.includes(item.type)) this.newSkills.push(item.type);
        hud.toast(t('toast.learned', { name: itemName(item) }));
      }
      return true;
    }
    // auto dismantle: weak rarities become essence at once (never upgrades)
    if (item.rarity <= this.autoSalvage && !this.isUpgrade(item, true)) {
      const n = dismantleValue(item);
      this.essence += n;
      hud.toast(t('toast.salvaged', { name: t('rarity.' + item.rarity) + ' ' + itemName(item), n }));
      return true;
    }
    if (this.inventory.length >= CONFIG.items.inventorySize) return false;
    item.n = 1; // new: marked in the menu until it was seen
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

  // a unique item up to the deepest Abyss floor cleared (best)
  attuneItem(item, best) {
    const lvl = attuneLevel(item, best), cost = attuneCost(item, best);
    if (!lvl || this.essence < cost) return false;
    this.essence -= cost;
    item.level = lvl;
    this.recalc();
    return true;
  }

  // better than what is equipped in its slot? bag: also better than every
  // item of that slot in the inventory
  isUpgrade(item, bag = false) {
    const sl = slotOf(item), cur = this.equip[sl];
    if (cur && itemPower(item) <= itemPower(cur)) return false;
    if (bag) for (const it of this.inventory) if (slotOf(it) === sl && itemPower(it) >= itemPower(item)) return false;
    return true;
  }

  // Items of this rarity that "dismantle all" would take: never upgraded ones,
  // and never the best item of a slot when it beats the equipped one.
  bulkList(rarity) {
    const best = {};
    for (const it of this.inventory) {
      const sl = slotOf(it);
      if (!best[sl] || itemPower(it) > itemPower(best[sl])) best[sl] = it;
    }
    const keep = new Set();
    for (const sl in best) if (this.isUpgrade(best[sl])) keep.add(best[sl]);
    return this.inventory.filter((it) => it.rarity === rarity && !it.up && !keep.has(it));
  }

  dismantleMany(list) {
    let n = 0;
    for (const it of list) {
      const i = this.inventory.indexOf(it);
      if (i < 0) continue;
      this.inventory.splice(i, 1);
      n += dismantleValue(it);
    }
    this.essence += n;
    return n;
  }

  dismantleItem(item) {
    const i = this.inventory.indexOf(item);
    if (i < 0) return;
    this.inventory.splice(i, 1);
    this.essence += dismantleValue(item);
  }

  // ---- health ---------------------------------------------------------------
  heal(amount) {
    if (this.dead || this.game.modOn('noHeal')) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // a chilling shot: slower for a moment
  chill() {
    if (this.dead) return;
    if (this.chillT <= 0) this.game.effects.ring(this.x, this.z, 0.4, 1.8, 0x9fe8ff, 0.3);
    this.chillT = CONFIG.traits.chill.time;
  }

  // Shadow Step can start: out of combat for a moment and not in a gate
  canSprint() {
    return !this.dead && this.calmT >= CONFIG.player.shadowStep.calm && this.game.gates.active < 0;
  }

  // something happened in a fight: Shadow Step stops
  fought() {
    this.calmT = 0;
    this.sprint = false;
  }

  damage(amount) {
    if (this.dead || this.invuln > 0) return;
    this.fought();
    this.game.profile.dmgTaken += amount;
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
    // Bastion of Night: a shield right after a hit
    const B = this.uq.bastion;
    if (B && this.bastionCd <= 0 && this.hp > 0) {
      this.shield = this.shieldMax = this.maxHp * B.shield;
      this.shieldT = B.time;
      this.bastionCd = B.cooldown;
      fx.ring(this.x, this.z, 0.5, 2.5, 0x6aa8ff, 0.4);
    }
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
      this.rageT = 0;
      this.ultLockT = 0;
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
    this.calmT += dt;
    if (this.cds[0] > 0) this.cds[0] -= dt;
    if (this.cds[1] > 0) this.cds[1] -= dt;
    if (this.eclipseT > 0) this.eclipseT -= dt;
    if (this.rageT > 0) this.rageT -= dt;
    if (this.chillT > 0) {
      this.chillT -= dt;
      if (Math.random() < dt * 12) game.effects.burst(this.x, 0.6 + Math.random(), this.z, 1, 0x9fe8ff, 1.2, 0.16, 0.5);
    }
    if (this.ultLockT > 0) this.ultLockT -= dt;
    if (this.bastionCd > 0) this.bastionCd -= dt;
    if (this.frenzyT > 0) { this.frenzyT -= dt; if (this.frenzyT <= 0) this.frenzy = 0; }
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
      // out of combat the dodge also starts Shadow Step
      if (!this.sprint && this.canSprint()) {
        this.sprint = true;
        this.idleT = 0;
        play('skill');
        game.effects.ring(this.x, this.z, 0.5, 3, 0x8a4dff, 0.35);
      }
      if (this.dodgeCd <= 0 && this.dodgeT <= 0) {
        if (this.moving) { this.dodgeX = mx / Math.min(ml, 1); this.dodgeZ = mz / Math.min(ml, 1); }
        else { this.dodgeX = this.dirX; this.dodgeZ = this.dirZ; }
        this.dirX = this.dodgeX;
        this.dirZ = this.dodgeZ;
        this.dodgeT = c.dodge.duration;
        this.counts.dodge++;
        game.profile.dodges++;
        // Voidstep Treads: an explosion where the dodge started
        const V = this.uq.voidstep;
        if (V) game.zones.add(this.x, this.z, V.radius, V.delay, 1, 0, this.skillPower() * V.power, 0, 0xb070ff);
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
      let sp = this.speed * (this.rageT > 0 ? 1 + CONFIG.skills.bloodRage.speed : 1) * (this.chillT > 0 ? 1 - CONFIG.traits.chill.slow : 1);
      if (this.sprint) sp = Math.max(sp, Math.min(CONFIG.player.shadowStep.maxSpeed, sp * this.sprintMult()));
      nx += mx * sp * dt;
      nz += mz * sp * dt;
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
    // Shadow Step: ends in a gate or after standing still; leaves a shadow trail
    if (this.sprint) {
      if (!this.canSprint()) this.sprint = false;
      else if (this.moving) {
        this.idleT = 0;
        if (Math.random() < dt * 70) game.effects.burst(this.x, 0.2 + Math.random() * 1.3, this.z, 1, Math.random() < 0.6 ? 0xb080ff : 0x6a3ad0, 0.8, 0.34, 0.7);
      } else if ((this.idleT += dt) > CONFIG.player.shadowStep.idle) this.sprint = false;
    }

    // camp or outpost: safe, heals, equipment can be changed
    this.safeIndex = game.gates.active >= 0 ? -1 : game.world.safeIndexAt(this.x, this.z);
    this.inCamp = this.safeIndex >= 0;

    // ---- charges reload one after another
    if (this.charges < this.maxCharges) {
      this.reloadT += (dt / this.reloadTime) * (1 + this.frenzy);
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
    if (this.hp < this.maxHp && !game.modOn('noHeal')) {
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

  // Shadow Step speed: x1.5, more with Agility
  sprintMult() {
    const S = CONFIG.player.shadowStep;
    return S.speed + Math.min(S.maxBonus, this.stats.agi * S.perAgi);
  }

  attack() {
    this.fought();
    const w = CONFIG.weapons[this.weapon];
    if (this.pendingAuto) this.autoAim(w.range);
    this.dirX = this.pendingX;
    this.dirZ = this.pendingZ;
    if (this.eclipseT <= 0) this.charges--;
    this.atkCd = w.cooldown;
    this.combo ^= 1;
    this.attackAnim = 1;
    this.counts.attack++;
    play('swing', this.weapon);
    fireWeapon(this.game, this.weapon, this.pendingX, this.pendingZ, this.pendingP);
    // Echo of the Fallen: every few attacks a shadow wave as well
    const U = this.uq.echo;
    if (U && this.counts.attack % U.every === 0) echoWave(this.game, this.pendingX, this.pendingZ, U);
  }

  // mana a skill costs (Mana Curse doubles it)
  manaCost(def) {
    const m = this.game.modOn('manaCurse');
    return def.mana * (m ? m.cost : 1);
  }

  // slot 0 / 1 = skills, 2 = ultimate
  cast(slot, auto, dx, dz, power) {
    const id = this.slots[slot];
    if (!id || this.dodgeT > 0) return;
    this.game.profile.casts++;
    const def = skillDef(id);
    const hud = this.game.hud;
    if (slot === 2) {
      if (this.ult < CONFIG.progression.ultCharge.max) { hud.deny(slot); return; }
    } else {
      if (this.cds[slot] > 0) { hud.deny(slot); return; }
      if (this.mana < this.manaCost(def)) { hud.deny(slot); hud.toast(t('toast.noMana')); return; }
    }
    this.pendingX = dx;
    this.pendingZ = dz;
    this.pendingP = power;
    if (def.aim === 'self') { this.pendingX = this.dirX; this.pendingZ = this.dirZ; }
    else if (auto) this.autoAim(def.range);
    this.fought();
    if (slot === 2) this.ult = 0;
    else { this.game.profile.manaSpent += this.manaCost(def); this.mana -= this.manaCost(def); this.cds[slot] = this.cdMax[slot] = def.cooldown * this.cdMult; }
    this.counts.cast++;
    this.dirX = this.pendingX;
    this.dirZ = this.pendingZ;
    this.castAnim = 1;
    play(slot === 2 ? 'ult' : 'skill', id);
    castSkill(this.game, id, this.pendingX, this.pendingZ, this.pendingP);
    if (slot === 2) {
      this.ult = 0; // the ultimate does not charge itself ...
      this.ultLockT = def.duration || (def.ticks || 0) * (def.interval || 0); // ... nor while it lasts
    }
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
    ANIM.rate = this.sprint && this.moving ? 1.7 : 1;
    ANIM.dead = this.dead;
    this.model.animate(dt, ANIM);
    this.game.effects.blob(this.x, this.z, 0.75);
    if (this.shield > 0) this.game.effects.showBubble(this.x, this.z, Math.min(1, this.shield / this.shieldMax));
  }
}
