// Locked classes are never offered or taken: classOffers, specOffers, the class panel, changeClass, evolutions.
import './dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { AFFINITIES } from '../src/core/affinities.js';
import { specAllowed } from '../src/core/classes.js';
import { classOffers } from '../src/core/style.js';
import { specOffers, evolutionOffers } from '../src/core/awakening.js';
import { ClassPanel } from '../src/ui/classPanel.js';
import { Game } from '../src/game.js';

const aff = (o) => Object.assign(Object.fromEntries(AFFINITIES.map((a) => [a, 0])), o || {});
const FULL = aff(Object.fromEntries(AFFINITIES.map((a) => [a, 100])));

// a hunter for the class logic: the real Game methods run on it (no world, no renderer)
function hunter(cls, values, history = [cls]) {
  const v = aff(values);
  return {
    mainClass: cls, specDone: false, rankIndex: 2, taken: '',
    aff: { values: () => v, top: () => ['might', 'arcana'], longT: 3600, longTerm: () => v, recent: () => v },
    awakening: { history: history.map((id) => ({ id, rank: 1, kind: 'first' })), pending: null, declined: -1 },
    specDue() { return !this.specDone; },
    takeClass(id) { this.taken = id; this.mainClass = id; },
    hud: { banner() {} }, save() {}, setPaused() {},
  };
}
// runs fn while class id is not ready (ready: false), then puts it back
function locked(id, fn) {
  const c = CONFIG.classes.list[id], was = c.ready;
  c.ready = false;
  try { fn(); } finally { c.ready = was; }
}

test('every class that is offered today is defined with ready: true', () => {
  for (const from in CONFIG.classes.spec) for (const id of CONFIG.classes.spec[from]) assert.equal(CONFIG.classes.list[id].ready, true, id);
  for (const g in CONFIG.classes.groups) assert.equal(CONFIG.classes.list[CONFIG.classes.groups[g].class].ready, true, g);
});

test('1. a hybrid with ready: false and a high fit is not in classOffers', () => {
  locked('spellblade', () => {
    const offers = classOffers(hunter('warrior', FULL));
    assert.ok(!offers.some((o) => o.id === 'spellblade'));
    assert.ok(offers.some((o) => o.id === 'paladin')); // the others still come
  });
});

test('2. the same locked hybrid is dropped by specOffers even when it is passed in', () => {
  locked('spellblade', () => {
    const passed = [{ id: 'warrior', fit: 0, stay: true }, { id: 'spellblade', fit: 0.99, why: 'might', open: true }, { id: 'rogue', fit: 0.5, why: 'agility' }];
    const out = specOffers('warrior', passed, FULL, new Set(['spellblade'])); // even "held before" does not open an unready class
    assert.ok(!out.some((o) => o.id === 'spellblade'));
    assert.ok(out.some((o) => o.id === 'rogue' && o.kind === 'specialization'));
  });
  // a hybrid whose needs are not met is dropped as well, when it is passed in
  const out = specOffers('warrior', [{ id: 'spellblade', fit: 0.9 }], aff({}), new Set());
  assert.ok(!out.some((o) => o.id === 'spellblade'));
});

test('3. a ready hybrid with a high enough fit is still offered', () => {
  const offers = classOffers(hunter('warrior', { might: 60, arcana: 40 }));
  assert.ok(offers.some((o) => o.id === 'spellblade'));
  const s = specOffers('warrior', offers, aff({ might: 60, arcana: 40 }), new Set());
  assert.equal(s.find((o) => o.id === 'spellblade').kind, 'hybrid');
});

test('4. a ready hybrid with too low a fit stays hidden', () => {
  const offers = classOffers(hunter('warrior', { might: 60, arcana: 10 }));
  assert.ok(!offers.some((o) => o.id === 'spellblade'));
  assert.ok(!specAllowed('warrior', 'spellblade', aff({ might: 60, arcana: 10 }), new Set()));
  // held before: still allowed (an earlier unlock stays)
  assert.ok(specAllowed('warrior', 'spellblade', aff({}), new Set(['spellblade'])));
});

test('5. changeClass refuses a locked hybrid on a direct call', () => {
  locked('spellblade', () => {
    const h = hunter('warrior', FULL);
    assert.equal(Game.prototype.changeClass.call(h, 'spellblade'), false);
    assert.equal(h.taken, ''); assert.equal(h.mainClass, 'warrior'); assert.equal(h.specDone, false);
  });
  // a ready hybrid whose needs are not met: refused too
  const low = hunter('warrior', {});
  assert.equal(Game.prototype.changeClass.call(low, 'spellblade'), false);
  // a class outside the specialization list: refused
  assert.equal(Game.prototype.changeClass.call(hunter('warrior', FULL), 'warlock'), false);
  // an open one works as before
  const ok = hunter('warrior', { might: 60, arcana: 40 });
  assert.equal(Game.prototype.changeClass.call(ok, 'spellblade'), true);
  assert.equal(ok.taken, 'spellblade');
  assert.equal(ok.specDone, true);
});

test('6. the current class stays as continuation', () => {
  for (const cls of ['warrior', 'mage', 'ranger', 'necromancer']) {
    const offers = classOffers(hunter(cls, {}));
    assert.equal(offers[0].id, cls); assert.ok(offers[0].stay);
    const s = specOffers(cls, offers, aff({}), new Set());
    assert.equal(s.find((o) => o.stay).kind, 'continuation');
    const h = hunter(cls, {});
    assert.equal(Game.prototype.changeClass.call(h, cls), true); // staying is always possible
  }
  // never more than four offers, the class itself always among them
  const many = classOffers(hunter('necromancer', FULL));
  assert.ok(many.length <= 4 && many[0].id === 'necromancer');
});

test('7. the class panel neither shows nor takes a locked class', () => {
  locked('spellblade', () => {
    const g = hunter('warrior', FULL);
    let changed = '';
    g.changeClass = (id) => { changed = id; return true; };
    const panel = Object.create(ClassPanel.prototype);
    Object.assign(panel, { game: g, mode: 'spec', el: { innerHTML: '', classList: { add() {}, remove() {} } }, isOpen: true, sel: '' });
    panel.offers = panel.makeOffers();
    assert.ok(!panel.offers.some((o) => o.id === 'spellblade'));
    panel.render();
    assert.ok(!panel.el.innerHTML.includes('data-id="spellblade"'));
    assert.ok(panel.el.innerHTML.includes('data-id="paladin"'));
    // a tap on a locked id (old or forged button) selects nothing, and a stale selection is not taken
    const tap = (act, id) => panel.onClick({ target: { closest: () => ({ dataset: { act, id }, disabled: false }) } });
    tap('pick', 'spellblade');
    assert.equal(panel.sel, '');
    panel.sel = 'spellblade';
    tap('confirm', 'spellblade');
    assert.equal(changed, '');
    // a real offer is taken
    panel.sel = 'paladin'; panel.isOpen = true;
    tap('confirm', 'paladin');
    assert.equal(changed, 'paladin');
  });
});

test('8. evolutions with ready: false stay invisible and cannot be taken', () => {
  for (const id in CONFIG.classes.list) {
    const c = CONFIG.classes.list[id];
    if (!c.evolution || c.ready) continue;
    for (const p of c.parents) {
      const offers = evolutionOffers(p, 9, FULL);
      assert.ok(!offers.some((o) => o.id === id), id + ' offered to ' + p);
    }
    // even a forged pending offer does not let it through
    const h = hunter(c.parents[0], FULL);
    h.rankIndex = 9; h.awakening.pending = { rank: 9, ids: [c.parents[0], id] };
    assert.equal(Game.prototype.evolveClass.call(h, id), false, id);
    assert.equal(h.taken, '');
  }
  // the class panel in evolution mode and its tree show none of them
  const g = hunter('rogue', FULL);
  g.rankIndex = 9; g.classTree = 'rogue'; g.progression = { picks: {}, uniques: {} }; g.player = { known: [] }; g.mastery = { level: () => 0 };
  const panel = Object.create(ClassPanel.prototype);
  Object.assign(panel, { game: g, mode: 'evolve', el: { innerHTML: '' }, sel: '' });
  panel.offers = panel.makeOffers();
  panel.render();
  assert.ok(!panel.el.innerHTML.includes('data-id="assassin"') && !panel.el.innerHTML.includes('data-c="assassin"'));
  panel.mode = 'tree';
  panel.render();
  assert.ok(!panel.el.innerHTML.includes('data-c="assassin"') && !panel.el.innerHTML.includes('data-c="phantomDuelist"'));
});

// ---- edge cases of the continuation and of unlocked hybrids -------------------------------------
test('an unready class does not appear through the continuation exception', () => {
  locked('warrior', () => {
    const out = specOffers('warrior', [{ id: 'warrior', fit: 0, stay: true }, { id: 'rogue', fit: 0.4 }], aff({}), new Set());
    assert.ok(!out.some((o) => o.id === 'warrior'), 'the unready class itself is not offered');
    assert.ok(out.some((o) => o.id === 'rogue'));
    assert.ok(!specAllowed('warrior', 'warrior', aff({}), new Set()));
    assert.equal(Game.prototype.changeClass.call(hunter('warrior', FULL), 'warrior'), false);
  });
});

test('a valid current class stays as continuation, even when it is missing from the passed offers', () => {
  for (const cls of ['warrior', 'mage', 'ranger', 'necromancer']) {
    const out = specOffers(cls, [], aff({}), new Set());
    assert.deepEqual(out.map((o) => [o.id, o.kind]), [[cls, 'continuation']]);
  }
});

test('invalid ids, missing definitions and bad input do not break specOffers', () => {
  const out = specOffers('warrior', [null, undefined, {}, { id: 5 }, { id: 'noSuchClass', fit: 1 }, { id: 'rogue', fit: 0.2 }], aff({}), new Set());
  assert.deepEqual(out.map((o) => o.id), ['warrior', 'rogue']);
  assert.doesNotThrow(() => specOffers('warrior', undefined, aff({}), undefined));
  assert.doesNotThrow(() => specOffers('noSuchClass', [{ id: 'rogue' }], aff({}), new Set()));
  assert.deepEqual(specOffers('noSuchClass', [{ id: 'rogue' }], aff({}), new Set()), []);
});

test('a hybrid unlocked once stays available through the class history while it is ready', () => {
  const held = new Set(['spellblade']);
  assert.ok(specAllowed('warrior', 'spellblade', aff({}), held)); // affinities have dropped to nothing
  assert.ok(classOffers(hunter('warrior', {}, ['warrior', 'spellblade'])).some((o) => o.id === 'spellblade'));
  assert.ok(specOffers('warrior', classOffers(hunter('warrior', {}, ['warrior', 'spellblade'])), aff({}), held).some((o) => o.kind === 'hybrid'));
  // ... but not when the class is not ready
  locked('spellblade', () => {
    assert.ok(!specAllowed('warrior', 'spellblade', aff({}), held));
    assert.ok(!classOffers(hunter('warrior', {}, ['warrior', 'spellblade'])).some((o) => o.id === 'spellblade'));
  });
});

test('a class with a missing ready value is not treated as unlocked', () => {
  const c = CONFIG.classes.list.spellblade, was = c.ready;
  try {
    delete c.ready;
    assert.ok(!specAllowed('warrior', 'spellblade', FULL, new Set(['spellblade'])));
    assert.ok(!classOffers(hunter('warrior', FULL)).some((o) => o.id === 'spellblade'));
    assert.equal(Game.prototype.changeClass.call(hunter('warrior', FULL), 'spellblade'), false);
    c.ready = 'yes'; // not exactly true: locked as well
    assert.ok(!specAllowed('warrior', 'spellblade', FULL, new Set()));
  } finally { c.ready = was; }
  // the current class without a ready value is not offered either
  const w = CONFIG.classes.list.warrior, wr = w.ready;
  try {
    delete w.ready;
    assert.ok(!specOffers('warrior', [{ id: 'warrior', stay: true }], aff({}), new Set()).some((o) => o.id === 'warrior'));
  } finally { w.ready = wr; }
});
