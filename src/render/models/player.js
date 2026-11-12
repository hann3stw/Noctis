// The player character, built from simple boxes. Faces +Z.
import * as THREE from 'three';

function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function mesh(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function buildSword() {
  const g = new THREE.Group();
  const blade = mesh(0.09, 1.25, 0.2, mat(0xcfd6e6), 0, 0.85, 0);
  const edge = mesh(0.03, 1.1, 0.24, new THREE.MeshBasicMaterial({ color: 0xb48cff }), 0, 0.85, 0);
  const guard = mesh(0.12, 0.08, 0.5, mat(0x3a2f55), 0, 0.2, 0);
  const grip = mesh(0.08, 0.3, 0.08, mat(0x22202c), 0, 0.02, 0);
  g.add(blade, edge, guard, grip);
  return g;
}

export function createPlayerModel(appearance) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mats = {
    skin: mat(appearance.skin),
    hair: mat(appearance.hair),
    clothes: mat(appearance.clothes),
    cape: mat(appearance.capeColor),
    eyes: new THREE.MeshBasicMaterial({ color: appearance.eyes }),
    boots: mat(0x18161f),
  };

  body.add(mesh(0.72, 0.8, 0.42, mats.clothes, 0, 1.2, 0));
  body.add(mesh(0.76, 0.14, 0.46, mats.boots, 0, 0.84, 0)); // belt

  const head = new THREE.Group();
  head.position.set(0, 1.88, 0);
  head.add(mesh(0.5, 0.5, 0.5, mats.skin, 0, 0, 0));
  head.add(mesh(0.56, 0.2, 0.56, mats.hair, 0, 0.28, -0.02));
  head.add(mesh(0.56, 0.4, 0.16, mats.hair, 0, 0.05, -0.24));
  head.add(mesh(0.1, 0.07, 0.04, mats.eyes, 0.12, 0.02, 0.26));
  head.add(mesh(0.1, 0.07, 0.04, mats.eyes, -0.12, 0.02, 0.26));
  body.add(head);

  function limb(x, y, w, h, d, material) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(mesh(w, h, d, material, 0, -h / 2, 0));
    body.add(pivot);
    return pivot;
  }
  const armL = limb(0.48, 1.56, 0.2, 0.72, 0.22, mats.clothes);
  const armR = limb(-0.48, 1.56, 0.2, 0.72, 0.22, mats.clothes);
  const legL = limb(0.19, 0.8, 0.26, 0.8, 0.28, mats.boots);
  const legR = limb(-0.19, 0.8, 0.26, 0.8, 0.28, mats.boots);

  const weapon = buildSword();
  weapon.position.set(0, -0.7, 0.05);
  weapon.rotation.x = Math.PI / 2;
  armR.add(weapon);

  const cape = new THREE.Group();
  cape.position.set(0, 1.58, -0.24);
  cape.add(mesh(0.7, 1.15, 0.05, mats.cape, 0, -0.57, 0));
  cape.visible = appearance.cape;
  body.add(cape);

  let walk = 0;
  let fall = 0;

  return {
    root,
    // st: { moving, attack (1 -> 0 while swinging), dodging, dead }
    animate(dt, st) {
      fall += ((st.dead ? 1 : 0) - fall) * Math.min(1, dt * 8);
      body.rotation.x = -fall * 1.45 + (st.dodging ? 0.55 : 0);
      body.position.y = fall * 0.25;

      if (st.moving && !st.dead) walk += dt * 13;
      const swing = st.moving && !st.dead ? Math.sin(walk) * 0.75 : 0;
      legL.rotation.x += (swing - legL.rotation.x) * 0.5;
      legR.rotation.x += (-swing - legR.rotation.x) * 0.5;
      armL.rotation.x += (-swing * 0.7 - armL.rotation.x) * 0.5;

      if (st.attack > 0) {
        const p = 1 - st.attack; // 0 -> 1
        armR.rotation.x = -2.4 + p * 2.9;
        armR.rotation.z = -0.5 + p * 1.0;
        body.rotation.y = 0.5 - p * 1.0;
      } else {
        armR.rotation.x += (swing * 0.7 - 0.25 - armR.rotation.x) * 0.4;
        armR.rotation.z *= 0.6;
        body.rotation.y *= 0.6;
      }
      const flutter = st.moving ? 0.55 + Math.sin(walk * 0.7) * 0.12 : 0.1;
      cape.rotation.x += (flutter - cape.rotation.x) * 0.2;
    },
  };
}
