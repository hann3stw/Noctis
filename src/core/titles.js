// Titles: earned by how the hunter plays or what was done (checked every few
// seconds). One earned title can be worn: it shows on the leaderboards. The
// ids are sent online (a-z, 0-9 and _ only, at most 24 characters); the names
// are in strings.js as 'title.<id>' and how to get it as 'title.<id>.how'.
import { t } from '../strings.js';
import { play } from './sfx.js';

const HOUR = 3600;

// id -> does the hunter have it now? (g = the game)
export const TITLES = {
  shadow_monarch: (g) => g.army.deployed.length >= 40,
  lone_blade: (g) => g.profile.kills() >= 2000 && g.profile.hunterShare() >= 0.7,
  warlord: (g) => g.profile.kills() >= 2000 && g.profile.hunterShare() <= 0.15,
  gate_breaker: (g) => g.profile.gatesCleared >= 50,
  deadly_delver: (g) => Math.max(0, ...g.gateTiers) >= 5,
  abyss_walker: (g) => g.abyss.best >= 10,
  abyss_lord: (g) => g.abyss.best >= 50,
  hunter_of_hunters: (g) => g.profile.huntsSlain >= 15,
  streak_keeper: (g) => g.quests.streak >= 14,
  gravecaller: (g) => g.profile.raised >= 500,
  unbroken: (g) => g.profile.time >= 3 * HOUR && g.profile.deaths === 0,
  soul_weaver: (g) => g.profile.casts >= 5000,
  beast_scholar: (g) => g.bestiary.counts().mastered >= 20,
  apex_hunter: (g) => g.rankIndex >= 9,
  iron_commander: (g) => g.path.chosen.some((c) => c.core === 'commander'),
  shadow_blade: (g) => g.path.chosen.some((c) => c.core === 'blade'),
  soul_reaper: (g) => g.path.chosen.some((c) => c.core === 'mage'),
};

export class Titles {
  constructor(game, saved) {
    this.game = game;
    this.earned = saved && Array.isArray(saved.earned) ? saved.earned.filter((id) => TITLES[id]) : [];
    this.worn = saved && TITLES[saved.worn] && this.earned.includes(saved.worn) ? saved.worn : '';
    this.checkT = 5;
  }

  serialize() {
    return { earned: [...this.earned], worn: this.worn };
  }

  has(id) {
    return this.earned.includes(id);
  }

  // looks for new titles; the first one earned is worn at once
  update(dt) {
    if ((this.checkT -= dt) > 0) return;
    this.checkT = 10;
    for (const id in TITLES) {
      if (this.has(id) || !TITLES[id](this.game)) continue;
      this.earned.push(id);
      if (!this.worn) this.worn = id;
      this.game.hud.banner(t('title.new'), t('title.' + id));
      play('levelup');
    }
  }

  wear(id) {
    if (id && !this.has(id)) return;
    this.worn = this.worn === id ? '' : id;
    this.game.submitRecords();
  }
}
