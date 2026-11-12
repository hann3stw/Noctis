// Aim preview on the ground while the attack stick is dragged.
import * as THREE from 'three';
import { sectorGeometry } from './geo.js';

export class AimIndicator {
  constructor(scene) {
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(undefined, this.material);
    this.mesh.visible = false;
    this.mesh.renderOrder = 4;
    scene.add(this.mesh);
    this.cache = new Map();
    this.current = null;
  }

  setWeapon(w) {
    if (this.current === w) return;
    this.current = w;
    const key = w.shape + ':' + (w.arcDeg || 0);
    let geo = this.cache.get(key);
    if (!geo) {
      geo = sectorGeometry((w.arcDeg * Math.PI) / 180, 0.12, 18);
      this.cache.set(key, geo);
    }
    this.mesh.geometry = geo;
    this.mesh.scale.setScalar(w.range);
  }

  show(x, z, dirX, dirZ) {
    this.mesh.visible = true;
    this.mesh.position.set(x, 0.08, z);
    this.mesh.rotation.y = Math.atan2(dirX, dirZ);
  }

  hide() {
    this.mesh.visible = false;
  }
}
