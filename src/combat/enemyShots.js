// Pooled shots of enemies and bosses. They fly straight and hit the player or
// the first shadow they touch. Dodging (invulnerability) lets them pass.
import * as THREE from 'three';

const MAX = 160;
const _c = new THREE.Color();

export class EnemyShots {
  constructor(game) {
    this.game = game;
    this.live = new Uint8Array(MAX);
    this.x = new Float32Array(MAX);
    this.z = new Float32Array(MAX);
    this.dx = new Float32Array(MAX);
    this.dz = new Float32Array(MAX);
    this.speed = new Float32Array(MAX);
    this.left = new Float32Array(MAX); // distance left
    this.dmg = new Float32Array(MAX);
    this.r = new Float32Array(MAX);
    this.color = new Uint32Array(MAX);
    this.next = 0;

    this.mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial(), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    const a = this.mesh.instanceMatrix.array;
    for (let i = 0; i < MAX; i++) a[i * 16 + 15] = 1;
    game.scene.add(this.mesh);
  }

  fire(x, z, dx, dz, speed, dmg, color, range, radius) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.live[i] = 1;
    this.x[i] = x + dx * 0.8;
    this.z[i] = z + dz * 0.8;
    this.dx[i] = dx;
    this.dz[i] = dz;
    this.speed[i] = speed;
    this.left[i] = range;
    this.dmg[i] = dmg;
    this.r[i] = radius;
    this.color[i] = color;
  }

  clear() {
    this.live.fill(0);
  }

  update(dt) {
    const game = this.game, P = game.player, army = game.army, D = army.deployed;
    const a = this.mesh.instanceMatrix.array, col = this.mesh.instanceColor.array;
    let n = 0;
    for (let i = 0; i < MAX; i++) {
      if (!this.live[i]) continue;
      const step = this.speed[i] * dt;
      this.x[i] += this.dx[i] * step;
      this.z[i] += this.dz[i] * step;
      this.left[i] -= step;
      if (this.left[i] <= 0) { this.live[i] = 0; continue; }
      const x = this.x[i], z = this.z[i], r = this.r[i];
      // the player
      if (!P.dead) {
        const ddx = P.x - x, ddz = P.z - z, m = r + P.radius;
        if (ddx * ddx + ddz * ddz < m * m && P.invuln <= 0) {
          P.damage(this.dmg[i]);
          this.pop(i);
          continue;
        }
      }
      // shadows
      let hit = false;
      for (let k = 0; k < D.length; k++) {
        const u = D[k];
        if (!army.targetable(u)) continue;
        const ddx = u.x - x, ddz = u.z - z, m = r + u.radius;
        if (ddx * ddx + ddz * ddz < m * m) {
          army.damage(u.slot, this.dmg[i]);
          hit = true;
          break;
        }
      }
      if (hit) { this.pop(i); continue; }

      const o = n * 16, s = r * 1.1;
      a[o] = s; a[o + 5] = s; a[o + 10] = s;
      a[o + 12] = x; a[o + 13] = 1.1; a[o + 14] = z;
      _c.setHex(this.color[i]);
      col[n * 3] = _c.r * 1.6; col[n * 3 + 1] = _c.g * 1.6; col[n * 3 + 2] = _c.b * 1.6;
      n++;
    }
    this.mesh.count = n;
    this.mesh.visible = n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  pop(i) {
    this.live[i] = 0;
    this.game.effects.burst(this.x[i], 1.1, this.z[i], 5, this.color[i], 3, 0.14, 0.3);
  }
}
