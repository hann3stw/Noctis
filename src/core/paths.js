// The Path of the Necromancer (class tree). At set ranks (CONFIG.paths.stages)
// one node is picked from the offered ones. Nodes belong to lines; a node
// gives bonuses (added to the item bonuses in Player.recalc, drawbacks are
// negative ones) and sometimes a rule (read where it counts).
// Which nodes are offered depends on how the hunter plays (core/profile.js and
// the army): see options(). The offer is made once per stage and saved. The
// picks are saved with the world and can be taken back for essence.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

const clamp = (v) => Math.max(0, Math.min(1, v));

export class Paths {
  constructor(game, saved) {
    this.game = game;
    this.chosen = saved && Array.isArray(saved.chosen) ? saved.chosen.filter((id) => CONFIG.paths.nodes[id]) : [];
    // the offer of the stage that is due: { stage, ids: [...], why: { id: 'fit' | 'deepen' | 'new' | reason } }
    const o = saved && saved.offer;
    this.offer = o && o.stage === this.chosen.length + 1 && Array.isArray(o.ids) && o.ids.every((id) => CONFIG.paths.nodes[id]) ? o : null;
    this.announced = false;
  }

  serialize() {
    return { chosen: [...this.chosen], offer: this.offer };
  }

  // how many picks the hunter's rank has unlocked
  unlocked() {
    const r = this.game.rankIndex;
    return CONFIG.paths.stages.filter((s) => r >= s).length;
  }

  // a pick is waiting
  due() {
    return this.chosen.length < this.unlocked();
  }

  // the stage that is due (1 = the first pick)
  stage() {
    return this.chosen.length + 1;
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
    };
  }

  // can this node be offered to this hunter (its requirements and the army limit)?
  eligible(id) {
    const n = CONFIG.paths.nodes[id], r = n.req || {}, g = this.game, pf = g.profile;
    if (this.chosen.includes(id) || !this.canPick(id)) return false;
    const army = g.army.deployed.length;
    if (r.armyMin && army < r.armyMin) return false;
    if (r.armyMax !== undefined && army > r.armyMax) return false;
    if (r.hunterMin && pf.hunterShare() < r.hunterMin) return false;
    if (r.hunterMax !== undefined && pf.hunterShare() > r.hunterMax) return false;
    if (r.killsMin && pf.kills() < r.killsMin) return false;
    if (r.deathsMin && pf.deathRate() < r.deathsMin) return false;
    if (r.castMin && pf.castRate() < r.castMin) return false;
    if (r.gateMin && pf.gateShare() < r.gateMin) return false;
    if (r.eliteMin && pf.eliteShare() < r.eliteMin) return false;
    if (r.lineMin) {
      const n = {};
      for (const c of this.chosen) { const l = CONFIG.paths.nodes[c].line; n[l] = (n[l] || 0) + 1; }
      for (const l in r.lineMin) if ((n[l] || 0) < r.lineMin[l]) return false;
    }
    return true;
  }

  // how well a node fits how the hunter plays, and the measure that counts most
  fit(id, m = this.metrics()) {
    const like = CONFIG.paths.nodes[id].like || {};
    let s = 0, best = '', bv = 0;
    for (const k in like) {
      const v = like[k] * (m[k] - 0.5) * 2;
      s += v;
      if (v > bv) { bv = v; best = k; } // the reason is what fits best, not what fits badly
    }
    return { score: s, key: best, high: m[best] >= 0.5 };
  }

  // The nodes of the stage that is due, chosen from the way of playing:
  //  - the best fitting ones (up to two),
  //  - one that deepens a line already picked (a node of the same line), and
  //  - one new direction (the best fitting node of a line not picked yet),
  // 3 to 4 cards. The offer stays the same until a pick is made.
  options() {
    const st = this.stage();
    if (this.offer && this.offer.stage === st) return this.offer.ids;
    const m = this.metrics();
    const all = Object.keys(CONFIG.paths.nodes).filter((id) => CONFIG.paths.nodes[id].stage === st && this.eligible(id));
    const scored = all.map((id) => ({ id, line: CONFIG.paths.nodes[id].line, ...this.fit(id, m) })).sort((a, b) => b.score - a.score);
    const ids = [], why = {};
    const add = (x, w) => { if (x && !ids.includes(x.id)) { ids.push(x.id); why[x.id] = w; } };
    const mine = new Set(this.chosen.map((id) => CONFIG.paths.nodes[id].line));
    // one that deepens the line (when there is a pick already)
    if (mine.size) add(scored.find((x) => mine.has(x.line)), 'deepen');
    // the best fitting ones
    for (const x of scored) { if (ids.length >= 3) break; add(x, 'fit'); }
    // one new direction
    add(scored.find((x) => !mine.has(x.line) && !ids.includes(x.id)), 'new');
    // too few eligible: the stage's plain nodes (without requirements) fill up
    for (const id of Object.keys(CONFIG.paths.nodes)) {
      if (ids.length >= 3) break;
      if (CONFIG.paths.nodes[id].stage === st && !this.chosen.includes(id) && this.canPick(id)) add({ id }, 'new');
    }
    // the reason shown on the card: the measure that counts most
    for (const id of ids) {
      if (why[id] === 'fit') { const f = this.fit(id, m); why[id] = f.key ? 'fit:' + f.key + ':' + (f.high ? 'hi' : 'lo') : 'fit'; }
    }
    this.offer = { stage: st, ids: ids.slice(0, 4), why };
    return this.offer.ids;
  }

  // why a node is offered (text), '' = no reason
  why(id) {
    const w = this.offer && this.offer.why && this.offer.why[id];
    if (!w) return '';
    if (w === 'deepen') return t('path.why.deepen');
    if (w === 'new') return t('path.why.new');
    const [, key, hi] = w.split(':');
    return key ? t('path.why.' + key + '.' + hi) : '';
  }

  pick(id) {
    if (!this.due() || !this.options().includes(id)) return false;
    if (!this.canPick(id)) { this.game.hud.toast(t('path.armyTooBig', { n: CONFIG.paths.nodes[id].rule.slotCapMax })); return false; }
    this.chosen.push(id);
    this.offer = null;
    this.game.player.recalc();
    this.game.hud.syncSkills();
    this.game.hud.banner(t('path.picked'), t('path.' + id));
    play('levelup');
    this.game.save();
    return true;
  }

  respecCost() {
    return CONFIG.paths.respec * (this.game.rankIndex + 1);
  }

  // a Respec Token (useToken) or essence
  respec(useToken) {
    const P = this.game.player, Q = this.game.quests, cost = this.respecCost();
    if (!this.chosen.length) return false;
    if (useToken) { if (Q.respecs <= 0) return false; Q.respecs--; }
    else { if (P.essence < cost) return false; P.essence -= cost; }
    this.chosen = [];
    this.offer = null;
    P.recalc();
    this.game.hud.syncSkills();
    play('ui');
    this.game.save();
    return true;
  }

  // adds the bonuses of the picked nodes to b (Player.recalc)
  apply(b) {
    for (const id of this.chosen) {
      const bo = this.bonusOf(id);
      for (const k in bo) b[k] = (b[k] || 0) + bo[k];
      const pb = CONFIG.paths.pickBonus;
      for (const k in pb) b[k] = (b[k] || 0) + pb[k];
    }
  }

  // the bonuses of a node, drawbacks softened (a pick is an upgrade, not a loss)
  bonusOf(id) {
    const n = CONFIG.paths.nodes[id], out = {};
    for (const k in n.bonus) {
      const v = n.bonus[k], bad = k === 'damageTaken' ? v > 0 : v < 0;
      const w = bad ? v * CONFIG.paths.drawback : v;
      out[k] = k === 'armySlots' ? Math.round(w) : Math.round(w * 1000) / 1000;
    }
    return out;
  }

  // a third skill slot: the Mage line from stage 2 on
  skillSlots() {
    return this.chosen.some((id) => { const n = CONFIG.paths.nodes[id]; return n.line === 'mage' && n.stage >= 2; }) ? 3 : 2;
  }

  // rune sockets per skill grow with the picks: 1, 2 (two picks), 3 (four picks)
  runeSockets() {
    const n = this.chosen.length;
    return 1 + (n >= 2 ? 1 : 0) + (n >= 4 ? 1 : 0);
  }

  // a rule value of the picked nodes (0 = none); the biggest one counts
  rule(name) {
    let v = 0;
    for (const id of this.chosen) {
      const r = CONFIG.paths.nodes[id].rule;
      if (r && r[name]) v = Math.max(v, r[name]);
    }
    return v;
  }

  // a rule that multiplies (1 = none)
  mult(name) {
    let v = 1;
    for (const id of this.chosen) {
      const r = CONFIG.paths.nodes[id].rule;
      if (r && r[name]) v *= r[name];
    }
    return v;
  }

  // the most army slots there can be: the Commander raises the limit, the Blade Master lowers it
  slotCap() {
    let cap = CONFIG.shadows.maxSlots, min = Infinity;
    for (const id of this.chosen) {
      const r = CONFIG.paths.nodes[id].rule;
      if (!r) continue;
      if (r.slotCapPlus) cap += r.slotCapPlus;
      if (r.slotCapMax) min = Math.min(min, r.slotCapMax);
    }
    return Math.min(cap, min);
  }

  // a node can be picked: one that limits the army needs an army that fits
  canPick(id) {
    const r = CONFIG.paths.nodes[id].rule;
    return !(r && r.slotCapMax && this.game.army.deployed.length > r.slotCapMax);
  }

  // the line with most picked nodes ('' = none)
  line() {
    const n = {};
    for (const id of this.chosen) { const l = CONFIG.paths.nodes[id].line; n[l] = (n[l] || 0) + 1; }
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || '';
  }

  // tells the player that a pick is waiting (once per session)
  check() {
    if (!this.due() || this.announced) return;
    this.announced = true;
    this.game.hud.banner(t('path.ready'), t('path.readySub'));
  }
}
