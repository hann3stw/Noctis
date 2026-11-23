// Pooled ground areas that deal damage after a short delay, once or several
// times (staff blast, Dagger Rain). The area is shown as a circle on the ground.
import * as THREE from 'three';
import { sectorGeometry } from '../render/geo.js';
import { hitCircle } from './weapons.js';
import { EXPAND } from '../render/effects.js';

const MAX = 20;

export class Zones {
  constructor(game) {
    this.game = game;
    this.list = [];
    const geo = sectorGeometry(Math.PI * 2, 0, 28);
    for (let i = 0; i < MAX; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      mesh.renderOrder = 3;
      game.scene.add(mesh);
      this.list.push({ mesh, owner: '', rain: false, follow: false, burn: 0, burnT: 0, knock: 0, heal: 0, live: false, x: 0, z: 0, r: 1, t: 0, total: 0, ticks: 0, interval: 0, dmg: 0, stun: 0, color: 0 });
    }
    this.next = 0;
  }

  // rain: daggers fall from the sky before every hit. opts (all optional): follow = the zone stays on the hunter,
  // burn / burnT = every tick sets the enemies on fire (damage per second, seconds), knock = every tick pushes
  // them out, heal = every tick that hits heals the hunter by this share of max health. Returns the zone.
  add(x, z, r, delay, ticks, interval, dmg, stun, color, rain = false, opts = null) {
    const zn = this.list[this.next];
    this.next = (this.next + 1) % MAX;
    zn.live = true;
    zn.x = x; zn.z = z; zn.r = r;
    zn.t = delay; zn.total = delay || 0.01;
    zn.ticks = ticks; zn.interval = interval;
    zn.dmg = dmg; zn.stun = stun; zn.color = color;
    zn.rain = rain;
    zn.follow = !!(opts && opts.follow);
    zn.burn = (opts && opts.burn) || 0; zn.burnT = (opts && opts.burnT) || 0;
    zn.knock = (opts && opts.knock) || 0;
    zn.heal = (opts && opts.heal) || 0;
    zn.owner = (opts && opts.owner) || ''; // a skill that may have only one zone (Stormfield) marks its own
    if (rain) this.game.effects.rain(x, z, r, 10, 0xe8dcff);
    zn.mesh.visible = true;
    zn.mesh.position.set(x, 0.07, z);
    zn.mesh.scale.setScalar(r);
    zn.mesh.material.color.setHex(color);
    return zn;
  }

  // ends the zones of an owner at once (a new Stormfield replaces the old one)
  killOwner(owner) {
    for (const zn of this.list) if (zn.live && zn.owner === owner) { zn.live = false; zn.mesh.visible = false; }
  }

  update(dt) {
    const game = this.game, fx = game.effects;
    for (let i = 0; i < MAX; i++) {
      const zn = this.list[i];
      if (!zn.live) continue;
      zn.t -= dt;
      if (zn.follow) { const P = game.player; zn.x = P.x; zn.z = P.z; zn.mesh.position.set(zn.x, 0.07, zn.z); }
      zn.mesh.material.opacity = 0.18 + 0.22 * (1 - Math.max(0, zn.t) / zn.total);
      if (zn.t > 0) continue;
      const n = hitCircle(game, zn.x, zn.z, zn.r, zn.dmg, zn.stun);
      if (zn.burn) game.enemies.burnArea(zn.x, zn.z, zn.r, zn.burn, zn.burnT);
      if (zn.knock) game.enemies.push(zn.x, zn.z, zn.r, zn.knock);
      if (zn.heal && n > 0) game.player.heal(game.player.maxHp * zn.heal);
      fx.slash(zn.x, zn.z, 0, zn.r, 360, zn.color, EXPAND, 1, 0.3);
      fx.ring(zn.x, zn.z, zn.r * 0.3, zn.r * 1.15, zn.color, 0.35);
      fx.burst(zn.x, 0.4, zn.z, 10, zn.color, 6, 0.2, 0.45);
      fx.flare(zn.x, 0.8, zn.z, zn.r * 1.3, zn.color, 0.28, 1.4);
      fx.light(zn.x, 1.8, zn.z, zn.color, 45, zn.r * 3 + 4, 0.25);
      if (--zn.ticks > 0) {
        zn.t = zn.total = zn.interval;
        if (zn.rain) fx.rain(zn.x, zn.z, zn.r, 10, 0xe8dcff);
      } else {
        zn.live = false;
        zn.mesh.visible = false;
      }
    }
  }
}
