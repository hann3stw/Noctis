// Pooled homing bolts fired by ranged shadows. Each bolt follows one enemy
// and deals its damage on arrival.
import * as THREE from 'three';
import { playerHit } from './weapons.js';

const MAX = 64;

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.live = new Uint8Array(MAX);
    this.x = new Float32Array(MAX);
    this.z = new Float32Array(MAX);
    this.target = new Int16Array(MAX);
    this.speed = new Float32Array(MAX);
    this.dmg = new Float32Array(MAX);
    this.src = new Int16Array(MAX);
    this.next = 0;

    // straight shots of the player (bow): fly along a direction, hit the first enemy
    this.sLive = new Uint8Array(MAX);
    this.sx = new Float32Array(MAX);
    this.sz = new Float32Array(MAX);
    this.sdx = new Float32Array(MAX);
    this.sdz = new Float32Array(MAX);
    this.sSpeed = new Float32Array(MAX);
    this.sLeft = new Float32Array(MAX);
    this.sDmg = new Float32Array(MAX);
    this.sRad = new Float32Array(MAX);
    this.sNext = 0;

    this.mesh = new THREE.InstancedMesh(
      new THREE.OctahedronGeometry(0.22, 0),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(game.appearance.aura).lerp(new THREE.Color(0xffffff), 0.5) }),
      MAX * 2,
    );
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const a = this.mesh.instanceMatrix.array;
    for (let i = 0; i < MAX * 2; i++) { a[i * 16] = 1; a[i * 16 + 5] = 1; a[i * 16 + 10] = 2.2; a[i * 16 + 15] = 1; }
    game.scene.add(this.mesh);
  }

  setAura(hex) {
    this.mesh.material.color.setHex(hex).lerp(new THREE.Color(0xffffff), 0.5);
  }

  fire(x, z, target, speed, dmg, src) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.live[i] = 1;
    this.x[i] = x;
    this.z[i] = z;
    this.target[i] = target;
    this.speed[i] = speed;
    this.dmg[i] = dmg;
    this.src[i] = src;
  }

  shoot(x, z, dx, dz, speed, range, dmg, width) {
    const i = this.sNext;
    this.sNext = (this.sNext + 1) % MAX;
    this.sLive[i] = 1;
    this.sx[i] = x;
    this.sz[i] = z;
    this.sdx[i] = dx;
    this.sdz[i] = dz;
    this.sSpeed[i] = speed;
    this.sLeft[i] = range;
    this.sDmg[i] = dmg;
    this.sRad[i] = width * 0.5;
  }

  update(dt) {
    const E = this.game.enemies;
    const a = this.mesh.instanceMatrix.array;
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      if (!this.live[i]) continue;
      const t = this.target[i];
      if (!E.alive[t]) { this.live[i] = 0; continue; }
      let dx = E.x[t] - this.x[i], dz = E.z[t] - this.z[i];
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      dx /= d; dz /= d;
      const step = this.speed[i] * dt;
      if (d <= step + E.radius[t]) {
        this.live[i] = 0;
        E.damage(t, this.dmg[i], dx, dz, this.src[i]);
        continue;
      }
      this.x[i] += dx * step;
      this.z[i] += dz * step;
      const o = n++ * 16;
      // stretched along the flight direction
      a[o] = dz; a[o + 2] = -dx;
      a[o + 8] = dx * 2.2; a[o + 10] = dz * 2.2;
      a[o + 12] = this.x[i]; a[o + 13] = 1.1; a[o + 14] = this.z[i];
    }

    for (let i = 0; i < MAX; i++) {
      if (!this.sLive[i]) continue;
      const step = this.sSpeed[i] * dt;
      const dx = this.sdx[i], dz = this.sdz[i];
      this.sx[i] += dx * step;
      this.sz[i] += dz * step;
      this.sLeft[i] -= step;
      let hit = -1;
      for (let k = 0; k < E.activeCount; k++) {
        const e = E.active[k];
        if (!E.alive[e]) continue;
        const ex = E.x[e] - this.sx[i], ez = E.z[e] - this.sz[i];
        const r = E.radius[e] + this.sRad[i] + step * 0.5;
        if (ex * ex + ez * ez < r * r) { hit = e; break; }
      }
      if (hit >= 0) {
        playerHit(this.game, hit, this.sDmg[i], dx, dz);
        this.sLive[i] = 0;
        continue;
      }
      if (this.sLeft[i] <= 0) { this.sLive[i] = 0; continue; }
      const o = n++ * 16;
      a[o] = dz; a[o + 2] = -dx;
      a[o + 8] = dx * 5; a[o + 10] = dz * 5;
      a[o + 12] = this.sx[i]; a[o + 13] = 1.2; a[o + 14] = this.sz[i];
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
