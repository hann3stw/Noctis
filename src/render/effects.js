// Pooled visual effects: particles, slash arcs, blob shadows, health bars and
// floating damage numbers. Nothing here allocates while the game is running.
import * as THREE from 'three';
import { sectorGeometry } from './geo.js';

const MAX_PARTICLES = 320;
const MAX_BLOBS = 256;
const MAX_BARS = 160;
const MAX_NUMBERS = 24;
const MAX_SLASHES = 6;

const _v = new THREE.Vector3();
const _c = new THREE.Color();

function dynamicInstanced(geo, material, count, withColor) {
  const m = new THREE.InstancedMesh(geo, material, count);
  m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  if (withColor) {
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3);
    m.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
  m.frustumCulled = false;
  m.count = 0;
  // identity-ish defaults (w = 1)
  const a = m.instanceMatrix.array;
  for (let i = 0; i < count; i++) a[i * 16 + 15] = 1;
  return m;
}

export class Effects {
  constructor(scene, camera, layer) {
    this.camera = camera;
    this.viewW = 1;
    this.viewH = 1;

    // --- particles (small cubes)
    this.pMesh = dynamicInstanced(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial(),
      MAX_PARTICLES,
      true,
    );
    scene.add(this.pMesh);
    this.pData = new Float32Array(MAX_PARTICLES * 12); // x y z vx vy vz life maxLife size r g b
    this.pNext = 0;

    // --- blob shadows
    const blobGeo = new THREE.CircleGeometry(1, 12);
    blobGeo.rotateX(-Math.PI / 2);
    this.blobMesh = dynamicInstanced(
      blobGeo,
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }),
      MAX_BLOBS,
      false,
    );
    this.blobMesh.renderOrder = 1;
    scene.add(this.blobMesh);
    this.blobCount = 0;

    // --- enemy health bars (camera facing quads)
    const barGeo = new THREE.PlaneGeometry(1, 1);
    this.barBg = dynamicInstanced(
      barGeo,
      new THREE.MeshBasicMaterial({ color: 0x15101f, depthTest: false, depthWrite: false, transparent: true, opacity: 0.85 }),
      MAX_BARS,
      false,
    );
    this.barFill = dynamicInstanced(
      barGeo,
      new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true }),
      MAX_BARS,
      true,
    );
    this.barBg.renderOrder = 20;
    this.barFill.renderOrder = 21;
    scene.add(this.barBg, this.barFill);
    this.barCount = 0;
    // camera basis (fixed, the camera never rotates)
    const e = camera.matrixWorld.elements;
    this.rx = e[0]; this.ry = e[1]; this.rz = e[2];
    this.ux = e[4]; this.uy = e[5]; this.uz = e[6];
    this.fx = e[8]; this.fy = e[9]; this.fz = e[10];

    // --- slash arcs
    this.slashes = [];
    this.slashGeo = new Map();
    for (let i = 0; i < MAX_SLASHES; i++) {
      const m = new THREE.Mesh(
        undefined,
        new THREE.MeshBasicMaterial({
          color: 0xc9a8ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      m.visible = false;
      m.renderOrder = 5;
      m.userData.life = 0;
      scene.add(m);
      this.slashes.push(m);
    }
    this.slashNext = 0;

    // --- beams (piercing line attacks)
    this.beams = [];
    const beamGeo = new THREE.BoxGeometry(1, 0.12, 1);
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      m.visible = false;
      m.renderOrder = 5;
      m.userData.life = 0;
      scene.add(m);
      this.beams.push(m);
    }
    this.beamNext = 0;

    // --- damage numbers (DOM)
    this.numbers = [];
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const el = document.createElement('div');
      el.className = 'dmg';
      layer.appendChild(el);
      this.numbers.push({ el, life: 0, x: 0, y: 0, z: 0 });
    }
    this.numNext = 0;
  }

  resize(w, h) {
    this.viewW = w;
    this.viewH = h;
  }

  // ---- particles ----------------------------------------------------------
  burst(x, y, z, count, color, speed = 5, size = 0.18, life = 0.5) {
    _c.setHex(color);
    const d = this.pData;
    for (let i = 0; i < count; i++) {
      const o = this.pNext * 12;
      this.pNext = (this.pNext + 1) % MAX_PARTICLES;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      d[o] = x; d[o + 1] = y; d[o + 2] = z;
      d[o + 3] = Math.cos(a) * s; d[o + 4] = 2 + Math.random() * speed * 0.6; d[o + 5] = Math.sin(a) * s;
      d[o + 6] = d[o + 7] = life * (0.6 + Math.random() * 0.4);
      d[o + 8] = size * (0.6 + Math.random() * 0.8);
      d[o + 9] = _c.r; d[o + 10] = _c.g; d[o + 11] = _c.b;
    }
  }

  // ---- slash --------------------------------------------------------------
  slash(x, z, yaw, range, arcDeg, color = 0xc9a8ff) {
    let geo = this.slashGeo.get(arcDeg);
    if (!geo) {
      geo = sectorGeometry((arcDeg * Math.PI) / 180, 0.35, 16);
      this.slashGeo.set(arcDeg, geo);
    }
    const m = this.slashes[this.slashNext];
    this.slashNext = (this.slashNext + 1) % MAX_SLASHES;
    m.geometry = geo;
    m.material.color.setHex(color);
    m.position.set(x, 0.9, z);
    m.rotation.y = yaw;
    m.userData.life = 1;
    m.userData.range = range;
    m.visible = true;
  }

  beam(x, z, dx, dz, len, width, color) {
    const m = this.beams[this.beamNext];
    this.beamNext = (this.beamNext + 1) % this.beams.length;
    m.material.color.setHex(color);
    m.position.set(x + dx * len * 0.5, 1, z + dz * len * 0.5);
    m.rotation.y = Math.atan2(dx, dz);
    m.scale.set(width, 1, len);
    m.userData.life = 1;
    m.visible = true;
  }

  // ---- blob shadows -------------------------------------------------------
  beginFrame() {
    this.blobCount = 0;
    this.barCount = 0;
  }

  blob(x, z, r) {
    if (this.blobCount >= MAX_BLOBS) return;
    const a = this.blobMesh.instanceMatrix.array;
    const o = this.blobCount++ * 16;
    a[o] = r; a[o + 5] = 1; a[o + 10] = r;
    a[o + 12] = x; a[o + 13] = 0.04; a[o + 14] = z;
  }

  // ---- health bars --------------------------------------------------------
  // ally = true draws the bar in violet (shadows) instead of red (enemies)
  bar(x, y, z, frac, width = 1.5, ally = false) {
    if (this.barCount >= MAX_BARS) return;
    const c = this.barFill.instanceColor.array, k = this.barCount * 3;
    if (ally) { c[k] = 0.45; c[k + 1] = 0.2; c[k + 2] = 1; } else { c[k] = 1; c[k + 1] = 0.07; c[k + 2] = 0.1; }
    const o = this.barCount++ * 16;
    const h = 0.2;
    this._bar(this.barBg.instanceMatrix.array, o, x, y, z, width + 0.1, h + 0.1);
    const w = width * (frac < 0 ? 0 : frac);
    const shift = -(width - w) / 2;
    this._bar(this.barFill.instanceMatrix.array, o, x + this.rx * shift, y + this.ry * shift, z + this.rz * shift, w, h);
  }

  _bar(a, o, x, y, z, w, h) {
    a[o] = this.rx * w; a[o + 1] = this.ry * w; a[o + 2] = this.rz * w;
    a[o + 4] = this.ux * h; a[o + 5] = this.uy * h; a[o + 6] = this.uz * h;
    a[o + 8] = this.fx; a[o + 9] = this.fy; a[o + 10] = this.fz;
    a[o + 12] = x; a[o + 13] = y; a[o + 14] = z;
  }

  // ---- damage numbers -----------------------------------------------------
  number(x, y, z, text, cls) {
    const n = this.numbers[this.numNext];
    this.numNext = (this.numNext + 1) % MAX_NUMBERS;
    n.x = x + (Math.random() - 0.5) * 0.8;
    n.y = y;
    n.z = z;
    n.life = 0.7;
    n.el.textContent = text;
    n.el.className = cls ? 'dmg ' + cls : 'dmg';
    n.el.style.opacity = '1';
  }

  // ---- per frame ----------------------------------------------------------
  update(dt) {
    // particles
    const d = this.pData;
    const pm = this.pMesh.instanceMatrix.array;
    const pc = this.pMesh.instanceColor.array;
    let n = 0;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const o = i * 12;
      if (d[o + 6] <= 0) continue;
      d[o + 6] -= dt;
      d[o + 4] -= 14 * dt;
      d[o] += d[o + 3] * dt;
      d[o + 1] += d[o + 4] * dt;
      d[o + 2] += d[o + 5] * dt;
      if (d[o + 1] < 0.05) { d[o + 1] = 0.05; d[o + 4] *= -0.4; }
      const s = d[o + 8] * (d[o + 6] / d[o + 7]);
      const m = n * 16;
      pm[m] = s; pm[m + 5] = s; pm[m + 10] = s;
      pm[m + 12] = d[o]; pm[m + 13] = d[o + 1]; pm[m + 14] = d[o + 2];
      pc[n * 3] = d[o + 9]; pc[n * 3 + 1] = d[o + 10]; pc[n * 3 + 2] = d[o + 11];
      n++;
    }
    this.pMesh.count = n;
    this.pMesh.instanceMatrix.needsUpdate = true;
    this.pMesh.instanceColor.needsUpdate = true;

    // slashes
    for (let i = 0; i < MAX_SLASHES; i++) {
      const m = this.slashes[i];
      if (!m.visible) continue;
      m.userData.life -= dt * 5.5;
      const l = m.userData.life;
      if (l <= 0) { m.visible = false; continue; }
      m.material.opacity = l * 0.75;
      m.scale.setScalar(m.userData.range * (1.08 - l * 0.2));
    }

    for (let i = 0; i < this.beams.length; i++) {
      const m = this.beams[i];
      if (!m.visible) continue;
      m.userData.life -= dt * 4;
      if (m.userData.life <= 0) { m.visible = false; continue; }
      m.material.opacity = m.userData.life * 0.85;
    }

    this.blobMesh.count = this.blobCount;
    this.blobMesh.instanceMatrix.needsUpdate = true;
    this.barBg.count = this.barFill.count = this.barCount;
    this.barBg.instanceMatrix.needsUpdate = true;
    this.barFill.instanceMatrix.needsUpdate = true;
    this.barFill.instanceColor.needsUpdate = true;

    // damage numbers
    for (let i = 0; i < MAX_NUMBERS; i++) {
      const nm = this.numbers[i];
      if (nm.life <= 0) continue;
      nm.life -= dt;
      if (nm.life <= 0) { nm.el.style.opacity = '0'; continue; }
      nm.y += dt * 2.2;
      this.project(nm.x, nm.y, nm.z);
      nm.el.style.transform = 'translate3d(' + _v.x.toFixed(1) + 'px,' + _v.y.toFixed(1) + 'px,0) translate(-50%,-50%)';
      if (nm.life < 0.25) nm.el.style.opacity = (nm.life * 4).toFixed(2);
    }
  }

  // world -> screen pixels, result in the shared vector (x, y)
  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    _v.x = (_v.x * 0.5 + 0.5) * this.viewW;
    _v.y = (-_v.y * 0.5 + 0.5) * this.viewH;
    return _v;
  }
}
