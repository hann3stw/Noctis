// How the hunter plays: counted while playing and saved with the world. The
// Path (core/paths.js) uses it to decide which nodes are offered. Worlds from
// before this existed start with nothing counted (the army size and the
// stat points still show the style).
export class Profile {
  constructor(saved) {
    const s = saved || {};
    this.hunterKills = s.hunterKills | 0; // kills made by the hunter
    this.armyKills = s.armyKills | 0; // kills made by shadows
    this.deaths = s.deaths | 0; // times the hunter fell
    this.casts = s.casts | 0; // skills and ultimates cast
    this.gateTime = s.gateTime || 0; // seconds spent in gates and the Abyss
    this.time = s.time || 0; // seconds counted in total
  }

  serialize() {
    return {
      hunterKills: this.hunterKills, armyKills: this.armyKills, deaths: this.deaths,
      casts: this.casts, gateTime: Math.round(this.gateTime), time: Math.round(this.time),
    };
  }

  // share of the kills the hunter made himself (0..1; 0.5 before enough kills are counted)
  hunterShare() {
    const n = this.hunterKills + this.armyKills;
    return n < 50 ? 0.5 : this.hunterKills / n;
  }

  // casts per minute
  castRate() {
    return this.time < 300 ? 0 : (this.casts / this.time) * 60;
  }

  // deaths per hour
  deathRate() {
    return this.time < 600 ? 0 : (this.deaths / this.time) * 3600;
  }

  // share of the time in gates
  gateShare() {
    return this.time < 300 ? 0 : this.gateTime / this.time;
  }
}
