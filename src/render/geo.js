// Helpers to build low-poly models in code: coloured primitives that are merged
// into a single geometry (one draw call per model type).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

function finish(geo, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  if (geo.index) geo = geo.toNonIndexed();
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
  geo.applyMatrix4(_m);
  _c.setHex(color);
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = _c.r;
    col[i * 3 + 1] = _c.g;
    col[i * 3 + 2] = _c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

export function box(w, h, d, color, x, y, z, rx, ry, rz) {
  return finish(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry, rz);
}

export function cone(r, h, seg, color, x, y, z, rx, ry, rz) {
  return finish(new THREE.ConeGeometry(r, h, seg), color, x, y, z, rx, ry, rz);
}

export function cyl(rTop, rBottom, h, seg, color, x, y, z, rx, ry, rz) {
  return finish(new THREE.CylinderGeometry(rTop, rBottom, h, seg), color, x, y, z, rx, ry, rz);
}

export function blob(r, color, x, y, z, sx = 1, sy = 1, sz = 1, detail = 0) {
  return finish(new THREE.IcosahedronGeometry(r, detail), color, x, y, z, 0, 0, 0, sx, sy, sz);
}

export function merge(parts) {
  const g = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  g.computeBoundingSphere();
  return g;
}

// Shared material for everything built with vertex colours.
export const flatMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// Flat ring sector on the ground pointing towards +Z, used for aim areas and
// slash effects. Radius 1, scale it to the wanted range.
export function sectorGeometry(arcRad, inner = 0, segments = 14) {
  const pos = [];
  for (let i = 0; i < segments; i++) {
    const a0 = -arcRad / 2 + (arcRad * i) / segments;
    const a1 = -arcRad / 2 + (arcRad * (i + 1)) / segments;
    const s0 = Math.sin(a0), c0 = Math.cos(a0), s1 = Math.sin(a1), c1 = Math.cos(a1);
    pos.push(s0 * inner, 0, c0 * inner, s0, 0, c0, s1, 0, c1);
    if (inner > 0) pos.push(s0 * inner, 0, c0 * inner, s1, 0, c1, s1 * inner, 0, c1 * inner);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}
