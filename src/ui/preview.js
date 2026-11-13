// Live 3D preview of the character for the skin editor. It draws into the
// shared game canvas while the editor is open; the editor panel leaves the
// left part of the screen free, and the camera is shifted so the character
// stands in the middle of that free part.
import * as THREE from 'three';
import { getRenderer, sizeRenderer, disposeScene } from '../render/renderer.js';
import { createPlayerModel } from '../render/models/player.js';

const IDLE = { moving: false, attack: 0, dodging: false, dead: false };

export class Preview {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120c22);
    this.scene.add(new THREE.HemisphereLight(0xc9c4ff, 0x2a2238, 1.6));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.0);
    key.position.set(3, 6, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8a4dff, 1.6);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);

    // pedestal
    const ped = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.7, 0.3, 32),
      new THREE.MeshLambertMaterial({ color: 0x2a2140 }),
    );
    ped.position.y = -0.15;
    this.scene.add(ped);
    this.glow = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.5, 40),
      new THREE.MeshBasicMaterial({ color: 0x8a4dff, transparent: true, opacity: 0.7 }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.01;
    this.scene.add(this.glow);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 2.6, 9.6);
    this.camera.lookAt(0, 1.05, 0);

    this.model = null;
    this.yaw = 0.6;
    this.running = false;
    this.anchor = null; // element whose centre the character should stand in
    this.last = 0;
    this.frame = this.frame.bind(this);
  }

  // Rebuilds the character with a new look and the given equipment.
  setLook(appearance, equip) {
    if (this.model) {
      this.scene.remove(this.model.root);
      this.model.root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.model = createPlayerModel(appearance);
    if (equip) this.model.setEquipment(equip);
    this.model.root.rotation.y = this.yaw;
    this.scene.add(this.model.root);
    this.glow.material.color.setHex(appearance.aura);
  }

  start(anchor) {
    this.anchor = anchor;
    if (this.running) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
  }

  dispose() {
    this.stop();
    disposeScene(this.scene);
  }

  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.yaw += dt * 0.6;
    if (this.model) {
      this.model.root.rotation.y = this.yaw;
      this.model.animate(dt, IDLE);
    }
    const r = getRenderer();
    sizeRenderer();
    const w = window.innerWidth, h = window.innerHeight;
    // put the character into the middle of the anchor element
    let cx = w * 0.25;
    if (this.anchor) {
      const b = this.anchor.getBoundingClientRect();
      if (b.width > 0) cx = b.left + b.width / 2;
    }
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, w / 2 - cx, 0, w, h);
    this.camera.updateProjectionMatrix();
    r.render(this.scene, this.camera);
  }
}
