// 3D hunters on the world cards of the Worlds screen: one small scene per
// world (the pedestal scene of the skin editor), each drawn into the area of
// its card (".wc-stage") of the shared game canvas. The rest of the canvas is
// cleared to the dark page colour; the page itself is see-through there.
import { getRenderer, sizeRenderer } from '../render/renderer.js';
import { Preview } from './preview.js';
import { CONFIG } from '../config.js';

const IDLE = { moving: false, attack: 0, dodging: false, dead: false };
const MAX_RATIO = 2.5;

export class WorldStages {
  constructor() {
    this.stages = []; // { preview, el }
    this.running = false;
    this.last = 0;
    this.sized = '';
    this.frame = this.frame.bind(this);
  }

  // saves: one per card (null = no character); els: the stage elements
  set(saves, els) {
    this.clear();
    this.sized = ''; // dispose() of a preview resets the canvas size
    saves.forEach((s, i) => {
      if (!s || !els[i]) return;
      const p = new Preview();
      p.yaw = 0.35 + i * 0.5;
      p.cls = s.mainClass || '';
      p.setLook({ ...CONFIG.defaultAppearance, ...(s.appearance || {}) }, (s.player && s.player.equip) || null);
      // a little closer than in the editor: the cards are small
      p.camera.position.set(0, 1.9, 6.3);
      p.camera.lookAt(0, 1.05, 0);
      this.stages.push({ preview: p, el: els[i], slot: i });
    });
    if (!this.running) {
      this.running = true;
      this.last = 0;
      this.sized = '';
      requestAnimationFrame(this.frame);
    }
  }

  // the stage elements were drawn again (same order)
  rebind(els) {
    for (const st of this.stages) st.el = els[st.slot] || null;
  }

  clear() {
    for (const st of this.stages) st.preview.dispose();
    this.stages = [];
  }

  stop() {
    this.clear();
    if (!this.running) return;
    this.running = false;
    sizeRenderer(); // back to the resolution of the graphics setting
  }

  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    const r = getRenderer();
    const w = window.innerWidth, h = window.innerHeight;
    const ratio = Math.min(MAX_RATIO, Math.max(2, window.devicePixelRatio || 1));
    const key = w + 'x' + h + '@' + ratio;
    if (key !== this.sized) {
      this.sized = key;
      r.setPixelRatio(ratio);
      r.setSize(w, h, false);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
    r.setClearColor(0x120a10, 1);
    r.clear();
    r.setScissorTest(true);
    for (const st of this.stages) {
      const p = st.preview;
      p.yaw += 0.45 * dt;
      if (p.model) {
        p.model.root.rotation.y = p.yaw;
        p.model.animate(dt, IDLE);
      }
      if (!st.el || !st.el.isConnected) continue;
      const b = st.el.getBoundingClientRect();
      if (b.width < 4 || b.height < 4 || b.bottom < 0 || b.top > h) continue;
      const y = h - b.bottom;
      r.setViewport(b.left, y, b.width, b.height);
      r.setScissor(b.left, y, b.width, b.height);
      p.camera.aspect = b.width / b.height;
      p.camera.clearViewOffset();
      p.camera.updateProjectionMatrix();
      r.render(p.scene, p.camera);
    }
    r.setScissorTest(false);
    r.setViewport(0, 0, w, h);
  }
}
