// Outposts: small safe camps, four per zone. Everything is drawn with a few
// InstancedMeshes (one per piece) for all outposts together.
import * as THREE from 'three';
import { flatMaterial } from '../render/geo.js';
import { runeStoneGeometry, campfireGeometry, altarGeometry } from '../render/models/props.js';
import { chestGeometry } from '../entities/loot.js';

const FREE = new THREE.Color(0x8a4dff), HELD = new THREE.Color(0xff3040);

const STONES = 8;

export function buildOutposts(scene, safes) {
  const list = safes.filter((s) => s.zone >= 0);
  const n = list.length;
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  const flat = (geo, material, count) => {
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, material, count);
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  };
  const r = list.length ? list[0].r : 10;
  const floor = flat(new THREE.CircleGeometry(r - 0.4, 32), new THREE.MeshLambertMaterial({ color: 0x5a4f48 }), n);
  const rim = flat(new THREE.RingGeometry(r - 0.4, r + 0.3, 32), new THREE.MeshLambertMaterial({ color: 0x35304a }), n);
  const glow = flat(new THREE.RingGeometry(2.2, 2.5, 24), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }), n);
  const border = flat(new THREE.RingGeometry(r + 0.3, r + 0.8, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6 }), n);
  const chests = new THREE.InstancedMesh(chestGeometry(), flatMaterial, n);
  const stones = new THREE.InstancedMesh(runeStoneGeometry(), flatMaterial, n * STONES);
  const fires = new THREE.InstancedMesh(campfireGeometry(), flatMaterial, n);
  const flames = new THREE.InstancedMesh(new THREE.ConeGeometry(0.45, 1.2, 5), new THREE.MeshBasicMaterial({ color: 0xffa040 }), n);
  const altars = new THREE.InstancedMesh(altarGeometry(), flatMaterial, n);
  const crystals = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.45, 0), new THREE.MeshBasicMaterial(), n);
  for (const mesh of [stones, fires, flames, altars, crystals, chests]) {
    mesh.frustumCulled = false;
    group.add(mesh);
  }

  list.forEach((o, i) => {
    sc.set(1, 1, 1);
    q.identity();
    m.compose(p.set(o.x, 0.03, o.z), q, sc);
    floor.setMatrixAt(i, m);
    m.compose(p.set(o.x, 0.04, o.z), q, sc);
    rim.setMatrixAt(i, m);
    m.compose(p.set(o.x - 3, 0.05, o.z + 2), q, sc);
    glow.setMatrixAt(i, m);
    m.compose(p.set(o.x + 2.5, 0, o.z + 1.5), q, sc);
    fires.setMatrixAt(i, m);
    m.compose(p.set(o.x + 2.5, 0.75, o.z + 1.5), q, sc);
    flames.setMatrixAt(i, m);
    sc.set(0.55, 0.55, 0.55);
    m.compose(p.set(o.x - 3, 0, o.z + 2), q, sc);
    altars.setMatrixAt(i, m);
    sc.set(1, 1, 1);
    m.compose(p.set(o.x - 3, 2.6, o.z + 2), q, sc);
    crystals.setMatrixAt(i, m);
    m.compose(p.set(o.x, 0.05, o.z), q, sc);
    border.setMatrixAt(i, m);
    for (let k = 0; k < STONES; k++) {
      const a = (k / STONES) * Math.PI * 2 + 0.2;
      const x = o.x + Math.cos(a) * o.r, z = o.z + Math.sin(a) * o.r;
      q.setFromAxisAngle(up, Math.atan2(x - o.x, z - o.z));
      sc.set(0.75, 0.75, 0.75);
      m.compose(p.set(x, 0, z), q, sc);
      stones.setMatrixAt(i * STONES + k, m);
    }
  });
  scene.add(group);

  // red = held by enemies (with a closed chest), violet = captured
  function setCaptured(si, captured) {
    const i = list.indexOf(safes[si]);
    if (i < 0) return;
    const c = captured ? FREE : HELD;
    glow.setColorAt(i, c);
    crystals.setColorAt(i, c);
    border.setColorAt(i, c);
    const o = list[i];
    q.identity();
    sc.setScalar(captured ? 0.0001 : 1);
    m.compose(p.set(o.x + 0.5, 0, o.z - 3), q, sc);
    chests.setMatrixAt(i, m);
    for (const mesh of [glow, crystals, border]) mesh.instanceColor.needsUpdate = true;
    chests.instanceMatrix.needsUpdate = true;
  }
  safes.forEach((s, si) => { if (s.zone >= 0) setCaptured(si, s.captured); });
  return { group, setCaptured };
}
