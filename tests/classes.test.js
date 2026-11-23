// Logic tests of the dynamic class system (run: npm test). No browser needed: only modules without DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { Affinities, AFFINITIES } from '../src/core/affinities.js';
import { firstOffers, specOffers, evolutionOffers, evolutionsOf, meets, AwakeningState } from '../src/core/awakening.js';
import { validateClasses, ancestors, installClasses } from '../src/core/classComponents.js';
import { skillOk, skillOpenAt, canForge, baseOf } from '../src/core/classes.js';
import { buildDef, FORMS, ELEMENTS, EFFECTS, CAPS } from '../src/core/forge.js';
import { migrateSave } from '../src/core/levels.js';
import { runesOf } from '../src/core/runes.js';

// plays `minutes` of active time, calling act(a, second) every second
function play(a, minutes, act) {
  for (let s = 0; s < minutes * 60; s++) { act(a, s); a.tick(1); }
  return a.values();
}
const top = (v) => AFFINITIES.slice().sort((x, y) => v[y] - v[x])[0];

// ---- affinities ----------------------------------------------------------------------------
test('pure melee fighter: Might leads, magic stays low', () => {
  const v = play(new Affinities(), 40, (a) => { a.record('meleeHit'); a.record('meleeHit'); });
  assert.equal(top(v), 'might');
  assert.ok(v.might >= 50, 'might ' + v.might);
  assert.ok(v.arcana < 10);
});

test('pure mage: Arcana leads', () => {
  const v = play(new Affinities(), 40, (a, s) => { a.record('magicHit'); if (s % 6 === 0) { a.record('skillCast', { magic: true }); a.record('manaSpent', { amount: 20 }); } });
  assert.equal(top(v), 'arcana');
  assert.ok(v.arcana >= 50, 'arcana ' + v.arcana);
});

test('ranged hunter: Precision and Agility', () => {
  const v = play(new Affinities(), 40, (a, s) => { a.record('rangedHit'); if (s % 4 === 0) a.record('criticalHit'); if (s % 8 === 0) a.record('dodgeSuccess'); });
  assert.ok(v.precision >= 40 && v.agility >= 30, JSON.stringify(v));
  assert.ok(v.might < 10);
});

test('strong companion and a big army make Dominion', () => {
  const comp = play(new Affinities(), 40, (a, s) => { a.record('companionHit'); if (s % 10 === 0) { a.record('companionKill'); a.record('eliteKill'); } });
  assert.ok(comp.dominion >= 40, 'dominion ' + comp.dominion);
  assert.ok(comp.instinct >= 35, 'instinct ' + comp.instinct);
  const army = play(new Affinities(), 40, (a, s) => { a.record('shadowKill'); if (s % 20 === 0) a.record('shadowRaised'); });
  assert.equal(top(army), 'dominion');
});

test('defensive play makes Resilience', () => {
  const v = play(new Affinities(), 40, (a, s) => { a.record('meleeHit'); if (s % 5 === 0) a.record('damagePrevented', { amount: 0.08 }); if (s % 10 === 0) a.record('healEffective', { amount: 0.05 }); });
  assert.ok(v.resilience >= 45, 'resilience ' + v.resilience);
});

test('mixed play spreads the values', () => {
  const v = play(new Affinities(), 40, (a, s) => { if (s % 2) a.record('meleeHit'); else a.record('magicHit'); if (s % 10 === 0) a.record('skillCast', { magic: true }); });
  assert.ok(v.might > 20 && v.arcana > 20, JSON.stringify(v));
});

test('little play: values stay low (no class from a few fights)', () => {
  const v = play(new Affinities(), 2, (a) => { a.record('meleeHit'); a.record('meleeHit'); a.record('meleeHit'); });
  assert.ok(v.might <= 25, 'might ' + v.might);
});

test('a change of style shows in the recent profile', () => {
  const a = new Affinities();
  play(a, 300, (x) => x.record('meleeHit'));
  const before = a.values().arcana;
  play(a, 120, (x) => { x.record('magicHit'); x.record('magicHit'); });
  assert.ok(a.recent().arcana > a.longTerm().arcana, 'recent arcana should lead');
  assert.ok(a.values().arcana > before + 10);
});

test('caps: spam in one second counts only so often, unknown types are ignored', () => {
  const a = new Affinities();
  let counted = 0;
  for (let k = 0; k < 100; k++) if (a.record('meleeHit')) counted++;
  assert.equal(counted, 3);
  assert.equal(a.record('noSuchAction'), false);
  assert.equal(a.record('damagePrevented', { amount: 0 }), false);
});

test('no double counting: one event adds once', () => {
  const a = new Affinities();
  a.record('bossKill');
  assert.equal(a.long.instinct, CONFIG && 12);
  assert.equal(a.record('bossKill'), false); // same second: capped at 1
});

test('affinities survive a save', () => {
  const a = new Affinities();
  play(a, 15, (x) => x.record('meleeHit'));
  const b = new Affinities(JSON.parse(JSON.stringify(a.serialize())));
  assert.deepEqual(b.values(), a.values());
  assert.deepEqual(new Affinities(null).values(), new Affinities({ junk: 1, ring: 'x' }).values());
});

// ---- class building blocks -------------------------------------------------------------------
test('every class built from blocks is valid', () => {
  assert.deepEqual(validateClasses(), []);
});

test('validation finds broken classes', () => {
  const C = structuredClone(CONFIG);
  C.classes.list.broken = { evolution: true, ready: true, family: 'nope', parents: ['ghost'], base: 'warrior', mechanic: 'none',
    components: { weapon: 'laser', passive: ['x'], skillPackage: 'none', ultimate: 'none', capabilities: ['fly'], pathAccess: ['moon'] } };
  const errs = validateClasses(C).filter((e) => e.startsWith('broken'));
  for (const part of ['family', 'weapon', 'parent', 'mechanic', 'path core', 'capability', 'passive', 'skill package']) assert.ok(errs.some((e) => e.includes(part)), 'missing check: ' + part);
});

test('ancestors resolve recursively and survive loops', () => {
  assert.deepEqual(new Set(ancestors('sentinel')), new Set(['cleric', 'paladin', 'warrior']));
  const C = structuredClone(CONFIG);
  C.classes.list.a = { parents: ['b'] }; C.classes.list.b = { parents: ['a'] };
  assert.deepEqual(ancestors('a', C.classes.list), ['b']);
});

test('the four new classes are playable and correctly filled in', () => {
  const L = CONFIG.classes.list;
  assert.equal(L.berserker.weapons, 'melee');
  assert.equal(L.berserker.army, false);
  assert.equal(L.stormcaller.spellForge, true);
  assert.equal(L.beastmaster.companion, true);
  assert.equal(L.beastmaster.army, false);
  assert.deepEqual(L.sentinel.cores, ['tank', 'mage', 'delver', 'slayer']);
  for (const id of ['berserker', 'stormcaller', 'beastmaster', 'sentinel']) assert.ok(L[id].ready && L[id].bonus && Object.keys(L[id].bonus).length);
  for (const id of ['assassin', 'phantomDuelist', 'elementalist', 'huntmaster', 'riftwalker', 'voidReaver', 'gravityWeaver']) assert.equal(L[id].ready, false);
  assert.equal(baseOf('beastmaster'), 'ranger');
});

// ---- skills ---------------------------------------------------------------------------------
test('skill inheritance', () => {
  assert.ok(skillOk('cleave', 'berserker') && skillOk('frenzyCleave', 'berserker'));
  assert.ok(!skillOk('frenzyCleave', 'warrior'));
  assert.ok(skillOk('fireball', 'stormcaller') && skillOk('thunderLance', 'stormcaller'));
  assert.ok(skillOk('bearTrap', 'beastmaster') && skillOk('packAssault', 'beastmaster'));
  assert.ok(skillOk('smite', 'sentinel') && skillOk('shieldBash', 'sentinel') && skillOk('radiantSweep', 'sentinel'));
  assert.ok(!skillOk('thunderLance', 'sentinel'));
  // the older hybrids still work
  assert.ok(skillOk('cleave', 'spellblade') && skillOk('fireball', 'spellblade'));
  assert.ok(skillOk('darkMend', 'deathKnight') && skillOk('cleave', 'deathKnight'));
  assert.ok(!skillOk('darkMend', 'warrior'));
});

test('evolution skills drop only from their rank', () => {
  assert.ok(!skillOpenAt('frenzyCleave', 2));
  assert.ok(skillOpenAt('frenzyCleave', 3));
  assert.ok(skillOpenAt('cleave', 0)); // older skills: no unlock rank
});

test('every new skill and ultimate has its numbers, a behaviour list and runes that change it', () => {
  const ids = ['frenzyCleave', 'recklessCharge', 'thunderLance', 'stormfield', 'preyMark', 'packAssault', 'aegisOath', 'radiantSweep'];
  const ults = ['bloodstorm', 'tempestAscension', 'primalApex', 'lastBastion'];
  for (const id of ids) assert.ok(CONFIG.skills[id] && CONFIG.skills[id].mana > 0 && CONFIG.skills[id].cooldown > 0, id);
  for (const id of ults) assert.ok(CONFIG.ultimates[id], id);
  for (const id of [...ids, ...ults]) {
    const d = CONFIG.skills[id] || CONFIG.ultimates[id];
    assert.ok(Array.isArray(d.behaviors) && d.behaviors.length, id);
    for (const r of runesOf(id)) assert.ok(r, id);
    assert.ok(runesOf(id).length >= 1);
    if (d.ticks) assert.ok(d.ticks * d.interval <= 6, id + ' lasts too long');
  }
});

test('the Spell Forge: who may use it', () => {
  assert.ok(canForge('mage') && canForge('stormcaller'));
  for (const c of ['warrior', 'cleric', 'necromancer', 'berserker', 'beastmaster', 'sentinel', 'spellblade']) assert.ok(!canForge(c), c);
});

// ---- Spell Forge ------------------------------------------------------------------------------
test('every old block combination builds as before (no NaN, same numbers as the old formula)', () => {
  const old = ['wave', 'bolt', 'nova', 'strike'], oe = ['fire', 'frost', 'arcane', 'lightning', 'shadow'], of = ['damage', 'mark', 'pull', 'heal', 'shield', 'haste'];
  for (const f of old) for (const e of oe) for (const x of of) {
    const d = buildDef({ form: f, elements: [e], effects: [x] });
    for (const k in d) if (typeof d[k] === 'number') assert.ok(Number.isFinite(d[k]), f + e + x + k);
    assert.ok(!d.ticks && !d.burn && !d.knock && !d.chain);
  }
  // a known one, by hand: fire bolt of damage = 2.4 x 1.25 x 1.3 x 1.1
  assert.equal(buildDef({ form: 'bolt', elements: ['fire'], effects: ['damage'] }).power, 4.29);
});

test('new forms, elements and effects have real effects and stay within the caps', () => {
  const er = buildDef({ form: 'eruption', elements: ['earth'], effects: ['burn'] });
  assert.equal(er.ticks, 3); assert.ok(er.knock > 0 && er.stun > 0 && er.burn > 0 && er.burnTime === 3);
  const au = buildDef({ form: 'aura', elements: ['nature'], effects: ['stun'] });
  assert.equal(au.ticks, 6); assert.ok(au.healSelf > 0 && au.stun >= 0.8);
  const st = buildDef({ form: 'bolt', elements: ['storm'], effects: ['knockback'] });
  assert.ok(st.chain === 2 && st.knock === 4 && st.range > FORMS.bolt.range);
  // the strongest fused spell that can be built stays within the caps
  for (const f in FORMS) {
    const d = buildDef({ form: f, elements: ['fire', 'storm'], effects: ['damage', 'burn', 'stun'] });
    assert.ok(d.power <= CAPS.power && (d.stun || 0) <= CAPS.stun && (d.burn || 0) <= CAPS.burn && (!d.range || d.range <= CAPS.range) && (!d.radius || d.radius <= CAPS.radius), f);
  }
  const heal = buildDef({ form: 'nova', elements: ['nature', 'shadow'], effects: ['heal', 'shield', 'haste'] });
  assert.ok(heal.healSelf <= CAPS.heal && heal.shield <= CAPS.shield);
  assert.ok(Object.keys(ELEMENTS).length === 8 && Object.keys(EFFECTS).length === 9 && Object.keys(FORMS).length === 6);
});

// ---- Awakening --------------------------------------------------------------------------------
const strong = (o) => Object.assign(Object.fromEntries(AFFINITIES.map((a) => [a, 0])), o);

test('First Awakening: all four groups, the fitting one recommended', () => {
  const o = firstOffers(strong({ arcana: 80, control: 40 }));
  assert.equal(o.length, 4);
  assert.equal(o.find((x) => x.rec).id, 'mage');
  assert.ok(!firstOffers(strong({})).some((x) => x.rec)); // no play: no recommendation
});

test('Specialization keeps continuation and marks kinds', () => {
  const o = specOffers('warrior', [{ id: 'warrior', fit: 0.5, why: 'melee', stay: true }, { id: 'rogue', fit: 0.6, why: 'dodge' }, { id: 'spellblade', fit: 0.5, why: 'magic' }], strong({}));
  assert.equal(o.find((x) => x.stay).kind, 'continuation');
  assert.equal(o.find((x) => x.id === 'spellblade').kind, 'hybrid');
  assert.equal(o.find((x) => x.id === 'rogue').kind, 'specialization');
  const noStay = specOffers('mage', [{ id: 'cleric', fit: 0.4 }], strong({}));
  assert.ok(noStay.some((x) => x.stay && x.id === 'mage'));
});

test('Class Evolution: each new class only with its parent, its rank and its needs', () => {
  const cases = [['warrior', 'berserker', { might: 60, resilience: 30 }], ['mage', 'stormcaller', { arcana: 60, control: 30 }], ['ranger', 'beastmaster', { dominion: 45, instinct: 40 }], ['cleric', 'sentinel', { resilience: 50, might: 25 }], ['paladin', 'sentinel', { resilience: 50, might: 25 }]];
  for (const [from, to, aff] of cases) {
    assert.ok(evolutionOffers(from, 3, strong(aff)).some((o) => o.id === to), from + ' -> ' + to);
    assert.ok(!evolutionOffers(from, 2, strong(aff)).some((o) => o.id === to), 'rank C is too early: ' + to);
    assert.ok(!evolutionOffers(from, 3, strong({})).some((o) => o.id === to), 'needs not met: ' + to);
    assert.equal(evolutionOffers(from, 3, strong(aff))[0].kind, 'continuation');
  }
  // wrong parent: nothing
  assert.ok(!evolutionOffers('rogue', 5, strong({ might: 99, resilience: 99 })).some((o) => o.id === 'berserker'));
  // prepared classes are never offered
  assert.ok(!evolutionOffers('rogue', 9, strong(Object.fromEntries(AFFINITIES.map((a) => [a, 100])))).some((o) => o.kind !== 'continuation'));
  assert.ok(evolutionsOf('rogue', 9, strong({}), { all: true }).some((o) => o.id === 'assassin' && !o.open));
  // the existing hybrids are never thrown into the evolutions
  assert.ok(!evolutionOffers('necromancer', 9, strong(Object.fromEntries(AFFINITIES.map((a) => [a, 100])))).some((o) => o.kind !== 'continuation'));
});

test('meets: missing needs are named', () => {
  const m = meets({ might: 50, resilience: 25 }, { might: 60, resilience: 10 });
  assert.ok(!m.ok); assert.deepEqual(m.miss, ['resilience']);
});

test('the Awakening state: saved offers, history from older worlds, no change by itself', () => {
  const s = new AwakeningState(null, 'warrior', 3);
  assert.deepEqual(s.history, [{ id: 'warrior', rank: 1, kind: 'first' }]);
  s.pending = { rank: 3, ids: ['warrior', 'berserker'] };
  const back = new AwakeningState(JSON.parse(JSON.stringify(s.serialize())), 'warrior', 3);
  assert.deepEqual(back.pending, { rank: 3, ids: ['warrior', 'berserker'] });
  back.add('berserker', 3, 'evolution');
  assert.ok(back.evolved());
  assert.equal(new AwakeningState(null, '', 0).history.length, 0);
  assert.equal(new AwakeningState({ history: [{ id: 'ghost' }] }, '', 0).history.length, 0);
});

// ---- saves ------------------------------------------------------------------------------------
test('a version 3 save becomes version 4 and keeps everything', () => {
  const v3 = { version: 3, mainClass: 'paladin', rankIndex: 4, specDone: true, path: { chosen: [{ core: 'tank' }] }, forge: { spells: [{ id: 'c1', form: 'bolt', elements: ['fire'], effects: ['damage'] }] },
    mastery: { xp: { cleave: 40 }, perks: { cleave: ['wide'] } }, runes: { owned: ['cleave:wide'] }, army: { units: [{ type: 1 }] },
    player: { level: 120, known: ['cleave', 'smite'], slots: ['cleave', 'smite', 'divineIntervention', null], inventory: [{ kind: 'weapon', type: 'sword', rarity: 3 }], equip: {} } };
  const copy = structuredClone(v3);
  const v4 = migrateSave(v3);
  assert.equal(v4.version, 4);
  for (const k of ['mainClass', 'rankIndex', 'specDone', 'path', 'forge', 'mastery', 'runes', 'army', 'player']) assert.deepEqual(v4[k], copy[k], k);
  assert.equal(v4.affinities, null); // nothing made up
  // a version 4 save is left alone
  const again = migrateSave(structuredClone(v4));
  assert.deepEqual(again, v4);
  // very old saves still come through all steps
  assert.equal(migrateSave({ version: 1, player: { level: 9, inventory: [], equip: {} } }).version, 4);
  assert.equal(migrateSave({ version: 2, player: { inventory: [{ rarity: 1 }], equip: {} } }).player.inventory[0].rarity, 2);
});

test('installClasses is repeatable', () => {
  const before = JSON.stringify(CONFIG.classes.list.berserker);
  installClasses();
  assert.equal(JSON.stringify(CONFIG.classes.list.berserker), before);
});

test('every rune of a new skill changes something it really has (not only its mana)', async () => {
  const { RUNE_KINDS } = await import('../src/core/runes.js');
  const ids = ['frenzyCleave', 'recklessCharge', 'thunderLance', 'stormfield', 'preyMark', 'packAssault', 'aegisOath', 'radiantSweep', 'bloodstorm', 'tempestAscension', 'primalApex', 'lastBastion'];
  for (const id of ids) {
    const d = CONFIG.skills[id] || CONFIG.ultimates[id];
    for (const r of runesOf(id)) assert.ok(Object.keys(RUNE_KINDS[r]).some((k) => k !== 'mana' && typeof d[k] === 'number'), id + ' / ' + r);
  }
});

test('loot: the second class skill can drop even with a full skill cap', async () => {
  const { rollLoot, setLootClass } = await import('../src/core/items.js');
  setLootClass('berserker');
  // a Berserker at rank B (level 60) that already knows many skills
  const known = ['cleave', 'shieldBash', 'groundSlam', 'shieldRush', 'challengingRoar', 'ironWill', 'shadowWave', 'nightLance', 'daggerRain', 'bladeDance', 'frenzyCleave', 'bloodstorm'];
  let found = 0;
  for (let k = 0; k < 4000; k++) { const it = rollLoot(60, 0, known); if (it.kind === 'skill') { assert.equal(it.type, 'recklessCharge'); found++; } }
  assert.ok(found > 0);
  // and never before rank B
  setLootClass('berserker');
  for (let k = 0; k < 4000; k++) { const it = rollLoot(20, 0, []); assert.ok(!(it.kind === 'skill' && ['frenzyCleave', 'recklessCharge', 'bloodstorm'].includes(it.type))); }
  // a Warrior never gets Berserker skills
  setLootClass('warrior');
  for (let k = 0; k < 4000; k++) { const it = rollLoot(60, 0, []); assert.ok(!(it.kind === 'skill' && ['frenzyCleave', 'recklessCharge', 'bloodstorm'].includes(it.type))); }
});
