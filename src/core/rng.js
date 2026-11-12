// Small deterministic random generator (mulberry32) so a world seed always
// produces the same world.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Mixes a seed with two integers (e.g. chunk coordinates) into a new seed.
export function hashSeed(seed, a, b) {
  let h = seed >>> 0;
  h = Math.imul(h ^ (a | 0), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ (b | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}
