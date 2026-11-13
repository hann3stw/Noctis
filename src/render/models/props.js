// World decoration models. Each type is one merged geometry that is drawn with
// InstancedMesh per chunk.
import { box, cone, cyl, blob, merge } from '../geo.js';

function grass() {
  return merge([
    cone(0.09, 0.55, 3, 0x6fb54a, 0, 0.27, 0, 0, 0, 0.12),
    cone(0.08, 0.42, 3, 0x5aa040, 0.14, 0.2, 0.05, 0.2, 0, -0.3),
    cone(0.08, 0.46, 3, 0x7cc257, -0.12, 0.22, -0.06, -0.2, 0, 0.35),
  ]);
}

function flower() {
  return merge([
    cyl(0.03, 0.03, 0.4, 3, 0x9ad07a, 0, 0.2, 0),
    blob(0.14, 0xffffff, 0, 0.46, 0, 1, 0.6, 1),
    blob(0.06, 0xffe9a0, 0, 0.52, 0),
  ]);
}

function bush() {
  return merge([
    blob(0.7, 0x3f8a3a, 0, 0.5, 0, 1, 0.8, 1),
    blob(0.5, 0x4c9c44, 0.55, 0.4, 0.2, 1, 0.8, 1),
    blob(0.45, 0x357a33, -0.45, 0.35, -0.25, 1, 0.8, 1),
  ]);
}

function rock() {
  return merge([
    blob(1, 0x7d8490, 0, 0.45, 0, 1, 0.7, 0.9),
    blob(0.55, 0x6a707c, 0.8, 0.25, 0.3, 1, 0.7, 1),
  ]);
}

function tree() {
  return merge([
    cyl(0.22, 0.32, 1.6, 5, 0x5b4030, 0, 0.8, 0),
    cone(1.5, 1.9, 6, 0x2f7a3a, 0, 2.2, 0),
    cone(1.15, 1.6, 6, 0x3a8c44, 0, 3.2, 0),
    cone(0.75, 1.2, 6, 0x48a04e, 0, 4.1, 0),
  ]);
}

// ---- forest
function pine() {
  return merge([
    cyl(0.18, 0.26, 1.4, 5, 0x4a3426, 0, 0.7, 0),
    cone(1.1, 1.8, 6, 0x1e5a32, 0, 2.0, 0),
    cone(0.85, 1.6, 6, 0x24683a, 0, 3.0, 0),
    cone(0.6, 1.4, 6, 0x2a7442, 0, 3.9, 0),
    cone(0.35, 1.0, 6, 0x30804a, 0, 4.7, 0),
  ]);
}

function fern() {
  const p = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    p.push(box(0.22, 0.04, 0.9, i % 2 ? 0x2e6a2a : 0x3a7a32, Math.sin(a) * 0.35, 0.22, Math.cos(a) * 0.35, -0.5, a, 0));
  }
  return merge(p);
}

function mushroomDecor() {
  return merge([
    cyl(0.07, 0.09, 0.35, 5, 0xe8e0d0, 0, 0.17, 0),
    cyl(0.05, 0.28, 0.16, 7, 0xc03030, 0, 0.4, 0),
    blob(0.04, 0xffffff, 0.12, 0.46, 0.05),
    cyl(0.05, 0.07, 0.22, 5, 0xe8e0d0, 0.3, 0.11, 0.15),
    cyl(0.04, 0.18, 0.1, 7, 0xc03030, 0.3, 0.26, 0.15),
  ]);
}

// ---- swamp
function reed() {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const x = (i % 3) * 0.18 - 0.18, z = (i > 2 ? 0.15 : -0.1);
    p.push(box(0.05, 1.1 + (i % 3) * 0.3, 0.05, 0x6a7a3a, x, 0.6 + (i % 3) * 0.15, z, 0, 0, (i - 2.5) * 0.06));
    if (i % 2 === 0) p.push(box(0.09, 0.3, 0.09, 0x5a3a22, x, 1.25 + (i % 3) * 0.3, z));
  }
  return merge(p);
}

function puddle() {
  return merge([
    cyl(1.5, 1.6, 0.04, 9, 0x5a6448, 0, 0.02, 0),
    cyl(1.3, 1.35, 0.05, 9, 0x22322e, 0, 0.04, 0),
  ]);
}

function deadTree() {
  return merge([
    cyl(0.18, 0.3, 2.4, 5, 0x4a4038, 0, 1.2, 0),
    box(0.12, 1.1, 0.12, 0x4a4038, 0.4, 2.2, 0, 0, 0, -0.8),
    box(0.1, 0.9, 0.1, 0x4a4038, -0.35, 2.6, 0.1, 0.3, 0, 0.9),
    box(0.08, 0.7, 0.08, 0x4a4038, 0.1, 2.8, -0.35, -0.8, 0, 0),
  ]);
}

function glowShroom() {
  return merge([
    cyl(0.08, 0.1, 0.5, 5, 0x6a8a9a, 0, 0.25, 0),
    cyl(0.06, 0.34, 0.18, 7, 0x40e0ff, 0, 0.55, 0),
    cyl(0.06, 0.08, 0.3, 5, 0x6a8a9a, 0.35, 0.15, 0.2),
    cyl(0.05, 0.22, 0.12, 7, 0x60ffd0, 0.35, 0.34, 0.2),
  ]);
}

// ---- ruins
function dryGrass() {
  return merge([
    cone(0.08, 0.5, 3, 0xb0a060, 0, 0.25, 0, 0, 0, 0.15),
    cone(0.07, 0.4, 3, 0x9a8a50, 0.13, 0.2, 0.05, 0.2, 0, -0.35),
    cone(0.07, 0.42, 3, 0xc0b070, -0.12, 0.21, -0.05, -0.2, 0, 0.35),
  ]);
}

function rubble() {
  return merge([
    box(0.45, 0.3, 0.4, 0xa09078, 0, 0.15, 0, 0, 0.4, 0.1),
    box(0.3, 0.22, 0.32, 0x8a7c66, 0.45, 0.11, 0.2, 0.2, 1.1, 0),
    box(0.25, 0.18, 0.25, 0xb0a088, -0.3, 0.09, 0.35, 0, 0.7, 0.2),
  ]);
}

function pillar() {
  return merge([
    box(1.3, 0.35, 1.3, 0x9a8c74, 0, 0.17, 0),
    cyl(0.45, 0.5, 2.6, 8, 0xb4a68c, 0, 1.6, 0),
    box(0.8, 0.5, 0.7, 0xb4a68c, 0.2, 3.0, 0, 0.1, 0.3, 0.25),
  ]);
}

function wall() {
  return merge([
    box(2.8, 1.6, 0.7, 0xa09078, 0, 0.8, 0),
    box(1.6, 0.6, 0.7, 0xa09078, -0.6, 1.9, 0),
    box(0.6, 0.35, 0.72, 0x8a7c66, 0.9, 1.75, 0, 0, 0, 0.4),
    box(0.5, 0.3, 0.5, 0x8a7c66, 1.6, 0.15, 0.5, 0, 0.5, 0),
  ]);
}

// ---- ice
function snowMound() {
  return merge([
    blob(0.9, 0xf0f6fc, 0, 0.05, 0, 1.2, 0.35, 1),
    blob(0.6, 0xe4eef8, 0.8, 0.0, 0.4, 1, 0.35, 1),
  ]);
}

function snowPine() {
  return merge([
    cyl(0.18, 0.26, 1.3, 5, 0x4a3a30, 0, 0.65, 0),
    cone(1.15, 1.7, 6, 0x2a5040, 0, 1.9, 0),
    cone(1.0, 0.6, 6, 0xf0f6fc, 0, 2.3, 0),
    cone(0.85, 1.5, 6, 0x2e5a48, 0, 2.9, 0),
    cone(0.7, 0.5, 6, 0xf0f6fc, 0, 3.3, 0),
    cone(0.5, 1.3, 6, 0x34644e, 0, 3.8, 0),
    cone(0.36, 0.5, 6, 0xffffff, 0, 4.3, 0),
  ]);
}

function crystal() {
  return merge([
    cone(0.35, 2.2, 5, 0x80d8ff, 0, 1.1, 0),
    cone(0.25, 1.4, 5, 0xa0e8ff, 0.45, 0.6, 0.1, 0, 0, -0.4),
    cone(0.22, 1.2, 5, 0x60c0f0, -0.35, 0.5, -0.2, 0.3, 0, 0.4),
  ]);
}

function iceRock() {
  return merge([
    blob(1, 0xa8c4dc, 0, 0.45, 0, 1, 0.7, 0.9),
    blob(0.7, 0xf0f6fc, 0, 0.85, 0, 1.1, 0.35, 1),
    blob(0.5, 0x90b0cc, 0.8, 0.25, 0.3, 1, 0.7, 1),
  ]);
}

// ---- volcano
function ash() {
  return merge([
    cone(0.12, 0.35, 3, 0x4a4040, 0, 0.17, 0),
    cone(0.1, 0.28, 3, 0x3a3434, 0.18, 0.14, 0.1),
    blob(0.15, 0x302a2a, -0.15, 0.05, 0.05, 1, 0.4, 1),
  ]);
}

function basalt() {
  return merge([
    cyl(0.5, 0.5, 2.4, 6, 0x2a2626, 0, 1.2, 0),
    cyl(0.45, 0.45, 1.6, 6, 0x342e2e, 0.8, 0.8, 0.3),
    cyl(0.45, 0.45, 1.1, 6, 0x221e1e, -0.6, 0.55, 0.5),
    cyl(0.4, 0.4, 0.6, 6, 0x302a2a, 0.1, 0.3, -0.75),
  ]);
}

function lavaPool() {
  return merge([
    cyl(1.4, 1.5, 0.05, 8, 0xff6010, 0, 0.03, 0),
    cyl(0.9, 1.0, 0.06, 8, 0xffb030, 0.15, 0.05, -0.1),
  ]);
}

function charredTree() {
  return merge([
    cyl(0.16, 0.28, 2.2, 5, 0x1e1a1a, 0, 1.1, 0),
    box(0.1, 0.9, 0.1, 0x1e1a1a, 0.35, 2.0, 0, 0, 0, -0.9),
    box(0.09, 0.8, 0.09, 0x1e1a1a, -0.3, 2.3, 0.05, 0.3, 0, 0.9),
    blob(0.08, 0xff6010, 0.7, 2.3, 0),
    blob(0.07, 0xff6010, -0.62, 2.62, 0.1),
  ]);
}

function emberCrystal() {
  return merge([
    cone(0.32, 1.8, 5, 0xff5020, 0, 0.9, 0),
    cone(0.22, 1.1, 5, 0xff8030, 0.4, 0.5, 0.1, 0, 0, -0.4),
    cone(0.2, 1.0, 5, 0xe03a10, -0.32, 0.45, -0.2, 0.3, 0, 0.4),
  ]);
}

// collide: collision radius at scale 1 (0 = walk through)
// tint: 'shade' = slight brightness variation, 'flower' = random petal colour
// glow: drawn unlit, so it shines in the dark
export const DECOR = {
  grass: { build: grass, collide: 0, scale: [0.8, 1.5], tint: 'shade' },
  flower: { build: flower, collide: 0, scale: [0.8, 1.3], tint: 'flower' },
  bush: { build: bush, collide: 0, scale: [0.7, 1.2], tint: 'shade' },
  rock: { build: rock, collide: 0.95, scale: [0.6, 1.5], tint: 'shade' },
  tree: { build: tree, collide: 0.45, scale: [0.85, 1.3], tint: 'shade' },
  pine: { build: pine, collide: 0.4, scale: [0.9, 1.4], tint: 'shade' },
  fern: { build: fern, collide: 0, scale: [0.8, 1.4], tint: 'shade' },
  mushroom: { build: mushroomDecor, collide: 0, scale: [0.8, 1.6], tint: 'shade' },
  reed: { build: reed, collide: 0, scale: [0.8, 1.3], tint: 'shade' },
  puddle: { build: puddle, collide: 0, scale: [0.7, 1.6], tint: 'shade' },
  deadTree: { build: deadTree, collide: 0.4, scale: [0.8, 1.3], tint: 'shade' },
  glowShroom: { build: glowShroom, collide: 0, scale: [0.8, 1.6], tint: 'shade', glow: true },
  dryGrass: { build: dryGrass, collide: 0, scale: [0.8, 1.5], tint: 'shade' },
  rubble: { build: rubble, collide: 0, scale: [0.7, 1.4], tint: 'shade' },
  pillar: { build: pillar, collide: 0.6, scale: [0.8, 1.2], tint: 'shade' },
  wall: { build: wall, collide: 1.2, scale: [0.8, 1.1], tint: 'shade' },
  snowMound: { build: snowMound, collide: 0, scale: [0.7, 1.5], tint: 'shade' },
  snowPine: { build: snowPine, collide: 0.4, scale: [0.9, 1.4], tint: 'shade' },
  crystal: { build: crystal, collide: 0.5, scale: [0.7, 1.4], tint: 'shade', glow: true },
  iceRock: { build: iceRock, collide: 0.95, scale: [0.6, 1.4], tint: 'shade' },
  ash: { build: ash, collide: 0, scale: [0.8, 1.5], tint: 'shade' },
  basalt: { build: basalt, collide: 0.9, scale: [0.7, 1.3], tint: 'shade' },
  lavaPool: { build: lavaPool, collide: 0, scale: [0.7, 1.5], tint: 'shade', glow: true },
  charredTree: { build: charredTree, collide: 0.4, scale: [0.8, 1.3], tint: 'shade' },
  emberCrystal: { build: emberCrystal, collide: 0.5, scale: [0.7, 1.3], tint: 'shade', glow: true },
};

// ---- gates ------------------------------------------------------------------------
// Stone frame of a gate. The glowing portal inside is added separately.
export function gateFrameGeometry() {
  return merge([
    box(1.0, 5.2, 1.0, 0x2a2436, -2.4, 2.6, 0),
    box(1.0, 5.2, 1.0, 0x2a2436, 2.4, 2.6, 0),
    box(6.0, 0.9, 1.1, 0x342c44, 0, 5.4, 0),
    box(1.4, 0.4, 1.4, 0x1c1828, -2.4, 0.2, 0),
    box(1.4, 0.4, 1.4, 0x1c1828, 2.4, 0.2, 0),
    cone(0.5, 1.0, 4, 0x342c44, -2.4, 6.3, 0, 0, Math.PI / 4, 0),
    cone(0.5, 1.0, 4, 0x342c44, 2.4, 6.3, 0, 0, Math.PI / 4, 0),
    box(5.4, 0.15, 2.6, 0x1c1828, 0, 0.07, 0),
  ]);
}

export function arenaPillarGeometry() {
  return merge([
    box(1.4, 0.4, 1.4, 0x1c1828, 0, 0.2, 0),
    box(0.9, 2.0, 0.9, 0x2a2436, 0, 1.2, 0),
    box(1.2, 0.4, 1.2, 0x342c44, 0, 2.3, 0),
  ]);
}

export const FLOWER_COLORS = [0xff7fb0, 0xffd24a, 0xffffff, 0xb48cff, 0x7fd0ff];

// --- camp pieces -----------------------------------------------------------

export function tentGeometry() {
  return merge([
    cone(2.6, 3.0, 4, 0x4a3a6a, 0, 1.5, 0, 0, Math.PI / 4, 0),
    cone(2.75, 0.5, 4, 0x2c2244, 0, 0.25, 0, 0, Math.PI / 4, 0),
    box(0.9, 1.5, 0.1, 0x15101f, 0, 0.75, 1.72, -0.5, 0, 0),
    cyl(0.05, 0.05, 0.9, 4, 0x8a7a5a, 0, 3.3, 0),
    box(0.5, 0.3, 0.03, 0x8a4dff, 0.27, 3.55, 0),
  ]);
}

export function runeStoneGeometry() {
  return merge([
    box(0.7, 1.8, 0.5, 0x3a3648, 0, 0.9, 0, 0, 0, 0.05),
    box(0.5, 0.5, 0.35, 0x2c2838, 0, 1.95, 0, 0, 0, 0.3),
  ]);
}

export function campfireGeometry() {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(blob(0.3, 0x6a6a74, Math.cos(a) * 1.1, 0.15, Math.sin(a) * 1.1, 1, 0.7, 1));
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    parts.push(cyl(0.12, 0.12, 1.5, 5, 0x4a3324, 0, 0.25, 0, Math.PI / 2, a, 0));
  }
  return merge(parts);
}

export function crateGeometry() {
  return merge([
    box(1.1, 1.1, 1.1, 0x6b4f33, 0, 0.55, 0),
    box(1.16, 0.14, 1.16, 0x4a3522, 0, 0.2, 0),
    box(1.16, 0.14, 1.16, 0x4a3522, 0, 0.9, 0),
    box(0.8, 0.8, 0.8, 0x7a5a3a, 0.9, 0.4, 0.5, 0, 0.5, 0),
  ]);
}

export function altarGeometry() {
  return merge([
    cyl(1.6, 1.9, 0.5, 6, 0x2a2636, 0, 0.25, 0),
    cyl(1.1, 1.3, 0.4, 6, 0x353044, 0, 0.7, 0),
    box(0.6, 2.2, 0.6, 0x1c1828, 0, 2.0, 0, 0, Math.PI / 4, 0),
  ]);
}
