// The Path of the Necromancer (class tree). At every rank from D to M
// (CONFIG.paths.stages) the System offers three classes, made from the way the
// hunter plays (core/profile.js and the army): see options().
//  - A class has a core (the style it comes from: blade, commander, mage, tank,
//    slayer, delver), maybe a second core (the "mod", a smaller share of its
//    package) and a rarity. Its bonuses grow with the stage and the rarity.
//  - Every class is an upgrade: no drawbacks, and all earlier packages stay.
//  - The core of the last pick gives the class skill; it grows (I-III) with the
//    picks of that core. Some cores unlock a mechanic (see unlocks in the config).
// The offer is made once per stage and saved. The picks are saved with the world
// and can be taken back with a Respec Token.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';
import { stepsOf, progName } from './classProgression.js';

const clamp = (v) => Math.max(0, Math.min(1, v));
const C = () => CONFIG.paths;
const at = (x, lv) => (Array.isArray(x) ? x[lv] : x);

// the nodes of the old Path (before the classes) and the core each one becomes
const LEGACY = {};
for (const [core, ids] of Object.entries({
  commander: 'commander1 warBanner graveLegion officerCorps reapersToll legion warlordCommand eternalRanks necromancerKing boneMarshal shadowEmperor undyingHost lichKing shadowMonarch',
  blade: 'blade1 duelist bladeDance bloodlust thousandCuts loneReaper phantomStep spellblade perfectForm deathIncarnate',
  mage: 'mage1 soulFurnace soulSiphon archmage soulTempest lichForm arcaneSovereign soulLord grimHarvest',
  tank: 'graveWard lastStand necroticAegis',
  slayer: 'executioner huntersCall bossBane apexPredator',
  delver: 'gatecrasher abyssTouched',
})) for (const id of ids.split(' ')) LEGACY[id] = core;
const OLD_STAGES = [1, 3, 5, 8]; // the ranks the old picks were made at

export class Paths {
  constructor(game, saved) {
    this.game = game;
    const S = saved || {};
    const cores = CONFIG.paths.cores;
    const okClass = (c) => c && cores[c.core] && (!c.mod || cores[c.mod]) && Number.isInteger(c.rarity) && c.rarity >= 0 && c.rarity < C().rarityMult.length;
    this.chosen = []; // [{ core, mod, rarity, st? }] one per stage
    this.legacy = false; // the picks were converted from the old nodes: a Respec Token is due
    if (S.v === 2 && Array.isArray(S.chosen)) {
      this.chosen = S.chosen.filter(okClass).map((c) => ({ core: c.core, mod: c.mod || '', rarity: c.rarity, ...(c.st ? { st: c.st } : {}) }));
      this.legacy = !!S.legacy;
    } else if (Array.isArray(S.chosen)) {
      S.chosen.filter((id) => LEGACY[id]).forEach((id, i) => this.chosen.push({ core: LEGACY[id], mod: '', rarity: 1, st: OLD_STAGES[i] || i + 1 }));
      this.legacy = this.chosen.length > 0;
    }
    this.chosen = this.chosen.slice(0, C().stages.length);
    // the offer of the stage that is due: { stage, list: [{ core, mod, rarity }] }
    const o = S.v === 2 && S.offer;
    this.offer = o && o.stage === this.chosen.length + 1 && Array.isArray(o.list) && o.list.length && o.list.every(okClass) ? o : null;
    this.announced = false;
    this.rallyCd = 0;
    this.dirty = true;
  }

  serialize() {
    return { v: 2, chosen: this.chosen.map((c) => ({ ...c })), offer: this.offer, legacy: this.legacy };
  }

  // how many picks the hunter's rank has unlocked
  unlocked() {
    const r = this.game.rankIndex;
    return C().stages.filter((s) => r >= s).length;
  }

  // a pick is waiting
  due() {
    return !this.game.classDue() && this.chosen.length < this.unlocked();
  }

  // the stage that is due (1 = the first pick)
  stage() {
    return this.chosen.length + 1;
  }

  // the stage a pick counts as (a converted pick keeps the rank it was made at)
  stageOf(i) {
    return this.chosen[i].st || i + 1;
  }

  // ---- how the hunter plays: every measure 0 .. 1 -------------------------------------------
  metrics() {
    const g = this.game, pf = g.profile, A = g.army, S = g.player.stats;
    const officers = A.deployed.filter((u) => (u.rank || 0) >= 3).length;
    const intShare = S.int / Math.max(1, S.int + S.str);
    return {
      army: clamp(A.deployed.length / 40) * 0.7 + intShare * 0.3,
      hunter: pf.hunterShare(),
      caster: clamp(pf.castRate() / 6),
      dodger: clamp(pf.dodgeRate() / 4),
      deaths: clamp(pf.deathRate() / 6),
      lossy: clamp(pf.lossRate() / 80),
      elite: clamp(pf.eliteShare() / 0.12),
      gates: clamp(pf.gateShare() / 0.4),
      sprint: clamp(pf.sprintShare() / 0.12),
      officers: clamp(officers / 7),
      critty: clamp(pf.critRate() / 0.5),
      tank: clamp(pf.takenPerMin() / Math.max(60, g.player.maxHp * 0.5)),
    };
  }

  // how well each core fits the way the hunter plays: 0 .. 1
  scores() {
    const m = this.metrics(), out = {};
    for (const c of this.cores()) {
      const like = C().cores[c].like;
      let s = 0, w = 0;
      for (const k in like) { const a = Math.abs(like[k]); s += a * (like[k] > 0 ? m[k] : 1 - m[k]); w += a; }
      out[c] = w ? s / w : 0;
    }
    return out;
  }

  // the cores the main class gets
  cores() {
    const k = CONFIG.classes.list[this.game.mainClass];
    return k ? k.cores : Object.keys(C().cores);
  }

  // the core of the last pick ('' = none)
  currentCore() {
    return this.chosen.length ? this.chosen[this.chosen.length - 1].core : '';
  }

  // picks of a core so far
  coreCount(core) {
    return this.chosen.filter((c) => c.core === core).length;
  }

  // Common .. Legendary from how strong the style is: one core strong = Rare, two = Epic,
  // an extreme mix from rank SS on = Legendary
  rarityOf(stage, s, ms) {
    let r = s < 0.35 ? 0 : s < 0.55 ? 1 : 2;
    if (ms >= 0.55 && s >= 0.55) r = 3;
    if (stage >= 6 && s >= 0.85 && ms >= 0.55) r = 4;
    return r;
  }

  // The three classes of the stage that is due, made from the way the hunter plays:
  //  - the way on: the core of the last pick (the best fitting core at the first pick),
  //  - a branch: the best fitting other core, and
  //  - a new direction: the next one.
  // Each gets the best fitting other core as its mod when that fits well enough.
  // The offer stays the same until a pick is made.
  options() {
    const st = this.stage();
    if (this.offer && this.offer.stage === st) return this.offer.list;
    const sc = this.scores();
    const order = this.cores().slice().sort((a, b) => sc[b] - sc[a]);
    const main = this.currentCore() || order[0];
    const rest = order.filter((c) => c !== main);
    const mod = (core, c) => (c && c !== core && sc[c] >= 0.4 ? c : '');
    const make = (core, m) => ({ core, mod: m, rarity: this.rarityOf(st, sc[core], m ? sc[m] : 0) });
    const list = [make(main, mod(main, rest[0])), make(rest[0], mod(rest[0], main)), make(rest[1], mod(rest[1], rest[0]))];
    this.offer = { stage: st, list };
    return list;
  }

  // ---- names, bonuses, rules ------------------------------------------------------------
  nameOf(cls, n) {
    const base = t('class.n.' + cls.core + '.' + Math.min(9, Math.max(1, n)));
    return cls.mod ? t('class.mod.' + cls.mod) + ' ' + base : base;
  }

  // the name of a pick that was made
  chosenName(i) {
    let n = 0;
    for (let k = 0; k <= i; k++) if (this.chosen[k].core === this.chosen[i].core) n++;
    return this.nameOf(this.chosen[i], n);
  }

  // the name of a class that is offered
  offerName(cls) {
    return this.nameOf(cls, this.coreCount(cls.core) + 1);
  }

  // stage and rarity make a package bigger
  factor(cls, stage) {
    return (1 + C().stageScale * (stage - 1)) * C().rarityMult[cls.rarity];
  }

  // a sum of the bonuses (what = 'bonus') or rules of a class: core + the share of the mod
  sumOf(cls, stage, what) {
    const f = this.factor(cls, stage), out = {};
    const add = (core, share) => {
      const src = C().cores[core][what];
      for (const k in src) out[k] = (out[k] || 0) + src[k] * f * share;
    };
    add(cls.core, 1);
    if (cls.mod) add(cls.mod, C().modShare);
    return out;
  }

  bonusOf(cls, stage) {
    return this.sumOf(cls, stage, 'bonus');
  }

  rulesOf(cls, stage) {
    return this.sumOf(cls, stage, 'rule');
  }

  // all bonuses of the picks (with the bonus of every pick); the army slots are whole
  totals() {
    const b = {}, pb = C().pickBonus;
    this.chosen.forEach((c, i) => {
      const bo = this.bonusOf(c, this.stageOf(i));
      for (const k in bo) b[k] = (b[k] || 0) + bo[k];
      for (const k in pb) b[k] = (b[k] || 0) + pb[k];
    });
    if (b.armySlots) b.armySlots = Math.round(b.armySlots);
    return b;
  }

  // adds the bonuses of the picks to b (Player.recalc)
  apply(b) {
    const tot = this.totals();
    for (const k in tot) b[k] = (b[k] || 0) + tot[k];
  }

  // all rules of the picks, summed (cached until a pick changes)
  rules() {
    if (this.dirty || !this._rules) {
      const r = {};
      this.chosen.forEach((c, i) => {
        const ro = this.rulesOf(c, this.stageOf(i));
        for (const k in ro) r[k] = (r[k] || 0) + ro[k];
      });
      this._rules = r;
      this.dirty = false;
    }
    return this._rules;
  }

  // a rule value of the picks (0 = none); armyKillXp is a factor
  rule(name) {
    const v = this.rules()[name] || 0;
    return name === 'armyKillXp' ? 1 + v : v;
  }

  // a rule that multiplies (1 = none)
  mult(name) {
    return Math.max(0.3, 1 + (this.rules()[name] || 0));
  }

  // the most army slots there can be
  slotCap() {
    return CONFIG.shadows.maxSlots + Math.round(this.rules().slotCapPlus || 0);
  }

  // ---- unlocked mechanics ---------------------------------------------------------------
  // a core unlocks mechanics from a stage on; a class at that stage or later is enough
  has(id) {
    return this.chosen.some((c, i) => C().cores[c.core].unlocks.some((u) => u.id === id && this.stageOf(i) >= u.stage));
  }

  // the unlocked mechanics that exist in the game
  unlockedList() {
    const out = [];
    for (const core in C().cores) for (const u of C().cores[core].unlocks) if (C().live.includes(u.id) && this.has(u.id)) out.push(u.id);
    return out;
  }

  // the unlocks a class would bring (only mechanics that exist in the game)
  unlocksOf(cls, stage) {
    return C().cores[cls.core].unlocks.filter((u) => C().live.includes(u.id) && stage >= u.stage && !this.has(u.id)).map((u) => u.id);
  }

  skillSlots() {
    return this.has('thirdSlot') ? 3 : 2;
  }

  // rune sockets per skill grow with the picks
  runeSockets() {
    const n = this.chosen.length, s = C().sockets;
    return 1 + (n >= s[0] ? 1 : 0) + (n >= s[1] ? 1 : 0);
  }

  // ---- class skill ----------------------------------------------------------------------
  // the class skill of the last pick: { core, level 0..2, def } (null = none)
  skill() {
    const core = this.currentCore();
    if (!core) return null;
    const level = Math.min(2, Math.floor((this.coreCount(core) - 1) / C().skillStep));
    return { core, level, def: C().cores[core].skill };
  }

  // the class skill when it is the one of this core
  skillOf(core) {
    const s = this.skill();
    return s && s.core === core ? s : null;
  }

  // the numbers of a class skill for its text: v (percent), s (seconds), c (cooldown)
  skillParams(def, level) {
    return { v: Math.round(at(def.value, level) * 100), s: at(def.time, level) || 0, c: at(def.cooldown, level) || 0 };
  }

  // an elite or boss fell (Commander: Rally)
  onKill(tier) {
    if (tier < 1 || this.rallyCd > 0) return;
    const s = this.skillOf('commander');
    if (!s) return;
    this.game.army.buff(at(s.def.value, s.level), at(s.def.time, s.level));
    this.rallyCd = at(s.def.cooldown, s.level);
  }

  // a gate stage was cleared (Delver: Resolve)
  onStage() {
    const s = this.skillOf('delver'), P = this.game.player;
    if (!s || P.dead) return;
    P.hp = Math.min(P.maxHp, P.hp + P.maxHp * at(s.def.value, s.level));
    this.game.effects.burst(P.x, 1.2, P.z, 8, 0x5cf08a, 3, 0.16, 0.5);
  }

  update(dt) {
    if (this.rallyCd > 0) this.rallyCd -= dt;
    // worlds from before the classes: the picks were converted, a Respec Token is the way out
    if (this.legacy && this.game.playTime > 3) {
      this.legacy = false;
      this.game.quests.addRespec(1);
      this.game.hud.banner(t('path.legacy'), t('path.legacySub'));
      this.game.save();
    }
  }

  // ---- one choice per rank-up: the class step that rides on a pick ---------------------------
  // The rank of a stage (stage 4 = rank A ...). A stage can carry the class step of that rank (A, S, L: a step
  // with two options, core/classProgression.js): then each card of the offer brings one of the two options
  // (cards 1 and 3 the first, card 2 the second), and one pick decides both.
  stageRank(stage) {
    return C().stages[stage - 1];
  }

  // the class step the due stage carries: { tree, key, node } or null (none, or already decided)
  stepFor(stage = this.stage()) {
    const g = this.game, tree = g.classTree, rank = this.stageRank(stage);
    if (!tree || rank === undefined || !g.progression) return null;
    const st = stepsOf(tree, Math.max(rank, 0), g.aff.values(), g.progression).find((s) => s.rank === rank);
    if (!st || !st.node.pick || st.picked) return null;
    return { tree, key: st.key, node: st.node };
  }

  // the option of the class step on card i (or null)
  stepOption(i, step = this.stepFor()) {
    return step ? step.node.pick[i % 2] : null;
  }

  // the card that fits the play best (the first of the offer: the way on, or the best core at the first pick)
  bestIndex() {
    return 0;
  }

  // ---- picking --------------------------------------------------------------------------
  // auto = taken by the game (the rank-up already had an Awakening choice): no class step rides on it, so the
  // class step of that rank stays open in the Path tab
  pick(i, auto = false) {
    if (!this.due()) return false;
    const cls = this.options()[i];
    if (!cls) return false;
    const stage = this.stage(), step = auto ? null : this.stepFor(stage), opt = this.stepOption(i, step);
    this.chosen.push({ core: cls.core, mod: cls.mod, rarity: cls.rarity });
    this.offer = null;
    this.dirty = true;
    if (opt) this.game.progression.pick(step.tree, step.key, opt.id, this.stageRank(stage)); // the class step of this rank
    if (this.game.refreshProgression) this.game.refreshProgression();
    this.game.player.recalc();
    this.game.hud.syncSkills();
    this.game.hud.banner(auto ? t('path.autoPicked') : t('path.picked'), this.chosenName(this.chosen.length - 1) + (opt ? ' · ' + progName(opt.id) : ''));
    play('levelup');
    this.game.save();
    return true;
  }

  // takes every pick back (a Respec Token); the ranks reached give the picks again
  respec() {
    const Q = this.game.quests;
    if (!this.chosen.length || Q.respecs <= 0) return false;
    Q.respecs--;
    this.chosen = [];
    this.offer = null;
    this.dirty = true;
    this.announced = false;
    this.game.player.recalc();
    this.game.hud.syncSkills();
    play('ui');
    this.game.save();
    return true;
  }

  // the core with most picks ('' = none)
  line() {
    const n = {};
    for (const c of this.chosen) n[c.core] = (n[c.core] || 0) + 1;
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || '';
  }

  // tells the player that a pick is waiting (once per session)
  check() {
    if (!this.due() || this.announced) return;
    this.announced = true;
    this.game.hud.banner(t('path.ready'), t('path.readySub'));
  }
}
