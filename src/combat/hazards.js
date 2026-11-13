// Telegraphed ground attacks of bosses: a red circle fills up, then everything
// inside takes damage. Dodging out of the circle (or through it with the
// dodge's invulnerability) avoids the hit.
import * as THREE from 'three';
import { sectorGeometry } from '../render/geo.js';

const MAX = 24;

export class Hazards {
  constructor(game) {
    this.game = game;
    this.list = [];
    const disc = sectorGeometry(Math.PI * 2, 0, 28);
    const ring = new THREE.RingGeometry(0.94, 1, 40);
    ring.rotateX(-Math.PI / 2);
    for (let i = 0; i < MAX; i++) {
      const fill = new THREE.Mesh(disc, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.35, depthWrite: false }));
      const edge = new THREE.Mesh(ring, new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.8, depthWrite: false }));
      fill.visible = edge.visible = false;
      fill.renderOrder = edge.renderOrder = 3;
      game.scene.add(fill, edge);
      this.list.push({ fill, edge, live: false, x: 0, z: 0, r: 1, t: 0, total: 1, dmg: 0, color: 0 });
    }
    this.next = 0;
  }

  add(x, z, r, delay, dmg, color = 0xff3030) {
    const h = this.list[this.next];
    this.next = (this.next + 1) % MAX;
    h.live = true;
    h.x = x; h.z = z; h.r = r;
    h.t = h.total = delay;
    h.dmg = dmg;
    h.color = color;
    h.fill.material.color.setHex(color);
    h.edge.material.color.setHex(color);
    h.fill.position.set(x, 0.08, z);
    h.edge.position.set(x, 0.09, z);
    h.edge.scale.setScalar(r);
    h.fill.visible = h.edge.visible = true;
  }

  clear() {
    for (const h of this.list) {
      h.live = false;
      h.fill.visible = h.edge.visible = false;
    }
  }

  update(dt) {
    const game = this.game, P = game.player, army = game.army, D = army.deployed;
    for (const h of this.list) {
      if (!h.live) continue;
      h.t -= dt;
      const k = 1 - Math.max(0, h.t) / h.total;
      h.fill.scale.setScalar(Math.max(0.01, h.r * k));
      if (h.t > 0) continue;
      // boom
      const r2 = h.r * h.r;
      if (!P.dead) {
        const dx = P.x - h.x, dz = P.z - h.z;
        if (dx * dx + dz * dz < r2) P.damage(h.dmg);
      }
      for (let i = 0; i < D.length; i++) {
        const u = D[i];
        if (!army.targetable(u)) continue;
        const dx = u.x - h.x, dz = u.z - h.z;
        if (dx * dx + dz * dz < r2) army.damage(u.slot, h.dmg);
      }
      game.effects.slash(h.x, h.z, 0, h.r, 360, h.color);
      game.effects.burst(h.x, 0.4, h.z, 16, h.color, 7, 0.24, 0.5);
      h.live = false;
      h.fill.visible = h.edge.visible = false;
    }
  }
}
