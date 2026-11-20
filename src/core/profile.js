// How the hunter plays: counted while playing and saved with the world. The
// Path (core/paths.js) uses it to decide which nodes are offered, and titles
// (core/titles.js) are earned from it. Worlds from before this existed start
// with nothing counted (the army size and the stat points still show the style).
const KEYS = [
  'hunterKills', 'armyKills', 'eliteKills', 'bossKills', // who killed what
  'dmgHunter', 'dmgArmy', 'dmgTaken', // damage dealt by the hunter / the shadows, damage the hunter took
  'hits', 'crits', // hits of the hunter and critical ones
  'deaths', 'casts', 'manaSpent', 'dodges', // the hunter's own play
  'raised', 'shadowsLost', 'revived', // the army: shadows raised, fallen, brought back
  'gatesCleared', 'stagesCleared', 'huntsSlain', 'outposts', 'chests', // content
  'time', 'timeCamp', 'timeGate', 'timeAbyss', 'sprintTime', // seconds
];

export class Profile {
  constructor(saved) {
    const s = saved || {};
    for (const k of KEYS) this[k] = Number(s[k]) || 0;
  }

  serialize() {
    const o = {};
    for (const k of KEYS) o[k] = Math.round(this[k]);
    return o;
  }

  kills() {
    return this.hunterKills + this.armyKills;
  }

  // share of the kills the hunter made himself (0..1; 0.5 before enough kills are counted)
  hunterShare() {
    return this.kills() < 50 ? 0.5 : this.hunterKills / this.kills();
  }

  // share of the damage dealt by the hunter (0.5 when unknown)
  dmgShare() {
    const n = this.dmgHunter + this.dmgArmy;
    return n <= 0 || this.kills() < 50 ? 0.5 : this.dmgHunter / n;
  }

  perMin(v) {
    return this.time < 300 ? 0 : (v / this.time) * 60;
  }

  castRate() { return this.perMin(this.casts); } // skills per minute
  dodgeRate() { return this.perMin(this.dodges); } // dodges per minute
  deathRate() { return this.time < 600 ? 0 : (this.deaths / this.time) * 3600; } // deaths per hour
  lossRate() { return this.time < 600 ? 0 : (this.shadowsLost / this.time) * 3600; } // shadows lost per hour
  critRate() { return this.hits < 100 ? 0 : this.crits / this.hits; } // share of hits that were critical
  eliteShare() { return this.kills() < 100 ? 0 : (this.eliteKills + this.bossKills) / this.kills(); }
  gateShare() { return this.time < 300 ? 0 : (this.timeGate + this.timeAbyss) / this.time; }
  campShare() { return this.time < 300 ? 0 : this.timeCamp / this.time; }
  sprintShare() { return this.time < 300 ? 0 : this.sprintTime / this.time; }
  // damage taken per minute, as a share of... just per minute (the Path compares it to max health)
  takenPerMin() { return this.perMin(this.dmgTaken); }
}
