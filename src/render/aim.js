// Aim preview on the ground while an attack, skill or ultimate stick is dragged.
// Shapes: arc (cone in front), circle (around the player), line (shot),
// point (area at a distance, with a thin line towards it).
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
    this.cache = new Map();
    this.sector = new THREE.Mesh(undefined, this.material);
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    quad.translate(0, 0, 0.5); // starts at the origin, points towards +Z
    this.line = new THREE.Mesh(quad, this.material);
    for (const m of [this.sector, this.line]) {
      m.visible = false;
      m.renderOrder = 4;
      scene.add(m);
    }
  }

  geo(arcDeg) {
    let g = this.cache.get(arcDeg);
    if (!g) {
      g = sectorGeometry((arcDeg * Math.PI) / 180, arcDeg >= 360 ? 0 : 0.12, arcDeg >= 360 ? 28 : 18);
      this.cache.set(arcDeg, g);
    }
    return g;
  }

  // shape: 'arc' | 'circle' | 'line' | 'point'; power = 0..1 for 'point'
  show(shape, x, z, dx, dz, power, range, arcDeg, width, radius) {
    const yaw = Math.atan2(dx, dz);
    this.sector.visible = shape !== 'line';
    this.line.visible = shape === 'line' || shape === 'point';
    if (shape === 'arc') {
      this.sector.geometry = this.geo(arcDeg);
      this.sector.position.set(x, 0.08, z);
      this.sector.rotation.y = yaw;
      this.sector.scale.setScalar(range);
    } else if (shape === 'circle') {
      this.sector.geometry = this.geo(360);
      this.sector.position.set(x, 0.08, z);
      this.sector.scale.setScalar(radius);
    } else if (shape === 'line') {
      this.line.position.set(x, 0.08, z);
      this.line.rotation.y = yaw;
      this.line.scale.set(width, 1, range);
    } else {
      const d = range * Math.max(0.15, power);
      this.sector.geometry = this.geo(360);
      this.sector.position.set(x + dx * d, 0.08, z + dz * d);
      this.sector.scale.setScalar(radius);
      this.line.position.set(x, 0.08, z);
      this.line.rotation.y = yaw;
      this.line.scale.set(0.15, 1, Math.max(0.1, d - radius));
    }
  }

  hide() {
    this.sector.visible = false;
    this.line.visible = false;
  }
}
