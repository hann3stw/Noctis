// The target marked on the big map: a spot, an outpost or a gate. It is shown
// on the minimap (an arrow on the edge when it is out of view, with the
// distance) and in the world as a tall beam of light. It goes away when the
// hunter gets there, or when a marked gate closes. Saved with the world.
import * as THREE from 'three';
import { t } from '../strings.js';
import { play } from './sfx.js';

const REACHED = 12; // this close counts as there

export class Waypoint {
  constructor(game, saved) {
    this.game = game;
    this.m = null; // { kind: 'spot' | 'outpost' | 'gate', x, z, si?, gi?, gen? }
    if (saved && typeof saved.x === 'number') this.m = { ...saved };
    this.t = 0;
    // the beam: a thin glowing column and a ring on the ground
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Group();
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, 46, 10, 1, true), mat);
    col.position.y = 23;
    this.beam.add(col);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 32), mat.clone());
    ring.material.opacity = 0.6;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    this.beam.add(ring);
    this.beam.visible = false;
    game.scene.add(this.beam);
  }

  serialize() {
    return this.m ? { ...this.m } : null;
  }

  set(m) {
    this.m = m;
    this.t = 0;
    play('ui');
  }

  clear() {
    this.m = null;
    this.beam.visible = false;
  }

  is(kind, id) {
    const m = this.m;
    if (!m || m.kind !== kind) return false;
    return kind === 'outpost' ? m.si === id : kind === 'gate' ? m.gi === id : true;
  }

  // where the target is now (a gate can move when it opens somewhere else)
  pos() {
    const m = this.m;
    if (!m) return null;
    if (m.kind === 'gate') {
      const g = this.game.gates.list[m.gi];
      if (!g || !g.open || g.gen !== m.gen) return null;
      return { x: g.x, z: g.z };
    }
    return { x: m.x, z: m.z };
  }

  update(dt) {
    const game = this.game, P = game.player;
    const p = this.pos();
    this.beam.visible = !!p && game.gates.active < 0;
    if (p) {
      this.beam.position.set(p.x, 0, p.z);
      this.beam.children[1].scale.setScalar(1 + 0.12 * Math.sin(performance.now() / 300));
    }
    if ((this.t -= dt) > 0) return;
    this.t = 0.5;
    if (!this.m) return;
    if (!p) { // a marked gate closed or moved
      this.clear();
      game.hud.toast(t('map.markGone'));
      return;
    }
    if (game.gates.active < 0 && !P.dead && (P.x - p.x) ** 2 + (P.z - p.z) ** 2 < REACHED * REACHED) {
      this.clear();
      game.hud.toast(t('map.reached'));
      play('stage');
    }
  }

  dispose() {
    this.game.scene.remove(this.beam);
    this.beam.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }
}
