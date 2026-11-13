// The player character, built from simple boxes. Faces +Z. Equipped weapon
// and armour are shown on top of the skin.
import * as THREE from 'three';
import { RARITY_COLORS } from '../../core/items.js';

function mat(color) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function mesh(w, h, d, material, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

const SET_COLORS = { stalker: 0x23464f, bulwark: 0x8a93a6, gravecaller: 0x3d2466 };
const STEEL = 0xcfd6e6, DARK = 0x22202c, WOOD = 0x5a3d28;

// ---- weapons (held in the right hand, grip at the origin, pointing +Y) -------
function buildWeapon(type, glow) {
  const g = new THREE.Group();
  const glowMat = new THREE.MeshBasicMaterial({ color: glow });
  if (type === 'sword') {
    g.add(mesh(0.09, 1.25, 0.2, mat(STEEL), 0, 0.85, 0));
    g.add(mesh(0.03, 1.1, 0.24, glowMat, 0, 0.85, 0));
    g.add(mesh(0.12, 0.08, 0.5, mat(0x3a2f55), 0, 0.2, 0));
    g.add(mesh(0.08, 0.3, 0.08, mat(DARK), 0, 0.02, 0));
  } else if (type === 'daggers') {
    g.add(mesh(0.07, 0.6, 0.16, mat(STEEL), 0, 0.48, 0));
    g.add(mesh(0.03, 0.5, 0.19, glowMat, 0, 0.48, 0));
    g.add(mesh(0.1, 0.06, 0.3, mat(0x3a2f55), 0, 0.16, 0));
    g.add(mesh(0.07, 0.24, 0.07, mat(DARK), 0, 0.02, 0));
  } else if (type === 'bow') {
    g.add(mesh(0.07, 0.5, 0.1, mat(WOOD), 0, 0, 0.12));
    const top = mesh(0.07, 0.5, 0.1, mat(WOOD), 0, 0.42, 0.02);
    const bottom = mesh(0.07, 0.5, 0.1, mat(WOOD), 0, -0.42, 0.02);
    top.rotation.x = 0.45;
    bottom.rotation.x = -0.45;
    g.add(top, bottom);
    g.add(mesh(0.025, 1.3, 0.025, glowMat, 0, 0, -0.1));
    g.rotation.x = -Math.PI / 2; // held upright in front of the body
  } else if (type === 'scythe') {
    g.add(mesh(0.08, 2.0, 0.08, mat(WOOD), 0, 0.7, 0));
    g.add(mesh(0.06, 0.2, 0.9, mat(STEEL), 0, 1.62, 0.4));
    g.add(mesh(0.03, 0.08, 0.95, glowMat, 0, 1.52, 0.42));
    const tip = mesh(0.06, 0.14, 0.3, mat(STEEL), 0, 1.5, 0.95);
    tip.rotation.x = 0.7;
    g.add(tip);
  } else {
    // staff
    g.add(mesh(0.09, 1.9, 0.09, mat(WOOD), 0, 0.6, 0));
    g.add(mesh(0.26, 0.1, 0.26, mat(DARK), 0, 1.5, 0));
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), glowMat);
    orb.position.set(0, 1.78, 0);
    g.add(orb);
  }
  return g;
}

// ---- hairstyles (head centre at the origin, head is 0.5 units wide) -----------
// 0 short, 1 spiky, 2 long, 3 ponytail, 4 mohawk, 5 swept fringe
function buildHair(style, m) {
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, rx = 0, rz = 0) => {
    const b = mesh(w, h, d, m, x, y, z);
    b.rotation.set(rx, 0, rz);
    g.add(b);
  };
  if (style === 4) {
    // mohawk: shaved sides, one tall strip
    add(0.14, 0.26, 0.5, 0, 0.36, -0.02);
    add(0.14, 0.18, 0.18, 0, 0.3, -0.3);
    return g;
  }
  add(0.56, 0.2, 0.56, 0, 0.28, -0.02); // top
  if (style === 0) {
    add(0.56, 0.4, 0.16, 0, 0.05, -0.24);
  } else if (style === 1) {
    add(0.56, 0.34, 0.16, 0, 0.1, -0.24);
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.32, 4), m);
      spike.position.set(-0.2 + i * 0.1, 0.48, -0.05 + (i % 2) * 0.12);
      spike.rotation.z = (i - 2) * -0.25;
      g.add(spike);
    }
  } else if (style === 2) {
    add(0.58, 0.9, 0.18, 0, -0.18, -0.24);
    add(0.1, 0.62, 0.42, 0.29, -0.04, -0.04);
    add(0.1, 0.62, 0.42, -0.29, -0.04, -0.04);
  } else if (style === 3) {
    add(0.56, 0.36, 0.16, 0, 0.08, -0.24);
    add(0.14, 0.14, 0.14, 0, 0.12, -0.36);
    add(0.13, 0.6, 0.13, 0, -0.2, -0.42, 0.25);
  } else {
    // swept fringe over one eye
    add(0.56, 0.4, 0.16, 0, 0.05, -0.24);
    add(0.32, 0.22, 0.1, 0.12, 0.13, 0.26, 0, 0.35);
    add(0.1, 0.4, 0.4, 0.29, 0.06, -0.02);
  }
  return g;
}

function dispose(group) {
  group.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
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
  const hair = buildHair(appearance.hairStyle || 0, mats.hair);
  head.add(hair);
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

  const cape = new THREE.Group();
  cape.position.set(0, 1.58, -0.24);
  cape.add(mesh(0.7, 1.15, 0.05, mats.cape, 0, -0.57, 0));
  cape.visible = appearance.cape;
  body.add(cape);

  // faint aura on the ground in the aura colour
  const auraGeo = new THREE.RingGeometry(0.55, 0.85, 24);
  auraGeo.rotateX(-Math.PI / 2);
  const aura = new THREE.Mesh(
    auraGeo,
    new THREE.MeshBasicMaterial({ color: appearance.aura, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }),
  );
  aura.position.y = 0.06;
  aura.renderOrder = 2;
  root.add(aura);

  // ---- equipment: rebuilt whenever it changes ---------------------------------
  let gear = []; // { group, parent }
  let gearKey = '';

  function attach(parent, group) {
    parent.add(group);
    gear.push({ group, parent });
  }

  function armorMats(item) {
    return [mat(SET_COLORS[item.set]), new THREE.MeshBasicMaterial({ color: RARITY_COLORS[item.rarity] })];
  }

  function setEquipment(equip) {
    let key = '';
    for (const slot in equip) key += equip[slot] ? equip[slot].type + (equip[slot].set || '') + equip[slot].rarity + '|' : '-|';
    if (key === gearKey) return;
    gearKey = key;
    for (const g of gear) { g.parent.remove(g.group); dispose(g.group); }
    gear = [];

    const w = equip.weapon;
    const weapon = buildWeapon(w.type, RARITY_COLORS[w.rarity]);
    const hold = new THREE.Group();
    hold.position.set(0, -0.7, 0.05);
    hold.rotation.x = Math.PI / 2;
    hold.add(weapon);
    attach(armR, hold);
    if (w.type === 'daggers') {
      const off = new THREE.Group();
      off.position.set(0, -0.7, 0.05);
      off.rotation.x = Math.PI / 2;
      off.add(buildWeapon('daggers', RARITY_COLORS[w.rarity]));
      attach(armL, off);
    }

    hair.visible = !equip.helmet;
    if (equip.helmet) {
      const [m, trim] = armorMats(equip.helmet);
      const g = new THREE.Group();
      g.add(mesh(0.58, 0.34, 0.58, m, 0, 0.2, 0));
      g.add(mesh(0.58, 0.3, 0.14, m, 0, -0.06, -0.24));
      g.add(mesh(0.6, 0.06, 0.6, trim, 0, 0.05, 0));
      g.add(mesh(0.08, 0.2, 0.08, trim, 0, 0.45, 0));
      attach(head, g);
    }
    if (equip.chest) {
      const [m, trim] = armorMats(equip.chest);
      const g = new THREE.Group();
      g.add(mesh(0.8, 0.6, 0.5, m, 0, 1.3, 0));
      g.add(mesh(0.3, 0.2, 0.3, m, 0.48, 1.58, 0));
      g.add(mesh(0.3, 0.2, 0.3, m, -0.48, 1.58, 0));
      g.add(mesh(0.2, 0.2, 0.04, trim, 0, 1.36, 0.26));
      attach(body, g);
    }
    if (equip.gloves) {
      for (const arm of [armL, armR]) {
        const [m, trim] = armorMats(equip.gloves);
        const g = new THREE.Group();
        g.add(mesh(0.26, 0.3, 0.28, m, 0, -0.55, 0));
        g.add(mesh(0.28, 0.05, 0.3, trim, 0, -0.42, 0));
        attach(arm, g);
      }
    }
    if (equip.boots) {
      for (const leg of [legL, legR]) {
        const [m, trim] = armorMats(equip.boots);
        const g = new THREE.Group();
        g.add(mesh(0.32, 0.36, 0.36, m, 0, -0.62, 0.02));
        g.add(mesh(0.34, 0.05, 0.38, trim, 0, -0.46, 0.02));
        attach(leg, g);
      }
    }
  }

  let walk = 0;
  let fall = 0;

  return {
    root,
    setEquipment,
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
      aura.material.opacity = st.dead ? 0 : 0.35 + Math.sin(walk * 0.3 + fall) * 0.1;
      const flutter = st.moving ? 0.55 + Math.sin(walk * 0.7) * 0.12 : 0.1;
      cape.rotation.x += (flutter - cape.rotation.x) * 0.2;
    },
  };
}
