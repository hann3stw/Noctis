// Levels, ranks and power. Every rank (E ... S) is one zone and covers a range
// of levels (CONFIG.levels.rankLevels). "Rank progress" is a smooth number:
// 0 at level 1, 1 at the first D level, 2 at the first C level and so on.
// Every power value below grows by a fixed factor per rank.
import { CONFIG } from '../config.js';

const L = CONFIG.levels;

// rank index of a level: 0 = E ... 5 = S
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

// the hunter's health and damage from the level alone
export function playerPower(level) {
  return Math.pow(L.playerRank, rankProgress(level));
}

// damage / defence factor of an item of this level
export function itemLevelPower(level) {
  return Math.pow(L.itemRank, rankProgress(level));
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
  if (!s || (s.version || 1) >= 2) return s;
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
  return s;
}
