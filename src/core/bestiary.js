// Bestiary: every kind of monster (and every boss) gets a page that fills
// with kills, yours and your army's. Step 1 shows the monster, step 2 how it
// fights and how to beat it, step 3 masters it: it takes a little more damage
// from you and your shadows. Kills are saved with the world.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

const B = CONFIG.bestiary;

export class Bestiary {
  constructor(game, saved) {
    this.game = game;
    this.kills = {};
    if (saved && typeof saved === 'object') for (const k in saved) if (CONFIG.enemies.types[k]) this.kills[k] = saved[k] | 0;
    this.fresh = new Set(); // pages with a new step not looked at yet
    const types = game.enemies.types;
    this.mult = new Float32Array(types.length).fill(1); // damage taken, per enemy type index
    types.forEach((ty, i) => { if (this.step(ty.id) >= 3) this.mult[i] = 1 + B.bonus; });
  }

  serialize() {
    return { ...this.kills };
  }

  steps(id) {
    return CONFIG.enemies.types[id].boss ? B.bossSteps : B.steps;
  }

  // 0 unknown, 1 seen, 2 known, 3 mastered
  step(id) {
    const n = this.kills[id] || 0, s = this.steps(id);
    let k = 0;
    while (k < s.length && n >= s[k]) k++;
    return k;
  }

  // kills needed for the next step (0 when mastered)
  next(id) {
    const s = this.steps(id), k = this.step(id);
    return k < s.length ? s[k] : 0;
  }

  add(typeIndex) {
    const id = this.game.enemies.types[typeIndex].id;
    const before = this.step(id);
    this.kills[id] = (this.kills[id] || 0) + 1;
    const now = this.step(id);
    if (now === before) return;
    this.fresh.add(id);
    const name = t('enemy.' + id);
    if (now >= 3) {
      this.mult[typeIndex] = 1 + B.bonus;
      this.game.hud.toast(t('best.mastered', { name, pct: Math.round(B.bonus * 100) }));
      play('stage');
    } else {
      this.game.hud.toast(t(now === 1 ? 'best.new' : 'best.known', { name }));
    }
  }

  // how many pages are mastered / known at all
  counts() {
    let seen = 0, mastered = 0, all = 0;
    for (const id in CONFIG.enemies.types) {
      all++;
      const s = this.step(id);
      if (s >= 1) seen++;
      if (s >= 3) mastered++;
    }
    return { seen, mastered, all };
  }
}
