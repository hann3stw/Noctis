// Goals for the middle of the game: Achievements (long lists with tiers, paid in Soul Seals the moment a tier is
// reached) and Weekly goals (three a week, new every Monday, claimed in Menu > Quests > Weekly), plus the weekly
// featured modifier (a gate modifier that gives double luck and XP that week). Everything is counted from numbers
// the game already keeps (core/profile.js and the state of the game), so nothing has to be hooked into the combat.
import { CONFIG } from '../config.js';
import { mulberry32, hashSeed } from './rng.js';
import { t } from '../strings.js';
import { play } from './sfx.js';
import { today } from './quests.js';
import { track } from './track.js';

const G = CONFIG.goals;

// the day count (see quests.today) -> the number of the week, Monday to Sunday
export const weekOf = (day = today()) => Math.floor((day + 3) / 7);
export function msToMonday() {
  const d = new Date(), m = new Date(d);
  m.setHours(24, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  return m - d + (6 - dow) * 86400000;
}

// what is counted: id -> number now
const COUNTERS = {
  kills: (g) => g.profile.kills(),
  elites: (g) => g.profile.eliteKills,
  bosses: (g) => g.profile.bossKills,
  gates: (g) => g.profile.gatesCleared,
  stages: (g) => g.profile.stagesCleared,
  hunts: (g) => g.profile.huntsSlain,
  chests: (g) => g.profile.chests,
  outposts: (g) => g.profile.outposts,
  raised: (g) => g.profile.raised,
  casts: (g) => g.profile.casts,
  dodges: (g) => g.profile.dodges,
  level: (g) => g.player.level,
  floor: (g) => g.abyss.best,
  tier: (g) => Math.max(0, ...g.gateTiers),
  mastered: (g) => g.bestiary.counts().mastered,
  hours: (g) => Math.floor(g.profile.time / 3600),
  streak: (g) => g.quests.streak,
  duels: (g) => g.duel.won,
  spells: (g) => (g.forge ? g.forge.spells.length : 0),
};

export class Goals {
  constructor(game, saved) {
    this.game = game;
    const s = saved || {};
    this.tiers = {}; // achievement id -> tiers reached (and paid)
    for (const a of G.achievements) this.tiers[a.id] = Math.min(a.tiers.length, Number(s.tiers && s.tiers[a.id]) || 0);
    const w = s.week || {};
    this.week = typeof w.week === 'number' ? w.week : -1;
    this.base = w.base && typeof w.base === 'object' ? { ...w.base } : {};
    this.list = Array.isArray(w.list) ? w.list : [];
    this.bonus = !!w.bonus;
    this.checkT = 2;
  }

  serialize() {
    return { tiers: { ...this.tiers }, week: { week: this.week, base: this.base, list: this.list, bonus: this.bonus } };
  }

  // ---- achievements -------------------------------------------------------------------------
  value(a) {
    return COUNTERS[a.stat](this.game);
  }

  // an achievement is shown only when it can be done (no army: no shadows raised, not a Mage: no spells)
  usable(a) {
    const g = this.game;
    if (a.stat === 'raised') return g.hasArmy();
    if (a.stat === 'spells') return g.canForge();
    return true;
  }

  total() {
    return Object.values(this.tiers).reduce((s, n) => s + n, 0);
  }

  max() {
    return G.achievements.reduce((s, a) => s + a.tiers.length, 0);
  }

  // new tiers: paid at once (Soul Seals), one banner for everything that came together
  checkAchievements() {
    const Q = this.game.quests;
    let seals = 0, last = null, n = 0;
    for (const a of G.achievements) {
      if (!this.usable(a)) continue;
      const v = this.value(a);
      while (this.tiers[a.id] < a.tiers.length && v >= a.tiers[this.tiers[a.id]]) {
        seals += G.sealsPerTier[Math.min(G.sealsPerTier.length - 1, this.tiers[a.id])];
        this.tiers[a.id]++;
        track('goal', { id: a.id, n: this.tiers[a.id] });
        last = a;
        n++;
      }
    }
    if (!n) return;
    Q.seals += seals;
    this.game.hud.banner(t('goal.new'), n === 1 ? t('goal.a.' + last.id + '.name') + ' ' + this.roman(this.tiers[last.id]) + ' · ' + t('quest.sealsN', { n: seals }) : t('goal.newMany', { n, seals }));
    play('levelup');
    this.game.save();
  }

  roman(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][n] || String(n);
  }

  // ---- weekly goals ------------------------------------------------------------------------
  zone() {
    return Math.min(this.game.rankIndex, CONFIG.world.zones.length - 1);
  }

  snapshot() {
    const o = {};
    for (const k of Object.keys(G.weekly.kinds)) o[k] = COUNTERS[k](this.game);
    return o;
  }

  make() {
    const g = this.game, rng = mulberry32(hashSeed(g.seed, 7700, weekOf()));
    const used = new Set();
    this.list = [0, 1, 2].map((d) => {
      const pool = G.weekly.pools[d].filter((k) => !used.has(k) && (k !== 'raised' || g.hasArmy()));
      const kind = pool[(rng() * pool.length) | 0];
      used.add(kind);
      const K = G.weekly.kinds[kind];
      const n = Math.max(1, Math.round(K.n[d] * (K.scale ? 1 + G.weekly.rankScale * g.rankIndex : 1)));
      return { kind, d, n, claimed: false };
    });
    this.week = weekOf();
    this.base = this.snapshot();
    this.bonus = false;
  }

  have(q) {
    return Math.max(0, Math.min(q.n, COUNTERS[q.kind](this.game) - (this.base[q.kind] || 0)));
  }

  done(q) {
    return this.have(q) >= q.n;
  }

  // goals finished and not yet claimed (for the badge in the menu)
  ready() {
    return this.list.filter((q) => this.done(q) && !q.claimed).length;
  }

  text(q) {
    return t('goal.w.' + q.kind, { n: q.n });
  }

  essence(q) {
    return G.weekly.essence[q.d] * (this.zone() + 1);
  }

  claim(k) {
    const q = this.list[k], g = this.game, Q = g.quests;
    if (!q || q.claimed || !this.done(q)) return;
    q.claimed = true;
    track('weekly', { kind: q.kind, d: q.d });
    Q.seals += G.weekly.seals[q.d];
    g.player.essence += this.essence(q);
    g.hud.toast(t('quest.sealsGot', { n: G.weekly.seals[q.d] }));
    if (!this.bonus && this.list.every((x) => x.claimed)) {
      this.bonus = true;
      Q.seals += G.weekly.bonusSeals;
      Q.addKey(1);
      Q.give(G.weekly.bonusRarity);
      g.hud.banner(t('goal.weekDone'), t('goal.weekDoneSub', { n: G.weekly.bonusSeals }));
    }
    play('chest');
    g.save();
  }

  // ---- the weekly featured modifier ----------------------------------------------------------
  featured() {
    const ids = Object.keys(CONFIG.modifiers.list);
    return ids[Math.floor(mulberry32(hashSeed(7800, weekOf(), 1))() * ids.length)];
  }

  // how many modifiers count for luck and XP: the featured one counts double
  modCount(mods) {
    return mods.length + (mods.includes(this.featured()) ? 1 : 0);
  }

  update(dt) {
    if ((this.checkT -= dt) > 0) return;
    this.checkT = 5;
    if (this.week !== weekOf()) {
      const had = this.list.length > 0;
      this.make();
      if (had) this.game.hud.toast(t('goal.newWeek'));
    }
    this.checkAchievements();
  }
}
