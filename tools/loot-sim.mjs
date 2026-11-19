// Loot per rank: how many items of each rarity a hunter finds while playing
// through a rank, with the game's own drop chances and rarity luck.
// Kills per level and gates per rank come from real cloud saves (Nov 2026):
// about 3.3 kills per level (army kills included), ~20 min per late rank.
//   node tools/loot-sim.mjs
import { CONFIG } from '../src/config.js';
import { rankOf } from '../src/core/levels.js';
import { points } from './curve-sim.mjs';

const L = CONFIG.levels, I = CONFIG.items, G = CONFIG.progression;
const NAMES = ['common', 'uncommon', 'rare', 'epic', 'legend', 'mythic', 'exotic'];

// ---- assumptions -------------------------------------------------------------
const KILLS_PER_LEVEL = 3.3;
const ELITE_SHARE = 0.03; // share of kills that are elites (14 % of packs have one)
const PER_SHARE = 0.2; // real saves spend about a fifth of their points on Perception
const DIFF_LUCK = CONFIG.difficulty.levels.normal.luck;
const GATES = (levels) => (levels >= 100 ? 6 : 3); // one of each difficulty, twice in long ranks
const CHESTS = (levels) => (levels >= 100 ? 15 : 8);
const OUTPOSTS = 4;

// probability of every rarity for one roll (same maths as rollRarity)
function dist(level, luck, min = 0) {
  const base = I.rarityWeights[Math.min(I.rarityWeights.length - 1, rankOf(level))];
  const k = 1 + Math.max(0, luck);
  const w = base.map((v, r) => v * Math.pow(k, r * I.luckStep));
  let top = 0;
  base.forEach((v, r) => { if (v > 0) top = r; });
  const sum = w.reduce((a, b) => a + b, 0);
  const p = w.map((v) => v / sum);
  const m = Math.min(min, top);
  for (let r = 0; r < m; r++) { p[m] += p[r]; p[r] = 0; }
  return { p, top };
}

function add(acc, d, n) { d.p.forEach((v, r) => { acc[r] += v * n; }); }

export function rankLoot(r) {
  const a = L.rankLevels[r], b = (L.rankLevels[r + 1] || L.maxLevel + 1) - 1, levels = b - a + 1;
  const mid = Math.round((a + b) / 2);
  const drop = Math.floor(points(mid) * PER_SHARE) * G.stats.per.drop + DIFF_LUCK;
  const kills = levels * KILLS_PER_LEVEL;
  const acc = [0, 0, 0, 0, 0, 0, 0];
  const src = {};
  const gearShare = 0.85; // the rest are skill drops
  // normal enemies and elites
  const nNormal = kills * (1 - ELITE_SHARE) * CONFIG.loot.dropChance[0] * (1 + drop) * gearShare;
  add(acc, dist(mid, drop), nNormal); src.monsters = nNormal;
  const nElite = kills * ELITE_SHARE * Math.min(1, CONFIG.loot.dropChance[1] * (1 + drop)) * gearShare;
  add(acc, dist(mid, drop + 0.6, 1), nElite); src.elites = nElite;
  // gates: boss items + one item per stage
  let nGate = 0;
  for (let g = 0; g < GATES(levels); g++) {
    const D = CONFIG.gates.difficulties[g % 3];
    add(acc, dist(mid, drop + D.luck, D.minRarity), D.items); nGate += D.items;
    add(acc, dist(mid, drop + D.luck * CONFIG.gates.stageLuck, 1), D.stages.length); nGate += D.stages.length;
  }
  src.gates = nGate;
  const nChest = CHESTS(levels) * 1.5 * gearShare;
  add(acc, dist(mid, drop + 0.4), nChest); src.chests = nChest;
  const nOut = OUTPOSTS * CONFIG.outposts.chestItems * gearShare;
  add(acc, dist(mid, drop + 0.8, CONFIG.outposts.chestMinRarity), nOut); src.outposts = nOut;
  const total = acc.reduce((x, y) => x + y, 0);
  const top = dist(mid, 0).top;
  return { rank: L.rankNames[r], levels, kills: Math.round(kills), drop, total, acc, top, src };
}

if ((process.argv[1] || '').replace(/\\/g, '/').endsWith('tools/loot-sim.mjs')) {
  console.log('rank lv  kills luck | items | ' + NAMES.map((n) => n.padStart(8)).join('') + ' | top rarity: found (per slot)');
  for (let r = 0; r < L.rankNames.length; r++) {
    const x = rankLoot(r);
    const cells = x.acc.map((v) => (v < 0.05 ? '-' : v.toFixed(1)).padStart(8)).join('');
    console.log(`${x.rank.padEnd(4)} ${String(x.levels).padStart(3)} ${String(x.kills).padStart(5)} ${x.drop.toFixed(2)} | ${x.total.toFixed(0).padStart(5)} | ${cells} | ${NAMES[x.top]}: ${x.acc[x.top].toFixed(1)} (${(x.acc[x.top] / 5).toFixed(1)})`);
  }
  // one deadly gate boss item, late game, with and without Perception
  for (const lv of [500, 900]) {
    const per = Math.floor(points(lv) * PER_SHARE) * G.stats.per.drop;
    const D = CONFIG.gates.difficulties[2];
    const t = dist(lv, 0).top;
    console.log(`L${lv} deadly gate item: top rarity ${NAMES[t]} ${(dist(lv, D.luck, D.minRarity).p[t] * 100).toFixed(0)} % without Perception, ${(dist(lv, D.luck + per, D.minRarity).p[t] * 100).toFixed(0)} % with ${Math.round(per / G.stats.per.drop)} Perception (luck +${per.toFixed(1)})`);
  }
}
