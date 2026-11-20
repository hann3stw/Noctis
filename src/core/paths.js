// The Path of the Necromancer (class tree). At set ranks (CONFIG.paths.stages)
// one node is picked from the offered ones. Nodes belong to lines; a node
// gives bonuses (added to the item bonuses in Player.recalc) and sometimes a
// rule (read where it counts). The picks are saved with the world and can be
// taken back for essence.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

export class Paths {
  constructor(game, saved) {
    this.game = game;
    this.chosen = saved && Array.isArray(saved.chosen) ? saved.chosen.filter((id) => CONFIG.paths.nodes[id]) : [];
    this.announced = false;
  }

  serialize() {
    return { chosen: [...this.chosen] };
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

  // the nodes that can be picked now
  options() {
    const st = this.stage();
    return Object.keys(CONFIG.paths.nodes).filter((id) => CONFIG.paths.nodes[id].stage === st);
  }

  pick(id) {
    if (!this.due() || !this.options().includes(id)) return false;
    if (!this.canPick(id)) { this.game.hud.toast(t('path.armyTooBig', { n: CONFIG.paths.nodes[id].rule.slotCapMax })); return false; }
    this.chosen.push(id);
    this.game.player.recalc();
    this.game.hud.banner(t('path.picked'), t('path.' + id));
    play('levelup');
    this.game.save();
    return true;
  }

  respecCost() {
    return CONFIG.paths.respec * (this.game.rankIndex + 1);
  }

  respec() {
    const P = this.game.player, cost = this.respecCost();
    if (!this.chosen.length || P.essence < cost) return false;
    P.essence -= cost;
    this.chosen = [];
    P.recalc();
    play('ui');
    this.game.save();
    return true;
  }

  // adds the bonuses of the picked nodes to b (Player.recalc)
  apply(b) {
    for (const id of this.chosen) {
      const bo = CONFIG.paths.nodes[id].bonus;
      for (const k in bo) b[k] = (b[k] || 0) + bo[k];
    }
  }

  // a rule value of the picked nodes (0 = none)
  rule(name) {
    let v = 0;
    for (const id of this.chosen) {
      const r = CONFIG.paths.nodes[id].rule;
      if (r && r[name]) v = Math.max(v, r[name]);
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
