// Intelligence: mana for everyone and exactly one bonus of the class line; the stats page shows only that one
import './dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../src/config.js';
import { baseOf } from '../src/core/classes.js';
import { Game } from '../src/game.js';
import { Player } from '../src/entities/player.js';
import { t } from '../src/strings.js';

const role = (cls) => {
  const g = { mainClass: cls, hasArmy: () => !!(CONFIG.classes.list[cls] && CONFIG.classes.list[cls].army), get mech() { return baseOf(cls); } };
  return Game.prototype.intRole.call(g);
};

test('every playable class gets the bonus of its line', () => {
  const want = {
    necromancer: 'army', deathKnight: 'army', boneArcher: 'army', warlock: 'army', commander: 'army',
    mage: 'mage', stormcaller: 'mage',
    warrior: 'warrior', berserker: 'warrior', spellblade: 'warrior',
    rogue: 'rogue', skirmisher: 'rogue',
    cleric: 'cleric', paladin: 'cleric', sentinel: 'cleric',
    ranger: 'ranger', beastmaster: 'ranger', arcaneArcher: 'ranger',
  };
  for (const id in CONFIG.classes.list) if (CONFIG.classes.list[id].ready) assert.equal(role(id), want[id], id);
  assert.equal(role(''), 'none');
  for (const r of ['none', 'army', 'mage', 'warrior', 'rogue', 'cleric', 'ranger']) assert.notEqual(t('stat.int.desc.' + r), 'stat.int.desc.' + r);
  // the text names only what it does: no other class in it
  assert.ok(!t('stat.int.desc.warrior').includes('army') && !t('stat.int.desc.warrior').includes('cooldown'));
});

test('the bonus really works, and only in its own line', () => {
  const S = CONFIG.progression.stats.int;
  const hunter = (mech, int) => {
    const P = Object.create(Player.prototype);
    Object.assign(P, { stats: { int }, rage: 0, faith: 0, cp: 0, cpT: 0, cpCd: 0, game: { mech } });
    return P;
  };
  const w0 = hunter('warrior', 0), w40 = hunter('warrior', 40);
  w0.addRage(10); w40.addRage(10);
  assert.equal(w0.rage, 10); assert.ok(Math.abs(w40.rage - 10 * (1 + 40 * S.rageGain)) < 1e-9);
  const c40 = hunter('cleric', 40); c40.addFaith(10);
  assert.ok(Math.abs(c40.faith - 10 * (1 + 40 * S.faithGain)) < 1e-9);
  const r40 = hunter('rogue', 40); r40.addCombo(1, true);
  assert.ok(Math.abs(r40.cpT - (CONFIG.rogue.cpTime + 40 * S.comboTime)) < 1e-9);
  // another line gains nothing from it
  const m40 = hunter('mage', 40); m40.addRage(10); m40.addFaith(10); m40.addCombo(1, true);
  assert.equal(m40.rage + m40.faith + m40.cp, 0);
});
