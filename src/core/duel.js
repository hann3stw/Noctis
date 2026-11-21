// The Duel Arena, a mechanic of the Blade core (Path). A duel is the deadly gate
// of your zone, fought alone: your army stays out of it. In return it is harder
// (more tiers), richer (more items, essence, Soul Seals and a rune) and costs essence.
// The arena remembers how many duels were won and the hardest tier.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

export class Duel {
  constructor(game, saved) {
    this.game = game;
    const s = saved || {};
    this.won = s.won | 0; // duels won
    this.best = s.best | 0; // the hardest tier won
  }

  serialize() {
    return { won: this.won, best: this.best };
  }

  zone() {
    return this.game.quests.zone();
  }

  // essence a duel costs now
  cost() {
    return CONFIG.duel.cost * (this.zone() + 1);
  }

  // the deadly gate of your zone (-1 = there is none)
  gate() {
    return this.game.gates.list.findIndex((x) => !x.abyss && !x.trial && x.zone === this.zone() && x.diff === 2);
  }

  // why a duel cannot start now ('' = it can)
  block() {
    const g = this.game;
    if (g.gates.active >= 0) return 'inGate';
    if (g.player.essence < this.cost()) return 'essence';
    if (this.gate() < 0) return 'gate';
    return '';
  }

  // opens the gate for a duel: the deadly gate of your zone, harder, richer, and without your army
  start() {
    const g = this.game, gates = g.gates;
    if (this.block()) return false;
    const gi = this.gate(), gt = gates.list[gi];
    g.player.essence -= this.cost();
    gt.duel = true;
    if (!gt.open) { gt.open = true; gt.gen++; gates.place(gi); }
    g.waypoint.set({ kind: 'gate', gi, gen: gt.gen, x: gt.x, z: gt.z });
    g.hud.banner(t('duel.open'), t('duel.openSub', { zone: t('zone.' + CONFIG.world.zones[gt.zone].id) }));
    play('arise');
    g.save();
    return true;
  }

  // a duel was won at this tier
  onWon(tier) {
    this.won++;
    this.best = Math.max(this.best, tier);
  }
}
