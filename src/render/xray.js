// The hunter stays visible behind trees, tents and rocks: after the normal
// frame the player model is drawn a second time as a soft glowing silhouette,
// but only where something stands in front of it. The model marks its own
// visible pixels in the stencil buffer, so the silhouette never tints the
// parts of the hunter that can already be seen.
import * as THREE from 'three';

export class Xray {
  constructor(renderer, color = 0xb89cff) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();
    this.scene.overrideMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      depthFunc: THREE.GreaterDepth, // only behind something
      stencilWrite: true, // turns the stencil test on
      stencilRef: 1,
      stencilFunc: THREE.NotEqualStencilFunc, // not where the hunter is visible
      stencilZPass: THREE.KeepStencilOp,
    });
    this.hidden = [];
  }

  // marks every body part so the normal frame writes the stencil (cheap: a
  // few dozen objects, new gear is caught on the next frame)
  mark(root) {
    root.traverse((o) => {
      const m = o.material;
      if (!m || m.stencilWrite) return;
      m.stencilWrite = true;
      m.stencilRef = 1;
      m.stencilFunc = THREE.AlwaysStencilFunc;
      m.stencilZPass = THREE.ReplaceStencilOp;
    });
  }

  render(root, scene, camera) {
    if (!root || !root.visible) return;
    this.mark(root);
    // glows and the ground ring stay out of the silhouette
    const hidden = this.hidden;
    hidden.length = 0;
    root.traverse((o) => {
      if (o.visible && o.material && o.material.transparent) { o.visible = false; hidden.push(o); }
    });
    const r = this.renderer, ac = r.autoClear;
    r.autoClear = false;
    this.scene.add(root);
    r.render(this.scene, camera);
    scene.add(root);
    r.autoClear = ac;
    for (let i = 0; i < hidden.length; i++) hidden[i].visible = true;
  }
}
