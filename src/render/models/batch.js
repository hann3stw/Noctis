// Fewer draw calls for models built from many small parts (the player character): the rigid parts of a group
// that use a plain lit material (Lambert, opaque) are merged into one mesh. Their colours go into the vertex
// colours, so the look stays the same; the groups (body, head, arms, legs, cape ...) stay as they are, so the
// animation that moves them is untouched. Parts that are moved, scaled or hidden on their own, and parts with
// glowing or see-through materials, are left alone (keep).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

function mergeable(o, keep) {
  return o.isMesh && !o.isInstancedMesh && o.children.length === 0 && !keep(o) && o.visible
    && o.material && o.material.isMeshLambertMaterial && !o.material.transparent && !o.material.vertexColors && !o.material.map;
}

// merges the mergeable direct children of one group (returns how many meshes were saved)
export function batchGroup(group, keep = () => false) {
  const parts = group.children.filter((o) => mergeable(o, keep));
  if (parts.length < 2) return 0;
  const geos = [];
  let shadow = false, receive = false;
  for (const m of parts) {
    m.updateMatrix();
    let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    g.applyMatrix4(m.matrix);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    _c.copy(m.material.color);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geos.push(g);
    shadow = shadow || m.castShadow;
    receive = receive || m.receiveShadow;
  }
  const merged = mergeGeometries(geos, false);
  for (const g of geos) g.dispose();
  if (!merged) return 0;
  const flat = parts.some((m) => m.material.flatShading);
  const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat }));
  mesh.castShadow = shadow;
  mesh.receiveShadow = receive;
  mesh.name = 'batched';
  for (const m of parts) { group.remove(m); m.geometry.dispose(); } // (the materials may be shared with parts that stay)
  group.add(mesh);
  return parts.length - 1;
}

// merges in every group of a tree (the root included)
export function batchTree(root, keep = () => false) {
  const groups = [];
  root.traverse((o) => { if (!o.isMesh && o.children.length) groups.push(o); });
  let saved = 0;
  for (const g of groups) saved += batchGroup(g, keep);
  return saved;
}
