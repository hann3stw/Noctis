// Balance model of Noctis: formulas from the game's own config and core/levels.js.
// Item and kill rates come from the cloud saves (median over the saves with more than 10 minutes of play).
import { CONFIG } from '../src/config.js';
import { playerPower, playerHpPower, enemyPower, rankHp, itemLevelPower, hunterXpNeed, rankOf } from '../src/core/levels.js';

const L = CONFIG.levels, I = CONFIG.items, G = CONFIG.progression;
const RANKS = L.rankNames;
const KILLS_PER_H = 750, ITEMS_PER_H = 250; // kills from the saves; items: 330 in the saves, about a quarter fewer since elites drop 75 % and normal enemies 4 %
const mid = (r) => Math.round((L.rankLevels[r] + (L.rankLevels[r + 1] || L.maxLevel + 1) - 1) / 2);
const pad = (s, n) => String(s).padStart(n);
const f1 = (x) => (Math.round(x * 10) / 10).toString();

// ---- A: how fast the gear comes ---------------------------------------------------------------
function rarityProbs(rank, luck) {
  const base = I.rarityWeights[Math.min(I.rarityWeights.length - 1, rank)];
  const k = 1 + luck;
  let top = 0;
  base.forEach((v, r) => { if (v > 0) top = r; });
  const w = base.map((v, r) => v * Math.pow(k, r * I.luckStep) * (r === top ? I.topChance : 1));
  const s = w.reduce((a, b) => a + b, 0);
  return w.map((v) => v / s);
}
// hours until all five slots (weapon + 4 armour) have an item of at least rarity rho, with probability 50 %
function hoursToSet(rank, luck, rho) {
  const p = rarityProbs(rank, luck);
  const atLeast = p.slice(rho).reduce((a, b) => a + b, 0);
  const slots = [CONFIG.loot.weights.weapon / 100, ...Array(4).fill(CONFIG.loot.weights.armor / 100 / 4)];
  const lam = slots.map((s) => ITEMS_PER_H * s * atLeast);
  let lo = 0, hi = 1000;
  for (let n = 0; n < 60; n++) {
    const t = (lo + hi) / 2;
    const pAll = lam.reduce((a, l) => a * (1 - Math.exp(-l * t)), 1);
    if (pAll < 0.5) lo = t; else hi = t;
  }
  return lo;
}
// the rarity a hunter has in all slots after h hours in the rank (median of the worst slot)
function setRarityAfter(rank, luck, h) {
  let best = 0;
  for (let rho = 0; rho < 7; rho++) if (hoursToSet(rank, luck, rho) <= h) best = rho;
  return best;
}

// ---- B: kills and hours per rank --------------------------------------------------------------
const avgXp = (zi) => {
  const z = CONFIG.world.zones[zi];
  return z.enemyTypes.reduce((a, t) => a + CONFIG.enemies.types[t].xp, 0) / z.enemyTypes.length;
};
function killsInRank(r) {
  let kills = 0;
  const a = L.rankLevels[r], b = (L.rankLevels[r + 1] || L.maxLevel + 1) - 1;
  for (let lv = a; lv <= b; lv++) {
    const xpKill = avgXp(r) * enemyPower(lv) * Math.sqrt(rankHp(lv)); // enemies of your level
    kills += hunterXpNeed(lv) / xpKill;
  }
  return kills;
}

// ---- C: a typical hunter vs the enemies -------------------------------------------------------
function statPoints(level) {
  let pts = 0;
  for (let lv = 2; lv <= level; lv++) pts += G.pointsPerLevel[rankOf(lv)];
  for (let r = 1; r <= rankOf(level); r++) pts += G.rankPoints[r];
  return pts;
}
const SPLIT = { str: 0.35, vit: 0.25, agi: 0.15, per: 0.15, int: 0.1 };
function hunter(level, rho, up, b = {}, itemLevelOff = 0) {
  const pts = statPoints(level), st = {};
  for (const k in SPLIT) st[k] = pts * SPLIT[k];
  const S = G.stats;
  const il = Math.max(1, level + itemLevelOff);
  const fac = itemLevelPower(il) * I.rarityStat[rho] * (1 + I.upgradeBonus * up);
  const bd = (b.damage || 0) + 0.15, bh = (b.hp || 0) + 0.2, bc = (b.crit || 0) + 0.1, br = (b.reload || 0) + 0.1, bs = (b.skillDamage || 0) + 0.15;
  const dmgMult = playerPower(level) * (1 + S.str.damage * st.str) * (1 + bd);
  const reload = CONFIG.weapons.sword.reload / (1 + st.agi * S.agi.reload + br);
  const hit = CONFIG.weapons.sword.damage * fac * dmgMult;
  const crit = Math.min(G.critMax, G.baseCrit + st.per * S.per.crit + bc), critDmg = G.critDamage + st.per * S.per.critDamage;
  const critAvg = 1 + crit * (critDmg - 1);
  const skillPow = CONFIG.skillBase * fac * dmgMult * (1 + bs);
  const dps = (hit / reload + 0.8 * skillPow) * critAvg * 0.85;
  const maxHp = CONFIG.player.baseHp * playerHpPower(level) * (1 + S.vit.hp * st.vit) * (1 + bh);
  const def = (5 + 9 + 4 + 4) * fac;
  const zi = rankOf(level), K = G.defenseK * Math.pow(L.itemRank, zi);
  const taken = (K / (K + def)) * (1 + (b.damageTaken || 0));
  return { dps, maxHp, taken, st };
}
function enemy(level, diff = 'normal') {
  const zi = rankOf(level), z = CONFIG.world.zones[zi], D = CONFIG.difficulty.levels[diff];
  const T = z.enemyTypes.map((t) => CONFIG.enemies.types[t]);
  const hp = T.reduce((a, t) => a + t.hp, 0) / T.length, dmg = T.reduce((a, t) => a + t.damage, 0) / T.length;
  const cd = T.reduce((a, t) => a + t.attackCooldown, 0) / T.length;
  const pw = enemyPower(level);
  const boss = CONFIG.enemies.types[z.boss];
  return {
    hp: hp * pw * D.enemyHp * rankHp(level), dmgHit: dmg * pw * D.enemyDamage, cd,
    bossHp: boss.hp * CONFIG.boss.hp * pw * D.enemyHp * Math.pow(rankHp(level), CONFIG.boss.rankHp), bossDmg: boss.damage * pw * D.enemyDamage,
  };
}

// ---- output -------------------------------------------------------------------------------------
const out = [];
const log = (s = '') => out.push(s);
log('A) How the game paces (normal difficulty, ' + KILLS_PER_H + ' kills/h, ' + ITEMS_PER_H + ' items/h from the saves)');
log('rank  levels      kills     hours  | hours to a full set of rarity 3 (epic) / 4 / 5 / 6 (at 50 %, luck 0.5)');
let cumH = 0;
for (let r = 0; r < 10; r++) {
  const k = killsInRank(r), h = k / KILLS_PER_H;
  cumH += h;
  const sets = [3, 4, 5, 6].map((rho) => { const v = hoursToSet(r, 0.5, rho); return v > 99 ? '  -' : pad(f1(v), 5); }).join(' ');
  log(pad(RANKS[r], 4) + pad(L.rankLevels[r] + '-' + ((L.rankLevels[r + 1] || 1001) - 1), 10) + pad(Math.round(k), 9) + pad(f1(h), 8) + '  (' + pad(f1(cumH), 5) + ' h total) | ' + sets);
}
log();
log('B) Fight model: typical hunter (35 % Str / 25 % Vit / 15 % Agi / 15 % Per / 10 % Int), sword, gear rarity rho at the level of the zone middle, upgrade +5');
log('TTK = seconds to kill one normal enemy of your level; TTD = seconds a pack of 4 needs to kill you; boss = seconds alone vs the boss of the zone (normal gate)');
log('rank  level   rho   TTK    pack-TTD  hits-to-kill  bossTTK  boss: your hits before you die');
for (let r = 0; r < 10; r++) {
  const lv = mid(r);
  for (const rho of [Math.max(0, r < 3 ? r + 1 : r - 1), Math.min(6, r < 3 ? r + 2 : r), Math.min(7, r < 3 ? r + 3 : r + 1)]) {
    const h = hunter(lv, rho, 5), e = enemy(lv);
    const ttk = e.hp / h.dps;
    const inDps = (4 * e.dmgHit) / e.cd * h.taken;
    const ttd = h.maxHp / inDps;
    const bttk = e.bossHp / h.dps;
    const bdps = (e.bossDmg / CONFIG.boss.pause) * h.taken;
    log(pad(RANKS[r], 4) + pad(lv, 6) + pad(rho, 6) + pad(f1(ttk), 7) + pad(f1(ttd), 10) + pad(f1(e.hp / (CONFIG.weapons.sword.damage * itemLevelPower(lv) * I.rarityStat[rho] * 1.5 * playerPower(lv))), 14) + pad(f1(bttk), 9) + pad(f1(h.maxHp / bdps / Math.max(0.1, 1)), 12) + ' s alive');
  }
}

// ---- D: the classes against each other (every number comes from the config) --------------------------
const P = CONFIG.paths, RM = P.rarityMult[2]; // a Rare class
const CL = CONFIG.classes.list, Mo = CONFIG.shadows.monarch;
function pathTotals(core, picks) {
  const t = {};
  for (let st = 1; st <= picks; st++) {
    const f = (1 + P.stageScale * (st - 1)) * RM;
    for (const k in P.cores[core].bonus) t[k] = (t[k] || 0) + P.cores[core].bonus[k] * f;
    for (const k in P.pickBonus) t[k] = (t[k] || 0) + P.pickBonus[k];
  }
  return t;
}
function armyDps(h, level, rho, up, t) {
  const slots = Math.min(CONFIG.shadows.maxSlots + 30, CONFIG.shadows.baseSlots + h.st.int * G.stats.int.slots + Math.round(t.armySlots || 0));
  const fac = itemLevelPower(level) * I.rarityStat[rho] * (1 + I.upgradeBonus * up);
  const dmgMult = playerPower(level) * (1 + G.stats.str.damage * h.st.str) * 1.15;
  const mp = CONFIG.skillBase * fac * dmgMult;
  const unit = mp * Mo.share * (1 + Mo.levelBonus * Math.min(40, level / 3)) * Math.sqrt(rankHp(level)) * (1 + (t.armyDamage || 0)) / 1.5;
  return unit * slots;
}
// average effect of the class mechanic while fighting (about 60 % Rage / Faith, 3.5 Arcane Charges, 3 Combo Points, enemies at 70 % of the range)
function mech(cls, h) {
  const m = { dps: 1, skill: 1, taken: 1, heal: 0, pet: 0, crit: 0, rate: 1 };
  if (cls === 'warrior') { const r = 60; m.dps = 1 + r * CONFIG.warrior.damage; m.taken = 1 - r * CONFIG.warrior.reduction; m.rate = 1.2; }
  if (cls === 'mage') { m.skill = 1 + 3.5 * CONFIG.mage.arcaneDamage; m.rate = 2; }
  if (cls === 'rogue') { m.crit = 3 * CONFIG.rogue.critPerPoint; m.dps = 1 + 0.4 * CONFIG.rogue.finisher * 3; m.rate = 1.2; }
  if (cls === 'ranger') { m.dps = 1 + CONFIG.ranger.rangeBonus * 0.7; m.pet = 0.15; m.rate = 1.2; }
  if (cls === 'cleric') {
    const C = CONFIG.cleric, S = CONFIG.skills;
    m.dps = 1 + 60 * C.damage; m.rate = 1.3;
    m.heal = 60 * C.hitHeal / C.healGap * 0.6 + S.mend.healSelf / S.mend.cooldown + S.consecration.healSelf / S.consecration.cooldown; // faith heals about 60 % of the time; Mend and Consecration on their cooldowns
  }
  return m;
}
function profile(label, level, rho, cfg) {
  const up = 5, cls = cfg.cls, cb = cls ? CL[cls].bonus || {} : {};
  const t = cfg.core ? pathTotals(cfg.core, rankOf(level)) : {};
  for (const k of ['armyDamage', 'armySlots']) t[k] = (t[k] || 0) + (cb[k] || 0);
  const b = {};
  for (const k of ['damage', 'hp', 'crit', 'reload', 'skillDamage', 'damageTaken']) b[k] = (t[k] || 0) + (cb[k] || 0);
  const m = mech(cls, null);
  b.crit += m.crit;
  b.skillDamage = (1 + b.skillDamage) * m.skill - 1;
  const h = hunter(level, rho, up, b), e = enemy(level);
  // skills: how many of them are cast, and a faster cooldown casts more
  const cdBoost = 1 + (cb.cooldown || 0) + (t.cooldown || 0);
  let dps = h.dps * m.dps;
  dps += 0.8 * (m.rate * cdBoost - 1) * (CONFIG.skillBase * itemLevelPower(level) * I.rarityStat[rho] * 1.5 * playerPower(level)) * 0.4 * 0 + 0; // (skills are inside h.dps already)
  if (m.rate !== 1 || cdBoost !== 1) dps *= 1 + 0.45 * (m.rate * cdBoost - 1); // skills are about 45 % of the damage
  if (cfg.army) dps += armyDps(h, level, rho, up, t);
  if (m.pet) dps += m.pet * h.dps;
  const taken = h.taken * m.taken;
  const inDps = (4 * e.dmgHit) / e.cd * taken;
  const net = Math.max(inDps - m.heal * h.maxHp, inDps * 0.5); // healing never makes you more than twice as sturdy
  const surv = h.maxHp / net;
  return { label, dps, surv, boss: e.bossHp / dps };
}
const CLASSES = [
  ['Neutral (no class, no path)', {}],
  ['Necromancer (Commander core)', { cls: 'necromancer', core: 'commander', army: true }],
  ['Necromancer (Blade core)', { cls: 'necromancer', core: 'blade', army: true }],
  ['Warrior (Tank core)', { cls: 'warrior', core: 'tank' }],
  ['Mage (Mage core)', { cls: 'mage', core: 'mage' }],
  ['Rogue (Blade core)', { cls: 'rogue', core: 'blade' }],
  ['Ranger (Slayer core)', { cls: 'ranger', core: 'slayer' }],
  ['Cleric (Tank core)', { cls: 'cleric', core: 'tank' }],
];
log();
log('D) Classes against each other, same gear, relative to Neutral. power = damage x sqrt(survival); the aim is about the same power for every class');
for (const [lv, rho, label] of [[mid(1), 3, 'Rank D (1 pick)'], [mid(3), 4, 'Rank B (3 picks)'], [mid(5), 5, 'Rank S (5 picks)'], [mid(8), 7, 'Rank L (8 picks)']]) {
  log(label + ':'.padEnd(26) + 'damage x  survival x   power   boss kill (s)');
  const base = profile('Neutral', lv, rho, {});
  for (const [name, cfg] of CLASSES) {
    const p = profile(name, lv, rho, cfg), d = p.dps / base.dps, sv = p.surv / base.surv;
    log('  ' + name.padEnd(30) + pad(d.toFixed(2), 8) + pad(sv.toFixed(2), 12) + pad((d * Math.sqrt(sv)).toFixed(2), 9) + pad(f1(p.boss), 10));
  }
}
console.log(out.join(String.fromCharCode(10)));
