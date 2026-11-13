// Souls left behind by defeated enemies. A soul can be raised as a shadow
// while the player stands close to it. Fixed pool, one InstancedMesh.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const MAX_SOULS = 48;

export class Souls {
  constructor(game) {
    this.game = game;
    this.life = new Float32Array(MAX_SOULS);
    this.x = new Float32Array(MAX_SOULS);
    this.z = new Float32Array(MAX_SOULS);
    this.type = new Uint8Array(MAX_SOULS); // enemy type index
    this.tier = new Uint8Array(MAX_SOULS);
    this.phase = new Float32Array(MAX_SOULS);
    this.next = 0;
    this.time = 0;

    const color = new THREE.Color(game.appearance.aura).lerp(new THREE.Color(0xffffff), 0.45);
    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.34, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
      MAX_SOULS,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const a = this.mesh.instanceMatrix.array;
    for (let i = 0; i < MAX_SOULS; i++) a[i * 16 + 15] = 1;
    game.scene.add(this.mesh);
  }

  spawn(x, z, type, tier) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_SOULS;
    this.life[i] = CONFIG.souls.duration;
    this.x[i] = x;
    this.z[i] = z;
    this.type[i] = type;
    this.tier[i] = tier;
    this.phase[i] = Math.random() * 6.28;
  }

  // nearest soul within range, -1 if there is none
  nearest(x, z, range) {
    let best = -1, bd = range * range;
    for (let i = 0; i < MAX_SOULS; i++) {
      if (this.life[i] <= 0) continue;
      const dx = this.x[i] - x, dz = this.z[i] - z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = i; }
    }
    return best;
  }

  remove(i) {
    this.life[i] = 0;
  }

  update(dt) {
    this.time += dt;
    const a = this.mesh.instanceMatrix.array;
    const fx = this.game.effects;
    let n = 0;
    for (let i = 0; i < MAX_SOULS; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) continue;
      const fade = this.life[i] < 1.5 ? this.life[i] / 1.5 : 1;
      const s = (1 + this.tier[i] * 0.5) * fade * (1 + Math.sin(this.time * 6 + this.phase[i]) * 0.12);
      const o = n++ * 16;
      a[o] = s; a[o + 5] = s * 1.5; a[o + 10] = s;
      a[o + 12] = this.x[i];
      a[o + 13] = 1.1 + Math.sin(this.time * 2.4 + this.phase[i]) * 0.22;
      a[o + 14] = this.z[i];
      if (Math.random() < dt * 5) fx.burst(this.x[i], 0.3, this.z[i], 1, 0x8a4dff, 0.8, 0.12, 0.7);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
