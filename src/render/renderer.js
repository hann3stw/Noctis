// One WebGL renderer for the whole app: the game and the skin editor preview
// both draw into the same canvas.
import * as THREE from 'three';
import { gfx } from '../core/settings.js';

let renderer = null;

export function getRenderer() {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('game'),
      antialias: true,
      powerPreference: 'high-performance',
    });
  }
  return renderer;
}

export function sizeRenderer() {
  const r = getRenderer();
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, gfx.pixelRatio));
  r.setSize(window.innerWidth, window.innerHeight, false);
}

// Frees the GPU memory of everything in a scene (used when leaving a world).
export function disposeScene(scene) {
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else if (m) m.dispose();
  });
  scene.clear();
}
