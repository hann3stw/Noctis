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
    this.zone = new Uint8Array(MAX_SOULS);
    this.level = new Uint16Array(MAX_SOULS); // level of the enemy (with its tier)
    this.plv = new Uint16Array(MAX_SOULS); // level its power comes from (shadows get the same)
    this.tries = new Uint8Array(MAX_SOULS); // arise tries left
    this.gate = new Uint8Array(MAX_SOULS); // 1 = fell inside a gate (easier to raise)
    this.phase = new Float32Array(MAX_SOULS);
    this.next = 0;
    this.time = 0;

    // a dark core with a faint glowing shell: souls look nothing like the
    // bright item drops
    const geo = new THREE.OctahedronGeometry(0.34, 0);
    this.mesh = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true, opacity: 0.92, depthWrite: false }),
      MAX_SOULS,
    );
    this.glow = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(), transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.BackSide }),
      MAX_SOULS,
    );
    this.glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.glow.frustumCulled = false;
    this.glow.count = 0;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const a = this.mesh.instanceMatrix.array;
    for (let i = 0; i < MAX_SOULS; i++) a[i * 16 + 15] = 1;
    game.scene.add(this.mesh);
    game.scene.add(this.glow);
    this.setAura(game.appearance.aura);
  }

  setAura(hex) {
    this.mesh.material.color.setHex(hex).multiplyScalar(0.035); // nearly black, a hint of the aura
    this.glow.material.color.setHex(hex);
    this.particle = new THREE.Color(hex).lerp(new THREE.Color(0x000000), 0.45).getHex();
  }

  spawn(x, z, type, tier, zone = 0, level = 1, gate = false, plv = level) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_SOULS;
    this.life[i] = CONFIG.souls.duration + tier * CONFIG.souls.tierDuration;
    this.zone[i] = zone;
    this.level[i] = level;
    this.plv[i] = plv;
    this.gate[i] = gate ? 1 : 0;
    this.tries[i] = CONFIG.arise.tries;
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
      if (Math.random() < dt * 5) fx.burst(this.x[i], 0.3, this.z[i], 1, this.particle, 0.8, 0.12, 0.7);
    }
    this.mesh.count = n;
    this.glow.count = n;
    // the shell: same places, 1.45x larger
    const g = this.glow.instanceMatrix.array;
    for (let k = 0; k < n * 16; k += 16) {
      g[k] = a[k] * 1.45; g[k + 5] = a[k + 5] * 1.45; g[k + 10] = a[k + 10] * 1.45; g[k + 15] = 1;
      g[k + 12] = a[k + 12]; g[k + 13] = a[k + 13]; g[k + 14] = a[k + 14];
    }
    this.glow.instanceMatrix.needsUpdate = true;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
