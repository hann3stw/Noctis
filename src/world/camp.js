// The safe camp in the centre of the world.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flatMaterial } from '../render/geo.js';
import {
  tentGeometry, runeStoneGeometry, campfireGeometry, crateGeometry, altarGeometry,
} from '../render/models/props.js';

export function buildCamp(scene, world) {
  const R = CONFIG.world.campRadius;
  const group = new THREE.Group();

  // packed earth floor with a stone rim
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(R - 0.5, 48),
    new THREE.MeshLambertMaterial({ color: 0x5a4f48 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  const rim = new THREE.Mesh(
    new THREE.RingGeometry(R - 0.5, R + 0.4, 48),
    new THREE.MeshLambertMaterial({ color: 0x35304a }),
  );
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.03;
  const inner = new THREE.Mesh(
    new THREE.RingGeometry(3.2, 3.6, 32),
    new THREE.MeshBasicMaterial({ color: 0x8a4dff, transparent: true, opacity: 0.55 }),
  );
  inner.rotation.x = -Math.PI / 2;
  inner.position.y = 0.04;
  group.add(floor, rim, inner);

  // rune stones mark the border of the safe zone
  const stones = 20;
  const stoneMesh = new THREE.InstancedMesh(runeStoneGeometry(), flatMaterial, stones);
  const glowMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.22, 0.7, 0.06),
    new THREE.MeshBasicMaterial({ color: 0xa87bff }),
    stones * 2,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < stones; i++) {
    const a = (i / stones) * Math.PI * 2 + 0.16;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const yaw = Math.atan2(x, z);
    q.setFromAxisAngle(up, yaw);
    stoneMesh.setMatrixAt(i, m.compose(p.set(x, 0, z), q, s));
    glowMesh.setMatrixAt(i * 2, m.compose(p.set(x + Math.sin(yaw) * 0.27, 1.0, z + Math.cos(yaw) * 0.27), q, s));
    glowMesh.setMatrixAt(i * 2 + 1, m.compose(p.set(x - Math.sin(yaw) * 0.27, 1.0, z - Math.cos(yaw) * 0.27), q, s));
    world.addStatic(x, z, 0.6);
  }
  group.add(stoneMesh, glowMesh);

  function place(geo, x, z, yaw, collide) {
    const mesh = new THREE.Mesh(geo, flatMaterial);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = yaw;
    group.add(mesh);
    if (collide) world.addStatic(x, z, collide);
    return mesh;
  }

  const tent = tentGeometry();
  place(tent, -10, -8, 0.9, 2.3);
  place(tent, 10.5, -7, -0.9, 2.3);
  place(tent, 0, -13, 0, 2.3);
  const crate = crateGeometry();
  place(crate, -12.5, 3, 0.3, 1.1);
  place(crate, 12, 4.5, -0.6, 1.1);

  // shadow altar (army management comes later)
  place(altarGeometry(), 0, 9.5, 0, 2.0);
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.55, 0),
    new THREE.MeshBasicMaterial({ color: 0xb48cff }),
  );
  crystal.position.set(0, 3.9, 9.5);
  group.add(crystal);

  // campfire
  place(campfireGeometry(), 0, 0, 0, 1.4);
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.5, 5),
    new THREE.MeshBasicMaterial({ color: 0xffa040 }),
  );
  flame.position.set(0, 0.95, 0);
  const flameCore = new THREE.Mesh(
    new THREE.ConeGeometry(0.3, 0.9, 5),
    new THREE.MeshBasicMaterial({ color: 0xfff0a0 }),
  );
  flameCore.position.set(0, 0.8, 0);
  const light = new THREE.PointLight(0xff9a4a, 60, 26, 1.6);
  light.position.set(0, 2.2, 0);
  group.add(flame, flameCore, light);

  scene.add(group);

  let t = 0;
  return {
    group,
    update(dt) {
      t += dt;
      const f = 1 + Math.sin(t * 11) * 0.12 + Math.sin(t * 23) * 0.06;
      flame.scale.set(f, 1 + Math.sin(t * 9) * 0.18, f);
      flame.rotation.y = t * 2;
      light.intensity = 55 + Math.sin(t * 13) * 8;
      crystal.rotation.y = t * 0.8;
      crystal.position.y = 3.9 + Math.sin(t * 1.6) * 0.15;
    },
  };
}
