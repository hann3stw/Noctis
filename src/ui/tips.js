// Tips: short cards that explain something the moment the player first meets
// it (a gate, an outpost, a new kind of monster, a boss phase ...), instead
// of all at once in the tutorial. Every tip comes once per world; the ones
// already seen are saved with the world. While the tutorial runs, tips wait.
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

// tips about things the old tutorial explained: worlds from before this
// version that finished the tutorial start with these marked as seen
export const BASIC_TIPS = ['zones', 'outposts', 'gate', 'gear', 'stats'];
const SHOW_TIME = 14; // seconds a tip stays, unless closed before

export class Tips {
  constructor(game, hudRoot, seen) {
    this.game = game;
    this.seen = new Set(seen || []);
    this.queue = [];
    this.cur = '';
    this.t = 0;
    this.gap = 1.5; // a short break before the first and between two tips
    this.checkT = 0;
    this.el = document.createElement('div');
    this.el.className = 'tut tip';
    this.el.innerHTML = `<div class="tut-head"><small>${t('tip.label')}</small><b></b></div><p></p>
      <div class="tut-btns"><div class="btn pill tut-next">${t('tip.ok')}</div></div>`;
    hudRoot.appendChild(this.el);
    this.title = this.el.querySelector('b');
    this.text = this.el.querySelector('p');
    const ok = this.el.querySelector('.tut-next');
    ok.addEventListener('pointerdown', (e) => e.stopPropagation());
    ok.addEventListener('pointerup', (e) => { e.stopPropagation(); play('ui'); this.hide(); });
  }

  // asks for a tip; it comes once, when nothing else is shown
  show(id) {
    if (this.seen.has(id) || this.cur === id || this.queue.includes(id)) return;
    this.queue.push(id);
  }

  hide() {
    if (!this.cur) return;
    this.cur = '';
    this.el.classList.remove('on');
    this.gap = 0.8;
  }

  // things the tips watch for themselves
  watch() {
    const g = this.game, P = g.player;
    if (P.dead) return;
    if (g.curZone >= 1 && g.gates.active < 0) this.show('zones');
    if (g.capture.si >= 0) this.show('outposts');
    if (P.inCamp && P.inventory.length > 0) this.show('gear');
    if (P.points > 0) this.show('stats');
  }

  update(dt) {
    if ((this.checkT -= dt) <= 0) { this.checkT = 0.5; this.watch(); }
    if (this.cur) {
      if ((this.t -= dt) <= 0) this.hide();
      return;
    }
    if (this.gap > 0) { this.gap -= dt; return; }
    if (!this.queue.length || this.game.tutorial) return;
    const id = this.queue.shift();
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.cur = id;
    this.t = SHOW_TIME;
    this.title.textContent = t('tip.' + id);
    this.text.textContent = t('tip.' + id + '.text');
    this.el.classList.add('on');
    play('pickup');
  }

  serialize() {
    return [...this.seen];
  }

  destroy() {
    this.el.remove();
  }
}
