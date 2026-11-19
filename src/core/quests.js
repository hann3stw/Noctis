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
    if (saved && saved.day === today() && Array.isArray(saved.list)) {
      this.day = saved.day;
      this.list = saved.list;
      this.bonus = !!saved.bonus;
    }
  }

  serialize() {
    return { day: this.day, list: this.list, bonus: this.bonus };
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

  claim(k) {
    const q = this.list[k], P = this.game.player;
    if (!q || !q.done || q.claimed) return;
    q.claimed = true;
    const ess = this.essence(q);
    P.essence += ess;
    this.give(Q.rarity[q.d]);
    this.game.hud.toast(t('toast.essence', { n: ess }));
    if (!this.bonus && this.list.every((x) => x.claimed)) {
      this.bonus = true;
      this.give(Q.bonus);
      this.game.hud.toast(t('quest.bonusGot'));
    }
    play('chest');
    this.game.save();
  }
}
