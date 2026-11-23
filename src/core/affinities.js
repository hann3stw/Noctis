// Affinities: what the way you play says about you, nine values from 0 to 100. The game reports only actions
// that really happened (a hit that landed, a skill that went off, damage a shield really took ...) through
// record(type, data); this module alone decides what each one is worth.
//
// Two profiles are kept:
//  - long term: everything since the affinities exist in this world
//  - recent: the last ~5 hours of active play, as a ring of 30 slices of 10 minutes (old slices are overwritten)
// Only active play counts as time (tick is called by the game while it runs, not in pauses or menus).
// final = 0.65 x long term + 0.35 x recent; while the recent profile has little time it weighs less.
//
// A value is points per active minute, turned into 0..100 with 100 x (1 - e^(-rate / ref)). Every kind of action
// may count only so often per second (cap), so spamming or one big area hit cannot make a profile. With little
// play (less than CONFIDENCE minutes) the values are scaled down: no class is suggested from a few fights.
// No DOM here: the module is loaded by the tests (node --test).

export const AFFINITIES = ['might', 'precision', 'agility', 'arcana', 'resilience', 'dominion', 'instinct', 'discovery', 'control'];

// what an action gives: { affinity: points }; cap = at most so many of it count per second (0 = no limit);
// scaled = the points are multiplied by data.amount (a share of max health, mana ...)
export const ACTIONS = {
  meleeHit: { give: { might: 1 }, cap: 3 },
  rangedHit: { give: { precision: 0.6, agility: 0.2 }, cap: 3 },
  magicHit: { give: { arcana: 0.8 }, cap: 3 },
  criticalHit: { give: { precision: 1 }, cap: 2 },
  dodgeSuccess: { give: { agility: 2 }, cap: 1 },
  comboPoint: { give: { agility: 0.4, precision: 0.2 }, cap: 2 },
  skillCast: { give: { arcana: 1 }, cap: 1 }, // data.magic: a spell; otherwise data.melee / ranged
  manaSpent: { give: { arcana: 0.05 }, cap: 0, scaled: true }, // amount = mana
  healEffective: { give: { resilience: 20 }, cap: 0, scaled: true }, // amount = share of max health healed
  damagePrevented: { give: { resilience: 25 }, cap: 0, scaled: true }, // amount = share of max health prevented
  companionHit: { give: { dominion: 0.5 }, cap: 2 },
  companionKill: { give: { dominion: 2, instinct: 0.5 }, cap: 1 },
  shadowRaised: { give: { dominion: 5 }, cap: 1 },
  shadowKill: { give: { dominion: 0.8 }, cap: 2 },
  controlApplied: { give: { control: 1.5 }, cap: 1 }, // one cast that stunned, pulled or pushed something
  eliteKill: { give: { instinct: 3 }, cap: 2 },
  bossKill: { give: { instinct: 12 }, cap: 1 },
  huntSlain: { give: { instinct: 15 }, cap: 1 },
  gateCleared: { give: { discovery: 12 }, cap: 1 },
  stageCleared: { give: { discovery: 3 }, cap: 1 },
  chestOpened: { give: { discovery: 3 }, cap: 1 },
  outpostCaptured: { give: { discovery: 10 }, cap: 1 },
};

// points per active minute at which an affinity reaches 63 (dedicated play of that kind lands at 60..90)
export const REF = { might: 30, precision: 14, agility: 5, arcana: 12, resilience: 4, dominion: 16, instinct: 3, discovery: 3, control: 2.5 };

const SLICES = 30, SLICE = 600; // 30 x 10 minutes
const CONFIDENCE = 10; // minutes of play before the values count fully
const RECENT_FULL = 30; // minutes of recent play before the recent profile has its full weight
export const W_LONG = 0.65, W_RECENT = 0.35;

const zero = () => { const o = {}; for (const a of AFFINITIES) o[a] = 0; return o; };
const num = (v) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

export class Affinities {
  constructor(saved) {
    const s = saved && typeof saved === 'object' ? saved : {};
    this.long = zero();
    this.longT = num(s.longT);
    for (const a of AFFINITIES) this.long[a] = num(s.long && s.long[a]);
    this.ring = [];
    for (let i = 0; i < SLICES; i++) {
      const r = s.ring && s.ring[i];
      const sl = { t: num(r && r.t), p: zero() };
      for (const a of AFFINITIES) sl.p[a] = num(r && r.p && r.p[a]);
      this.ring.push(sl);
    }
    this.cur = Math.max(0, Math.min(SLICES - 1, (s.cur | 0)));
    this.clock = 0; // active seconds of this run (for the caps)
    this.seen = {}; // type -> [second, count in that second]
    this.cache = null;
  }

  serialize() {
    const r2 = (o) => { const out = {}; for (const a of AFFINITIES) out[a] = Math.round(o[a] * 10) / 10; return out; };
    return { longT: Math.round(this.longT), long: r2(this.long), cur: this.cur, ring: this.ring.map((sl) => ({ t: Math.round(sl.t), p: r2(sl.p) })) };
  }

  // active play time goes on (only while the game runs)
  tick(dt) {
    if (!(dt > 0)) return;
    this.clock += dt;
    this.longT += dt;
    let sl = this.ring[this.cur];
    sl.t += dt;
    if (sl.t >= SLICE) {
      this.cur = (this.cur + 1) % SLICES;
      sl = this.ring[this.cur];
      sl.t = 0;
      sl.p = zero();
    }
    this.cache = null;
  }

  // An action that really happened. data.amount scales the scaled kinds; data.magic / melee / ranged steer a skill cast.
  record(type, data) {
    const A = ACTIONS[type];
    if (!A) return false;
    if (A.cap) {
      const sec = Math.floor(this.clock), s = this.seen[type] || (this.seen[type] = [-1, 0]);
      if (s[0] !== sec) { s[0] = sec; s[1] = 0; }
      if (s[1] >= A.cap) return false; // counted enough of it in this second
      s[1]++;
    }
    let give = A.give;
    if (type === 'skillCast' && data && !data.magic) give = data.ranged ? { precision: 0.6, agility: 0.4 } : { might: 1 };
    const k = A.scaled ? Math.min(5, num(data && data.amount)) : 1;
    if (!k) return false;
    const sl = this.ring[this.cur];
    for (const a in give) {
      this.long[a] += give[a] * k;
      sl.p[a] += give[a] * k;
    }
    this.cache = null;
    return true;
  }

  static score(points, minutes) {
    const out = zero();
    if (minutes <= 0) return out;
    const conf = Math.min(1, minutes / CONFIDENCE);
    for (const a of AFFINITIES) out[a] = Math.round(100 * (1 - Math.exp(-(points[a] / minutes) / REF[a])) * conf);
    return out;
  }

  longTerm() {
    return Affinities.score(this.long, this.longT / 60);
  }

  recent() {
    const p = zero();
    let t = 0;
    for (const sl of this.ring) { t += sl.t; for (const a of AFFINITIES) p[a] += sl.p[a]; }
    return Affinities.score(p, t / 60);
  }

  recentMinutes() {
    let t = 0;
    for (const sl of this.ring) t += sl.t;
    return t / 60;
  }

  // { might: 0..100, ... }: the values that count (cached until something changes)
  values() {
    if (this.cache) return this.cache;
    const L = this.longTerm(), R = this.recent();
    const wr = W_RECENT * Math.min(1, this.recentMinutes() / RECENT_FULL), wl = 1 - wr;
    const out = zero();
    for (const a of AFFINITIES) out[a] = Math.round(L[a] * wl + R[a] * wr);
    this.cache = out;
    return out;
  }

  // the strongest affinities, best first
  top(n = 3) {
    const v = this.values();
    return AFFINITIES.slice().sort((a, b) => v[b] - v[a]).slice(0, n);
  }
}
