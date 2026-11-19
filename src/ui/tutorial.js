// The tutorial: a small panel at the top that explains the game step by step
// in the real world. Some steps wait for the player to do something (move,
// attack, raise a shadow ...), the others are read and closed with Next.
// It is switched on when a world is made; the step is saved with the world.
// Only the basics are taught here; gates, outposts, zones, gear and stats are
// explained by tips (ui/tips.js) the moment the player first meets them.
import { t } from '../strings.js';
import { input } from '../input/input.js';
import { rollLoot } from '../core/items.js';
import { play } from '../core/sfx.js';

// done(game, c): true once the step is fulfilled; c = values from when the
// step began (see snapshot). Steps without done are closed with Next.
// hl = HUD element that is highlighted during the step.
const STEPS = [
  { id: 'move', done: (g, c) => c.moved > 8 },
  { id: 'leave', done: (g) => !g.player.inCamp },
  { id: 'attack', hl: '#btn-attack', done: (g, c) => g.player.counts.attack - c.attack >= 3 },
  { id: 'kill', done: (g, c) => g.kills > c.kills },
  { id: 'dodge', hl: '#btn-dodge', done: (g, c) => g.player.counts.dodge > c.dodge },
  { id: 'skill', hl: '#btn-skill0', done: (g, c) => g.player.counts.cast > c.cast },
  { id: 'ult', hl: '#btn-ult' },
  { id: 'arise', hl: '#btn-arise', done: (g) => g.army.totalCount() > 0 },
  { id: 'army', hl: '.squad' },
  { id: 'loot', done: (g, c) => g.player.inventory.length > c.inv || g.player.essence > c.essence },
  { id: 'menu', hl: '#btn-menu', done: (g, c) => g.menu.opens > c.opens },
  { id: 'done' },
];
// steps 0..10 are the same as in the old, longer tutorial; a world saved in
// one of its later steps continues at "done"
export const OLD_STEP_COUNT = STEPS.length - 1;

export class Tutorial {
  constructor(game, hudRoot, step = 0) {
    this.game = game;
    this.hud = hudRoot;
    this.step = Math.max(0, Math.min(STEPS.length - 1, step));
    this.c = null;
    this.doneT = 0; // > 0: the step is fulfilled, the next one comes in a moment
    this.hlEl = null;
    this.finished = false;
    this.el = document.createElement('div');
    this.el.className = 'tut';
    this.el.innerHTML = `<div class="tut-head"><small></small><b></b></div><p></p>
      <div class="tut-btns"><div class="btn pill tut-skip">${t('tut.skip')}</div><div class="btn pill tut-next"></div></div>`;
    hudRoot.appendChild(this.el);
    this.count = this.el.querySelector('small');
    this.title = this.el.querySelector('b');
    this.text = this.el.querySelector('p');
    this.nextBtn = this.el.querySelector('.tut-next');
    const tap = (el, fn) => {
      el.addEventListener('pointerdown', (e) => e.stopPropagation());
      el.addEventListener('pointerup', (e) => { e.stopPropagation(); play('ui'); fn(); });
    };
    tap(this.nextBtn, () => this.next());
    tap(this.el.querySelector('.tut-skip'), () => this.finish());
    this.begin();
  }

  // what the steps compare against
  snapshot() {
    const g = this.game, P = g.player;
    return {
      moved: 0, x: P.x, z: P.z, attack: P.counts.attack, dodge: P.counts.dodge, cast: P.counts.cast,
      kills: g.kills, inv: P.inventory.length, essence: P.essence, opens: g.menu.opens,
    };
  }

  begin() {
    const s = STEPS[this.step], g = this.game, P = g.player;
    this.c = this.snapshot();
    this.doneT = 0;
    this.el.classList.remove('ok');
    this.count.textContent = t('tut.count', { n: this.step + 1, max: STEPS.length });
    this.title.textContent = t('tut.' + s.id);
    this.text.textContent = t('tut.' + s.id + '.text', { side: t(input.swap ? 'tut.right' : 'tut.left') });
    this.nextBtn.textContent = t(this.step === STEPS.length - 1 ? 'tut.finish' : 'tut.next');
    this.nextBtn.style.display = s.done ? 'none' : '';
    this.el.classList.toggle('wait', !!s.done);
    this.highlight(s.hl);
    // something to pick up for the loot step
    if (s.id === 'loot' && !P.dead) {
      const a = Math.atan2(P.dirX, P.dirZ);
      g.loot.drop(P.x + Math.sin(a) * 3, P.z + Math.cos(a) * 3, rollLoot(P.level, 0, P.known, 1, true));
    }
  }

  highlight(sel) {
    if (this.hlEl) this.hlEl.classList.remove('tut-hl');
    this.hlEl = sel ? this.hud.querySelector(sel) : null;
    if (this.hlEl) this.hlEl.classList.add('tut-hl');
  }

  next() {
    if (this.finished) return;
    if (this.step >= STEPS.length - 1) { this.finish(); return; }
    this.step++;
    this.begin();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.highlight(null);
    this.el.remove();
    this.game.tutorial = null;
    this.game.save();
  }

  update(dt) {
    if (this.finished) return;
    const s = STEPS[this.step], g = this.game, P = g.player, c = this.c;
    c.moved += Math.hypot(P.x - c.x, P.z - c.z);
    c.x = P.x;
    c.z = P.z;
    if (!s.done) return;
    if (this.doneT > 0) {
      this.doneT -= dt;
      if (this.doneT <= 0) this.next();
    } else if (s.done(g, c)) {
      // a short "done" before the next step
      this.doneT = 0.9;
      this.el.classList.add('ok');
      play('pickup');
    }
  }
}
