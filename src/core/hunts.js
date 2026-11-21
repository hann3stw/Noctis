// Hunted monsters: now and then a named champion shows up in the zone the
// hunter is in (a normal monster of that zone grows into it). It is marked on
// the map and by a red beam of light, has a health bar with its name when you
// are close, and drops good items. It leaves again after a while. Nothing of
// it is saved: a new session starts with a fresh timer.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { rollLoot } from './items.js';
import { t } from '../strings.js';
import { play } from './sfx.js';

const TITLES = 8; // hunt.title.0 ... 7
const BAR_RANGE = 34; // the health bar shows this close

export class Hunts {
  constructor(game, saved) {
    this.game = game;
    this.i = -1; // enemy slot of the hunted monster (-1 = none)
    this.trophies = {}; // kind of monster -> hunts won (Hunt Board)
    if (saved && saved.trophies) for (const id in saved.trophies) if (CONFIG.enemies.types[id] && saved.trophies[id] > 0) this.trophies[id] = saved.trophies[id] | 0;
    this.pending = saved && Number.isInteger(saved.pending) && CONFIG.huntBoard.contracts[saved.pending] ? saved.pending : -1; // a hunt that was called: the contract
    this.contract = -1; // the contract of the hunt that is on
    this.name = '';
    this.zone = -1;
    this.ttl = 0;
    this.t = this.pending >= 0 ? 0 : CONFIG.hunts.first;
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff3048, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 40, 10, 1, true), mat);
    this.beam.visible = false;
    game.scene.add(this.beam);
  }

  serialize() {
    return { trophies: { ...this.trophies }, pending: this.pending };
  }

  // the Hunt Board: what a contract costs
  callCost(ci) {
    const B = CONFIG.huntBoard;
    return Math.round(B.call * B.contracts[ci].cost * (this.game.quests.zone() + 1));
  }

  // calls a hunted monster at once (it appears in the open world), with a contract
  call(ci) {
    const g = this.game, P = g.player, B = CONFIG.huntBoard;
    if (!B.contracts[ci] || this.on || this.pending >= 0 || P.essence < this.callCost(ci)) return false;
    P.essence -= this.callCost(ci);
    this.pending = ci;
    this.t = 0;
    g.hud.toast(t('board.called'));
    play('ui');
    g.save();
    return true;
  }

  trophyCount() {
    return Object.keys(this.trophies).length;
  }

  // the bonuses of the trophies (Player.recalc)
  apply(b) {
    const n = this.trophyCount(), T = CONFIG.huntBoard.trophy;
    for (const k in T) b[k] = (b[k] || 0) + T[k] * n;
  }

  get on() {
    return this.i >= 0;
  }

  // slot whose health bar the HUD shows (-1 = none)
  barIndex() {
    const game = this.game, E = game.enemies, P = game.player, i = this.i;
    if (i < 0 || !E.alive[i] || game.gates.active >= 0) return -1;
    return (E.x[i] - P.x) ** 2 + (E.z[i] - P.z) ** 2 < BAR_RANGE * BAR_RANGE ? i : -1;
  }

  update(dt) {
    const game = this.game, E = game.enemies, P = game.player, H = CONFIG.hunts;
    const i = this.i;
    this.beam.visible = i >= 0 && E.alive[i] && game.gates.active < 0;
    if (this.beam.visible) this.beam.position.set(E.x[i], 20, E.z[i]);
    if (game.gates.active >= 0 || P.dead) return;
    if (i >= 0) {
      if (!E.alive[i]) { this.end(); return; } // gone some other way
      // it moves on after a while, but not in the middle of a fight
      this.ttl -= dt;
      const close = (E.x[i] - P.x) ** 2 + (E.z[i] - P.z) ** 2 < 50 * 50;
      if (this.ttl <= 0 && !close) {
        game.hud.toast(t('hunt.gone', { name: this.name }));
        this.calm(i);
        this.end();
      }
      return;
    }
    if (P.inCamp || P.safeIndex >= 0) return; // the timer runs out in the open
    this.t -= dt;
    if (this.t <= 0) this.t = this.spawn() ? H.every[0] + Math.random() * (H.every[1] - H.every[0]) : 20;
  }

  // a normal monster of the zone, some way off, becomes the hunted one
  spawn() {
    const game = this.game, E = game.enemies, P = game.player, H = CONFIG.hunts;
    const zi = game.curZone;
    if (zi < 0 || game.world.zoneIndexAt(Math.hypot(P.x, P.z)) !== zi) return false;
    const lo = H.dist[0] * H.dist[0], hi = H.dist[1] * H.dist[1];
    const pick = [];
    for (let k = 0; k < E.count; k++) {
      if (!E.alive[k] || E.arena[k] || E.kid[k] || E.tier[k] !== 0 || E.zone[k] !== zi) continue;
      const d = (E.x[k] - P.x) ** 2 + (E.z[k] - P.z) ** 2;
      if (d < lo || d > hi) continue;
      if (game.world.zoneIndexAt(Math.hypot(E.x[k], E.z[k])) !== zi) continue;
      pick.push(k);
    }
    if (!pick.length) return false;
    const i = pick[(Math.random() * pick.length) | 0];
    E.tier[i] = 2;
    E.place(i, E.x[i], E.z[i]);
    E.maxHp[i] = Math.round(E.maxHp[i] * H.hp);
    E.hp[i] = E.maxHp[i];
    E.dmg[i] *= H.damage;
    E.xpv[i] = Math.round(E.xpv[i] * H.xp);
    // a contract of the Hunt Board: tougher
    const CN = this.pending >= 0 ? CONFIG.huntBoard.contracts[this.pending] : null;
    if (CN) {
      E.maxHp[i] = Math.round(E.maxHp[i] * CN.hp);
      E.hp[i] = E.maxHp[i];
      E.dmg[i] *= CN.damage;
    }
    this.contract = this.pending;
    this.pending = -1;
    this.i = i;
    this.zone = zi;
    this.ttl = H.ttl;
    this.name = t('hunt.name', { title: t('hunt.title.' + ((Math.random() * TITLES) | 0)), name: t('enemy.' + E.types[E.type[i]].id) });
    game.hud.banner(t('hunt.appeared'), t('hunt.appearedSub', { name: this.name, zone: t('zone.' + CONFIG.world.zones[zi].id) }));
    play('roar');
    if (game.tips) game.tips.show('hunt');
    return true;
  }

  // back to a normal monster (it left the zone)
  calm(i) {
    const E = this.game.enemies;
    E.tier[i] = 0;
    E.place(i, E.x[i], E.z[i]);
  }

  end() {
    this.contract = -1;
    this.i = -1;
    this.beam.visible = false;
  }

  // called by Game.onEnemyKilled after the usual drops
  onKill(i) {
    if (i !== this.i) return;
    this.game.profile.huntsSlain++;
    const game = this.game, E = game.enemies, P = game.player, H = CONFIG.hunts;
    const x = E.x[i], z = E.z[i], level = E.lvl[i];
    const CN = this.contract >= 0 ? CONFIG.huntBoard.contracts[this.contract] : null;
    const items = H.items + (CN ? CN.items : 0);
    for (let k = 0; k < items; k++) {
      const a = (k / items) * Math.PI * 2 + 0.5;
      game.loot.drop(x + Math.cos(a) * 2, z + Math.sin(a) * 2, rollLoot(level, P.luck + H.luck, P.known, Math.min(5, H.minRarity + (CN ? CN.rarity : 0)), true));
    }
    if (CN && CN.seals) { game.quests.seals += CN.seals; game.hud.toast(t('quest.sealsGot', { n: CN.seals })); }
    // a trophy of this kind of monster (Hunt Board)
    const kind = E.types[E.type[i]].id;
    if (game.path.has('huntBoard') && !this.trophies[kind]) { this.trophies[kind] = 1; P.recalc(); game.hud.toast(t('board.trophy', { name: t('enemy.' + kind) })); } else if (this.trophies[kind]) this.trophies[kind]++;
    const ess = Math.round(H.essence * (this.zone + 1) * (CN ? CN.essence : 1));
    P.essence += ess;
    game.hud.banner(t('hunt.slain'), t('hunt.slainSub', { name: this.name }) + ' · ' + t('toast.essence', { n: ess }));
    game.effects.burst(x, 1.5, z, 50, 0xff3048, 8, 0.28, 1.0);
    E.tier[i] = 0; // it comes back as a normal monster
    this.end();
  }
}
