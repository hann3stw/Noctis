// The player character, built from simple boxes. Faces +Z. Equipped weapon
// and armour are shown on top of the skin. Every armour set has its own
// shapes and colours (see ARMOR below), so sets can be told apart at a glance.
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

// box / cone added to a group, with an optional rotation
function box(g, material, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = mesh(w, h, d, material, x, y, z);
  m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

function cone(g, material, r, h, x, y, z, rx = 0, rz = 0, sides = 5) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, sides), material);
  m.position.set(x, y, z);
  m.rotation.set(rx, 0, rz);
  g.add(m);
  return m;
}

// main colour and second colour of every armour set
export const SET_COLORS = {
  stalker: [0x1f4f55, 0x2a2733], // dark teal leather
  bulwark: [0x8f98aa, 0x6a4a30], // steel and bark
  gravecaller: [0x3d2466, 0xe6dfcc], // violet cloth and bone
  tempest: [0xdfe8f2, 0x3f9fe0], // white and sky blue
  arcanist: [0x1e2a6a, 0xe0b040], // deep blue and gold
  bloodreaver: [0x7a1420, 0x17131a], // crimson and black
};
const STEEL = 0xcfd6e6, DARK = 0x22202c, WOOD = 0x5a3d28;

// ---- armour pieces per set ----------------------------------------------------
// Every function fills the group g. m = main colour, a = second colour,
// t = glowing trim in the colour of the item's rarity.
// helmet: head centre at the origin (the head is 0.5 wide)
// chest: body space (torso centre at y 1.2, shoulders at x +-0.48, y 1.56)
// gloves: arm space (shoulder at the origin, hand at y -0.67)
// boots: leg space (hip at the origin, sole at y -0.8)
const ARMOR = {
  stalker: {
    helmet(g, m, a, t) {
      // hood with a pointed tip and a mask over the mouth
      box(g, m, 0.6, 0.42, 0.6, 0, 0.12, -0.02);
      box(g, m, 0.58, 0.34, 0.14, 0, -0.14, -0.25);
      cone(g, m, 0.2, 0.34, 0, 0.42, -0.2, -0.7, 0, 4);
      box(g, a, 0.52, 0.17, 0.06, 0, -0.15, 0.25);
      box(g, t, 0.04, 0.2, 0.04, 0, 0.2, 0.3);
    },
    chest(g, m, a, t) {
      box(g, m, 0.78, 0.62, 0.48, 0, 1.3, 0);
      box(g, a, 0.1, 0.78, 0.5, 0.06, 1.3, 0.01, 0, 0, 0.75); // strap across the chest
      box(g, m, 0.24, 0.12, 0.28, 0.48, 1.6, 0);
      box(g, m, 0.24, 0.12, 0.28, -0.48, 1.6, 0);
      box(g, t, 0.1, 0.1, 0.04, -0.14, 1.44, 0.26);
    },
    gloves(g, m, a, t) {
      box(g, m, 0.25, 0.34, 0.27, 0, -0.58, 0);
      box(g, a, 0.27, 0.05, 0.29, 0, -0.5, 0);
      box(g, a, 0.27, 0.05, 0.29, 0, -0.62, 0);
      box(g, t, 0.05, 0.12, 0.3, 0, -0.56, 0);
    },
    boots(g, m, a, t) {
      box(g, m, 0.31, 0.4, 0.35, 0, -0.6, 0.02);
      box(g, a, 0.33, 0.05, 0.37, 0, -0.5, 0.02);
      box(g, a, 0.33, 0.05, 0.37, 0, -0.64, 0.02);
      box(g, t, 0.06, 0.06, 0.04, 0, -0.44, 0.2);
    },
  },
  bulwark: {
    helmet(g, m, a, t) {
      // closed helm with a glowing visor slit and a crest
      box(g, m, 0.62, 0.62, 0.62, 0, 0.03, 0);
      box(g, t, 0.42, 0.06, 0.04, 0, 0.03, 0.31);
      box(g, a, 0.1, 0.2, 0.66, 0, 0.42, 0);
      box(g, m, 0.66, 0.1, 0.66, 0, -0.26, 0);
    },
    chest(g, m, a, t) {
      box(g, m, 0.88, 0.68, 0.58, 0, 1.3, 0);
      box(g, a, 0.9, 0.14, 0.6, 0, 1.0, 0);
      box(g, m, 0.42, 0.28, 0.46, 0.54, 1.62, 0);
      box(g, m, 0.42, 0.28, 0.46, -0.54, 1.62, 0);
      box(g, a, 0.44, 0.06, 0.48, 0.54, 1.5, 0);
      box(g, a, 0.44, 0.06, 0.48, -0.54, 1.5, 0);
      box(g, t, 0.22, 0.26, 0.04, 0, 1.36, 0.3);
    },
    gloves(g, m, a, t) {
      box(g, m, 0.3, 0.4, 0.32, 0, -0.56, 0);
      box(g, a, 0.32, 0.08, 0.34, 0, -0.4, 0);
      box(g, t, 0.33, 0.04, 0.35, 0, -0.6, 0);
    },
    boots(g, m, a, t) {
      box(g, m, 0.36, 0.44, 0.4, 0, -0.58, 0.02);
      box(g, m, 0.3, 0.16, 0.12, 0, -0.3, 0.16); // knee plate
      box(g, a, 0.38, 0.08, 0.42, 0, -0.76, 0.02);
      box(g, t, 0.37, 0.04, 0.41, 0, -0.42, 0.02);
    },
  },
  gravecaller: {
    helmet(g, m, a, t) {
      // dark cowl with a crown of bone spikes and a bone jaw
      box(g, m, 0.58, 0.24, 0.58, 0, 0.24, 0);
      box(g, m, 0.58, 0.5, 0.14, 0, -0.04, -0.25);
      for (let i = 0; i < 5; i++) {
        const k = (i - 2) / 2;
        cone(g, a, 0.07, 0.3 - Math.abs(k) * 0.08, k * 0.24, 0.48 - Math.abs(k) * 0.04, 0.1 - Math.abs(k) * 0.14, 0, -k * 0.35, 4);
      }
      box(g, a, 0.4, 0.1, 0.06, 0, -0.2, 0.26);
      box(g, t, 0.1, 0.1, 0.05, 0, 0.26, 0.29);
    },
    chest(g, m, a, t) {
      box(g, m, 0.8, 0.64, 0.5, 0, 1.3, 0);
      box(g, m, 0.84, 0.3, 0.54, 0, 0.82, 0); // robe below the belt
      for (let i = 0; i < 3; i++) box(g, a, 0.5 - i * 0.08, 0.05, 0.04, 0, 1.46 - i * 0.12, 0.26); // ribs
      box(g, a, 0.56, 0.26, 0.08, 0, 1.74, -0.24); // high collar
      box(g, t, 0.1, 0.1, 0.05, 0, 1.56, 0.26);
    },
    gloves(g, m, a, t) {
      box(g, m, 0.26, 0.3, 0.28, 0, -0.55, 0);
      box(g, a, 0.3, 0.06, 0.32, 0, -0.44, 0);
      box(g, t, 0.06, 0.06, 0.3, 0, -0.56, 0);
    },
    boots(g, m, a, t) {
      box(g, m, 0.32, 0.36, 0.36, 0, -0.62, 0.02);
      box(g, a, 0.08, 0.28, 0.04, 0, -0.6, 0.21); // shin bone
      box(g, t, 0.34, 0.04, 0.38, 0, -0.46, 0.02);
    },
  },
  tempest: {
    helmet(g, m, a, t) {
      // light cap with two wings
      box(g, m, 0.58, 0.26, 0.58, 0, 0.22, 0);
      box(g, m, 0.58, 0.26, 0.14, 0, 0, -0.25);
      for (const s of [1, -1]) {
        box(g, a, 0.04, 0.34, 0.2, s * 0.32, 0.36, -0.06, -0.5);
        box(g, a, 0.04, 0.26, 0.16, s * 0.32, 0.26, -0.2, -0.8);
      }
      box(g, t, 0.12, 0.12, 0.05, 0, 0.24, 0.29);
    },
    chest(g, m, a, t) {
      box(g, m, 0.78, 0.5, 0.48, 0, 1.36, 0);
      box(g, a, 0.08, 0.5, 0.04, 0.12, 1.36, 0.25, 0, 0, 0.5); // V on the chest
      box(g, a, 0.08, 0.5, 0.04, -0.12, 1.36, 0.25, 0, 0, -0.5);
      for (const s of [1, -1]) box(g, a, 0.26, 0.06, 0.34, s * 0.5, 1.66, -0.06, 0.5, 0, s * 0.5); // shoulder fins
      box(g, t, 0.08, 0.08, 0.05, 0, 1.2, 0.26);
    },
    gloves(g, m, a, t) {
      box(g, m, 0.24, 0.26, 0.26, 0, -0.56, 0);
      box(g, a, 0.04, 0.3, 0.16, 0.14, -0.5, -0.1, 0.5);
      box(g, t, 0.26, 0.04, 0.28, 0, -0.45, 0);
    },
    boots(g, m, a, t) {
      box(g, m, 0.3, 0.32, 0.34, 0, -0.64, 0.02);
      box(g, a, 0.04, 0.26, 0.16, 0.17, -0.56, -0.12, 0.6); // wing at the ankle
      box(g, t, 0.32, 0.04, 0.36, 0, -0.5, 0.02);
    },
  },
  arcanist: {
    helmet(g, m, a, t) {
      // wizard hat with a wide brim and a gold band
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 10), m);
      brim.position.set(0, 0.27, 0);
      g.add(brim);
      cone(g, m, 0.32, 0.74, 0, 0.66, -0.06, -0.22, 0, 8);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.1, 8), a);
      band.position.set(0, 0.35, 0);
      g.add(band);
      box(g, m, 0.56, 0.3, 0.12, 0, 0.1, -0.25);
      box(g, t, 0.1, 0.1, 0.05, 0, 0.36, 0.31);
    },
    chest(g, m, a, t) {
      box(g, m, 0.8, 0.64, 0.5, 0, 1.3, 0);
      box(g, m, 0.86, 0.34, 0.56, 0, 0.8, 0); // robe below the belt
      box(g, a, 0.14, 0.98, 0.04, 0, 1.14, 0.29); // gold stripe down the front
      box(g, a, 0.94, 0.1, 0.6, 0, 1.63, 0); // wide collar
      box(g, t, 0.14, 0.14, 0.05, 0, 1.44, 0.31);
    },
    gloves(g, m, a, t) {
      box(g, m, 0.3, 0.2, 0.32, 0, -0.46, 0); // flared cuff
      box(g, m, 0.24, 0.2, 0.26, 0, -0.64, 0);
      box(g, a, 0.32, 0.05, 0.34, 0, -0.37, 0);
      box(g, t, 0.08, 0.08, 0.04, 0, -0.62, 0.14);
    },
    boots(g, m, a, t) {
      box(g, m, 0.3, 0.36, 0.34, 0, -0.62, 0.02);
      box(g, a, 0.3, 0.1, 0.12, 0, -0.75, 0.2); // gold toe
      box(g, a, 0.32, 0.05, 0.36, 0, -0.46, 0.02);
      box(g, t, 0.06, 0.06, 0.04, 0, -0.56, 0.2);
    },
  },
  bloodreaver: {
    helmet(g, m, a, t) {
      // open helm with two horns
      box(g, a, 0.6, 0.3, 0.6, 0, 0.2, 0);
      box(g, a, 0.6, 0.34, 0.14, 0, -0.06, -0.25);
      box(g, m, 0.1, 0.36, 0.06, 0, 0.14, 0.29); // nose guard
      for (const s of [1, -1]) {
        cone(g, m, 0.09, 0.26, s * 0.36, 0.34, 0, 0, -s * 1.1, 5);
        cone(g, m, 0.07, 0.3, s * 0.5, 0.54, 0, 0, -s * 0.25, 5);
      }
      box(g, t, 0.62, 0.05, 0.62, 0, 0.07, 0);
    },
    chest(g, m, a, t) {
      box(g, a, 0.8, 0.62, 0.5, 0, 1.3, 0);
      box(g, m, 0.5, 0.46, 0.06, 0, 1.34, 0.25);
      for (const s of [1, -1]) {
        box(g, m, 0.34, 0.2, 0.36, s * 0.5, 1.6, 0);
        cone(g, m, 0.08, 0.3, s * 0.56, 1.8, 0, 0, -s * 0.5, 5);
        cone(g, m, 0.06, 0.22, s * 0.42, 1.78, 0.1, 0, -s * 0.2, 5);
      }
      box(g, t, 0.06, 0.34, 0.04, 0, 1.34, 0.29);
    },
    gloves(g, m, a, t) {
      box(g, a, 0.27, 0.32, 0.29, 0, -0.56, 0);
      box(g, m, 0.29, 0.1, 0.31, 0, -0.44, 0);
      cone(g, m, 0.06, 0.22, 0, -0.5, -0.2, -1.5, 0, 4);
      box(g, t, 0.3, 0.04, 0.32, 0, -0.66, 0);
    },
    boots(g, m, a, t) {
      box(g, a, 0.33, 0.4, 0.37, 0, -0.6, 0.02);
      box(g, m, 0.35, 0.1, 0.39, 0, -0.44, 0.02);
      cone(g, m, 0.06, 0.2, 0, -0.74, 0.28, 1.5, 0, 4); // spike at the toe
      box(g, t, 0.06, 0.2, 0.04, 0, -0.6, 0.21);
    },
  },
};

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
  } else if (type === 'spear') {
    // long shaft, leaf-shaped tip
    g.add(mesh(0.07, 2.3, 0.07, mat(WOOD), 0, 0.55, 0));
    g.add(mesh(0.14, 0.08, 0.14, mat(DARK), 0, 1.66, 0));
    cone(g, mat(STEEL), 0.13, 0.6, 0, 2.0, 0, 0, 0, 4);
    g.add(mesh(0.03, 0.44, 0.03, glowMat, 0, 1.98, 0.09));
    g.add(mesh(0.03, 0.44, 0.03, glowMat, 0, 1.98, -0.09));
  } else if (type === 'hammer') {
    // thick shaft, heavy block of a head
    g.add(mesh(0.1, 1.5, 0.1, mat(WOOD), 0, 0.55, 0));
    g.add(mesh(0.36, 0.42, 0.7, mat(0x6f7686), 0, 1.4, 0));
    g.add(mesh(0.4, 0.3, 0.12, mat(STEEL), 0, 1.4, 0.36));
    g.add(mesh(0.4, 0.3, 0.12, mat(STEEL), 0, 1.4, -0.36));
    g.add(mesh(0.38, 0.08, 0.5, glowMat, 0, 1.4, 0));
  } else if (type === 'grimoire') {
    // open book with a glowing rune floating above it
    const cover = mat(0x3a2450), page = mat(0xe8e0cc);
    for (const s of [1, -1]) {
      const half = new THREE.Group();
      half.add(mesh(0.3, 0.05, 0.42, cover, s * 0.15, 0, 0));
      half.add(mesh(0.27, 0.04, 0.38, page, s * 0.15, 0.04, 0));
      half.rotation.z = s * 0.3;
      g.add(half);
    }
    const rune = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glowMat);
    rune.position.set(0, 0.36, 0);
    g.add(rune);
    g.add(mesh(0.4, 0.02, 0.04, glowMat, 0, 0.08, 0.1));
    g.add(mesh(0.4, 0.02, 0.04, glowMat, 0, 0.08, -0.08));
    g.position.set(0, 0.12, 0.12);
    g.rotation.x = -Math.PI / 2; // lies open on the hand
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

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

export function createPlayerModel(appearance) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const mats = {
    skin: mat(appearance.skin),
    hair: mat(appearance.hair),
    clothes: mat(appearance.clothes),
    pants: mat(shade(appearance.clothes, 0.62)),
    cape: mat(appearance.capeColor),
    eyes: new THREE.MeshBasicMaterial({ color: appearance.eyes }),
    boots: mat(0x18161f),
    dark: mat(0x16121c),
    buckle: mat(0xc9a24a),
  };

  // torso: tunic, belt with a buckle, the hem of the tunic below it
  body.add(mesh(0.72, 0.8, 0.42, mats.clothes, 0, 1.2, 0));
  body.add(mesh(0.76, 0.14, 0.46, mats.boots, 0, 0.84, 0)); // belt
  body.add(mesh(0.14, 0.1, 0.04, mats.buckle, 0, 0.84, 0.24));
  body.add(mesh(0.74, 0.14, 0.44, mats.clothes, 0, 0.72, 0));
  body.add(mesh(0.3, 0.1, 0.44, mats.pants, 0, 1.56, 0)); // collar
  body.add(mesh(0.2, 0.12, 0.2, mats.skin, 0, 1.63, 0)); // neck

  const head = new THREE.Group();
  head.position.set(0, 1.88, 0);
  head.add(mesh(0.5, 0.5, 0.5, mats.skin, 0, 0, 0));
  const hair = buildHair(appearance.hairStyle || 0, mats.hair);
  head.add(hair);
  // face: glowing eyes, brows in the hair colour, a small mouth
  head.add(mesh(0.1, 0.07, 0.04, mats.eyes, 0.12, 0.02, 0.26));
  head.add(mesh(0.1, 0.07, 0.04, mats.eyes, -0.12, 0.02, 0.26));
  head.add(mesh(0.13, 0.03, 0.03, mats.hair, 0.12, 0.09, 0.26));
  head.add(mesh(0.13, 0.03, 0.03, mats.hair, -0.12, 0.09, 0.26));
  head.add(mesh(0.12, 0.025, 0.03, mats.dark, 0, -0.14, 0.255));
  body.add(head);

  function limb(x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    body.add(pivot);
    return pivot;
  }
  // arms: sleeve and hand
  const armL = limb(0.48, 1.56), armR = limb(-0.48, 1.56);
  for (const arm of [armL, armR]) {
    arm.add(mesh(0.2, 0.6, 0.22, mats.clothes, 0, -0.3, 0));
    arm.add(mesh(0.22, 0.06, 0.24, mats.pants, 0, -0.58, 0));
    arm.add(mesh(0.17, 0.14, 0.19, mats.skin, 0, -0.67, 0));
  }
  // legs: trousers and boots
  const legL = limb(0.19, 0.8), legR = limb(-0.19, 0.8);
  for (const leg of [legL, legR]) {
    leg.add(mesh(0.26, 0.5, 0.28, mats.pants, 0, -0.25, 0));
    leg.add(mesh(0.28, 0.32, 0.32, mats.boots, 0, -0.64, 0.02));
  }

  const cape = new THREE.Group();
  cape.position.set(0, 1.58, -0.24);
  cape.add(mesh(0.7, 1.15, 0.05, mats.cape, 0, -0.57, 0));
  cape.add(mesh(0.76, 0.1, 0.1, mats.cape, 0, -0.02, 0.02)); // where it sits on the shoulders
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

  // one armour piece in the shapes and colours of its set
  function armorPiece(slot, item) {
    const set = ARMOR[item.set] ? item.set : 'stalker';
    const [c1, c2] = SET_COLORS[set];
    const g = new THREE.Group();
    ARMOR[set][slot](g, mat(c1), mat(c2), new THREE.MeshBasicMaterial({ color: RARITY_COLORS[item.rarity] }));
    return g;
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
    if (equip.helmet) attach(head, armorPiece('helmet', equip.helmet));
    if (equip.chest) attach(body, armorPiece('chest', equip.chest));
    if (equip.gloves) for (const arm of [armL, armR]) attach(arm, armorPiece('gloves', equip.gloves));
    if (equip.boots) for (const leg of [legL, legR]) attach(leg, armorPiece('boots', equip.boots));
  }

  let walk = 0;
  let fall = 0;
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // p: 0 -> 1 through the attack
  function attackPose(weapon, p, combo) {
    const side = combo ? -1 : 1;
    if (weapon === 'daggers') {
      // quick stab, left and right hand in turn
      const arm = combo ? armL : armR, other = combo ? armR : armL;
      const k = Math.sin(p * Math.PI);
      arm.rotation.x = -0.3 - 1.4 * k;
      arm.rotation.z = 0;
      other.rotation.x += (0.4 - other.rotation.x) * 0.5;
      body.rotation.y = 0.35 * side * k;
      body.rotation.x += 0.18 * k;
    } else if (weapon === 'bow') {
      // bow arm forward, string hand pulls back and lets go
      armR.rotation.x = -1.55;
      armR.rotation.z = 0.15;
      armL.rotation.x = p < 0.55 ? -1.5 : -1.5 + (p - 0.55) * 3;
      armL.rotation.z = p < 0.55 ? -0.9 * (p / 0.55) : -0.9 * (1 - (p - 0.55) / 0.45);
      body.rotation.y = 0.35;
    } else if (weapon === 'scythe') {
      // full spin with the blade held out
      body.rotation.y = -ease(p) * Math.PI * 2;
      armR.rotation.x = -0.6;
      armR.rotation.z = -1.3;
    } else if (weapon === 'staff' || weapon === 'hammer') {
      // raise over the head, then slam forward
      const up = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
      const x = p < 0.45 ? -2.9 * up : -2.9 + ((p - 0.45) / 0.55) * 1.9;
      armR.rotation.x = x;
      armL.rotation.x = x;
      armR.rotation.z = 0;
      body.rotation.x += p > 0.45 ? (weapon === 'hammer' ? 0.45 : 0.25) * (1 - p) * 2 : 0;
      body.rotation.y *= 0.5;
    } else if (weapon === 'spear') {
      // pull back, then a long thrust with the whole body
      const k = p < 0.3 ? -(p / 0.3) * 0.5 : Math.sin(((p - 0.3) / 0.7) * Math.PI);
      armR.rotation.x = -1.0 - 0.6 * k;
      armR.rotation.z = 0;
      armL.rotation.x += (-0.7 - armL.rotation.x) * 0.5;
      body.rotation.x += 0.3 * Math.max(0, k);
      body.rotation.y = -0.3 * Math.max(0, k);
    } else if (weapon === 'grimoire') {
      // the book is held out, the free hand throws the bolt
      const k = Math.sin(p * Math.PI);
      armR.rotation.x = -1.2;
      armR.rotation.z = 0.2;
      armL.rotation.x = -1.6 * k - 0.2;
      armL.rotation.z = 0.3 * k;
      body.rotation.y = 0.2 * k;
    } else {
      // sword: wide slash, alternating direction
      const e = ease(p);
      armR.rotation.x = -2.2 + e * 2.6;
      armR.rotation.z = (-0.6 + e * 1.2) * side;
      body.rotation.y = (0.6 - e * 1.2) * side;
    }
  }

  return {
    root,
    setEquipment,
    // st: { moving, attack (1 -> 0 while swinging), weapon, combo (0 / 1,
    // alternates every attack), cast (1 -> 0 while casting a skill), dodging, dead }
    animate(dt, st) {
      fall += ((st.dead ? 1 : 0) - fall) * Math.min(1, dt * 8);
      body.rotation.x = -fall * 1.45 + (st.dodging ? 0.55 : 0);

      if (st.moving && !st.dead) walk += dt * 13;
      const swing = st.moving && !st.dead ? Math.sin(walk) * 0.75 : 0;
      legL.rotation.x += (swing - legL.rotation.x) * 0.5;
      legR.rotation.x += (-swing - legR.rotation.x) * 0.5;
      armL.rotation.x += (-swing * 0.7 - armL.rotation.x) * 0.5;

      body.position.y = fall * 0.25;
      if (st.attack > 0) {
        attackPose(st.weapon, 1 - st.attack, st.combo);
      } else if (st.cast > 0) {
        // skill: both arms thrown up and out, a small hop
        const k = Math.sin((1 - st.cast) * Math.PI);
        armR.rotation.x = -2.7 * k;
        armL.rotation.x = -2.7 * k;
        armR.rotation.z = -0.5 * k;
        armL.rotation.z = 0.5 * k;
        body.position.y += 0.18 * k;
        body.rotation.y *= 0.6;
      } else {
        armR.rotation.x += (swing * 0.7 - 0.25 - armR.rotation.x) * 0.4;
        armR.rotation.z *= 0.6;
        armL.rotation.z *= 0.6;
        body.rotation.y *= 0.6;
      }
      aura.material.opacity = st.dead ? 0 : 0.35 + Math.sin(walk * 0.3 + fall) * 0.1;
      const flutter = st.moving ? 0.55 + Math.sin(walk * 0.7) * 0.12 : 0.1;
      cape.rotation.x += (flutter - cape.rotation.x) * 0.2;
    },
  };
}
