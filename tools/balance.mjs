// Balance model of Noctis: formulas from the game's own config and core/levels.js.
// Item and kill rates come from the cloud saves (median over the saves with more than 10 minutes of play).
import { CONFIG } from '../src/config.js';
import { playerPower, playerHpPower, enemyPower, rankHp, itemLevelPower, hunterXpNeed, rankOf } from '../src/core/levels.js';

const L = CONFIG.levels, I = CONFIG.items, G = CONFIG.progression;
const RANKS = L.rankNames;
const KILLS_PER_H = 750, ITEMS_PER_H = 330; // from the saves
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

// ---- D: the classes against each other -----------------------------------------------------------
const P = CONFIG.paths, RM = P.rarityMult[2];
function pathTotals(core, picks) {
  const t = {};
  for (let st = 1; st <= picks; st++) {
    const f = (1 + P.stageScale * (st - 1)) * RM;
    for (const k in P.cores[core].bonus) t[k] = (t[k] || 0) + P.cores[core].bonus[k] * f;
    for (const k in P.pickBonus) t[k] = (t[k] || 0) + P.pickBonus[k];
  }
  return t;
}
const Mo = CONFIG.shadows.monarch;
function armyDps(h, level, rho, up, t) {
  const slots = Math.min(CONFIG.shadows.maxSlots + 30, CONFIG.shadows.baseSlots + h.st.int * G.stats.int.slots + Math.round(t.armySlots || 0));
  const fac = itemLevelPower(level) * I.rarityStat[rho] * (1 + I.upgradeBonus * up);
  const dmgMult = playerPower(level) * (1 + G.stats.str.damage * h.st.str) * 1.15;
  const mp = CONFIG.skillBase * fac * dmgMult;
  const unit = mp * Mo.share * (1 + Mo.levelBonus * Math.min(40, level / 3)) * Math.sqrt(rankHp(level)) * (1 + (t.armyDamage || 0)) / 1.5;
  return { dps: unit * slots, slots };
}
function profile(name, level, rho, cfg) {
  const up = 5, b = {};
  const t = cfg.core ? pathTotals(cfg.core, rankOf(level)) : {};
  for (const k of ['damage', 'hp', 'crit', 'reload', 'skillDamage', 'damageTaken']) b[k] = (t[k] || 0) + ((cfg.bonus && cfg.bonus[k]) || 0);
  const h = hunter(level, rho, up, b), e = enemy(level);
  let dps = h.dps * (cfg.dpsMul || 1);
  const taken = h.taken * (cfg.takenMul || 1);
  let slots = 0;
  if (cfg.army) { const a = armyDps(h, level, rho, up, t); dps += a.dps; slots = a.slots; }
  if (cfg.pet) dps += 0.15 * h.dps;
  const inDps = (4 * e.dmgHit) / e.cd * taken;
  let net = inDps - (cfg.healPerSec ? cfg.healPerSec * h.maxHp : 0);
  net = Math.max(net, inDps * 0.2);
  return { name, dps, ttd: h.maxHp / net, ttk: e.hp / dps, bossTtk: e.bossHp / dps, slots };
}
const CLASSES = [
  ['Neutral (no class, no path)', {}],
  ['Necromancer (Commander core)', { core: 'commander', army: true }],
  ['Necromancer (Blade core)', { core: 'blade', army: true }],
  ['Warrior (Tank core)', { core: 'tank', bonus: { damage: 0.15 }, dpsMul: 1.24, takenMul: 0.91 }],
  ['Mage (Mage core)', { core: 'mage', bonus: { skillDamage: 0.5, cooldown: 0.15 }, dpsMul: 1.15 }],
  ['Rogue (Blade core)', { core: 'blade', bonus: { crit: 0.22, damage: 0.1 }, dpsMul: 1.15 }],
  ['Ranger (Slayer core)', { core: 'slayer', bonus: { crit: 0.06, damage: 0.12 }, dpsMul: 1.245, pet: true }],
  ['Cleric (Tank core)', { core: 'tank', bonus: { hp: 0.15, skillDamage: 0.1 }, dpsMul: 1.12, healPerSec: 0.011 }],
];
log();
log('D) Classes against each other (same gear; relative to Neutral = 1.00; bigger survival = lives longer)');
for (const [lv, rho, label] of [[mid(3), 4, 'Rank B (3 picks)'], [mid(5), 5, 'Rank S (5 picks)'], [mid(8), 7, 'Rank L (8 picks)']]) {
  log(label + ':                             DPS x   survival x   boss kill (s)   army slots');
  const base = profile('Neutral', lv, rho, {});
  for (const [name, cfg] of CLASSES) {
    const p = profile(name, lv, rho, cfg);
    log('  ' + name.padEnd(32) + pad(f1(p.dps / base.dps * 100) / 100, 6) + pad(f1(p.ttd / base.ttd * 100) / 100, 12) + pad(f1(p.bossTtk), 14) + pad(p.slots || '-', 14));
  }
}
console.log(out.join('\n'));
