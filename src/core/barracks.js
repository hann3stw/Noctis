// The Barracks, a mechanic of the Commander core (Path). Shadows can be
// stationed here (in the camp). A stationed shadow trains with real time, also
// while the game is closed. With Expeditions (a later Commander class) the
// stationed shadows can be sent on a mission that takes real time and brings
// essence, items and Soul Seals back. The barracks grows with essence.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from './sfx.js';
import { rollLoot } from './items.js';

const HOUR = 3600000;
const B = () => CONFIG.barracks;

export class Barracks {
  constructor(game, saved) {
    this.game = game;
    const s = saved || {};
    this.level = Math.max(1, Math.min(B().maxLevel, s.level | 0 || 1));
    this.nextId = s.nextId | 0 || 1;
    this.garrison = []; // [{ id, u, since }]: u = the shadow (a unit like those of the army, but not in it now)
    for (const e of Array.isArray(s.garrison) ? s.garrison : []) {
      if (!e || !e.d || !CONFIG.enemies.types[e.d.type]) continue;
      const id = e.id | 0 || this.nextId++;
      this.nextId = Math.max(this.nextId, id + 1);
      this.garrison.push({ id, u: game.army.makeUnit(e.d, -1), since: Number(e.since) || Date.now() });
    }
    const m = s.mission;
    this.mission = m && B().expeditions[m.kind] ? { kind: m.kind, end: Number(m.end) || 0, ids: Array.isArray(m.ids) ? m.ids : [] } : null;
    this.report = s.report && B().expeditions[s.report.kind] ? s.report : null; // a mission that came home, waiting to be claimed
    this.party = new Set(); // the shadows picked for the next mission (not saved)
    this.t = 0;
  }

  serialize() {
    this.collect();
    return {
      level: this.level, nextId: this.nextId,
      garrison: this.garrison.map((e) => ({ id: e.id, d: this.game.army.unitData(e.u), since: e.since })),
      mission: this.mission, report: this.report,
    };
  }

  capacity() {
    return B().baseSlots + B().slotsPerLevel * (this.level - 1);
  }

  // levels of XP per hour of a stationed shadow
  rate() {
    return B().trainRate + B().trainPerLevel * (this.level - 1);
  }

  upgradeCost() {
    return Math.round(B().upgradeCost * Math.pow(B().upgradeGrowth, this.level - 1));
  }

  upgrade() {
    const P = this.game.player;
    if (this.level >= B().maxLevel || P.essence < this.upgradeCost()) return false;
    P.essence -= this.upgradeCost();
    this.level++;
    this.game.hud.toast(t('barracks.upgraded'));
    play('levelup');
    this.game.save();
    return true;
  }

  away(id) {
    return !!this.mission && this.mission.ids.includes(id);
  }

  // hours a stationed shadow has trained since the last time (counted at most trainCap)
  hours(e) {
    return Math.max(0, Math.min(B().trainCap, (Date.now() - e.since) / HOUR));
  }

  // puts the shadow of army slot `slot` into the barracks
  station(slot) {
    if (!this.game.player.inCamp || this.garrison.length >= this.capacity()) return false;
    const u = this.game.army.detach(slot);
    if (!u) return false;
    this.garrison.push({ id: this.nextId++, u, since: Date.now() });
    play('ui');
    this.game.save();
    return true;
  }

  // brings a shadow back into the army (it has trained meanwhile)
  recall(id) {
    if (!this.game.player.inCamp) return false;
    this.collect();
    const i = this.garrison.findIndex((e) => e.id === id);
    if (i < 0 || this.away(id)) return false;
    if (!this.game.army.attach(this.garrison[i].u)) { this.game.hud.toast(t('barracks.noRoom')); return false; }
    this.garrison.splice(i, 1);
    this.party.delete(id);
    play('ui');
    this.game.save();
    return true;
  }

  // lets the stationed shadows train for the time that has passed, and ends a mission that is over
  collect() {
    const now = Date.now(), A = this.game.army;
    for (const e of this.garrison) {
      if (e.since > now) e.since = now;
      if (this.away(e.id)) { e.since = now; continue; } // a mission is no training
      const h = this.hours(e);
      if (h >= 1 / 30) { A.train(e.u, h, this.rate()); e.since = now; }
    }
    this.finish();
  }

  // ---- expeditions ----------------------------------------------------------------------
  startMission(kind) {
    const M = B().expeditions[kind];
    if (!this.game.path.has('expeditions') || !M || this.mission || this.report) return false;
    const ids = [...this.party].filter((id) => this.garrison.some((e) => e.id === id));
    if (ids.length < M.party) return false;
    this.collect();
    this.mission = { kind, end: Date.now() + M.time * 1000, ids };
    this.party.clear();
    play('ui');
    this.game.save();
    return true;
  }

  timeLeft() {
    return this.mission ? Math.max(0, this.mission.end - Date.now()) : 0;
  }

  // what a mission brings (essence grows with the zone of your rank and with a bigger party)
  rewardOf(kind, size) {
    const M = B().expeditions[kind];
    const zone = Math.min(this.game.rankIndex, CONFIG.world.zones.length - 1);
    return { essence: Math.round(M.essence * (zone + 1) * (1 + 0.1 * Math.max(0, size - M.party))), seals: M.seals, items: M.items, rarity: M.rarity };
  }

  // a mission that has run its time: the shadows are home, the result waits to be claimed
  finish() {
    if (!this.mission || Date.now() < this.mission.end) return;
    const { kind, ids } = this.mission, M = B().expeditions[kind];
    let fallen = 0;
    for (const id of ids) {
      const e = this.garrison.find((x) => x.id === id);
      if (!e) continue;
      e.since = Date.now();
      if (Math.random() < M.injury) { e.u.alive = false; e.u.hp = 0; e.u.reviveT = 0; fallen++; }
    }
    const R = this.rewardOf(kind, ids.length);
    this.report = { kind, essence: R.essence, seals: R.seals, items: R.items, rarity: R.rarity || 0, fallen, size: ids.length };
    this.mission = null;
    this.game.hud.toast(t('barracks.home'));
    this.game.save();
  }

  claim() {
    const R = this.report, g = this.game, P = g.player;
    if (!R) return false;
    P.essence += R.essence;
    g.quests.seals += R.seals;
    for (let i = 0; i < R.items; i++) {
      const item = rollLoot(P.level, P.luck + 0.6, P.known, R.rarity, true);
      if (!P.addItem(item)) g.loot.drop(P.x, P.z, item);
    }
    this.report = null;
    g.hud.toast(t('barracks.got'));
    play('levelup');
    g.save();
    return true;
  }

  update(dt) {
    if ((this.t += dt) < 30) return;
    this.t = 0;
    this.collect();
  }
}
