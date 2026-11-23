// The Spell Forge, for the Mage only. A spell is built from blocks: a FORM (how it hits: wave, bolt, nova,
// strike), an ELEMENT (what it is made of) and an EFFECT (what else it does). A new spell has one element and one
// effect. A spell can then be FUSED: its blocks are the start of a new spell that may carry a second element and
// up to three effects (the old spell stays). More blocks make a spell stronger and dearer. Blocks open with the
// rank. The spells are skills like all others (they go into the skill slots, grow with mastery, can get perks);
// they are put into CONFIG.skills when the world loads (see register) and cast by combat/skills.js (castCustom).
import { CONFIG } from '../config.js';
import { t, addString } from '../strings.js';
import { SKILL_ICONS } from '../ui/icons.js';

// unlock = the rank index the block opens at (1 = D, where the Mage starts)
export const FORMS = {
  wave: { unlock: 1, aim: 'arc', mana: 20, cooldown: 6, power: 2.2, range: 9, arcDeg: 70, icon: 'M12 3C7 3 3 6 2 10l10 11 10-11c-1-4-5-7-10-7z' },
  bolt: { unlock: 1, aim: 'line', mana: 16, cooldown: 5, power: 2.4, range: 17, width: 1.3, icon: 'M2 12l12-3 1-4 7 7-7 7-1-4z' },
  nova: { unlock: 2, aim: 'self', mana: 24, cooldown: 9, power: 1.7, radius: 5.5, icon: 'M12 2l2 6 6-2-3 5 5 3-6 1 1 6-5-4-5 4 1-6-6-1 5-3-3-5 6 2z' },
  strike: { unlock: 3, aim: 'point', mana: 22, cooldown: 8, power: 2.6, range: 12, radius: 4, icon: 'M11 2h2v9l4 2-5 9-5-9 4-2z' },
};
export const ELEMENTS = {
  fire: { unlock: 1, color: 0xff7a30, power: 1.25 },
  frost: { unlock: 1, color: 0x9fe0ff, stun: 1.2, power: 0.95 },
  arcane: { unlock: 1, color: 0x8aa8ff, mana: 0.75, cooldown: 0.9 },
  lightning: { unlock: 2, color: 0xfff07a, range: 1.25, radius: 1.2 },
  shadow: { unlock: 3, color: 0xb27cff, leech: 0.4, power: 0.95 },
};
export const EFFECTS = {
  damage: { unlock: 1, power: 1.3, mana: 1.15 },
  mark: { unlock: 1, mark: 5 },
  pull: { unlock: 2, pull: 0.8 },
  heal: { unlock: 2, heal: 0.08 },
  shield: { unlock: 3, shield: 0.12 },
  haste: { unlock: 4, cooldown: 0.75 },
};
const MAX_SPELLS = 12;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

// the numbers of a spell from its blocks
export function buildDef(spec) {
  const F = FORMS[spec.form];
  const d = { aim: F.aim, mana: F.mana, cooldown: F.cooldown, power: F.power };
  for (const k of ['range', 'arcDeg', 'width', 'radius']) if (F[k]) d[k] = F[k];
  let stun = 0, leech = 0, mark = 0, pull = 0, heal = 0, shield = 0;
  for (const b of [...spec.elements.map((k) => ELEMENTS[k]), ...spec.effects.map((k) => EFFECTS[k])]) {
    if (b.power) d.power *= b.power;
    if (b.mana) d.mana *= b.mana;
    if (b.cooldown) d.cooldown *= b.cooldown;
    if (b.range && d.range) d.range *= b.range;
    if (b.radius && d.radius) d.radius *= b.radius;
    if (b.stun) stun += b.stun;
    if (b.leech) leech += b.leech;
    if (b.mark) mark = Math.max(mark, b.mark);
    if (b.pull) pull = b.pull;
    if (b.heal) heal += b.heal;
    if (b.shield) shield += b.shield;
  }
  // more blocks: stronger, dearer; a crafted spell is a little stronger than a normal skill (the Mage's edge)
  const extra = spec.elements.length + spec.effects.length - 2;
  d.power *= 1.1 * (1 + 0.15 * extra);
  d.mana *= 1 + 0.2 * extra;
  d.power = Math.round(d.power * 100) / 100;
  d.mana = Math.max(1, Math.round(d.mana));
  d.cooldown = Math.round(d.cooldown * 10) / 10;
  if (d.range) d.range = Math.round(d.range * 10) / 10;
  if (d.radius) d.radius = Math.round(d.radius * 10) / 10;
  if (stun) d.stun = Math.round(stun * 10) / 10;
  if (leech) d.leech = leech;
  if (mark) d.mark = mark;
  if (pull) d.pull = pull;
  if (heal) d.healSelf = heal;
  if (shield) d.shield = shield;
  d.custom = true;
  d.form = spec.form;
  d.els = [...spec.elements];
  d.fxs = [...spec.effects];
  d.for = ['mage'];
  d.color = ELEMENTS[spec.elements[0]].color;
  d.colors = spec.elements.map((k) => ELEMENTS[k].color);
  return d;
}

export function spellName(spec) {
  return spec.elements.map((k) => t('forge.el.' + k)).join(' ') + ' ' + t('forge.form.' + spec.form);
}

function spellIcon(spec) {
  const c = hex(ELEMENTS[spec.elements[0]].color);
  return `<svg viewBox="0 0 24 24" aria-hidden="true" style="color:${c}"><path d="${FORMS[spec.form].icon}" fill="currentColor"/></svg>`;
}

export class Forge {
  constructor(game, saved) {
    this.game = game;
    this.spells = [];
    this.next = 1;
    for (const s of (saved && saved.spells) || []) {
      if (!FORMS[s.form] || !Array.isArray(s.elements) || !Array.isArray(s.effects)) continue;
      if (!s.elements.every((k) => ELEMENTS[k]) || !s.effects.every((k) => EFFECTS[k])) continue;
      this.spells.push({ id: s.id, form: s.form, elements: s.elements, effects: s.effects });
      this.next = Math.max(this.next, Number(String(s.id).slice(1)) + 1 || 1);
    }
    for (const s of this.spells) this.register(s);
  }

  serialize() {
    return { spells: this.spells.map((s) => ({ ...s })) };
  }

  // a spell becomes a skill like the others
  register(spec) {
    CONFIG.skills[spec.id] = buildDef(spec);
    SKILL_ICONS[spec.id] = spellIcon(spec);
    addString('skill.' + spec.id, spellName(spec));
    addString('skill.' + spec.id + '.desc', t('forge.desc', { blocks: [...spec.elements.map((k) => t('forge.el.' + k)), t('forge.form.' + spec.form), ...spec.effects.map((k) => t('forge.fx.' + k))].join(' · ') }));
  }

  // the classes with the right to it (spellForge: the Mage and the Stormcaller), not just any mage-like class
  get open() {
    return this.game.canForge();
  }

  unlocked(kind, key) {
    const T = { form: FORMS, el: ELEMENTS, fx: EFFECTS }[kind];
    return this.game.rankIndex >= T[key].unlock;
  }

  // the limits: a new spell 1 element + 1 effect, a fused one 2 elements + 3 effects
  limits(fusing) {
    return fusing ? { el: 2, fx: 3 } : { el: 1, fx: 1 };
  }

  cost(spec) {
    const extra = spec.elements.length + spec.effects.length - 2;
    return Math.round(120 * (1 + this.game.rankIndex) * (1 + 0.6 * extra));
  }

  // why this spec cannot be made (or '' when it can); from = the spell it is fused from
  check(spec, from) {
    if (!this.open) return 'forge.noMage';
    if (this.spells.length >= MAX_SPELLS) return 'forge.full';
    if (!FORMS[spec.form] || !this.unlocked('form', spec.form)) return 'forge.locked';
    const L = this.limits(!!from);
    if (spec.elements.length < 1 || spec.effects.length < 1) return 'forge.need';
    if (spec.elements.length > L.el || spec.effects.length > L.fx) return 'forge.tooMany';
    if (new Set(spec.elements).size !== spec.elements.length || new Set(spec.effects).size !== spec.effects.length) return 'forge.same';
    if (!spec.elements.every((k) => ELEMENTS[k] && this.unlocked('el', k)) || !spec.effects.every((k) => EFFECTS[k] && this.unlocked('fx', k))) return 'forge.locked';
    if (from && spec.elements.length + spec.effects.length <= from.elements.length + from.effects.length) return 'forge.more';
    if (this.spells.some((s) => s.form === spec.form && s.elements.join() === spec.elements.join() && s.effects.join() === spec.effects.join())) return 'forge.exists';
    if (this.game.player.essence < this.cost(spec)) return 'forge.essence';
    return '';
  }

  make(spec, from) {
    if (this.check(spec, from)) return null;
    const P = this.game.player;
    P.essence -= this.cost(spec);
    const s = { id: 'c' + this.next++, form: spec.form, elements: [...spec.elements], effects: [...spec.effects] };
    this.spells.push(s);
    this.register(s);
    P.learn(s.id);
    if (!P.newSkills.includes(s.id)) P.newSkills.push(s.id);
    this.game.save();
    return s;
  }

  get(id) {
    return this.spells.find((s) => s.id === id);
  }

  // delete a spell: half of the essence comes back
  remove(id) {
    const i = this.spells.findIndex((s) => s.id === id);
    if (i < 0) return false;
    const G = this.game, P = G.player, s = this.spells[i];
    P.essence += Math.round(this.cost(s) * 0.5);
    this.spells.splice(i, 1);
    delete CONFIG.skills[id];
    delete SKILL_ICONS[id];
    P.known = P.known.filter((k) => k !== id);
    P.slots = P.slots.map((k) => (k === id ? null : k));
    P.newSkills = P.newSkills.filter((k) => k !== id);
    if (G.mastery) { delete G.mastery.xp[id]; delete G.mastery.perks[id]; G.mastery.ver++; }
    if (G.runes) { delete G.runes.worn[id]; G.runes.owned = G.runes.owned.filter((k) => !k.startsWith(id + ':')); }
    G.save();
    return true;
  }
}
