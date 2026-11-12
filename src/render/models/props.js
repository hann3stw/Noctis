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

// collide: collision radius at scale 1 (0 = walk through)
// tint: 'shade' = slight brightness variation, 'flower' = random petal colour
export const DECOR = {
  grass: { build: grass, collide: 0, scale: [0.8, 1.5], tint: 'shade' },
  flower: { build: flower, collide: 0, scale: [0.8, 1.3], tint: 'flower' },
  bush: { build: bush, collide: 0, scale: [0.7, 1.2], tint: 'shade' },
  rock: { build: rock, collide: 0.95, scale: [0.6, 1.5], tint: 'shade' },
  tree: { build: tree, collide: 0.45, scale: [0.85, 1.3], tint: 'shade' },
};

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
