// Mastery by use. A skill grows with the kills you make with it: every level makes it a little stronger
// (power) and quicker (cooldown), and at levels 3 and 5 you pick a perk for it (the kinds of the runes:
// empowered, swift, wide ... but free and always yours). The dodge grows with every dodge you make: a shorter
// cooldown. All of it comes from the way you play; nothing is bought. The numbers of a skill are made by skillDef
// (combat/skills.js), the picks are made in the Skills page of the menu.
import { t } from '../strings.js';
import { runesOf } from './runes.js';

const LEVELS = [15, 50, 120, 250, 500]; // points for level 1 .. 5 (a kill with the skill = 1, a cast = 0.2)
const PICK_AT = [3, 5]; // levels that give a perk to pick
const DODGE_AT = [60, 250, 700, 1800, 4000]; // dodges for dodge level 1 .. 5
const WINDOW = 3; // seconds after a cast in which a kill counts for the skill

export const POWER_PER_LEVEL = 0.05;
export const COOLDOWN_PER_LEVEL = 0.025;
export const DODGE_CD_PER_LEVEL = 0.05;

export class Mastery {
  constructor(game, saved) {
    this.game = game;
    this.xp = {}; // skill -> points
    this.perks = {}; // skill -> [kinds]
    this.ver = 0; // goes up when a level or perk changes (skillDef caches the numbers)
    if (saved) {
      for (const id in saved.xp || {}) this.xp[id] = Number(saved.xp[id]) || 0;
      for (const id in saved.perks || {}) this.perks[id] = [].concat(saved.perks[id]).filter((k) => runesOf(id).includes(k)).slice(0, PICK_AT.length);
    }
    this.recent = { id: '', t: 0 };
    this.dodgeLv = 0;
    this.checkT = 0;
  }

  serialize() {
    const xp = {};
    for (const id in this.xp) xp[id] = Math.round(this.xp[id] * 10) / 10;
    return { xp, perks: this.perks };
  }

  level(id) {
    const x = this.xp[id] || 0;
    let lv = 0;
    while (lv < LEVELS.length && x >= LEVELS[lv]) lv++;
    return lv;
  }

  // 0..1 towards the next level (1 at the top)
  progress(id) {
    const lv = this.level(id), x = this.xp[id] || 0;
    if (lv >= LEVELS.length) return 1;
    const lo = lv ? LEVELS[lv - 1] : 0;
    return (x - lo) / (LEVELS[lv] - lo);
  }

  need(id) {
    const lv = this.level(id);
    return lv >= LEVELS.length ? 0 : Math.ceil(LEVELS[lv] - (this.xp[id] || 0));
  }

  perkList(id) {
    return this.perks[id] || [];
  }

  // picks that wait for this skill
  pending(id) {
    const lv = this.level(id);
    return PICK_AT.filter((l) => lv >= l).length - this.perkList(id).length;
  }

  anyPending() {
    for (const id of this.game.player.known) if (this.pending(id) > 0) return true;
    return false;
  }

  options(id) {
    const have = this.perkList(id);
    return runesOf(id).filter((k) => !have.includes(k));
  }

  pick(id, kind) {
    if (this.pending(id) <= 0 || !this.options(id).includes(kind)) return false;
    (this.perks[id] = this.perks[id] || []).push(kind);
    this.ver++;
    return true;
  }

  // a skill was cast
  onCast(id) {
    this.xp[id] = (this.xp[id] || 0) + 0.2;
    this.recent.id = id;
    this.recent.t = performance.now();
  }

  // the hunter killed something: the skill he just used gets the point
  onKill() {
    const r = this.recent;
    if (!r.id || performance.now() - r.t > WINDOW * 1000) return;
    const before = this.level(r.id);
    this.xp[r.id] = (this.xp[r.id] || 0) + 1;
    const lv = this.level(r.id);
    if (lv > before) {
      this.ver++;
      const g = this.game;
      g.hud.toast(t('mastery.up', { skill: t('skill.' + r.id), lv }) + (this.pending(r.id) > 0 ? ' · ' + t('mastery.pickWaits') : ''));
    }
  }

  // the dodge level from the dodges counted
  dodgeLevel() {
    const n = this.game.profile.dodges;
    let lv = 0;
    while (lv < DODGE_AT.length && n >= DODGE_AT[lv]) lv++;
    return lv;
  }

  dodgeNeed() {
    const lv = this.dodgeLevel();
    return lv >= DODGE_AT.length ? 0 : DODGE_AT[lv] - this.game.profile.dodges;
  }

  update(dt) {
    if ((this.checkT -= dt) > 0) return;
    this.checkT = 4;
    const lv = this.dodgeLevel();
    if (lv !== this.dodgeLv) {
      if (this.dodgeLv > 0 || lv > 0) this.game.hud.toast(t('mastery.dodgeUp', { lv }));
      this.dodgeLv = lv;
      this.game.player.recalc();
    }
  }
}
