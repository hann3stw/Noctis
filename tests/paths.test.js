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
      assert.equal(o[0].role, 'deepen'); assert.ok(['branch', 'new'].includes(o[1].role)); assert.equal(o[2].role, 'wild');
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

test('new cores open with the rank and come as "newly found" once', () => {
  const g = world('warrior', 1);
  const P = g.path;
  assert.ok(!P.cores().includes('blood') && !P.cores().includes('void')); // rank D: only the first cores
  P.pick(0);
  g.rankIndex = 2; // rank C: Blood opens
  assert.ok(P.cores().includes('blood'));
  const o = P.options();
  assert.equal(o[1].core, 'blood'); assert.equal(o[1].role, 'new');
  for (let r = 3; r <= 9; r++) { g.rankIndex = r; P.pick(0); }
  assert.ok(P.cores().includes('void') && P.cores().includes('flow') && P.cores().includes('fortune'));
  // every class ends with 7 or more cores, all of them real
  for (const id in CONFIG.classes.list) {
    const c = CONFIG.classes.list[id];
    if (!c.ready) continue;
    assert.ok(c.cores.length >= 7, id + ' has ' + c.cores.length);
    for (const k of c.cores) assert.ok(CONFIG.paths.cores[k], id + ': ' + k);
  }
});

test('every core is complete: names, mod, skill text and numbers, only rules the game reads', async () => {
  const { t } = await import('../src/strings.js');
  const { PATH_CORES } = await import('../src/core/classComponents.js');
  const KNOWN_RULES = ['selfXp', 'slotCapPlus', 'armyKillXp', 'reviveCostMult', 'killMana', 'hpRegenMult', 'manaRegenMult']; // each read in game.js / player.js / army.js
  const BONUS = ['hp', 'speed', 'mana', 'crit', 'reload', 'damage', 'damageTaken', 'armyDamage', 'armyHp', 'armySlots', 'skillDamage', 'ultCharge', 'charges', 'cooldown', 'killHeal', 'hitHeal', 'companionDamage', 'companionHp'];
  const has = (k) => t(k) !== k;
  assert.deepEqual(Object.keys(CONFIG.paths.cores).sort(), [...PATH_CORES].sort());
  for (const c in CONFIG.paths.cores) {
    const d = CONFIG.paths.cores[c];
    assert.ok(has('class.core.' + c) && has('class.mod.' + c), c);
    for (let n = 1; n <= 9; n++) assert.ok(has('class.n.' + c + '.' + n), c + ' name ' + n);
    assert.ok(has('cskill.' + d.skill.id) && has('cskill.' + d.skill.id + '.desc'), c + ' skill text');
    assert.equal(d.skill.value.length, 3, c);
    for (const k in d.rule) assert.ok(KNOWN_RULES.includes(k), c + ' rule ' + k);
    for (const k in d.bonus) assert.ok(BONUS.includes(k), c + ' bonus ' + k);
    for (const k in d.like) assert.ok(typeof d.like[k] === 'number', c);
  }
});

test('keystones come at the 2nd, 4th, 6th and 8th pick of a core and really change the numbers', () => {
  const g = world('warrior');
  const P = g.path;
  P.chosen = [];
  const add = (core, n) => { for (let k = 0; k < n; k++) P.chosen.push({ core, mod: '', rarity: 1 }); P.dirty = true; };
  add('tank', 3);
  assert.equal(P.totals().charges || 0, 0); // three Tank picks: no extra attack charge yet
  assert.equal(P.keystonesOf('tank').length, 1);
  add('tank', 1);
  assert.equal(P.totals().charges, 1); // the fourth: Steady Arm
  assert.ok(P.rules().hpRegenMult >= 0); // rules sum without errors
  add('tank', 2);
  assert.ok(P.rules().hpRegenMult >= 0.1); // the sixth: a rule
  assert.equal(P.nextKeystone('tank'), null); // the 7th pick brings none
  add('tank', 1);
  assert.equal(P.nextKeystone('tank').at, 8); // the 8th does
});

test('combos need two picks of both cores and show on the card that completes them', () => {
  const g = world('warrior');
  const P = g.path;
  P.chosen = [{ core: 'blade', mod: '', rarity: 1 }, { core: 'blade', mod: '', rarity: 1 }, { core: 'slayer', mod: '', rarity: 1 }];
  P.dirty = true;
  assert.deepEqual(P.combos(), []);
  assert.equal(P.comboWith('slayer'), 'executioner');
  const before = P.totals().crit || 0;
  P.chosen.push({ core: 'slayer', mod: '', rarity: 1 }); P.dirty = true;
  assert.deepEqual(P.combos(), ['executioner']);
  assert.ok((P.totals().crit || 0) > before + 0.03);
});

test('every keystone and combo has a name and only known numbers', async () => {
  const { t } = await import('../src/strings.js');
  for (const core in CONFIG.paths.keystones) {
    assert.ok(CONFIG.paths.cores[core], core);
    for (const k of CONFIG.paths.keystones[core]) {
      assert.notEqual(t('keystone.' + core + '.' + k[0]), 'keystone.' + core + '.' + k[0]);
      assert.ok(Object.keys(k[1] || {}).length + Object.keys(k[2] || {}).length > 0, core + ' ' + k[0] + ' does nothing');
    }
  }
  for (const c in CONFIG.paths.cores) assert.ok(CONFIG.paths.keystones[c], 'no keystones for ' + c);
  for (const id in CONFIG.paths.combos) {
    assert.notEqual(t('combo.' + id), 'combo.' + id);
    for (const c of CONFIG.paths.combos[id].cores) assert.ok(CONFIG.paths.cores[c], id + ': ' + c);
  }
});
