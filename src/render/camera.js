// Fixed, angled top-down camera that follows the player. It never rotates.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class FollowCamera {
  constructor() {
    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 16 / 9, 1, 260);
    this.tx = 0;
    this.tz = 0;
    this.camera.position.set(0, c.height, c.back);
    this.camera.lookAt(0, 1, -1);
    this.camera.updateMatrixWorld();
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  snap(x, z) {
    this.tx = x;
    this.tz = z;
    this.apply();
  }

  update(dt, x, z) {
    const k = 1 - Math.exp(-CONFIG.camera.followSpeed * dt);
    this.tx += (x - this.tx) * k;
    this.tz += (z - this.tz) * k;
    this.apply();
  }

  apply() {
    const c = CONFIG.camera;
    this.camera.position.set(this.tx, c.height, this.tz + c.back);
    this.camera.updateMatrixWorld();
  }
}
