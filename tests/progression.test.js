// Class progression A to M, rank borders, specialization by affinities, save version 5 (run: npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { rankOf, migrateSave } from '../src/core/levels.js';
import { TREES, STEPS, GUARANTEED, treeOf, stepsOf, validateTrees, ClassProgression } from '../src/core/classProgression.js';
import { classOffers } from '../src/core/style.js';
import { specOffers } from '../src/core/awakening.js';
import { AFFINITIES, Affinities } from '../src/core/affinities.js';

const aff = (o) => Object.assign(Object.fromEntries(AFFINITIES.map((a) => [a, 0])), o || {});
const full = aff(Object.fromEntries(AFFINITIES.map((a) => [a, 100])));

test('every tree is complete, every step does something, every path exists', () => {
  assert.deepEqual(validateTrees(), []);
  for (const c of ['berserker', 'stormcaller', 'beastmaster', 'sentinel', 'warrior', 'mage', 'rogue', 'ranger', 'cleric', 'necromancer']) assert.ok(TREES[c], c);
});

test('every playable class has a tree (hybrids use the one of their base)', () => {
  for (const id in CONFIG.classes.list) {
    const c = CONFIG.classes.list[id];
    if (c.ready) assert.ok(treeOf(id), 'no tree: ' + id);
  }
  assert.equal(treeOf('paladin'), 'cleric');
  assert.equal(treeOf('deathKnight'), 'necromancer');
  assert.equal(treeOf('berserker'), 'berserker');
});

test('rank borders: the level of each rank', () => {
  const borders = [[9, 0], [10, 1], [24, 1], [25, 2], [49, 2], [50, 3], [99, 3], [100, 4], [199, 4], [200, 5], [299, 5], [300, 6], [449, 6], [450, 7], [649, 7], [650, 8], [849, 8], [850, 9]];
  for (const [lv, r] of borders) assert.equal(rankOf(lv), r, 'level ' + lv);
});

test('each step opens exactly at its rank, never one rank early', () => {
  for (const tree of Object.keys(TREES)) {
    for (const s of STEPS) {
      const before = stepsOf(tree, s.rank - 1, full, null).find((x) => x.key === s.key);
      const at = stepsOf(tree, s.rank, full, null).find((x) => x.key === s.key);
      assert.equal(before.status, 'rank', tree + ' ' + s.key + ' too early');
      assert.notEqual(at.status, 'rank', tree + ' ' + s.key + ' not open at its rank');
    }
  }
  // level 99 -> rank B: no step; level 100 -> A
  assert.ok(stepsOf('berserker', rankOf(99), full, null).every((x) => x.status === 'rank'));
  assert.equal(stepsOf('berserker', rankOf(100), full, null)[0].status, 'pick');
});

test('a unique step needs its affinities and stays once open', () => {
  const p = new ClassProgression();
  const low = stepsOf('stormcaller', 6, aff({ arcana: 50 }), p).find((x) => x.key === 'SS');
  assert.equal(low.status, 'needs');
  assert.deepEqual(low.miss, ['arcana', 'control']);
  assert.equal(p.openUniques('stormcaller', 6, aff({ arcana: 80, control: 50 })).length, 1);
  // the affinities drop later: the unique stays
  assert.equal(stepsOf('stormcaller', 6, aff({}), p).find((x) => x.key === 'SS').status, 'active');
  const back = new ClassProgression(JSON.parse(JSON.stringify(p.serialize())));
  assert.equal(stepsOf('stormcaller', 6, aff({}), back).find((x) => x.key === 'SS').status, 'active');
});

test('picks: only at their rank, only real options, for good, saved', () => {
  const p = new ClassProgression();
  assert.equal(p.pick('berserker', 'A', 'wideCleave', 3), false); // rank B: too early
  assert.equal(p.pick('berserker', 'A', 'nonsense', 4), false);
  assert.equal(p.pick('berserker', 'A', 'wideCleave', 4), true);
  assert.equal(p.pick('berserker', 'A', 'rendingCleave', 4), false); // already picked
  const back = new ClassProgression(JSON.parse(JSON.stringify(p.serialize())));
  assert.equal(back.picks.berserker.A, 'wideCleave');
  assert.equal(new ClassProgression({ picks: { berserker: { A: 'evil' } }, uniques: { ghost: { SS: true } } }).picks.berserker, undefined);
});

test('applying steps changes the real numbers, and resetting brings them back (no stacking)', () => {
  const p = new ClassProgression();
  const arc0 = CONFIG.skills.frenzyCleave.arcDeg, gap0 = CONFIG.mechanics.berserkerMomentum.gap, max0 = CONFIG.mechanics.berserkerMomentum.max;
  p.pick('berserker', 'A', 'wideCleave', 9); p.pick('berserker', 'S', 'unstoppable', 9);
  assert.ok(p.apply('berserker', 9, full));
  assert.equal(CONFIG.skills.frenzyCleave.arcDeg, arc0 + 40 - 0); // L not picked yet: only A
  assert.equal(CONFIG.mechanics.berserkerMomentum.gap, Math.round((gap0 - 0.15) * 10000) / 10000);
  assert.equal(CONFIG.mechanics.berserkerMomentum.max, max0 + 2 + 1); // S pick + M
  assert.equal(p.apply('berserker', 9, full), false); // same state: nothing to do
  // another class: the Berserker numbers are back
  p.apply('mage', 9, full);
  assert.equal(CONFIG.skills.frenzyCleave.arcDeg, arc0);
  assert.equal(CONFIG.mechanics.berserkerMomentum.max, max0);
  assert.ok(CONFIG.mage.arcaneTime > 6);
  // no class: everything at its base
  p.apply('', 0, full);
  assert.equal(CONFIG.mage.arcaneTime, 6);
  assert.equal(CONFIG.skills.frenzyCleave.burn, undefined);
});

test('step bonuses and companion upgrades are collected', () => {
  const p = new ClassProgression();
  p.pick('beastmaster', 'L', 'alphaPredator', 9);
  p.apply('beastmaster', 9, full);
  assert.ok(p.bonus.companionDamage >= 0.6 && p.bonus.companionHp >= 0.2);
  assert.ok(p.compUp.includes('protectiveBond') && p.compUp.includes('mythicApex'));
  assert.ok(CONFIG.mechanics.companionBond.guard >= 0.3);
  p.apply('', 0, full);
  assert.equal(CONFIG.mechanics.companionBond.guard, 0);
});

test('guaranteed skills: each evolution class gets its second skill by a quest or at rank A', () => {
  for (const c of ['berserker', 'stormcaller', 'beastmaster', 'sentinel']) {
    const g = GUARANTEED[c];
    assert.ok(g && CONFIG.skills[g.skill].for.includes(c) && CONFIG.classes.list[c].startSkills.includes(g.quest.mastery), c);
    assert.equal(g.rank, 4);
  }
});

// ---- Specialization by affinities ---------------------------------------------------------------
function fakeGame(cls, values, history = []) {
  return { mainClass: cls, aff: { values: () => aff(values) }, awakening: { history: history.map((id) => ({ id })) } };
}

test('specialization: the class and its plain sibling are always offered, hybrids only with their affinities', () => {
  const none = classOffers(fakeGame('warrior', {}));
  assert.ok(none.find((o) => o.id === 'warrior').open && none.find((o) => o.id === 'rogue').open);
  assert.ok(!none.some((o) => o.id === 'spellblade')); // locked: not offered at all
  const yes = classOffers(fakeGame('warrior', { might: 60, arcana: 40 }));
  assert.ok(yes.find((o) => o.id === 'spellblade').open);
  // held before: open whatever the affinities say
  assert.ok(classOffers(fakeGame('warrior', {}, ['spellblade'])).find((o) => o.id === 'spellblade').open);
  // the recommendation is the best open one, with its reason (an affinity)
  const s = specOffers('warrior', yes, aff({ might: 60, arcana: 40 }));
  assert.equal(s[0].kind, 'continuation');
  const rec = s.find((o) => o.rec);
  assert.ok(rec && rec.open && ['might', 'arcana', 'agility', 'precision'].includes(rec.why));
});

test('specialization by play style: pure styles lead to fitting offers', () => {
  const play = (fn) => { const a = new Affinities(); for (let k = 0; k < 2400; k++) { fn(a, k); a.tick(1); } return a.values(); };
  const melee = play((a) => { a.record('meleeHit'); a.record('meleeHit'); });
  const magic = play((a, k) => { a.record('magicHit'); if (k % 5 === 0) a.record('skillCast', { magic: true }); if (k % 7 === 0) a.record('controlApplied'); });
  const ranged = play((a, k) => { a.record('rangedHit'); if (k % 3 === 0) a.record('criticalHit'); if (k % 6 === 0) a.record('dodgeSuccess'); });
  const defend = play((a, k) => { a.record('meleeHit'); if (k % 4 === 0) a.record('damagePrevented', { amount: 0.08 }); });
  const summon = play((a, k) => { a.record('shadowKill'); if (k % 15 === 0) a.record('shadowRaised'); });
  const explore = play((a, k) => { if (k % 40 === 0) a.record('chestOpened'); if (k % 120 === 0) a.record('gateCleared'); if (k % 300 === 0) a.record('outpostCaptured'); });
  const best = (v) => AFFINITIES.slice().sort((x, y) => v[y] - v[x])[0];
  assert.equal(best(melee), 'might'); assert.equal(best(magic), 'arcana'); assert.equal(best(defend), 'resilience'); assert.equal(best(summon), 'dominion'); assert.equal(best(explore), 'discovery');
  assert.ok(ranged.precision > 40);
  // a Necromancer who plays mostly with shadows gets the Commander, one who also fights up close the Death Knight
  const g1 = classOffers({ mainClass: 'necromancer', aff: { values: () => summon }, awakening: { history: [] } });
  assert.ok(g1.find((o) => o.id === 'commander').open);
  const mix = aff({ dominion: summon.dominion, might: melee.might });
  const g2 = classOffers({ mainClass: 'necromancer', aff: { values: () => mix }, awakening: { history: [] } });
  assert.ok(g2.find((o) => o.id === 'deathKnight').open);
  // several changes of style: the recent profile moves the values
  const a = new Affinities();
  for (let k = 0; k < 3600; k++) { a.record('meleeHit'); a.tick(1); }
  for (let k = 0; k < 3600; k++) { a.record('magicHit'); a.record('magicHit'); a.tick(1); }
  const m1 = a.values();
  for (let k = 0; k < 3600; k++) { a.record('shadowKill'); a.record('shadowKill'); a.tick(1); }
  const m2 = a.values();
  assert.ok(m1.arcana > 30 && m2.dominion > m1.dominion);
});

// ---- saves ----------------------------------------------------------------------------------------
test('version 5: the companion of a Ranger world leaves the army, the rest stays; repeatable', () => {
  const v4 = { version: 4, mainClass: 'ranger', seed: 77, army: { units: [{ type: 'gloomfang', tier: 1, level: 9, xp: 3, totalXp: 500, stage: 0, alive: true, hp: 40 }] }, player: { known: ['piercingShot'], inventory: [], equip: {} }, path: { chosen: [] } };
  const v5 = migrateSave(structuredClone(v4));
  assert.equal(v5.version, 5);
  assert.equal(v5.army.units.length, 0);
  assert.equal(v5.companion.level, 9);
  assert.equal(v5.companion.totalXp, 500);
  assert.deepEqual(migrateSave(structuredClone(v5)), v5);
  // a Necromancer world keeps its army as it is
  const nec = migrateSave({ version: 4, mainClass: 'necromancer', army: { units: [{ type: 'gloomfang' }, { type: 'gloomfang' }] }, player: { inventory: [], equip: {} } });
  assert.equal(nec.army.units.length, 2);
  assert.equal(nec.companion, undefined);
  // version 3 and older come all the way
  assert.equal(migrateSave({ version: 3, mainClass: 'beastmaster', army: { units: [{ type: 'gloomfang', level: 4 }] }, player: { inventory: [], equip: {} } }).companion.level, 4);
});

test('every class step and option reads as text (no raw string keys)', async () => {
  await import('./dom-stub.js');
  const { describeOps } = await import('../src/ui/classPanel.js');
  const { progName } = await import('../src/core/classProgression.js');
  const raw = /\b(pf|ks|prog|class|cskill|tree|path)\.[a-zA-Z]/;
  for (const tree in TREES) for (const k in TREES[tree]) {
    const n = TREES[tree][k];
    for (const x of [n, ...(n.pick || [])]) {
      assert.ok(!raw.test(progName(x.id)), tree + ' ' + x.id);
      for (const line of describeOps(x.ops)) assert.ok(!raw.test(line), tree + ' ' + x.id + ': ' + line);
    }
  }
});
