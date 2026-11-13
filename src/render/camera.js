// Fixed, angled top-down camera that follows the player. It never rotates.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

export class FollowCamera {
  constructor() {
    const c = CONFIG.camera;
    this.camera = new THREE.PerspectiveCamera(c.fov, 16 / 9, 1, 260);
    this.tx = 0;
    this.tz = 0;
    this.shakeAmp = 0; // current shake strength (world units)
    this.shakeT = 0;
    this.shakeDur = 1;
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
    this.apply(dt);
  }

  // a short shake (strength in world units); a weaker one never cuts a stronger one short
  shake(strength, duration = 0.25) {
    const cur = this.shakeT > 0 ? this.shakeAmp * (this.shakeT / this.shakeDur) : 0;
    if (strength < cur) return;
    this.shakeAmp = strength;
    this.shakeT = duration;
    this.shakeDur = duration;
  }

  apply(dt = 0) {
    const c = CONFIG.camera;
    let ox = 0, oy = 0;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const a = this.shakeAmp * Math.max(0, this.shakeT / this.shakeDur);
      ox = (Math.random() * 2 - 1) * a;
      oy = (Math.random() * 2 - 1) * a;
    }
    this.camera.position.set(this.tx + ox, c.height + oy, this.tz + c.back);
    this.camera.updateMatrixWorld();
  }
}
