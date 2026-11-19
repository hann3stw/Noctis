// Difficulty curve simulation: for a "typical" and a "good" hunter at every
// level it works out how long fights take, how many hits you survive and how
// many kills a level costs. It uses the game's own config and formulas
// (config.js, levels.js, items.js), so a balancing change shows up here at once.
//   node tools/curve-sim.mjs            table for every rank
//   node tools/curve-sim.mjs --json     all levels as JSON (for charts)
import { CONFIG } from '../src/config.js';
import {
  rankOf, enemyPower, rankHp, playerPower, playerHpPower, itemLevelPower, hunterXpNeed, gateLevel,
} from '../src/core/levels.js';

const L = CONFIG.levels, G = CONFIG.progression, S = G.stats, I = CONFIG.items;
const ZONES = CONFIG.world.zones;
const D = CONFIG.difficulty.levels.normal;

// ---- assumptions (written out so they can be argued with) --------------------
const SPLIT = { str: 0.4, vit: 0.25, agi: 0.15, int: 0.1, per: 0.1 }; // how stat points are spent
const PROFILES = {
  // typical: keeps a better-than-average drop (80th percentile of the rank's
  // rarities, gate luck), +2, no full set
  typical: { pct: 0.8, luck: 1, up: 2, set: null },
  // good: the best rarity the rank can drop, +5, 4 pieces of the Stalker set
  good: { pct: 1, luck: 3, up: 5, set: 'stalker' },
};
const WEAPON = 'sword';
const SKILLS = ['shadowWave', 'phantomStrike'];
// army: shadows of your level, shadow level 15 (evolved twice), a few knights
const ARMY = { level: 15, stage: 2, rankMult: 1.15, roleDmg: 0.87, interval: 1.5 };
// how fights go out in the world
const PACK = { normal: 4.5, elite: CONFIG.enemies.eliteChance }; // enemies per pack
const AOE = 1.6; // a basic attack or skill hits this many enemies of a pack on average
const ARMY_KILLS = 0.5; // share of kills your shadows land (you get armyKillXp of those)
const WALK = 10; // seconds from one pack to the next

// ---- the hunter ------------------------------------------------------------
export function points(level) {
  let p = 0;
  for (let lv = 2; lv <= level; lv++) {
    const rate = G.pointsPerLevel[rankOf(lv - 1)];
    p += Math.floor(lv * rate) - Math.floor((lv - 1) * rate);
  }
  for (let r = 1; r <= rankOf(level); r++) p += G.rankPoints[r] || 0;
  return p;
}

function rarityFor(level, prof) {
  const base = I.rarityWeights[Math.min(I.rarityWeights.length - 1, rankOf(level))];
  const k = 1 + prof.luck;
  const w = base.map((v, r) => v * Math.pow(k, r * I.luckStep));
  if (prof.pct >= 1) { let top = 0; w.forEach((v, r) => { if (v > 0) top = r; }); return top; }
  const sum = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let r = 0; r < w.length; r++) { acc += w[r] / sum; if (acc >= prof.pct) return r; }
  return w.length - 1;
}

export function hunter(level, profName = 'typical') {
  const prof = PROFILES[profName];
  const pts = points(level);
  const st = {};
  for (const k in SPLIT) st[k] = Math.floor(pts * SPLIT[k]);
  const rarity = rarityFor(level, prof);
  const factor = itemLevelPower(level) * I.rarityStat[rarity] * (1 + I.upgradeBonus * prof.up);
  const b = { damage: 0, crit: 0, hp: 0, reload: 0 };
  if (prof.set) for (const need in I.sets[prof.set]) if (4 >= Number(need)) for (const k in I.sets[prof.set][need]) b[k] = (b[k] || 0) + I.sets[prof.set][need][k];
  const def = Object.values(I.armor).reduce((a, x) => a + Math.round(x.defense * factor), 0);
  const damageMult = playerPower(level) * (1 + S.str.damage * st.str) * (1 + b.damage);
  const crit = Math.min(G.critMax, G.baseCrit + st.per * S.per.crit + b.crit);
  const critDmg = G.critDamage + st.per * S.per.critDamage;
  const critAvg = 1 + crit * (critDmg - 1);
  const W = CONFIG.weapons[WEAPON];
  const hit = W.damage * factor * damageMult * critAvg;
  const reload = W.reload / (1 + st.agi * S.agi.reload + b.reload);
  const basicDps = hit / reload;
  // skills, limited by cooldown and by mana
  const skillHit = CONFIG.skillBase * factor * damageMult * critAvg;
  let powPerSec = 0, manaPerSec = 0;
  for (const id of SKILLS) { const s = CONFIG.skills[id]; powPerSec += s.power / s.cooldown; manaPerSec += s.mana / s.cooldown; }
  const regen = CONFIG.player.manaRegen + st.int * S.int.manaRegen;
  const skillDps = skillHit * powPerSec * Math.min(1, regen / manaPerSec);
  const maxHp = CONFIG.player.baseHp * playerHpPower(level) * (1 + S.vit.hp * st.vit) * (1 + b.hp);
  const slots = Math.min(CONFIG.shadows.maxSlots, CONFIG.shadows.baseSlots + Math.floor(st.int * S.int.slots));
  return { level, pts, st, rarity, up: prof.up, hit, basicDps, skillDps, dps: basicDps + skillDps, maxHp, def, slots };
}

// ---- enemies of a level (average of the zone's three kinds) -----------------
function zoneOf(level) {
  return Math.max(0, ZONES.findIndex((z, i) => level >= L.rankLevels[i] && level < (L.rankLevels[i + 1] || 1e9)));
}

export function enemy(level) {
  const zi = zoneOf(level), z = ZONES[zi];
  const defs = z.enemyTypes.map((t) => CONFIG.enemies.types[t]);
  const avg = (f) => defs.reduce((a, d) => a + f(d), 0) / defs.length;
  const pw = enemyPower(level), rk = rankHp(level);
  return {
    zi,
    hp: avg((d) => d.hp) * pw * rk * D.enemyHp,
    dmg: avg((d) => d.damage) * pw * D.enemyDamage,
    dps: avg((d) => (d.damage * pw * D.enemyDamage) / (d.attackCooldown + d.attackWindup)),
    xp: avg((d) => d.xp) * pw * Math.sqrt(rk),
  };
}

function armyDps(level, slots) {
  const zi = zoneOf(level), z = ZONES[zi], Sh = CONFIG.shadows;
  const defs = z.enemyTypes.map((t) => CONFIG.enemies.types[t]);
  const baseDmg = defs.reduce((a, d) => a + d.damage, 0) / defs.length * enemyPower(level);
  const tier = Sh.tierFactor[0] * (1 + ARMY.stage * Sh.evolveBonus) * ARMY.rankMult;
  const lv = Math.pow(Sh.levelGrowth, ARMY.level - 1);
  const one = baseDmg * Sh.damageFactor * ARMY.roleDmg * tier * lv * Math.sqrt(rankHp(level));
  return (slots * one) / ARMY.interval;
}

function boss(level, diff = 0) {
  const zi = zoneOf(level), z = ZONES[zi];
  const def = CONFIG.enemies.types[z.boss], gd = CONFIG.gates.difficulties[diff];
  const lv = gateLevel(zi, diff);
  return { level: lv, hp: def.hp * enemyPower(lv) * CONFIG.boss.hp * gd.hp * D.enemyHp, dmg: def.damage * enemyPower(lv) * gd.damage * D.enemyDamage };
}

export function row(level, prof = 'typical') {
  const h = hunter(level, prof), e = enemy(level), zi = e.zi;
  const K = G.defenseK * Math.pow(L.itemRank, zi);
  const taken = K / (K + h.def);
  const army = armyDps(level, h.slots);
  const bs = boss(level, 0), bsD = boss(level, 2);
  const hitTaken = e.dmg * taken;
  // a pack out in the world
  const packHp = e.hp * (PACK.normal + PACK.elite * CONFIG.enemies.tiers[1].hp);
  const packXp = e.xp * (PACK.normal + PACK.elite * CONFIG.enemies.tiers[1].xp) * (1 - ARMY_KILLS + ARMY_KILLS * G.armyKillXp);
  const packTime = packHp / (h.dps * AOE + army) + WALK;
  const kills = hunterXpNeed(level) / (e.xp * (1 - ARMY_KILLS + ARMY_KILLS * G.armyKillXp));
  const minPerLevel = (hunterXpNeed(level) / packXp) * packTime / 60;
  return {
    level, rank: L.rankNames[rankOf(level)], prof,
    rarity: h.rarity, pts: h.pts, slots: h.slots,
    hitsToKill: e.hp / h.hit, // basic attacks for one enemy of your level
    ttkSolo: e.hp / h.dps, // seconds, one enemy, you alone
    ttkArmy: e.hp / (h.dps + army), // with your army on it
    armyShare: army / (h.dps + army),
    hitsToDie: h.maxHp / hitTaken, // enemy hits you can take
    surviveSec: h.maxHp / (e.dps * taken * PACK.normal), // a whole pack on you, no dodging
    bossSolo: bs.hp / h.dps, // normal gate boss, you alone
    bossArmy: bs.hp / (h.dps + army * 1.5), // boss shadows count more there? keep simple: army on it
    deadlyBossArmy: bsD.hp / (h.dps + army),
    bossHitsToDie: h.maxHp / (bs.dmg * taken),
    kills, minPerLevel,
  };
}

// ---- output -------------------------------------------------------------------
const RL = L.rankLevels;
function sampleLevels() {
  const out = [];
  for (let r = 0; r < RL.length; r++) {
    const a = RL[r], b = (RL[r + 1] || L.maxLevel + 1) - 1;
    for (const lv of [a, Math.round((a + b) / 2), b]) if (!out.includes(lv)) out.push(lv);
  }
  return out;
}

function rankHours(prof) {
  const res = [];
  for (let r = 0; r < RL.length; r++) {
    const a = RL[r], b = (RL[r + 1] || L.maxLevel + 1) - 1;
    let min = 0;
    for (let lv = a; lv <= Math.min(b, L.maxLevel - 1); lv++) min += row(lv, prof).minPerLevel;
    res.push({ rank: L.rankNames[r], levels: b - a + 1, hours: min / 60 });
  }
  return res;
}

const MAIN = (process.argv[1] || '').replace(/\\/g, '/').endsWith('tools/curve-sim.mjs');
if (!MAIN) {
  // imported by another tool: no output
} else if (process.argv.includes('--json')) {
  const all = [];
  for (let lv = 1; lv <= L.maxLevel; lv++) all.push({ t: row(lv, 'typical'), g: row(lv, 'good') });
  console.log(JSON.stringify({ rows: all, hours: { typical: rankHours('typical'), good: rankHours('good') } }));
} else {
  const f = (x, d = 1) => (x >= 100 ? Math.round(x).toString() : x.toFixed(d));
  for (const prof of ['typical', 'good']) {
    console.log(`\n== ${prof} ==`);
    console.log('lvl rank rar | hits  ttkSolo ttkArmy army% | hitsToDie packSec | boss solo  boss+army deadly+army bossHits | kills  min/lvl');
    for (const lv of sampleLevels()) {
      const x = row(lv, prof);
      console.log(`${String(lv).padStart(4)} ${x.rank.padEnd(3)} ${x.rarity}  | ${f(x.hitsToKill).padStart(5)} ${f(x.ttkSolo).padStart(7)} ${f(x.ttkArmy).padStart(7)} ${String(Math.round(x.armyShare * 100)).padStart(4)}% | ${f(x.hitsToDie).padStart(8)} ${f(x.surviveSec).padStart(7)} | ${f(x.bossSolo).padStart(9)} ${f(x.bossArmy).padStart(9)} ${f(x.deadlyBossArmy).padStart(10)} ${f(x.bossHitsToDie).padStart(8)} | ${f(x.kills).padStart(5)} ${f(x.minPerLevel).padStart(7)}`);
    }
    console.log('hours per rank:', rankHours(prof).map((h) => `${h.rank} ${h.hours.toFixed(1)}h`).join(' · '));
    console.log('gate bosses fought at their own level (solo s / with army s / hits you take):');
    for (let zi = 0; zi < ZONES.length; zi++) {
      const cells = [0, 1, 2].map((d) => {
        const lv = gateLevel(zi, d), h = hunter(lv, prof), b = boss(lv, d), e = enemy(lv);
        const K = G.defenseK * Math.pow(L.itemRank, zi), taken = K / (K + h.def);
        const army = armyDps(lv, h.slots);
        return `${CONFIG.gates.difficulties[d].id} L${lv}: ${f(b.hp / h.dps)} / ${f(b.hp / (h.dps + army))} / ${f(h.maxHp / (b.dmg * taken))}`;
      });
      console.log(`  ${L.rankNames[zi].padEnd(3)} ${cells.join('   ')}`);
    }
  }
}
