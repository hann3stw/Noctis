// The Awakening panel: the choice of the main class and its later steps. The game is paused while it is open.
//  'group'  First Awakening (rank D): the four groups (fighter, ranged, mage, necromancer), all of them pickable
//  'spec'   Specialization (rank C): stay, the sibling class or a hybrid that fits the play
//  'evolve' Class Evolution (rank B on): stay, or an evolution whose affinity needs are met
// Every card shows what the class is (family, role, weapons, parent, mechanic, first skill, ultimate, army or
// companion, the affinities it needs); the class that fits the play best is marked with the reason. The
// recommendation never takes a choice away. On top: the nine affinities (core/affinities.js) and the history.
import { CONFIG } from '../config.js';
import { classOffers } from '../core/style.js';
import { firstOffers, specOffers, evolutionOffers, evolutionsOf, reasonFor } from '../core/awakening.js';
import { stepsOf, GUARANTEED, titleOf } from '../core/classProgression.js';
import { identityOf } from '../core/classComponents.js';
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

const PCT = new Set(['guard', 'shield', 'healSelf', 'healArmy', 'companionDamage', 'damage', 'armyDamage', 'burn', 'highAegis', 'aegisGuard', 'armyGuard', 'healPerHit', 'perStack', 'reduction', 'hitHeal', 'critPerPoint', 'finisher', 'ambush', 'rangeBonus', 'arcaneDamage', 'share', 'xpShare', 'fullBond', 'rageBonus']);
// what the ops of a step do, as short lines (made from the data, so the text always matches the effect)
export function describeOps(ops) {
  const out = [];
  const label = (path) => {
    const p = path.split('.');
    if (p[0] === 'skills' || p[0] === 'ultimates') return t('skill.' + p[1]) + ': ' + (t('ks.' + p[2]) !== 'ks.' + p[2] ? t('ks.' + p[2]) : t('pf.f.' + p[2]));
    return t('pf.' + path);
  };
  const val = (path, v, mul) => {
    const f = path.split('.').pop();
    if (mul) return '×' + v;
    const n = Math.abs(v), sign = v < 0 ? '−' : '+';
    if (PCT.has(f) || (n > 0 && n < 0.01)) return sign + Math.round(n * (n < 0.01 ? 10000 : 100)) / (n < 0.01 ? 100 : 1) + '%';
    return sign + Math.round(n * 100) / 100;
  };
  for (const p in ops.add) out.push(label(p) + ' ' + val(p, ops.add[p]));
  for (const p in ops.mul) out.push(label(p) + ' ' + val(p, ops.mul[p], true));
  for (const k in ops.bonus) out.push(t('prog.b.' + k) + ' ' + (ops.bonus[k] < 0 ? '−' : '+') + Math.round(Math.abs(ops.bonus[k]) * 100) + '%');
  return out;
}

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
    this.offers = mode === 'tree' ? [] : this.makeOffers();
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
    if (this.mode === 'spec') return specOffers(g.mainClass, classOffers(g), aff, new Set(g.awakening.history.map((h) => h.id))); // only classes that can be taken
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
    if (b.dataset.act === 'pick') { if (this.offers.some((o) => o.id === b.dataset.id)) this.sel = b.dataset.id; }
    else if (b.dataset.act === 'aff') this.showAff = !this.showAff;
    else if (b.dataset.act === 'close') { this.close(); return; }
    else if (b.dataset.act === 'step') { this.game.progressionPick(b.dataset.k, b.dataset.id); }
    else if (b.dataset.act === 'confirm') {
      const id = this.sel;
      if (!this.offers.some((o) => o.id === id)) { this.sel = ''; this.render(); return; } // only what is offered now
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

  // The evolution tree of the class: where it comes from, the evolutions (open, locked and why), the progression
  // from A to M (with the picks that wait), and the guaranteed skill. Locked entries cannot be picked.
  renderTree() {
    const g = this.game, list = CONFIG.classes.list, cls = g.mainClass, c = list[cls], aff = g.aff.values(), rank = g.rankIndex;
    const RN = CONFIG.levels.rankNames, RL = CONFIG.levels.rankLevels;
    if (!c) { this.el.innerHTML = `<div class="ab-box mods aw-box"><div class="ab-head"><h2>${t('tree.title')}</h2><small>${t('tree.noClass')}</small></div><div class="ab-btns"><button class="ap-btn go" data-act="close">${t('tree.close')}</button></div></div>`; return; }
    const id = identityOf(cls);
    const parent = (c.parents && c.parents[0]) || (c.base && c.base !== cls ? c.base : '');
    const head = `<div class="tr-cls"><i class="emb" data-c="${cls}"></i><b>${t('mc.' + cls)}</b>${parent ? `<small>${t('tree.from', { name: t('mc.' + parent) })}</small>` : ''}${id ? `<small>${t('tree.identity', { channel: t('id.ch.' + id.channel), defense: t('id.def.' + id.defense), mobility: t('id.mob.' + id.mobility), weak: t('id.weak.' + id.weakness) })}</small>` : ''}</div>`;
    // evolutions
    // only evolutions that can be taken now (locked or not ready ones are not shown)
    const evo = evolutionsOf(cls, rank, aff).filter((o) => o.open && CONFIG.classes.list[o.id].ready === true).map((o) => {
      const e = list[o.id], need = Object.keys(e.needs || {}).map((a) => `${t('aff.' + a)} ${aff[a] || 0}/${e.needs[a]}`).join(', ');
      const status = !e.ready ? t('tree.later') : o.open ? t('tree.evoOpen') : rank < (e.rank || CONFIG.classes.evolveRank) ? t('tree.rank', { rank: RN[e.rank || CONFIG.classes.evolveRank], level: RL[e.rank || CONFIG.classes.evolveRank] }) : t('tree.needs');
      return `<div class="tr-row${o.open ? ' open' : ' lock'}"><i class="emb" data-c="${o.id}"></i><b>${t('mc.' + o.id)}</b><em>${status}</em>${e.ready ? `<small>${need}</small>` : ''}</div>`;
    }).join('') || `<p class="k-hint">${t('tree.noEvo')}</p>`;
    // progression A to M
    const tree = g.classTree;
    const steps = stepsOf(tree, rank, aff, g.progression).map((st) => {
      const n = st.node, name = titleOf(n.id);
      const lines = describeOps(n.ops);
      let status = '', body = '';
      if (st.status === 'rank') status = t('tree.rank', { rank: RN[st.rank], level: RL[st.rank] });
      else if (st.status === 'needs') status = t('tree.uniqueNeeds', { list: Object.keys(n.needs).map((a) => `${t('aff.' + a)} ${aff[a] || 0}/${n.needs[a]}`).join(', ') });
      else if (st.status === 'pick') status = t('tree.pickNow');
      else status = t('tree.active');
      if (n.needs && st.status !== 'needs') lines.unshift(t('tree.uniqueOk', { list: Object.keys(n.needs).map((a) => t('aff.' + a) + ' ' + n.needs[a]).join(', ') }));
      if (n.pick) {
        body = `<div class="tr-picks">${n.pick.map((p) => {
          const chosen = st.picked === p.id, can = st.status === 'pick';
          return `<button class="tr-pick${chosen ? ' on' : ''}" data-act="step" data-k="${st.key}" data-id="${p.id}"${can ? '' : ' disabled'}><b>${titleOf(p.id)}</b><small>${describeOps(p.ops).join(' · ')}</small></button>`;
        }).join('')}</div>`;
      }
      return `<div class="tr-step ${st.status}"><div class="tr-k">${st.key}<small>${t('tree.step.' + st.key)}</small></div><div class="tr-b"><b>${name}</b><em>${status}</em><small>${lines.join(' · ')}</small>${body}</div></div>`;
    }).join('');
    // the guaranteed skill of an evolution class
    const G = GUARANTEED[cls];
    let gs = '';
    if (G) {
      const has = g.player.known.includes(G.skill), lv = g.mastery.level(G.quest.mastery);
      gs = `<p class="tr-guar">${has ? t('tree.guarHave', { skill: t('skill.' + G.skill) }) : t('tree.guar', { skill: t('skill.' + G.skill), quest: t('skill.' + G.quest.mastery), lv, need: G.quest.level, rank: RN[G.rank] })}</p>`;
    }
    this.el.innerHTML = `<div class="ab-box mods aw-box tr-box">
      <div class="ab-head"><h2>${t('tree.title')}</h2><small>${t('tree.hint')}</small></div>
      <div class="tr-scroll">${head}${historyHtml(g)}${gs}
        <h4>${t('tree.evolutions')}</h4><div class="tr-evo">${evo}</div>
        <h4>${t('tree.progression')}</h4>${tree ? steps : `<p class="k-hint">${t('tree.noTree')}</p>`}</div>
      <div class="ab-btns"><button class="ap-btn go" data-act="close">${t('tree.close')}</button></div></div>`;
  }

  render() {
    if (this.mode === 'tree') { this.renderTree(); return; }
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
      else if (o.why) note = t('aw.fitAff', { aff: t('aff.' + o.why) });
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
