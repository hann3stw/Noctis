// The Awakening: which classes a hunter may take, from the class it has, its rank and its affinities
// (core/affinities.js). Five kinds of offer:
//  continuation   stay what you are (always part of every later choice)
//  specialization the class or its sibling at rank C (CONFIG.classes.spec, as before)
//  hybrid         two class identities in one (spellblade, paladin ... as before, at rank C)
//  evolution      a new class grown from yours (rank B: berserker, stormcaller, beastmaster, sentinel)
//  unique         rare evolutions earned by deeds (prepared: none is ready yet)
// Offers never change the class by themselves; the hunter picks. Nothing here touches the DOM (node --test).
import { CONFIG } from '../config.js';
import { AFFINITIES } from './affinities.js';
import { lineOf, specAllowed } from './classes.js';

// how well the affinities meet the needs of a class: 0..1 (1 = every need met), and which are missing
export function meets(needs, aff) {
  const miss = [];
  let sum = 0, n = 0;
  for (const a in needs || {}) {
    const v = (aff && aff[a]) || 0;
    sum += Math.min(1, v / needs[a]);
    n++;
    if (v < needs[a]) miss.push(a);
  }
  return { ok: miss.length === 0, share: n ? sum / n : 1, miss };
}

// how much the strongest affinities point to a class (0..1): the needs of the class read as weights
function lean(c, aff) {
  const needs = c.needs || {};
  let w = 0, v = 0;
  for (const a in needs) { w += needs[a]; v += needs[a] * ((aff && aff[a]) || 0) / 100; }
  return w ? v / w : 0;
}

// which affinities matter for a first class (the four groups of rank D)
export const GROUP_LEANS = {
  fighter: { might: 1, resilience: 0.5 },
  ranged: { precision: 1, agility: 0.6 },
  mage: { arcana: 1, control: 0.5 },
  necromancer: { dominion: 1, instinct: 0.3 },
};

// First Awakening (rank D): all four groups, the one that fits the play best is the recommendation
export function firstOffers(aff) {
  const out = Object.keys(CONFIG.classes.groups).map((g) => {
    const L = GROUP_LEANS[g] || {};
    let w = 0, v = 0;
    for (const a in L) { w += L[a]; v += L[a] * ((aff && aff[a]) || 0); }
    return { id: g, kind: 'first', fit: w ? v / w / 100 : 0, why: Object.keys(L) };
  });
  const best = out.slice().sort((a, b) => b.fit - a.fit)[0];
  for (const o of out) o.rec = best.fit > 0.05 && o === best;
  return out;
}

// the evolutions a class can grow into now: ready, reached rank, grown from this class (or one of its line)
export function evolutionsOf(cls, rank, aff, { all = false } = {}) {
  const list = CONFIG.classes.list, out = [];
  if (!list[cls]) return out;
  const line = lineOf(cls);
  for (const id in list) {
    const c = list[id];
    if (!c.evolution || id === cls || !(c.parents || []).includes(cls)) continue; // only the direct ways (warrior -> berserker ...)
    if (line.includes(id)) continue; // already grown past it
    if (!c.ready && !all) continue;
    const m = meets(c.needs, aff);
    const open = c.ready && rank >= (c.rank || CONFIG.classes.evolveRank) && m.ok;
    if (!open && !all) continue;
    out.push({ id, kind: c.unique ? 'unique' : 'evolution', fit: lean(c, aff), share: m.share, miss: m.miss, open, why: Object.keys(c.needs || {}) });
  }
  return out.sort((a, b) => b.fit - a.fit);
}

// Class Evolution (rank B and later): continuation first, then every evolution whose needs are met
export function evolutionOffers(cls, rank, aff) {
  const evo = evolutionsOf(cls, rank, aff);
  const out = [{ id: cls, kind: 'continuation', fit: 0, why: [], stay: true }, ...evo];
  if (evo.length) evo[0].rec = true;
  return out;
}

// Specialization (rank C): the offers of the affinities (core/style.js classOffers) with their kind and the
// recommendation; continuation is always one of them, locked classes never
// held = a Set of the classes held before. Whatever is passed in, a class that cannot be taken (core/classes.js
// specAllowed) is dropped here too.
export function specOffers(cls, offers, aff, held) {
  const list = CONFIG.classes.list;
  // every offer, the continuation included, passes the one check (specAllowed); invalid entries are skipped
  const out = (Array.isArray(offers) ? offers : [])
    .filter((o) => o && typeof o.id === 'string' && specAllowed(cls, o.id, aff, held))
    .map((o) => ({ ...o, open: true, stay: o.id === cls, kind: o.id === cls ? 'continuation' : list[o.id].hybrid ? 'hybrid' : 'specialization' }));
  // the continuation is added when missing, but only when the class itself is allowed (ready)
  if (!out.some((o) => o.stay) && specAllowed(cls, cls, aff, held)) out.unshift({ id: cls, kind: 'continuation', fit: 0, why: '', stay: true, open: true });
  const best = out.filter((o) => !o.stay && o.open).sort((a, b) => b.fit - a.fit)[0];
  if (best && best.fit > 0.3) best.rec = true;
  return out;
}

// the two strongest affinities that speak for a class (for the reason shown on the card)
export function reasonFor(id, aff) {
  const c = CONFIG.classes.list[id];
  const keys = c && c.needs ? Object.keys(c.needs) : AFFINITIES;
  return keys.slice().sort((a, b) => ((aff && aff[b]) || 0) - ((aff && aff[a]) || 0)).slice(0, 2);
}

// The state of the Awakening, saved with the world.
//  history    the classes taken: [{ id, rank, kind }]
//  declined   the rank at which the evolution was last turned down (it is offered again at the next rank)
//  pending    the offer that is open: { rank, ids } (kept, so the cards do not change while it waits)
export class AwakeningState {
  constructor(saved, mainClass, rank) {
    const s = saved && typeof saved === 'object' ? saved : {};
    this.history = Array.isArray(s.history) ? s.history.filter((h) => h && CONFIG.classes.list[h.id]).map((h) => ({ id: h.id, rank: h.rank | 0, kind: String(h.kind || '') })) : [];
    if (!this.history.length && mainClass && CONFIG.classes.list[mainClass]) {
      // older worlds: what is known for sure is the class now (rank of its choice: D, or C for a spec class)
      const c = CONFIG.classes.list[mainClass];
      if (!c.hybrid && !c.evolution && CONFIG.classes.groups[c.group] && CONFIG.classes.groups[c.group].class === mainClass) this.history.push({ id: mainClass, rank: CONFIG.classes.choiceRank, kind: 'first' });
      else this.history.push({ id: mainClass, rank: Math.min(rank | 0, CONFIG.classes.specRank), kind: c.hybrid ? 'hybrid' : 'specialization' });
    }
    this.declined = Number.isInteger(s.declined) ? s.declined : -1;
    this.pending = s.pending && Array.isArray(s.pending.ids) ? { rank: s.pending.rank | 0, ids: s.pending.ids.filter((id) => CONFIG.classes.list[id]) } : null;
  }

  serialize() {
    return { history: this.history.map((h) => ({ ...h })), declined: this.declined, pending: this.pending ? { rank: this.pending.rank, ids: [...this.pending.ids] } : null };
  }

  add(id, rank, kind) {
    const last = this.history[this.history.length - 1];
    if (last && last.id === id) return;
    this.history.push({ id, rank, kind });
  }

  evolved() {
    return this.history.some((h) => h.kind === 'evolution' || h.kind === 'unique');
  }
}
