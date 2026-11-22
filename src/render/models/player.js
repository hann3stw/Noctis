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
  } else if (type === 'crossbow') {
    // a stock with a short bow across it, held like the bow
    g.add(mesh(0.1, 0.9, 0.14, mat(WOOD), 0, 0, 0.05));
    g.add(mesh(0.8, 0.07, 0.07, mat(STEEL), 0, 0.42, 0.08));
    g.add(mesh(0.8, 0.02, 0.02, glowMat, 0, 0.32, 0.05));
    g.add(mesh(0.04, 0.5, 0.04, glowMat, 0, 0.2, 0.12));
    g.rotation.x = -Math.PI / 2;
  } else if (type === 'javelin') {
    // a short thrown spear
    g.add(mesh(0.06, 1.5, 0.06, mat(WOOD), 0, 0.4, 0));
    cone(g, mat(STEEL), 0.1, 0.45, 0, 1.4, 0, 0, 0, 4);
    g.add(mesh(0.08, 0.1, 0.08, glowMat, 0, 1.12, 0));
  } else if (type === 'wand') {
    g.add(mesh(0.06, 0.7, 0.06, mat(WOOD), 0, 0.3, 0));
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glowMat);
    tip.position.set(0, 0.78, 0);
    g.add(tip);
    g.add(mesh(0.1, 0.05, 0.1, mat(DARK), 0, 0.62, 0));
  } else if (type === 'orb') {
    // a glowing sphere that floats above the hand in a cage of rings
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 0), glowMat);
    ball.position.set(0, 0.5, 0);
    g.add(ball);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 20), mat(DARK));
    ring.position.set(0, 0.5, 0);
    ring.rotation.x = Math.PI / 2 - 0.4;
    g.add(ring);
    g.add(mesh(0.1, 0.3, 0.1, mat(DARK), 0, 0.1, 0));
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

function dispose(group) {
  group.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
}


// ---- what the main class wears: parts on top of the look, so a Warrior, a Mage and a Rogue can be told apart
// at a glance. H = the head group (origin = centre of the head, the head is a 0.5 cube; hidden under a helmet),
// B = the body group, F = the head group that stays (a halo). 
// Returns what has to move (a floating orb) or null. Colours are the class colours of the interface.
const CLASS_LOOK = {
  necromancer: 0x9a6bff, warrior: 0xe8553f, mage: 0x4aa8ff, rogue: 0xe050a8, ranger: 0x58c24a, cleric: 0xffd24a,
};
function buildClassParts(id, H, B, F) {
  const col = CLASS_LOOK[id];
  if (!col) return null;
  const main = mat(col), dark = mat(shade(col, 0.45)), glow = new THREE.MeshBasicMaterial({ color: col });
  const steel = mat(0x8d97a8), steelHi = mat(0xc4ccd8), gold = mat(0xc9a24a), bone = mat(0xd8d0bc), leather = mat(0x6a4a2a);
  let orb = null;
  if (id === 'necromancer') {
    // bone spikes on the shoulders, a violet soul floating over one of them
    for (const s of [1, -1]) {
      cone(B, bone, 0.07, 0.3, s * 0.5, 1.82, 0, 0, -s * 0.3, 5);
      cone(B, bone, 0.05, 0.2, s * 0.58, 1.74, 0.1, 0.4, -s * 0.9, 5);
    }
    orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.1, 0), glow);
    orb.position.set(0.62, 2.35, 0);
    B.add(orb);
  } else if (id === 'warrior') {
    // steel pauldrons with a red trim, a plate on the chest
    for (const s of [1, -1]) {
      box(B, steel, 0.38, 0.18, 0.44, s * 0.52, 1.68, 0, 0, 0, -s * 0.22);
      box(B, steelHi, 0.4, 0.05, 0.46, s * 0.54, 1.78, 0, 0, 0, -s * 0.22);
      box(B, main, 0.4, 0.05, 0.46, s * 0.5, 1.58, 0, 0, 0, -s * 0.22);
    }
    box(B, steel, 0.5, 0.36, 0.06, 0, 1.3, 0.24);
    box(B, main, 0.12, 0.3, 0.07, 0, 1.3, 0.255);
  } else if (id === 'mage') {
    // a tall pointed hat with a gold band and a glowing star
    box(H, dark, 0.86, 0.06, 0.86, 0, 0.27, 0);
    box(H, main, 0.5, 0.06, 0.5, 0, 0.33, 0);
    cone(H, main, 0.27, 0.72, 0, 0.7, 0, -0.12, 0, 4);
    box(H, gold, 0.56, 0.07, 0.56, 0, 0.35, 0);
    box(H, glow, 0.09, 0.09, 0.05, 0, 0.36, 0.29);
  } else if (id === 'rogue') {
    // a hood and a scarf over the lower face
    box(H, dark, 0.58, 0.12, 0.6, 0, 0.27, -0.02);
    box(H, dark, 0.58, 0.58, 0.12, 0, 0, -0.3);
    box(H, dark, 0.1, 0.5, 0.5, 0.3, 0.02, -0.04);
    box(H, dark, 0.1, 0.5, 0.5, -0.3, 0.02, -0.04);
    box(H, main, 0.54, 0.16, 0.06, 0, -0.14, 0.27);
    box(B, dark, 0.64, 0.14, 0.48, 0, 1.66, 0); // cowl
  } else if (id === 'ranger') {
    // a quiver with arrows on the back, a feather in a green cap band
    box(B, leather, 0.2, 0.64, 0.2, 0.14, 1.32, -0.34, 0.18, 0, -0.15);
    box(B, mat(0x3a2a18), 0.22, 0.08, 0.22, 0.14, 1.64, -0.3, 0.18, 0, -0.15);
    for (let i = 0; i < 3; i++) box(B, i === 1 ? main : bone, 0.05, 0.22, 0.05, 0.08 + i * 0.07, 1.74, -0.34 - i * 0.01, 0.18, 0, -0.15 + i * 0.1);
    box(H, dark, 0.54, 0.09, 0.54, 0, 0.2, 0);
    cone(H, main, 0.05, 0.34, 0.2, 0.36, -0.2, 0.3, -0.5, 4);
  } else if (id === 'cleric') {
    // a golden halo, a white tabard with a gold cross
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 6, 28), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = Math.PI / 2 - 0.2;
    halo.position.set(0, 0.56, -0.04);
    F.add(halo);
    box(B, mat(0xf4f0e4), 0.32, 0.78, 0.04, 0, 1.18, 0.225);
    box(B, gold, 0.06, 0.26, 0.05, 0, 1.28, 0.25);
    box(B, gold, 0.18, 0.06, 0.05, 0, 1.32, 0.25);
    for (const s of [1, -1]) box(B, gold, 0.3, 0.07, 0.36, s * 0.48, 1.62, 0, 0, 0, -s * 0.2);
  }
  return orb;
}

// ---- the look of the hunter ----------------------------------------------------
// Every option of the skin editor. The index of an entry is what is saved; the
// name is the key of its label (strings: 'opt.<option>.<name>'). New entries
// only ever go to the end, so saved looks stay the same.
export const LOOK_OPTIONS = {
  build: ['slim', 'normal', 'broad'],
  height: ['short', 'normal', 'tall'],
  hairStyle: ['short', 'spiky', 'long', 'ponytail', 'mohawk', 'swept', 'buzz', 'bun', 'braid', 'wild', 'undercut', 'twintails'],
  facialHair: ['none', 'stubble', 'goatee', 'beard', 'moustache'],
  eyeShape: ['normal', 'sharp', 'large', 'slit', 'visor'],
  mark: ['none', 'scar', 'paint', 'runes', 'freckles', 'patch'],
  accessory: ['none', 'earrings', 'headband', 'horns', 'halo', 'mask', 'circlet'],
  outfit: ['tunic', 'coat', 'hoodie', 'vest', 'robe', 'jacket'],
  capeStyle: ['none', 'cape', 'long', 'tattered', 'scarf', 'mantle'],
  auraStyle: ['ring', 'double', 'runes', 'flames', 'orbs'],
};
const LOOK_DEFAULT = { build: 1, height: 1 };
const LEATHER = 0x18161f;

const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
const mix = (a, b, k) => new THREE.Color(a).lerp(new THREE.Color(b), k).getHex();

// A complete look: fills in what older saves do not have yet, so a hunter
// made before an option existed looks exactly as before.
export function normLook(a) {
  const L = { ...a };
  for (const k in LOOK_OPTIONS) {
    const n = Number(L[k]);
    L[k] = Number.isInteger(n) && n >= 0 && n < LOOK_OPTIONS[k].length ? n : (LOOK_DEFAULT[k] || 0);
  }
  if (a.capeStyle == null) L.capeStyle = a.cape === false ? 0 : 1;
  L.cape = L.capeStyle > 0;
  const second = shade(L.clothes, 0.62); // collar, cuffs and trousers of older looks
  if (L.accent == null) L.accent = second;
  if (L.pants == null) L.pants = second;
  if (L.leather == null) L.leather = LEATHER;
  return L;
}

// ---- hairstyles (head centre at the origin, head is 0.5 units wide) -----------
function buildHair(style, m) {
  const g = new THREE.Group();
  const add = (w, h, d, x, y, z, rx = 0, rz = 0, ry = 0) => {
    const b = mesh(w, h, d, m, x, y, z);
    b.rotation.set(rx, ry, rz);
    g.add(b);
    return b;
  };
  const spike = (r, h, x, y, z, rx, rz) => {
    const s = new THREE.Mesh(new THREE.ConeGeometry(r, h, 4), m);
    s.position.set(x, y, z);
    s.rotation.set(rx, 0, rz);
    g.add(s);
  };
  if (style === 4) {
    // mohawk: shaved sides, one tall strip
    add(0.14, 0.26, 0.5, 0, 0.36, -0.02);
    add(0.14, 0.18, 0.18, 0, 0.3, -0.3);
    return g;
  }
  if (style === 6) {
    // buzz cut: a thin layer only
    add(0.52, 0.08, 0.52, 0, 0.27, 0);
    add(0.52, 0.34, 0.05, 0, 0.08, -0.24);
    add(0.05, 0.2, 0.36, 0.25, 0.14, -0.06);
    add(0.05, 0.2, 0.36, -0.25, 0.14, -0.06);
    return g;
  }
  if (style === 10) {
    // undercut: thin sides, a long top swept to one side
    add(0.52, 0.3, 0.05, 0, 0.1, -0.24);
    add(0.05, 0.18, 0.4, 0.25, 0.14, -0.04);
    add(0.05, 0.18, 0.4, -0.25, 0.14, -0.04);
    add(0.5, 0.16, 0.58, 0.02, 0.32, 0, 0.12, -0.12);
    add(0.3, 0.12, 0.16, 0.12, 0.3, 0.26, 0.5, -0.35);
    return g;
  }
  add(0.56, 0.2, 0.56, 0, 0.28, -0.02); // top
  if (style === 0) {
    add(0.56, 0.4, 0.16, 0, 0.05, -0.24);
  } else if (style === 1) {
    add(0.56, 0.34, 0.16, 0, 0.1, -0.24);
    for (let i = 0; i < 5; i++) spike(0.1, 0.32, -0.2 + i * 0.1, 0.48, -0.05 + (i % 2) * 0.12, 0, (i - 2) * -0.25);
  } else if (style === 2) {
    add(0.58, 0.9, 0.18, 0, -0.18, -0.24);
    add(0.1, 0.62, 0.42, 0.29, -0.04, -0.04);
    add(0.1, 0.62, 0.42, -0.29, -0.04, -0.04);
  } else if (style === 3) {
    add(0.56, 0.36, 0.16, 0, 0.08, -0.24);
    add(0.14, 0.14, 0.14, 0, 0.12, -0.36);
    add(0.13, 0.6, 0.13, 0, -0.2, -0.42, 0.25);
  } else if (style === 7) {
    // bun on top of the head
    add(0.56, 0.36, 0.14, 0, 0.08, -0.24);
    add(0.24, 0.2, 0.24, 0, 0.44, -0.12, 0.3);
    add(0.16, 0.08, 0.16, 0, 0.56, -0.1, 0.3);
  } else if (style === 8) {
    // one long braid down the back
    add(0.56, 0.38, 0.14, 0, 0.07, -0.24);
    for (let i = 0; i < 5; i++) {
      const s = 0.15 - i * 0.015;
      add(s, 0.15, s, 0, -0.1 - i * 0.14, -0.33 - i * 0.02, 0.15, i % 2 ? 0.2 : -0.2);
    }
  } else if (style === 9) {
    // wild: big, untamed spikes in every direction
    add(0.6, 0.42, 0.18, 0, 0.06, -0.25);
    const tips = [[-0.24, 0.42, 0.05, 0.6], [-0.1, 0.5, -0.05, 0.2], [0.06, 0.52, 0.06, -0.2], [0.2, 0.46, -0.06, -0.55],
      [0.32, 0.2, -0.05, -1.3], [-0.32, 0.2, -0.05, 1.3], [0, 0.36, -0.36, 0], [0.18, 0.3, 0.24, -0.5]];
    tips.forEach(([x, y, z, rz], i) => spike(0.11, 0.38, x, y, z, i === 6 ? -1.2 : i === 7 ? 0.9 : 0, rz));
  } else if (style === 11) {
    // two tails at the sides
    add(0.56, 0.36, 0.16, 0, 0.08, -0.24);
    for (const s of [1, -1]) {
      add(0.12, 0.12, 0.12, s * 0.3, 0.16, -0.12);
      add(0.15, 0.62, 0.15, s * 0.4, -0.18, -0.14, 0, s * 0.22);
      add(0.11, 0.2, 0.11, s * 0.47, -0.54, -0.14, 0, s * 0.3);
    }
  } else {
    // swept fringe over one eye
    add(0.56, 0.4, 0.16, 0, 0.05, -0.24);
    add(0.32, 0.22, 0.1, 0.12, 0.13, 0.26, 0, 0.35);
    add(0.1, 0.4, 0.4, 0.29, 0.06, -0.02);
  }
  return g;
}

// beard and moustache (head space)
function buildFacialHair(style, m, stubble) {
  const g = new THREE.Group();
  if (style === 1) g.add(mesh(0.44, 0.16, 0.03, stubble, 0, -0.16, 0.245));
  if (style === 2) {
    g.add(mesh(0.14, 0.14, 0.08, m, 0, -0.26, 0.22));
    g.add(mesh(0.2, 0.04, 0.04, m, 0, -0.1, 0.262));
  }
  if (style === 3) {
    g.add(mesh(0.54, 0.2, 0.12, m, 0, -0.2, 0.2));
    g.add(mesh(0.34, 0.14, 0.12, m, 0, -0.34, 0.19));
    g.add(mesh(0.06, 0.3, 0.32, m, 0.27, -0.06, 0.06));
    g.add(mesh(0.06, 0.3, 0.32, m, -0.27, -0.06, 0.06));
    g.add(mesh(0.24, 0.05, 0.04, m, 0, -0.1, 0.27));
  }
  if (style === 4) {
    g.add(mesh(0.26, 0.05, 0.05, m, 0, -0.1, 0.265));
    g.add(mesh(0.05, 0.1, 0.04, m, 0.13, -0.15, 0.262));
    g.add(mesh(0.05, 0.1, 0.04, m, -0.13, -0.15, 0.262));
  }
  return g;
}

// eyes, brows and mouth (head space); the eyes glow in their colour
function buildFace(g, shape, M) {
  const eye = (x, w, h, rz = 0) => {
    const e = mesh(w, h, 0.04, M.eyes, x, 0.02, 0.26);
    e.rotation.z = rz;
    g.add(e);
  };
  let brow = 0;
  if (shape === 4) {
    // visor: one glowing band
    g.add(mesh(0.4, 0.06, 0.04, M.eyes, 0, 0.02, 0.26));
    g.add(mesh(0.44, 0.03, 0.03, M.dark, 0, 0.065, 0.262));
  } else {
    for (const s of [1, -1]) {
      if (shape === 1) { eye(s * 0.12, 0.12, 0.045, s * 0.22); brow = 0.28; }
      else if (shape === 2) eye(s * 0.12, 0.11, 0.11);
      else eye(s * 0.12, 0.1, shape === 3 ? 0.08 : 0.07);
      if (shape === 2) g.add(mesh(0.04, 0.06, 0.02, M.dark, s * 0.13, 0.01, 0.282));
      if (shape === 3) g.add(mesh(0.025, 0.08, 0.02, M.dark, s * 0.12, 0.02, 0.282));
    }
  }
  if (shape !== 4) {
    for (const s of [1, -1]) {
      const b = mesh(0.13, 0.03, 0.03, M.hair, s * 0.12, shape === 2 ? 0.11 : 0.09, 0.26);
      b.rotation.z = -s * brow;
      g.add(b);
    }
  }
  g.add(mesh(0.12, 0.025, 0.03, M.dark, 0, -0.14, 0.255)); // mouth
  g.add(mesh(0.06, 0.09, 0.05, M.skin, 0, -0.05, 0.27)); // nose
  g.add(mesh(0.05, 0.12, 0.09, M.skin, 0.27, 0, 0)); // ears
  g.add(mesh(0.05, 0.12, 0.09, M.skin, -0.27, 0, 0));
}

// scars, paint and the like (head space)
function buildMark(g, mark, M) {
  if (mark === 1) {
    const s = mesh(0.035, 0.34, 0.02, M.scar, -0.12, 0.03, 0.258);
    s.rotation.z = 0.35;
    g.add(s);
  } else if (mark === 2) {
    for (const s of [1, -1]) {
      g.add(mesh(0.12, 0.028, 0.02, M.accent, s * 0.15, -0.07, 0.258));
      g.add(mesh(0.12, 0.028, 0.02, M.accent, s * 0.15, -0.115, 0.258));
    }
  } else if (mark === 3) {
    const d = mesh(0.07, 0.07, 0.02, M.glow, 0, 0.17, 0.258);
    d.rotation.z = Math.PI / 4;
    g.add(d);
    for (const s of [1, -1]) {
      g.add(mesh(0.025, 0.1, 0.02, M.glow, s * 0.12, -0.08, 0.258));
      g.add(mesh(0.025, 0.05, 0.02, M.glow, s * 0.17, -0.06, 0.258));
    }
  } else if (mark === 4) {
    [[0.07, -0.05], [0.12, -0.08], [0.17, -0.05], [0.1, -0.11]].forEach(([x, y]) => {
      g.add(mesh(0.025, 0.025, 0.02, M.scar, x, y, 0.258));
      g.add(mesh(0.025, 0.025, 0.02, M.scar, -x, y, 0.258));
    });
  } else if (mark === 5) {
    g.add(mesh(0.15, 0.13, 0.03, M.dark, 0.12, 0.02, 0.27));
    const strap = mesh(0.54, 0.03, 0.54, M.dark, 0, 0.08, 0);
    strap.rotation.z = -0.3;
    g.add(strap);
  }
}

// things worn on the head; 'top' ones are hidden under a helmet
function buildAccessory(kind, M) {
  const g = new THREE.Group();
  if (kind === 1) {
    g.add(mesh(0.04, 0.08, 0.04, M.gold, 0.28, -0.1, 0));
    g.add(mesh(0.04, 0.08, 0.04, M.gold, -0.28, -0.1, 0));
  } else if (kind === 2) {
    g.add(mesh(0.6, 0.08, 0.6, M.accent, 0, 0.14, 0));
    for (const s of [1, -1]) {
      const t = mesh(0.07, 0.32, 0.03, M.accent, s * 0.06, -0.02, -0.32);
      t.rotation.set(0.3, 0, s * 0.25);
      g.add(t);
    }
  } else if (kind === 3) {
    for (const s of [1, -1]) {
      cone(g, M.horn, 0.075, 0.24, s * 0.22, 0.38, 0.02, -0.3, -s * 0.5, 6);
      cone(g, M.horn, 0.05, 0.2, s * 0.3, 0.55, -0.06, -0.6, -s * 0.15, 6);
    }
  } else if (kind === 5) {
    g.add(mesh(0.54, 0.22, 0.06, M.leather, 0, -0.15, 0.25));
    g.add(mesh(0.4, 0.03, 0.03, M.accent, 0, -0.06, 0.282));
  } else if (kind === 6) {
    g.add(mesh(0.56, 0.06, 0.56, M.gold, 0, 0.17, 0));
    for (let i = -1; i <= 1; i++) cone(g, M.gold, 0.05, i ? 0.12 : 0.18, i * 0.14, 0.27 + (i ? 0 : 0.03), 0.27, 0, 0, 4);
    g.add(mesh(0.06, 0.06, 0.03, M.glow, 0, 0.17, 0.285));
  }
  return g;
}

function castShadows(root) {
  root.traverse((o) => { if (o.isMesh && o.material && o.material.isMeshLambertMaterial) o.castShadow = true; });
}

export function createPlayerModel(appearance, cls = '') {
  const A = normLook(appearance);
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const SX = [0.88, 1, 1.13][A.build], SY = [0.93, 1, 1.07][A.height];
  body.scale.set(SX, SY, SX);

  const glowMat = () => new THREE.MeshBasicMaterial({ color: A.aura });
  const mats = {
    skin: mat(A.skin),
    hair: mat(A.hair),
    clothes: mat(A.clothes),
    accent: mat(A.accent),
    pants: mat(A.pants),
    leather: mat(A.leather),
    sole: mat(shade(A.leather, 0.6)),
    cape: mat(A.capeColor),
    lining: mat(shade(A.capeColor, 0.55)),
    eyes: new THREE.MeshBasicMaterial({ color: A.eyes }),
    dark: mat(0x16121c),
    gold: mat(0xc9a24a),
    scar: mat(shade(A.skin, 0.62)),
    stubble: mat(mix(A.skin, A.hair, 0.5)),
    horn: mat(0x2a2230),
    glow: glowMat(),
  };
  const add = (w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => box(body, m, w, h, d, x, y, z, rx, ry, rz);
  const O = A.outfit;

  // ---- torso: shirt or coat, belt with a buckle, collar, neck
  add(0.72, 0.8, 0.42, mats.clothes, 0, 1.2, 0);
  add(0.76, 0.14, 0.46, O === 4 ? mats.accent : mats.leather, 0, 0.84, 0); // belt (a sash on the robe)
  add(0.14, 0.1, 0.04, mats.gold, 0, 0.84, 0.24);
  add(0.2, 0.12, 0.2, mats.skin, 0, 1.63, 0); // neck
  if (O === 0) {
    // tunic: short hem, collar
    add(0.74, 0.14, 0.44, mats.clothes, 0, 0.72, 0);
    add(0.3, 0.1, 0.44, mats.accent, 0, 1.56, 0);
  } else if (O === 1) {
    // long coat: open front, high collar, tails at the back
    add(0.14, 0.66, 0.02, mats.accent, 0, 1.24, 0.215);
    add(0.06, 0.06, 0.02, mats.gold, 0.1, 1.36, 0.225);
    add(0.06, 0.06, 0.02, mats.gold, 0.1, 1.14, 0.225);
    add(0.62, 0.22, 0.1, mats.clothes, 0, 1.66, -0.18);
    add(0.08, 0.3, 0.03, mats.accent, 0.13, 1.44, 0.22, 0, 0, 0.35);
    add(0.08, 0.3, 0.03, mats.accent, -0.13, 1.44, 0.22, 0, 0, -0.35);
    add(0.74, 0.62, 0.06, mats.clothes, 0, 0.48, -0.2, -0.12);
    add(0.06, 0.5, 0.36, mats.clothes, 0.36, 0.56, -0.04, 0, 0, 0.08);
    add(0.06, 0.5, 0.36, mats.clothes, -0.36, 0.56, -0.04, 0, 0, -0.08);
    add(0.26, 0.2, 0.05, mats.clothes, 0.22, 0.68, 0.2);
    add(0.26, 0.2, 0.05, mats.clothes, -0.22, 0.68, 0.2);
  } else if (O === 2) {
    // hoodie: the hood lies on the back, strings and a pocket at the front
    add(0.74, 0.14, 0.44, mats.clothes, 0, 0.72, 0);
    add(0.52, 0.3, 0.2, mats.clothes, 0, 1.62, -0.3, 0.25);
    add(0.4, 0.12, 0.06, mats.accent, 0, 1.62, -0.38, 0.25);
    add(0.03, 0.2, 0.03, mats.accent, 0.08, 1.44, 0.22);
    add(0.03, 0.2, 0.03, mats.accent, -0.08, 1.44, 0.22);
    add(0.42, 0.18, 0.03, mats.accent, 0, 1.0, 0.215);
  } else if (O === 3) {
    // vest without sleeves, a shirt under it, a pad on one shoulder
    add(0.74, 0.14, 0.44, mats.clothes, 0, 0.72, 0);
    add(0.2, 0.7, 0.02, mats.accent, 0, 1.2, 0.215);
    add(0.3, 0.1, 0.44, mats.accent, 0, 1.56, 0);
    add(0.32, 0.14, 0.36, mats.leather, 0.46, 1.62, 0, 0, 0, -0.25);
    add(0.34, 0.04, 0.38, mats.gold, 0.46, 1.56, 0, 0, 0, -0.25);
  } else if (O === 4) {
    // robe: long skirt, the ends of the sash hang down at the front
    add(0.82, 0.5, 0.5, mats.clothes, 0, 0.54, 0);
    add(0.86, 0.06, 0.54, mats.accent, 0, 0.32, 0);
    add(0.1, 0.36, 0.03, mats.accent, 0.12, 0.62, 0.27, 0, 0, 0.08);
    add(0.1, 0.3, 0.03, mats.accent, 0.24, 0.64, 0.27, 0, 0, -0.1);
    add(0.5, 0.12, 0.46, mats.accent, 0, 1.58, 0);
    add(0.16, 0.6, 0.02, mats.accent, 0, 1.22, 0.215);
  } else {
    // jacket with straps, a plate on one shoulder and a high collar
    add(0.74, 0.14, 0.44, mats.clothes, 0, 0.72, 0);
    add(0.1, 0.84, 0.04, mats.leather, 0.04, 1.22, 0.22, 0, 0, 0.62);
    add(0.1, 0.84, 0.04, mats.leather, -0.04, 1.22, -0.22, 0, 0, -0.62);
    add(0.08, 0.08, 0.03, mats.gold, 0.04, 1.22, 0.245);
    add(0.38, 0.16, 0.42, mats.accent, -0.46, 1.64, 0, 0, 0, 0.3);
    add(0.32, 0.08, 0.38, mats.accent, -0.5, 1.52, 0, 0, 0, 0.35);
    add(0.52, 0.16, 0.48, mats.accent, 0, 1.62, -0.02);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.88, 0);
  head.scale.set(1 / SX, 1 / SY, 1 / SX); // the head keeps its size on every build
  head.add(mesh(0.5, 0.5, 0.5, mats.skin, 0, 0, 0));
  const hair = buildHair(A.hairStyle, mats.hair);
  head.add(hair);
  buildFace(head, A.eyeShape, mats);
  buildMark(head, A.mark, mats);
  head.add(buildFacialHair(A.facialHair, mats.hair, mats.stubble));
  // a halo floats above the head, everything else is worn on it
  const worn = A.accessory === 4 ? new THREE.Group() : buildAccessory(A.accessory, mats);
  head.add(worn);
  let halo = null;
  if (A.accessory === 4) {
    halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 6, 28),
      new THREE.MeshBasicMaterial({ color: A.aura, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.rotation.x = Math.PI / 2 - 0.25;
    halo.position.set(0, 0.5, -0.04);
    head.add(halo);
  }
  body.add(head);

  // the parts of the main class (setClass changes them when the class is chosen later)
  const clsHead = new THREE.Group(), clsFree = new THREE.Group(), clsBody = new THREE.Group();
  head.add(clsHead);
  head.add(clsFree);
  body.add(clsBody);
  let clsOrb = null, clsKey = null, helmetOn = false;
  function setClass(id) {
    id = id || '';
    if (id === clsKey) return;
    clsKey = id;
    for (const g of [clsHead, clsFree, clsBody]) for (const c of [...g.children]) { g.remove(c); dispose(c); }
    // the hat and hood are shown on the bare head only; the halo, pauldrons and quiver stay
    clsOrb = buildClassParts(id, clsHead, clsBody, clsFree);
    castShadows(clsHead);
    castShadows(clsBody);
    clsHead.visible = !helmetOn;
  }
  setClass(cls);

  function limb(x, y) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    body.add(pivot);
    return pivot;
  }
  // arms: sleeve (bare on the vest) and hand
  const armL = limb(0.48, 1.56), armR = limb(-0.48, 1.56);
  for (const arm of [armL, armR]) {
    if (O === 3) {
      arm.add(mesh(0.18, 0.4, 0.2, mats.skin, 0, -0.2, 0));
      arm.add(mesh(0.2, 0.22, 0.22, mats.leather, 0, -0.48, 0)); // bracer
      arm.add(mesh(0.21, 0.04, 0.23, mats.gold, 0, -0.4, 0));
    } else {
      arm.add(mesh(0.2, 0.6, 0.22, mats.clothes, 0, -0.3, 0));
      arm.add(mesh(0.22, 0.06, 0.24, mats.accent, 0, -0.58, 0));
    }
    arm.add(mesh(0.17, 0.14, 0.19, mats.skin, 0, -0.67, 0));
  }
  if (O === 4) for (const arm of [armL, armR]) arm.add(mesh(0.26, 0.2, 0.28, mats.clothes, 0, -0.5, 0)); // wide sleeves
  // legs: trousers and boots
  const legL = limb(0.19, 0.8), legR = limb(-0.19, 0.8);
  for (const leg of [legL, legR]) {
    leg.add(mesh(0.26, 0.5, 0.28, mats.pants, 0, -0.25, 0));
    leg.add(mesh(0.28, 0.32, 0.32, mats.leather, 0, -0.64, 0.02));
    leg.add(mesh(0.3, 0.05, 0.34, mats.sole, 0, -0.78, 0.02));
    leg.add(mesh(0.3, 0.05, 0.34, mats.sole, 0, -0.5, 0.02)); // top of the boot
  }

  // ---- cape, scarf or mantle (swings on the back)
  const cape = new THREE.Group();
  cape.position.set(0, 1.58, -0.24);
  const C = A.capeStyle;
  const cadd = (w, h, d, m, x, y, z, rz = 0) => box(cape, m, w, h, d, x, y, z, 0, 0, rz);
  if (C === 1) {
    cadd(0.7, 1.15, 0.05, mats.cape, 0, -0.57, 0);
    cadd(0.76, 0.1, 0.1, mats.cape, 0, -0.02, 0.02);
  } else if (C === 2) {
    // long, wide, lined in a darker shade, with a gold clasp bar
    cadd(0.86, 1.5, 0.05, mats.cape, 0, -0.74, 0);
    cadd(0.8, 1.44, 0.02, mats.lining, 0, -0.73, 0.035);
    cadd(0.92, 0.14, 0.14, mats.cape, 0, -0.02, 0.03);
    cadd(0.94, 0.04, 0.16, mats.gold, 0, 0.04, 0.03);
  } else if (C === 3) {
    // torn: strips of different length at the bottom
    cadd(0.72, 0.8, 0.05, mats.cape, 0, -0.4, 0);
    cadd(0.78, 0.1, 0.1, mats.cape, 0, -0.02, 0.02);
    [0.42, 0.24, 0.5, 0.3, 0.46].forEach((l, i) => cadd(0.13, l, 0.04, mats.cape, -0.28 + i * 0.14, -0.8 - l / 2 + 0.02, 0, (i - 2) * 0.04));
  } else if (C === 4) {
    // scarf: wrapped around the neck, two tails flow behind
    add(0.36, 0.13, 0.34, mats.cape, 0, 1.64, 0);
    add(0.38, 0.06, 0.36, mats.lining, 0, 1.57, 0);
    cadd(0.16, 0.75, 0.04, mats.cape, 0.1, -0.36, 0, 0.08);
    cadd(0.14, 0.5, 0.04, mats.cape, -0.06, -0.24, 0.01, -0.12);
  } else if (C === 5) {
    // mantle over one shoulder
    cadd(0.44, 0.95, 0.05, mats.cape, 0.18, -0.48, 0);
    add(0.38, 0.16, 0.48, mats.cape, 0.4, 1.62, -0.02, 0, 0, -0.22);
    add(0.1, 0.1, 0.04, mats.gold, 0.22, 1.56, 0.24);
  }
  cape.visible = C > 0;
  body.add(cape);

  // ---- aura on the ground in the aura colour (plus extras by style)
  const glowOf = (o = 0.45) => new THREE.MeshBasicMaterial({ color: A.aura, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const flat = (geo, m, y) => {
    geo.rotateX(-Math.PI / 2);
    const o = new THREE.Mesh(geo, m);
    o.position.y = y;
    o.renderOrder = 2;
    return o;
  };
  const aura = flat(new THREE.RingGeometry(0.55, 0.85, 24), glowOf(), 0.06);
  root.add(aura);
  const auraFx = new THREE.Group(); // spins
  root.add(auraFx);
  const fxMat = glowOf(0.6);
  const flames = [], orbs = [];
  const S = A.auraStyle;
  if (S === 1) {
    auraFx.add(flat(new THREE.RingGeometry(0.3, 0.36, 24), fxMat, 0.065));
    for (let i = 0; i < 6; i++) auraFx.add(flat(new THREE.RingGeometry(0.95, 1.02, 6, 1, (i / 6) * Math.PI * 2, 0.7), fxMat, 0.065));
  } else if (S === 2) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = flat(new THREE.PlaneGeometry(0.12, 0.12), fxMat, 0.065);
      r.position.set(Math.cos(a) * 1.0, 0.065, Math.sin(a) * 1.0);
      r.rotation.y = a + Math.PI / 4;
      auraFx.add(r);
    }
    auraFx.add(flat(new THREE.RingGeometry(1.08, 1.11, 32), fxMat, 0.065));
  } else if (S === 3) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.4, 4), fxMat);
      f.position.set(Math.cos(a) * 0.72, 0.2, Math.sin(a) * 0.72);
      f.renderOrder = 2;
      flames.push(f);
      auraFx.add(f);
    }
  } else if (S === 4) {
    for (let i = 0; i < 3; i++) {
      const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), glowOf(0.9));
      o.renderOrder = 2;
      orbs.push(o);
      auraFx.add(o);
    }
  }
  let time = Math.random() * 10;
  castShadows(body);

  // ---- equipment: rebuilt whenever it changes ---------------------------------
  let gear = []; // { group, parent }
  let gearKey = '';

  function attach(parent, group) {
    castShadows(group);
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
    worn.visible = !equip.helmet;
    helmetOn = !!equip.helmet;
    clsHead.visible = !helmetOn;
    if (equip.helmet) attach(head, armorPiece('helmet', equip.helmet));
    if (equip.chest) attach(body, armorPiece('chest', equip.chest));
    if (equip.gloves) for (const arm of [armL, armR]) attach(arm, armorPiece('gloves', equip.gloves));
    if (equip.boots) for (const leg of [legL, legR]) attach(leg, armorPiece('boots', equip.boots));
  }

  let walk = 0;
  let fall = 0;
  let lean = 0;
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  // p: 0 -> 1 through the attack
  const POSE = { crossbow: 'bow', javelin: 'spear', wand: 'grimoire', orb: 'grimoire' }; // the new weapons move like their relatives
  function attackPose(weapon, p, combo) {
    weapon = POSE[weapon] || weapon;
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
    setClass,
    // st: { moving, attack (1 -> 0 while swinging), weapon, combo (0 / 1,
    // alternates every attack), cast (1 -> 0 while casting a skill), dodging, dead }
    animate(dt, st) {
      fall += ((st.dead ? 1 : 0) - fall) * Math.min(1, dt * 8);
      const run = st.moving && !st.dead;
      lean += ((run ? (st.rate > 1 ? 0.32 : 0.13) : 0) - lean) * Math.min(1, dt * 10);
      body.rotation.x = -fall * 1.45 + (st.dodging ? 0.55 : 0) + lean;

      if (st.moving && !st.dead) walk += dt * 13 * (st.rate || 1);
      const swing = st.moving && !st.dead ? Math.sin(walk) * 0.75 : 0;
      legL.rotation.x += (swing - legL.rotation.x) * 0.5;
      legR.rotation.x += (-swing - legR.rotation.x) * 0.5;
      armL.rotation.x += (-swing * 0.7 - armL.rotation.x) * 0.5;

      body.position.y = fall * 0.25
        + (run ? Math.abs(Math.sin(walk)) * 0.07 : Math.sin(time * 2.2) * 0.018); // bob / breathing
      head.rotation.x = run ? -0.1 : Math.sin(time * 1.1) * 0.03;
      // a short lunge forward on every attack
      const lunge = st.attack > 0 ? Math.sin((1 - st.attack) * Math.PI) * 0.16 : 0;
      body.position.z += (lunge - body.position.z) * Math.min(1, dt * 20);
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
      time += dt;
      auraFx.visible = !st.dead;
      auraFx.rotation.y = time * (S === 1 ? 0.6 : 0.35);
      flames.forEach((f, i) => {
        const k = 0.7 + 0.45 * Math.abs(Math.sin(time * 5 + i * 1.7));
        f.scale.set(1, k, 1);
        f.position.y = 0.2 * k;
      });
      orbs.forEach((o, i) => {
        const a = -time * 1.6 + (i / 3) * Math.PI * 2;
        o.position.set(Math.cos(a) * 0.8, 1.05 + Math.sin(time * 2 + i * 2) * 0.15, Math.sin(a) * 0.8);
        o.rotation.y = time * 3;
      });
      if (halo) halo.position.y = 0.5 + Math.sin(time * 2) * 0.03;
      if (clsOrb) { clsOrb.position.y = 2.35 + Math.sin(time * 2.4) * 0.07; clsOrb.rotation.y = time * 2; }
      const flutter = st.moving ? 0.55 + Math.sin(walk * 0.7) * 0.12 : 0.1;
      cape.rotation.x += (flutter - cape.rotation.x) * 0.2;
    },
  };
}
