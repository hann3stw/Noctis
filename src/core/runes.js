// Skill runes: every skill and ultimate has up to three runes. A rune changes
// how the skill works (stronger but dearer, quicker but weaker, wider, more
// hits, longer ...). A skill has 1 to 3 rune sockets (they grow with the Path picks). Runes are found (gate
// bosses, daily quests, the Seal Shop); the ones not found yet stay unknown.
// The runed numbers are made by skillDef (combat/skills.js).
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

// the kinds of rune: numbers multiply the same field of the skill (when it has it)
export const RUNE_KINDS = {
  empowered: { power: 1.4, shield: 1.35, healSelf: 1.35, healArmy: 1.35, armyDamage: 1.35, damage: 1.35, heal: 1.4, mana: 1.25 },
  swift: { cooldown: 0.7, power: 0.9, mana: 0.9 },
  wide: { radius: 1.35, range: 1.2, width: 1.3, arcDeg: 1.25, power: 0.9 },
  barrage: { ticks: 1.6, interval: 0.8, power: 0.85, mana: 1.2 },
  crushing: { stun: 1.7, radius: 1.15, cooldown: 1.15 },
  lasting: { duration: 1.6, mana: 1.15 },
};

// the runes of a skill: empowered, swift (skills with a cooldown) and one that suits it
export function runesOf(id) {
  const def = CONFIG.skills[id] || CONFIG.ultimates[id];
  if (!def) return [];
  const out = ['empowered'];
  if (def.cooldown) out.push('swift');
  if (def.ticks) out.push('barrage');
  else if (def.stun) out.push('crushing');
  else if (def.duration) out.push('lasting');
  else if (def.radius || def.range || def.width) out.push('wide');
  return out.length < 3 && def.radius && !out.includes('wide') ? [...out, 'wide'] : out;
}

export class Runes {
  constructor(game, saved) {
    this.game = game;
    this.owned = saved && Array.isArray(saved.owned) ? saved.owned.filter((k) => this.valid(k)) : []; // 'skill:rune'
    this.worn = {}; // skill -> [runes]
    this.ver = 0; // goes up when a rune level changes (skillDef caches the runed numbers)
    this.lv = {}; // 'skill:rune' -> level (Rune Workshop)
    if (saved && saved.levels) for (const k in saved.levels) if (this.owned.includes(k)) this.lv[k] = Math.max(0, Math.min(CONFIG.runeWorkshop.max, saved.levels[k] | 0));
    if (saved && saved.worn) for (const id in saved.worn) {
      const list = [].concat(saved.worn[id]).filter((r) => this.owned.includes(id + ':' + r));
      if (list.length) this.worn[id] = [...new Set(list)].slice(0, 3);
    }
  }

  valid(key) {
    const [id, r] = String(key).split(':');
    return runesOf(id).includes(r);
  }

  serialize() {
    const worn = {};
    for (const id in this.worn) worn[id] = [...this.worn[id]];
    return { owned: [...this.owned], worn, levels: { ...this.lv } };
  }

  has(id, r) {
    return this.owned.includes(id + ':' + r);
  }

  // sockets of a skill (Path picks)
  sockets() {
    return this.game.path ? this.game.path.runeSockets() : 1;
  }

  // the runes of a skill that are worn: a key like 'swift+wide' ('' = none)
  of(id) {
    return (this.worn[id] || []).slice(0, this.sockets()).join('+');
  }

  isWorn(id, r) {
    return (this.worn[id] || []).slice(0, this.sockets()).includes(r);
  }

  // wears a rune (or takes it off when it is worn already); a full skill drops the oldest
  wear(id, r) {
    if (!this.has(id, r)) return;
    let list = (this.worn[id] || []).slice(0, this.sockets());
    if (list.includes(r)) list = list.filter((x) => x !== r);
    else { list.push(r); if (list.length > this.sockets()) list.shift(); }
    if (list.length) this.worn[id] = list; else delete this.worn[id];
    this.game.player.cds && this.game.hud.syncSkills();
    this.game.save();
  }

  // ---- Rune Workshop (Mage) ---------------------------------------------------------------
  level(id, r) {
    return this.lv[id + ':' + r] || 0;
  }

  // essence for the next level of a rune (0 = it is at the top)
  infuseCost(id, r) {
    const W = CONFIG.runeWorkshop, lv = this.level(id, r);
    return lv >= W.max ? 0 : W.infuse[lv] * (this.game.rankIndex + 1);
  }

  infuse(id, r) {
    const P = this.game.player, cost = this.infuseCost(id, r);
    if (!this.has(id, r) || !cost || P.essence < cost) return false;
    P.essence -= cost;
    this.lv[id + ':' + r] = this.level(id, r) + 1;
    this.ver++;
    this.game.hud.syncSkills();
    play('levelup');
    this.game.save();
    return true;
  }

  craftCost() {
    return CONFIG.runeWorkshop.craft * (this.game.rankIndex + 1);
  }

  // makes a rune that was not found yet
  craft(id, r) {
    const P = this.game.player, cost = this.craftCost();
    if (this.has(id, r) || !this.valid(id + ':' + r) || !P.known.includes(id) || P.essence < cost) return false;
    P.essence -= cost;
    this.owned.push(id + ':' + r);
    this.game.hud.toast(t('rune.found', { rune: t('rune.' + r), skill: t('skill.' + id) }));
    play('chest');
    this.game.save();
    return true;
  }

  // finds a rune: a random one of a skill the hunter knows (not found yet).
  // Returns the key or '' when there is nothing left to find.
  find() {
    const known = this.game.player.known.filter((id) => CONFIG.skills[id] || CONFIG.ultimates[id]);
    const open = [];
    for (const id of known) for (const r of runesOf(id)) if (!this.has(id, r)) open.push(id + ':' + r);
    if (!open.length) return '';
    const key = open[(Math.random() * open.length) | 0];
    this.owned.push(key);
    const [id, r] = key.split(':');
    this.game.hud.toast(t('rune.found', { rune: t('rune.' + r), skill: t('skill.' + id) }));
    play('chest');
    return key;
  }

  // is there a rune left to find?
  canFind() {
    return this.game.player.known.some((id) => (CONFIG.skills[id] || CONFIG.ultimates[id]) && runesOf(id).some((r) => !this.has(id, r)));
  }

  // how many runes of a skill were found
  count(id) {
    return runesOf(id).filter((r) => this.has(id, r)).length;
  }
}
