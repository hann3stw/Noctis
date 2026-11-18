// Live 3D preview of the character for the skin editor. It draws into the
// shared game canvas while the editor is open; the editor panel leaves the
// left part of the screen free, and the camera is shifted so the character
// stands in the middle of that free part. The character can be turned by
// dragging. The preview always renders at the full resolution of the screen
// (the game itself may run at a lower one).
import * as THREE from 'three';
import { getRenderer, sizeRenderer, disposeScene } from '../render/renderer.js';
import { createPlayerModel } from '../render/models/player.js';

const IDLE = { moving: false, attack: 0, dodging: false, dead: false };
const SPIN = 0.5; // radians per second while nobody touches the character
const MAX_RATIO = 3;

export class Preview {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x120c22);
    this.scene.add(new THREE.HemisphereLight(0xd8d4ff, 0x2a2238, 1.5));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
    key.position.set(3, 6, 5);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x9ab0ff, 0.7);
    fill.position.set(-5, 2, 4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0x8a4dff, 1.8);
    rim.position.set(-4, 3, -5);
    this.scene.add(rim);

    // pedestal with two steps, a glowing ring and a soft shadow
    const stone = new THREE.MeshLambertMaterial({ color: 0x2a2140 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 48), stone);
    ped.position.y = -0.15;
    this.scene.add(ped);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.2, 48), new THREE.MeshLambertMaterial({ color: 0x1c1530 }));
    base.position.y = -0.4;
    this.scene.add(base);
    this.glow = new THREE.Mesh(
      new THREE.RingGeometry(1.3, 1.5, 64),
      new THREE.MeshBasicMaterial({ color: 0x8a4dff, transparent: true, opacity: 0.7 }),
    );
    this.glow.rotation.x = -Math.PI / 2;
    this.glow.position.y = 0.01;
    this.scene.add(this.glow);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.8, 32),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    this.scene.add(shadow);
    // a soft light in the aura colour behind the character
    // (a white glow that fades out to the edge, tinted with the aura colour)
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,255,255,0.85)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.4)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 256, 256);
    this.backTex = new THREE.CanvasTexture(cv);
    this.back = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 11),
      new THREE.MeshBasicMaterial({ color: 0x8a4dff, map: this.backTex, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    this.back.position.set(0, 1.6, -3.5);
    this.scene.add(this.back);

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    this.camera.position.set(0, 2.3, 8.2);
    this.camera.lookAt(0, 1.2, 0);

    this.focus = 0; // 0 = whole body, 1 = close on the head
    this.zoom = 0;
    this.model = null;
    this.yaw = 0.6;
    this.spin = SPIN; // current turning speed
    this.auto = true; // turns on its own until the player drags it
    this.dragging = false;
    this.running = false;
    this.anchor = null; // element whose centre the character should stand in
    this.last = 0;
    this.sized = '';
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
    this.back.material.color.setHex(appearance.aura);
  }

  // ---- turning by hand: dx = pixels the finger moved sideways -----------------
  dragStart() {
    this.dragging = true;
    this.auto = false;
    this.spin = 0;
  }

  dragMove(dx, dt) {
    const d = dx * 0.012;
    this.yaw += d;
    // remembered so the character keeps turning a little after letting go
    if (dt > 0) this.spin = this.spin * 0.5 + (d / dt) * 0.5;
  }

  dragEnd() {
    this.dragging = false;
    this.spin = Math.max(-4, Math.min(4, this.spin));
  }

  start(anchor) {
    this.anchor = anchor;
    this.auto = true;
    this.spin = SPIN;
    if (this.running) return;
    this.running = true;
    this.last = 0;
    this.sized = '';
    requestAnimationFrame(this.frame);
  }

  stop() {
    this.running = false;
    this.sized = '';
    sizeRenderer(); // back to the resolution of the graphics setting
  }

  dispose() {
    this.stop();
    disposeScene(this.scene);
    this.backTex.dispose();
  }

  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    if (!this.dragging) {
      this.yaw += this.spin * dt;
      if (!this.auto) this.spin *= Math.exp(-dt * 5); // comes to rest
    }
    if (this.model) {
      this.model.root.rotation.y = this.yaw;
      this.model.animate(dt, IDLE);
    }
    const r = getRenderer();
    const w = window.innerWidth, h = window.innerHeight;
    // full resolution, and at least 2x so edges are smooth on every screen
    const ratio = Math.min(MAX_RATIO, Math.max(2, window.devicePixelRatio || 1));
    const key = w + 'x' + h + '@' + ratio;
    if (key !== this.sized) {
      this.sized = key;
      r.setPixelRatio(ratio);
      r.setSize(w, h, false);
    }
    // put the character into the middle of the anchor element
    let cx = w * 0.25;
    if (this.anchor) {
      const b = this.anchor.getBoundingClientRect();
      if (b.width > 0) cx = b.left + b.width / 2;
    }
    this.zoom += (this.focus - this.zoom) * Math.min(1, dt * 6);
    const z = this.zoom;
    this.camera.position.set(0, 2.3 - z * 0.05, 8.2 - z * 3.7);
    this.camera.lookAt(0, 1.2 + z * 0.8, 0);
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, w / 2 - cx, 0, w, h);
    this.camera.updateProjectionMatrix();
    r.render(this.scene, this.camera);
  }
}
