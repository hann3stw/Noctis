// Daily quests: three a day (easy, medium, hard), picked from the world seed
// and the date, so they change at midnight. They are about the zone of the
// hunter's rank. Progress comes from the game (kills, shadows, chests, gates,
// outposts); a finished quest is claimed in Menu → Quests for essence and an
// item, and all three together give one more item.
import { CONFIG } from '../config.js';
import { mulberry32, hashSeed } from './rng.js';
import { rollLoot } from './items.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

const Q = CONFIG.quests;

// today as a number (local time), so quests change at the player's midnight
export function today() {
  const d = new Date();
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

// milliseconds until the next local midnight
export function msToMidnight() {
  const d = new Date(), m = new Date(d);
  m.setHours(24, 0, 0, 0);
  return m - d;
}

export class Quests {
  constructor(game, saved) {
    this.game = game;
    this.day = -1;
    this.list = [];
    this.bonus = false; // the bonus for all three was given
    this.checkT = 0;
    // what lasts over the days: Soul Seals, the day streak, unused Soul Stones (tiers)
    this.seals = (saved && saved.seals | 0) || 0;
    this.streak = (saved && saved.streak | 0) || 0;
    this.streakDay = saved && typeof saved.streakDay === 'number' ? saved.streakDay : -9;
    this.stones = saved && Array.isArray(saved.stones) ? saved.stones.filter((n) => n >= 0 && n <= 2).slice(0, 50) : [];
    this.bought = {}; // shop purchases of today
    if (saved && saved.day === today() && Array.isArray(saved.list)) {
      this.day = saved.day;
      this.list = saved.list;
      this.bonus = !!saved.bonus;
      if (saved.bought && typeof saved.bought === 'object') this.bought = { ...saved.bought };
    }
  }

  serialize() {
    return {
      day: this.day, list: this.list, bonus: this.bonus, bought: this.bought,
      seals: this.seals, streak: this.streak, streakDay: this.streakDay, stones: this.stones,
    };
  }

  // the zone the quests are about: the one of the hunter's rank
  zone() {
    return Math.min(this.game.rankIndex, CONFIG.world.zones.length - 1);
  }

  make() {
    const game = this.game, rng = mulberry32(hashSeed(game.seed, 7300, today()));
    const zi = this.zone(), zone = CONFIG.world.zones[zi];
    const openOutpost = game.world.safes.some((s) => s.zone >= 0 && !s.captured && game.knownZones.has(s.zone));
    const used = new Set();
    this.list = [0, 1, 2].map((d) => {
      const pool = Q.pools[d].filter((k) => !used.has(k) && (k !== 'outpost' || openOutpost));
      const kind = pool[(rng() * pool.length) | 0];
      used.add(kind);
      const q = { kind, d, n: Q.kinds[kind].n[d], have: 0, zone: zi, done: false, claimed: false };
      if (kind === 'type') q.type = zone.enemyTypes[(rng() * zone.enemyTypes.length) | 0];
      if (kind === 'gate') q.gd = d === 1 ? 0 : game.rankIndex >= 2 ? 2 : 1;
      return q;
    });
    this.day = today();
    this.bonus = false;
    this.bought = {};
  }

  // a new day: new quests (also checked while playing past midnight)
  update(dt) {
    if ((this.checkT -= dt) > 0) return;
    this.checkT = 5;
    if (this.day !== today()) {
      const had = this.list.length > 0;
      this.make();
      if (had) this.game.hud.toast(t('quest.newDay'));
    }
  }

  // something happened: kind, and what it was about
  add(kind, v = {}) {
    for (const q of this.list) {
      if (q.done || q.kind !== kind) continue;
      if (kind === 'kill' && v.zone !== q.zone) continue;
      if (kind === 'type' && v.type !== q.type) continue;
      if (kind === 'gate' && v.diff < q.gd) continue;
      q.have = Math.min(q.n, q.have + 1);
      if (q.have >= q.n) {
        q.done = true;
        this.game.hud.toast(t('quest.done', { text: this.text(q) }));
        play('stage');
      }
    }
  }

  // an enemy died (by the hunter or the army)
  kill(typeId, zone, tier) {
    if (tier === 3) return;
    this.add('kill', { zone });
    this.add('type', { type: typeId });
    if (tier >= 1) this.add('elite');
  }

  text(q) {
    const zone = CONFIG.world.zones[q.zone];
    return t('quest.' + q.kind, {
      n: q.n, zone: t('zone.' + zone.id), enemy: q.type ? t('enemy.' + q.type) : '',
      diff: q.gd !== undefined ? t('gate.diff.' + CONFIG.gates.difficulties[q.gd].id) : '',
    });
  }

  essence(q) {
    return Q.essence[q.d] * (q.zone + 1);
  }

  // waiting to be claimed (for the menu badge)
  ready() {
    return this.list.filter((q) => q.done && !q.claimed).length;
  }

  give(minRarity) {
    const P = this.game.player;
    const item = rollLoot(P.level, P.luck + 0.6, P.known, minRarity, true);
    if (!P.addItem(item)) this.game.loot.drop(P.x, P.z, item); // full bag: at your feet
  }

  // The three rewards to pick from for quest k: the same ones every time the
  // quest is looked at (picked from the world seed, the day and the quest).
  options(k) {
    const q = this.list[k];
    if (!q) return [];
    const rng = mulberry32(hashSeed(this.game.seed, 7400 + k, today()));
    const all = [
      { kind: 'item', rarity: Q.rarity[q.d] },
      { kind: 'essence', n: this.essence(q) },
      { kind: 'seals', n: Q.sealBonus[q.d] },
      { kind: 'stone', tier: Q.stoneTier[q.d] },
    ];
    // one is left out (the item stays most of the time, so gear is always an option)
    const out = rng() < 0.7 ? all.splice((1 + rng() * 3) | 0, 1) : all.splice(0, 1);
    return all;
  }

  // quest k, reward number i of its options
  claim(k, i = 0) {
    const q = this.list[k], P = this.game.player;
    if (!q || !q.done || q.claimed) return;
    const o = this.options(k)[i];
    if (!o) return;
    q.claimed = true;
    this.seals += Q.seals[q.d];
    this.game.hud.toast(t('quest.sealsGot', { n: Q.seals[q.d] }));
    this.apply(o);
    this.updateStreak();
    if (!this.bonus && this.list.every((x) => x.claimed)) {
      this.bonus = true;
      this.seals += Q.bonusSeals;
      this.give(Q.bonus);
      this.game.hud.toast(t('quest.bonusGot', { n: Q.bonusSeals }));
    }
    play('chest');
    this.game.save();
  }

  // gives a reward option
  apply(o) {
    const P = this.game.player;
    if (o.kind === 'essence') {
      P.essence += o.n;
      this.game.hud.toast(t('toast.essence', { n: o.n }));
    } else if (o.kind === 'seals') {
      this.seals += o.n;
      this.game.hud.toast(t('quest.sealsGot', { n: o.n }));
    } else if (o.kind === 'stone') {
      this.stones.push(o.tier);
      this.game.hud.toast(t('quest.stoneGot', { tier: t('quest.tier.' + o.tier) }));
    } else {
      this.give(o.rarity);
    }
  }

  // the day streak counts days with a claimed quest; one missed day is forgiven
  updateStreak() {
    const d = today();
    if (this.streakDay === d) return;
    this.streak = d - this.streakDay <= 2 ? this.streak + 1 : 1;
    this.streakDay = d;
    const m = Q.streak.find((x) => x.days === this.streak);
    if (!m) return;
    this.game.hud.banner(t('quest.streakBanner', { n: this.streak }), t('quest.streakSub'));
    if (m.seals) this.seals += m.seals;
    if (m.item) this.give(m.item);
    if (m.stone !== undefined) this.stones.push(m.stone);
  }

  // the next streak reward: { days, seals, item, stone } or null
  nextStreak() {
    return Q.streak.find((x) => x.days > this.streak) || null;
  }

  // ---- Soul Stones: raise a shadow of a monster kind of the current zone ----------------
  // kinds a stone can raise: the ones of the hunter's zone
  stoneTypes() {
    return CONFIG.world.zones[this.zone()].enemyTypes;
  }

  useStone(index, type) {
    const g = this.game, P = g.player, tier = this.stones[index];
    if (tier === undefined || !this.stoneTypes().includes(type)) return false;
    if (!g.army.hasRoom()) { g.hud.toast(t('arise.full')); return false; }
    // as strong as a shadow raised from a monster of the hunter's level
    const u = g.army.add(type, tier, P.x, P.z, undefined, this.zone(), P.level);
    if (!u) return false;
    this.stones.splice(index, 1);
    g.effects.burst(u.x, 0.2, u.z, 22, g.appearance.aura, 6, 0.24, 0.8);
    g.effects.ring(u.x, u.z, 0.5, 4, g.appearance.aura, 0.55);
    g.hud.toast(t('toast.joinsArmy', { name: g.army.name(u) }));
    play('arise');
    g.save();
    return true;
  }

  // ---- the Soul Seal shop ---------------------------------------------------------------
  shopLeft(o) {
    return o.max ? Math.max(0, o.max - (this.bought[o.id] || 0)) : Infinity;
  }

  shopEssence() {
    return 100 * (this.zone() + 1);
  }

  buy(id) {
    const o = Q.shop.find((x) => x.id === id), g = this.game, P = g.player;
    if (!o || this.seals < o.cost || this.shopLeft(o) <= 0) return false;
    if (id === 'revive' && !g.army.deployed.some((u) => !u.alive)) return false;
    this.seals -= o.cost;
    this.bought[id] = (this.bought[id] || 0) + 1;
    if (o.tier !== undefined) this.stones.push(o.tier);
    else if (id === 'essence') P.essence += this.shopEssence();
    else if (id === 'revive') g.army.reviveAll();
    play('chest');
    g.save();
    return true;
  }
}
