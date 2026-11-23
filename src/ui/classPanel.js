// The Awakening panel: the choice of the main class and its later steps. The game is paused while it is open.
//  'group'  First Awakening (rank D): the four groups (fighter, ranged, mage, necromancer), all of them pickable
//  'spec'   Specialization (rank C): stay, the sibling class or a hybrid that fits the play
//  'evolve' Class Evolution (rank B on): stay, or an evolution whose affinity needs are met
// Every card shows what the class is (family, role, weapons, parent, mechanic, first skill, ultimate, army or
// companion, the affinities it needs); the class that fits the play best is marked with the reason. The
// recommendation never takes a choice away. On top: the nine affinities (core/affinities.js) and the history.
import { CONFIG } from '../config.js';
import { classOffers } from '../core/style.js';
import { firstOffers, specOffers, evolutionOffers, reasonFor } from '../core/awakening.js';
import { AFFINITIES } from '../core/affinities.js';
import { familyOf, mechanicOf } from '../core/classComponents.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { flashClass } from '../core/format.js';

// the affinity bars: total, long term, recent (used here and in the menu)
export function affinityHtml(game, compact = false) {
  const A = game.aff, v = A.values(), L = A.longTerm(), R = A.recent();
  const rows = AFFINITIES.map((a) => `<div class="af-row"><span>${t('aff.' + a)}</span><div class="af-bar"><i style="transform:scaleX(${(v[a] / 100).toFixed(2)})"></i></div><b>${v[a]}</b>${compact ? '' : `<small>${t('aff.lr', { l: L[a], r: R[a] })}</small>`}</div>`).join('');
  return `<div class="af-grid${compact ? ' compact' : ''}">${rows}</div>`;
}

// the classes taken so far: Warrior -> Berserker -> ...
export function historyHtml(game) {
  const h = game.awakening.history;
  if (!h.length) return '';
  const next = game.rankIndex < CONFIG.levels.rankNames.length - 1 ? ` → <em>${t('aw.next')}</em>` : '';
  return `<div class="aw-hist"><span>${t('aw.history')}</span> ${h.map((x) => `<i class="emb" data-c="${x.id}"></i><b>${t('mc.' + x.id)}</b>`).join(' → ')}${next}</div>`;
}

const affNames = (list) => list.map((a) => t('aff.' + a)).join(t('aw.and'));

export class ClassPanel {
  constructor(root, game) {
    this.game = game;
    this.el = document.createElement('div');
    this.el.id = 'class-panel';
    root.appendChild(this.el);
    this.isOpen = false;
    this.sel = '';
    // pointerup as well as click: a tap on a phone must work even when the click does not come through
    this.last = 0;
    this.el.addEventListener('pointerup', (e) => { this.last = performance.now(); this.onClick(e); });
    this.el.addEventListener('click', (e) => { if (performance.now() - this.last > 500) this.onClick(e); });
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  open(mode = 'group') {
    if (this.isOpen) return;
    this.mode = mode;
    this.offers = this.makeOffers();
    const rec = this.offers.find((o) => o.rec);
    this.sel = mode === 'group' ? (rec ? rec.id : 'fighter') : this.game.mainClass;
    this.isOpen = true;
    this.game.setPaused(true);
    this.el.classList.add('on');
    this.render();
    flashClass(this.el, 'enter');
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('on');
    this.game.setPaused(false);
  }

  makeOffers() {
    const g = this.game, aff = g.aff.values();
    if (this.mode === 'spec') return specOffers(g.mainClass, classOffers(g), aff);
    if (this.mode === 'evolve') {
      const P = g.awakening.pending;
      const all = evolutionOffers(g.mainClass, g.rankIndex, aff);
      return P ? all.filter((o) => P.ids.includes(o.id)) : all;
    }
    return firstOffers(aff);
  }

  onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b || b.disabled) return;
    play('ui');
    if (b.dataset.act === 'pick') this.sel = b.dataset.id;
    else if (b.dataset.act === 'aff') this.showAff = !this.showAff;
    else if (b.dataset.act === 'confirm') {
      const id = this.sel;
      this.close();
      if (this.mode === 'spec') this.game.changeClass(id);
      else if (this.mode === 'evolve') this.game.evolveClass(id);
      else this.game.chooseClass(CONFIG.classes.groups[id].class);
      return;
    }
    this.render();
  }

  // the facts of a class for its card
  facts(cid) {
    const c = CONFIG.classes.list[cid], fam = familyOf(cid), mech = mechanicOf(cid);
    const parent = (c.parents && c.parents[0]) || (c.hybrid && c.base) || '';
    const access = c.army ? t('aw.army') : c.companion || (c.base || cid) === 'ranger' ? t('aw.companion') : '';
    const start = (c.startSkills || [])[0];
    const rows = [
      fam ? [t('aw.family'), t('fam.' + fam)] : null,
      [t('aw.weapons'), t('aw.w.' + (c.weapons || 'neutral'))],
      parent ? [t('aw.parent'), t('mc.' + parent)] : null,
      mech ? [t('aw.mechanic'), t('mech.' + mech)] : null,
      start ? [t('aw.start'), t('skill.' + start)] : null,
      c.startUltimate ? [t('aw.ult'), t('skill.' + c.startUltimate)] : null,
      access ? [t('aw.access'), access] : null,
      c.spellForge ? [t('aw.forge'), t('aw.yes')] : null,
    ].filter(Boolean);
    return rows.map(([k, v]) => `<li><span>${k}</span><b>${v}</b></li>`).join('');
  }

  render() {
    const g = this.game, list = CONFIG.classes.list, mode = this.mode, aff = g.aff.values();
    const cards = this.offers.map((o) => {
      const cid = mode === 'group' ? CONFIG.classes.groups[o.id].class : o.id, c = list[cid], on = o.id === this.sel;
      const name = mode === 'group' ? t('mc.group.' + o.id) : t('mc.' + o.id);
      const desc = mode === 'group' ? t('mc.group.' + o.id + '.desc') : t('mc.' + o.id + '.desc');
      const kind = o.stay ? t('aw.kind.continuation') : t('aw.kind.' + o.kind);
      let note = '';
      if (o.stay) note = t('mc.stay');
      else if (mode === 'group') note = t('mc.group.' + o.id + '.mech');
      else if (o.kind === 'evolution' || o.kind === 'unique') note = t('aw.needs', { list: Object.keys(c.needs || {}).map((a) => t('aff.' + a) + ' ≥ ' + c.needs[a] + ' (' + (aff[a] || 0) + ')').join(', ') });
      else if (o.why) note = t('mc.fit', { why: t('style.' + o.why) });
      else note = t('mc.' + o.id + '.mech');
      const rec = o.rec ? `<p class="aw-rec">${t('aw.rec.' + (mode === 'group' ? 'group' : 'class'), { aff: affNames(mode === 'group' ? o.why.slice(0, 2) : reasonFor(cid, aff)), name })}</p>` : '';
      return `<button class="cls-card aw-card${on ? ' on' : ''}${o.rec ? ' rec' : ''}" data-act="pick" data-id="${o.id}">
        ${o.rec ? `<u class="aw-badge">${t('aw.recommended')}</u>` : ''}
        <i class="emb" data-c="${cid}"></i><em>${kind} · ${t('mc.role.' + c.role)}</em><b>${name}</b><p>${desc}</p>
        <ul class="aw-facts">${this.facts(cid)}</ul>${rec}<small class="mech">${note}</small></button>`;
    }).join('');
    const sel = this.sel ? (mode === 'group' ? t('mc.group.' + this.sel) : t('mc.' + this.sel)) : '';
    const stay = mode !== 'group' && this.sel === g.mainClass;
    const title = mode === 'spec' ? t('mc.specTitle') : mode === 'evolve' ? t('aw.evolveTitle') : t('mc.title');
    const hint = mode === 'spec' ? t('mc.specHint') : mode === 'evolve' ? t('aw.evolveHint') : t('mc.hint');
    const minutes = Math.round(g.aff.longT / 60);
    this.el.innerHTML = `<div class="ab-box mods aw-box">
      <div class="ab-head"><h2>${title}</h2><small>${hint}</small></div>
      ${historyHtml(g)}
      <button class="aw-afftoggle" data-act="aff">${t('aw.affTitle')} · ${t('aw.top', { list: affNames(g.aff.top(2)) })}${minutes < 10 ? ' · ' + t('aw.little') : ''}</button>
      ${this.showAff ? affinityHtml(g) : ''}
      <div class="cls-grid aw-grid">${cards}</div>
      <div class="ab-btns"><button class="ap-btn go" data-act="confirm"${this.sel ? '' : ' disabled'}>${!this.sel ? t('mc.pick') : stay ? t('aw.stay') : t('mc.confirm', { name: sel })}</button></div></div>`;
  }
}
