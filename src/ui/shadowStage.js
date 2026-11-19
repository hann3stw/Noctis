// 3D view of the shadow selected in the army tab. It has its own small
// renderer and canvas inside the panel (the game canvas is not touched), so
// it also works while the game is paused. The shadow turns slowly and can be
// turned by dragging. The renderer is only alive while the panel is shown:
// once the army tab is left or the menu closes, it frees its GPU memory.
import * as THREE from 'three';
import { buildShadowGeometry } from '../render/models/enemies.js';

const SPIN = 0.55; // radians per second while nobody touches it
const HEIGHT = 2.7; // every shadow is scaled to about this height
const FOV = 30;
const GONE_FRAMES = 20; // frames without the panel before the renderer is freed

export class ShadowStage {
  constructor() {
    this.host = null; // element the canvas sits in
    this.r = null;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.model = null; // group with the body and its outline
    this.key = '';
    this.look = null;
    this.yaw = 0.6;
    this.spin = SPIN;
    this.auto = true;
    this.dragging = false;
    this.running = false;
    this.last = 0;
    this.gone = 0;
    this.sized = '';
    this.time = 0;
    this.frame = this.frame.bind(this);
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
  }

  // look: { id, tint: [r, g, b], aura, rankHex, glow (0 = no outline) }
  show(host, look) {
    this.host = host;
    this.look = look;
    if (!this.ensure()) return false;
    if (this.canvas.parentNode !== host) host.appendChild(this.canvas);
    const key = JSON.stringify(look);
    if (key !== this.key) { this.key = key; this.build(); }
    this.gone = 0;
    if (!this.running) {
      this.running = true;
      this.last = 0;
      requestAnimationFrame(this.frame);
    }
    return true;
  }

  hide() {
    this.running = false;
    this.free();
  }

  // ---- renderer and scene ------------------------------------------------------
  ensure() {
    if (this.r) return true;
    try {
      this.canvas = document.createElement('canvas');
      this.canvas.className = 'ap-canvas';
      this.r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
    } catch (_) {
      this.r = null;
      this.canvas = null;
      return false;
    }
    this.r.setClearColor(0x000000, 0);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xd8d4ff, 0x2a2238, 1.6));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
    key.position.set(3, 6, 5);
    const fill = new THREE.DirectionalLight(0x9ab0ff, 0.8);
    fill.position.set(-5, 2, 4);
    const rim = new THREE.DirectionalLight(0xffffff, 2.4);
    rim.position.set(-4, 3, -5);
    this.scene.add(key, fill, rim);
    // pedestal, a glowing ring and a soft light behind (the shadow itself is almost black)
    const stone = new THREE.MeshLambertMaterial({ color: 0x2a2140 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.3, 40), stone);
    ped.position.y = -0.15;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.2, 40), new THREE.MeshLambertMaterial({ color: 0x1c1530 }));
    base.position.y = -0.4;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.5, 56), new THREE.MeshBasicMaterial({ color: 0x8a4dff, transparent: true, opacity: 0.75 }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.01;
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,0.9)');
    gr.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    gr.addColorStop(0.75, 'rgba(255,255,255,0.1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr;
    cx.fillRect(0, 0, 128, 128);
    this.backTex = new THREE.CanvasTexture(cv);
    this.back = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({ color: 0x8a4dff, map: this.backTex, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    this.back.position.set(0, 1.5, -3);
    this.scene.add(ped, base, this.ring, this.back);
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.sized = '';
    return true;
  }

  // the shadow: the near-black body (tinted by the army's aura colour) and,
  // for knights and officers, the glowing outline of their rank
  build() {
    if (this.model) {
      this.scene.remove(this.model);
      this.model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      this.model = null;
    }
    const L = this.look;
    const geo = buildShadowGeometry(L.id);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    mat.color.setRGB(L.tint[0] * 2.6, L.tint[1] * 2.6, L.tint[2] * 2.6); // brighter than in the field, so the shape reads
    mat.emissive.setRGB(L.tint[0] * 0.07, L.tint[1] * 0.07, L.tint[2] * 0.07);
    const body = new THREE.Mesh(geo, mat);
    const grp = new THREE.Group();
    grp.add(body);
    if (L.glow > 0) {
      const gm = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      gm.color.setHex(L.rankHex).multiplyScalar(L.glow);
      const out = new THREE.Mesh(geo.clone(), gm);
      out.scale.setScalar(1.1);
      out.position.y = -0.04;
      grp.add(out);
    }
    // scale it to the same height and put it on the floor
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const h = Math.max(0.1, bb.max.y - bb.min.y), w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    const k = Math.min(HEIGHT / h, 2.6 / w);
    grp.scale.setScalar(k);
    grp.position.y = -bb.min.y * k;
    this.height = h * k;
    this.model = new THREE.Group();
    this.model.add(grp);
    this.model.rotation.y = this.yaw;
    this.scene.add(this.model);
    const aura = L.aura;
    this.ring.material.color.setHex(aura);
    this.back.material.color.setHex(aura);
  }

  // ---- turning by hand ----------------------------------------------------------
  onDown(e) {
    this.dragging = true;
    this.auto = false;
    this.spin = 0;
    this.lastX = e.clientX;
    this.lastT = performance.now();
    try { this.canvas.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
  }

  onMove(e) {
    if (!this.dragging) return;
    const now = performance.now(), d = (e.clientX - this.lastX) * 0.012, dt = (now - this.lastT) / 1000;
    this.yaw += d;
    if (dt > 0) this.spin = this.spin * 0.5 + (d / dt) * 0.5;
    this.lastX = e.clientX;
    this.lastT = now;
  }

  onUp() {
    this.dragging = false;
    this.spin = Math.max(-4, Math.min(4, this.spin));
  }

  // ---- drawing ---------------------------------------------------------------------
  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const host = this.host;
    // the panel is gone (other tab, menu closed): wait a moment, then free everything
    if (!host || !host.isConnected || !host.offsetParent || !host.clientWidth) {
      if (++this.gone > GONE_FRAMES) { this.running = false; this.free(); }
      return;
    }
    this.gone = 0;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.time += dt;
    if (!this.dragging) {
      this.yaw += this.spin * dt;
      if (!this.auto) this.spin *= Math.exp(-dt * 4);
      if (!this.auto && Math.abs(this.spin) < SPIN * 0.5) this.auto = true; // slowly goes on turning by itself
      if (this.auto) this.spin += (SPIN - this.spin) * Math.min(1, dt * 2);
    }
    if (this.model) {
      this.model.rotation.y = this.yaw;
      this.model.position.y = Math.sin(this.time * 1.6) * 0.04; // breathes a little
    }
    const w = host.clientWidth, h = host.clientHeight;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const key = w + 'x' + h + '@' + ratio;
    if (key !== this.sized) {
      this.sized = key;
      this.r.setPixelRatio(ratio);
      this.r.setSize(w, h, false);
      this.camera.aspect = w / h;
    }
    // the whole shadow and its pedestal fit, tall or wide
    const hh = Math.max(this.height || HEIGHT, 1) + 0.9;
    const tan = Math.tan((FOV * Math.PI) / 360);
    const dist = Math.max(hh / (2 * tan), 3.4 / (2 * tan * this.camera.aspect)) * 1.02;
    this.camera.position.set(0, hh * 0.5 + 0.5, dist);
    this.camera.lookAt(0, hh * 0.5 - 0.3, 0);
    this.camera.updateProjectionMatrix();
    this.r.render(this.scene, this.camera);
  }

  // frees the GPU memory (the canvas cannot be used again afterwards)
  free() {
    if (!this.r) return;
    if (this.model) {
      this.model.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
      this.model = null;
    }
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const m = o.material;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else if (m) m.dispose();
    });
    this.backTex.dispose();
    this.r.dispose();
    this.r.forceContextLoss();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
    this.r = null;
    this.canvas = null;
    this.scene = null;
    this.key = '';
    this.sized = '';
  }
}
