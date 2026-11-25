// The Path offer: three roles, never the same three cores twice in a row, roll anew once per stage, respec
import './dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import '../src/core/classes.js'; // (fills in the cores of the evolution classes, as the game does)
import { Paths } from '../src/core/paths.js';
import { Profile } from '../src/core/profile.js';

function world(cls = 'necromancer', rank = 9) {
  const g = {
    mainClass: cls, rankIndex: rank, classTree: '', progression: null,
    classDue: () => false, profile: new Profile(), army: { deployed: [] },
    player: { stats: { int: 5, str: 5 }, maxHp: 100, essence: 1e9, slots: [null, null, null, 'x'], recalc() {} },
    hud: { syncSkills() {}, banner() {} }, save() {}, quests: { respecs: 0 }, aff: { values: () => ({}) },
  };
  g.path = new Paths(g, null);
  return g;
}

test('every offer has the three roles and three different cores', () => {
  for (const cls of ['necromancer', 'warrior', 'mage', 'berserker', 'beastmaster']) {
    const g = world(cls);
    for (let k = 0; k < 9; k++) {
      const o = g.path.options();
      assert.deepEqual(o.map((c) => c.role), ['deepen', 'branch', 'wild'], cls);
      assert.equal(new Set(o.map((c) => c.core)).size, 3, cls + ' stage ' + (k + 1));
      assert.ok(g.path.pick(k % 3));
    }
  }
});

test('two offers in a row are never the same three cores', () => {
  for (const cls of ['necromancer', 'warrior', 'mage', 'rogue', 'stormcaller', 'sentinel']) {
    const g = world(cls);
    let last = null;
    for (let k = 0; k < 9; k++) {
      const set = g.path.options().map((c) => c.core).sort().join();
      if (last && g.path.cores().length > 3) assert.notEqual(set, last, cls + ' stage ' + (k + 1));
      last = set;
      g.path.pick(0); // always the way on: the old offer logic gave the same three every time
    }
  }
});

test('branch brings the core picked least', () => {
  const g = world('necromancer');
  const P = g.path;
  for (let k = 0; k < 4; k++) P.pick(0);
  const o = P.options();
  const counts = P.cores().filter((c) => c !== o[0].core).map((c) => P.coreCount(c));
  assert.equal(P.coreCount(o[1].core), Math.min(...counts));
});

test('the offer is saved: reloading does not roll it anew', () => {
  const g = world('warrior');
  g.path.pick(0);
  const before = JSON.stringify(g.path.options());
  const back = new Paths(g, JSON.parse(JSON.stringify(g.path.serialize())));
  assert.equal(JSON.stringify(back.options()), before);
});

test('roll anew: once per stage, costs essence, the way on stays, the other cards change', () => {
  const g = world('necromancer');
  const P = g.path, before = P.options().map((c) => c.core), e0 = g.player.essence;
  assert.ok(P.reroll());
  const after = P.options().map((c) => c.core);
  assert.equal(after[0], before[0]);
  assert.ok(after.slice(1).some((c) => !before.slice(1).includes(c)));
  assert.equal(g.player.essence, e0 - P.rerollCost());
  assert.equal(P.reroll(), false); // only once per stage
  const back = new Paths(g, JSON.parse(JSON.stringify(P.serialize())));
  assert.equal(back.canReroll(), false); // and not again after a reload
  P.pick(0);
  assert.ok(P.canReroll()); // the next stage may roll again
});

test('respec: one token takes the last pick back, all picks cost more; the third slot leaves with its picks', () => {
  const g = world('mage');
  const P = g.path;
  for (let k = 0; k < 5; k++) P.pick(0);
  g.quests.respecs = 1;
  assert.ok(P.respecLast());
  assert.equal(P.chosen.length, 4);
  assert.equal(g.quests.respecs, 0);
  assert.equal(P.respecLast(), false);
  g.quests.respecs = CONFIG.paths.respecAll - 1;
  assert.equal(P.respec(), false);
  g.quests.respecs = CONFIG.paths.respecAll;
  assert.ok(P.respec());
  assert.equal(P.chosen.length, 0);
  assert.equal(g.player.slots[3], null); // no picks: no third skill slot
});
