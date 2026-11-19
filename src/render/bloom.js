// Bloom for the glowing effects (graphics preset "ultra"): sparks, flares,
// slashes, rings, glowing runes and auras are drawn a second time on their
// own into a small image, blurred at three sizes and laid over the frame. The
// rest of the scene is not touched, so the hunter's silhouette behind trees
// (render/xray.js) keeps working. Glowing objects are found by their
// additive material (or userData.glow) and put on GLOW_LAYER.
import * as THREE from 'three';

export const GLOW_LAYER = 1;

const VERT = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

// 9 taps of a gaussian in one direction (linear sampling between texels)
const BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main() {
  vec4 c = texture2D(tex, vUv) * 0.2270270270;
  c += texture2D(tex, vUv + dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tex, vUv - dir * 1.3846153846) * 0.3162162162;
  c += texture2D(tex, vUv + dir * 3.2307692308) * 0.0702702703;
  c += texture2D(tex, vUv - dir * 3.2307692308) * 0.0702702703;
  gl_FragColor = c;
}`;

const MIX = `uniform sampler2D a; uniform sampler2D b; uniform sampler2D c; uniform float strength; varying vec2 vUv;
void main() {
  vec3 col = (texture2D(a, vUv).rgb * 0.8 + texture2D(b, vUv).rgb * 0.9 + texture2D(c, vUv).rgb * 1.0) * strength;
  // soft limit: small glows shine fully, many big ones never turn the screen white
  col = col / (1.0 + col * 0.9);
  gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
}`;

const target = () => new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });

export class Bloom {
  constructor(renderer, strength = 0.85) {
    this.r = renderer;
    this.src = target();
    this.lv = [target(), target(), target()]; // 1/2, 1/4, 1/8 of the screen
    this.tmp = [target(), target(), target()];
    this.blur = new THREE.ShaderMaterial({
      uniforms: { tex: { value: null }, dir: { value: new THREE.Vector2() } },
      vertexShader: VERT, fragmentShader: BLUR, depthTest: false, depthWrite: false,
    });
    this.mix = new THREE.ShaderMaterial({
      uniforms: { a: { value: this.lv[0].texture }, b: { value: this.lv[1].texture }, c: { value: this.lv[2].texture }, strength: { value: strength } },
      vertexShader: VERT, fragmentShader: MIX, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, transparent: true,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.blur);
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.w = 0; this.h = 0;
    this.scanT = 0;
    this._size = new THREE.Vector2();
    this._clear = new THREE.Color();
  }

  resize() {
    this.r.getDrawingBufferSize(this._size);
    const w = Math.max(2, this._size.x >> 1), h = Math.max(2, this._size.y >> 1);
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.src.setSize(w, h);
    for (let i = 0; i < 3; i++) {
      const lw = Math.max(1, w >> i), lh = Math.max(1, h >> i);
      this.lv[i].setSize(lw, lh);
      this.tmp[i].setSize(lw, lh);
    }
  }

  // every glowing object joins the glow layer (checked once a second, new
  // effects and equipment are caught that way)
  scan(scene) {
    scene.traverse((o) => {
      const m = o.material;
      if (!m || Array.isArray(m)) return;
      if (m.blending === THREE.AdditiveBlending || o.userData.glow || m.userData.glow) o.layers.enable(GLOW_LAYER);
    });
  }

  pass(tex, dx, dy, out) {
    this.blur.uniforms.tex.value = tex;
    this.blur.uniforms.dir.value.set(dx, dy);
    this.r.setRenderTarget(out);
    this.r.render(this.scene, this.cam);
  }

  render(scene, camera, dt) {
    const r = this.r;
    this.resize();
    this.scanT -= dt;
    if (this.scanT <= 0) { this.scanT = 1; this.scan(scene); }

    const ac = r.autoClear, sh = r.shadowMap.autoUpdate, alpha = r.getClearAlpha();
    r.getClearColor(this._clear);
    const bg = scene.background, mask = camera.layers.mask;
    r.autoClear = true;
    r.shadowMap.autoUpdate = false; // the shadows of this frame are done already
    r.setClearColor(0x000000, 1);
    scene.background = null;

    // 1. only the glowing things, half size
    camera.layers.set(GLOW_LAYER);
    r.setRenderTarget(this.src);
    r.render(scene, camera);
    camera.layers.mask = mask;
    scene.background = bg;

    // 2. blur at three sizes (each one starts from the one before)
    this.quad.material = this.blur;
    let input = this.src.texture;
    for (let i = 0; i < 3; i++) {
      const w = this.lv[i].width, h = this.lv[i].height;
      this.pass(input, 1 / w, 0, this.tmp[i]);
      this.pass(this.tmp[i].texture, 0, 1 / h, this.lv[i]);
      input = this.lv[i].texture;
    }

    // 3. laid over the finished frame
    r.setRenderTarget(null);
    r.autoClear = false;
    this.quad.material = this.mix;
    r.render(this.scene, this.cam);

    r.autoClear = ac;
    r.shadowMap.autoUpdate = sh;
    r.setClearColor(this._clear, alpha);
  }

  dispose() {
    for (const t of [this.src, ...this.lv, ...this.tmp]) t.dispose();
    this.blur.dispose();
    this.mix.dispose();
    this.quad.geometry.dispose();
  }
}
