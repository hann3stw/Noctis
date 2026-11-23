// Levels, ranks and power. Every rank (E ... S) is one zone and covers a range
// of levels (CONFIG.levels.rankLevels). "Rank progress" is a smooth number:
// 0 at level 1, 1 at the first D level, 2 at the first C level and so on.
// Every power value below grows by a fixed factor per rank.
import { CONFIG } from '../config.js';

const L = CONFIG.levels;

// names of the ranks: E, D, C, B, A, S, SS, SSS, L, M
export const RANKS = L.rankNames;

// rank index of a level: 0 = E ... 9 = M
export function rankOf(level) {
  let r = 0;
  for (let i = 0; i < L.rankLevels.length; i++) if (level >= L.rankLevels[i]) r = i;
  return r;
}

export function rankProgress(level) {
  const r = rankOf(level), a = L.rankLevels[r], b = L.rankLevels[r + 1] || L.maxLevel + 1;
  return r + Math.min(1, Math.max(0, (level - a) / (b - a)));
}

export function levelFromProgress(p) {
  const r = Math.max(0, Math.min(L.rankLevels.length - 1, Math.floor(p)));
  const a = L.rankLevels[r], b = L.rankLevels[r + 1] || L.maxLevel + 1;
  return Math.max(1, Math.min(L.maxLevel, Math.round(a + (p - r) * (b - a))));
}

// health, damage and XP of an enemy of this level (and of shadows raised from it)
export function enemyPower(level) {
  const p = rankProgress(level), r = Math.floor(p);
  return Math.pow(L.enemyRank, r + (p - r) * L.zoneSpread);
}

// XP the hunter needs for the next level (officer shadows use it too)
export function hunterXpNeed(level) {
  const G = CONFIG.progression;
  return Math.round(G.xpBase * enemyPower(level) * (1 + G.xpPerLevel * (level - 1)) * (L.xpRank ? L.xpRank[rankOf(level)] || 1 : 1));
}

// extra health of normal enemies of this level (see CONFIG.levels.enemyHpRank)
export function rankHp(level) {
  return L.enemyHpRank[rankOf(level)] || 1;
}

// the hunter's damage and health from the level alone
export function playerPower(level) {
  return Math.pow(L.playerRank, rankProgress(level));
}

export function playerHpPower(level) {
  return Math.pow(L.playerHpRank, rankProgress(level));
}

// level of a gate boss: the zone's first level + a share of its levels
export function gateLevel(zi, diff) {
  const z = CONFIG.world.zones[zi];
  return z.level + Math.round(CONFIG.gates.difficulties[diff].level * (z.levelTo - z.level + 1));
}

// damage / defence factor of an item of this level
// Abyss items above the last level: one more rank every levelsPerRankAbove levels.
export function itemLevelPower(level) {
  const p = level > L.maxLevel ? rankProgress(L.maxLevel) + (level - L.maxLevel) / L.levelsPerRankAbove : rankProgress(level);
  return Math.pow(L.itemRank, p);
}

// Enemy level at distance r from the centre: rises from the inner to the
// outer edge of the zone.
export function levelAt(r) {
  const zs = CONFIG.world.zones;
  if (r < zs[0].inner) return 1;
  for (const z of zs) {
    if (r >= z.inner && r < z.outer) {
      const span = z.levelTo - z.level + 1;
      const f = (r - z.inner) / (z.outer - z.inner);
      return z.level + Math.min(span - 1, Math.floor(f * span));
    }
  }
  return zs[zs.length - 1].levelTo;
}

// extra levels of elites, champions and bosses in zone zi
export function tierLevels(zi, tier) {
  const z = CONFIG.world.zones[zi] || CONFIG.world.zones[0];
  return Math.round(L.tierLevel[tier] * (z.levelTo - z.level + 1));
}

// Saves from before the new rank levels (8 levels per rank) are moved to the
// same place on the new scale: same rank, same share of it.
export function migrateSave(s) {
  if (!s || (s.version || 1) >= 5) return s;
  if (s.version === 4) return migrateCompanion(s);
  if (s.version === 3) return migrateCompanion(migrateClasses(s));
  if (s.version === 2) return migrateCompanion(migrateClasses(migrateRarity(s)));
  const map = (lv) => levelFromProgress(((lv || 1) - 1) / 8);
  const items = [];
  if (s.player) {
    s.player.level = map(s.player.level);
    s.player.xp = 0;
    items.push(...(s.player.inventory || []));
    for (const k in s.player.equip || {}) if (s.player.equip[k]) items.push(s.player.equip[k]);
    s.rankIndex = rankOf(s.player.level);
  }
  for (const it of items) if (it && it.level) it.level = map(it.level);
  s.version = 2;
  return migrateCompanion(migrateClasses(migrateRarity(s)));
}

function playerItems(s) {
  const items = [];
  if (s.player) {
    items.push(...(s.player.inventory || []));
    for (const k in s.player.equip || {}) if (s.player.equip[k]) items.push(s.player.equip[k]);
  }
  return items;
}

// Four rarities became six (uncommon and mythic are new): common stays,
// rare, epic and legendary move up.
function migrateRarity(s) {
  const map = [0, 2, 3, 4];
  for (const it of playerItems(s)) if (it && typeof it.rarity === 'number') it.rarity = map[it.rarity] ?? it.rarity;
  s.version = 3;
  return s;
}

// Version 4: the dynamic class system (affinities, the Awakening). Nothing is taken away and nothing is made
// up: the class, Path, items, skills, spells, army, mastery and runes stay as they are; the affinities start
// empty (they grow from the play from now on) and the class history is filled in by the game from the class
// it has (core/awakening.js). The class mechanics start at 0.
function migrateClasses(s) {
  if (!s.affinities || typeof s.affinities !== 'object') s.affinities = null;
  if (!s.awakening || typeof s.awakening !== 'object') s.awakening = null;
  s.version = 4;
  return s;
}

// Version 5: the companion of the Ranger line is no longer a shadow of the army. In older worlds of that line
// the companion was the one unit of the army (of the companion's kind): it is taken out of the army and kept as
// the companion, with its level, XP and health. Nothing else of the army is touched. Running it twice changes
// nothing (a save that has a companion already is left alone). The class progression starts empty (rewards
// come from the rank the world has).
function migrateCompanion(s) {
  const C = CONFIG.classes && CONFIG.classes.list, c = C && C[s.mainClass];
  const ranger = !!c && (c.base || s.mainClass) === 'ranger';
  if (ranger && !s.companion && s.army && Array.isArray(s.army.units)) {
    const i = s.army.units.findIndex((u) => u && u.type === CONFIG.ranger.companionType);
    if (i >= 0) {
      const u = s.army.units.splice(i, 1)[0];
      s.companion = { id: 'cmp-' + ((s.seed || 0) >>> 0).toString(36), kind: 'beast', type: u.type, tier: u.tier, role: u.role, zone: u.zone, level: u.level, xp: u.xp, totalXp: u.totalXp, stage: u.stage, plv: u.plv, alive: u.alive, hp: u.hp, reviveT: u.reviveT, upgrades: [] };
    }
  }
  s.version = 5;
  return s;
}
