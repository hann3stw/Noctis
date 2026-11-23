// Daily quest rewards: always three real options (a hunter without a class once got an empty one, which broke the
// quest menu: "Cannot read properties of undefined (reading 'kind')", seen in the play data)
import './dom-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quests } from '../src/core/quests.js';

function questsFor({ army = false, rune = false, path = false } = {}) {
  const q = Object.create(Quests.prototype);
  q.game = { seed: 0, hasArmy: () => army, runes: { canFind: () => rune }, path: { chosen: path ? [1] : [] } };
  return q;
}

test('every quest offers three real, different rewards, with or without a class', () => {
  for (const opts of [{}, { army: true }, { rune: true, path: true }, { army: true, rune: true, path: true }]) {
    for (let seed = 0; seed < 300; seed++) {
      const q = questsFor(opts);
      q.game.seed = seed;
      for (let d = 0; d <= 2; d++) {
        q.list = [{ d, zone: 0 }, { d, zone: 1 }, { d, zone: 2 }];
        for (let k = 0; k < 3; k++) {
          const o = q.options(k);
          assert.equal(o.length, 3, JSON.stringify({ opts, seed, d, k }));
          assert.ok(o.every((x) => x && typeof x.kind === 'string'), JSON.stringify({ opts, seed, d, k, o }));
          assert.equal(new Set(o.map((x) => x.kind)).size, 3);
        }
      }
    }
  }
});
