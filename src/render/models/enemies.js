// Enemy and boss models. All face +Z and stand on y = 0. One merged geometry
// per type, drawn with a single InstancedMesh. Most models come from three
// builders (four-legged beasts, two-legged creatures, floating things) with
// their own colours and parts. Eyes are red: the shadow version keeps only
// the eyes glowing.
import { box, cone, cyl, blob, merge } from '../geo.js';

const EYE = 0xff3040;

// ---- four-legged beasts -------------------------------------------------------
function quad(o) {
  const w = o.w || 0.75, h = o.h || 0.62, len = o.len || 1.35, legH = o.legH || 0.5;
  const fur = o.fur, dark = o.dark, eye = o.eye || EYE;
  const by = legH + h / 2;
  const hs = o.head || 0.55;
  const hz = len / 2 + hs * 0.35, hy = by + h * 0.3;
  const p = [
    box(w, h, len, fur, 0, by, 0),
    box(w * 0.8, h * 0.45, len * 0.65, dark, 0, by + h * 0.6, -len * 0.08), // back ridge
    box(hs * 0.95, hs * 0.85, hs, fur, 0, hy, hz), // head
    box(hs * 0.55, hs * 0.45, hs * 0.75, dark, 0, hy - hs * 0.2, hz + hs * 0.65), // snout
    box(hs * 0.18, hs * 0.14, 0.05, eye, hs * 0.27, hy + hs * 0.12, hz + hs * 0.5),
    box(hs * 0.18, hs * 0.14, 0.05, eye, -hs * 0.27, hy + hs * 0.12, hz + hs * 0.5),
  ];
  const lx = w * 0.35, lz = len * 0.36, lw = Math.max(0.18, w * 0.27);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) p.push(box(lw, legH + 0.05, lw * 1.1, dark, sx * lx, legH / 2, sz * lz));
  }
  if (o.tail !== false) p.push(box(0.14, 0.14, 0.6, dark, 0, by + 0.15, -len / 2 - 0.25, 0.6, 0, 0));
  const top = hy + hs * 0.45;
  if (o.ears) {
    p.push(cone(0.1, 0.3, 3, dark, hs * 0.32, top, hz - 0.05));
    p.push(cone(0.1, 0.3, 3, dark, -hs * 0.32, top, hz - 0.05));
  }
  if (o.tusks) {
    p.push(cone(0.06, 0.4, 4, 0xe8e0c8, hs * 0.3, hy - hs * 0.2, hz + hs * 0.9, -1.2, 0, 0));
    p.push(cone(0.06, 0.4, 4, 0xe8e0c8, -hs * 0.3, hy - hs * 0.2, hz + hs * 0.9, -1.2, 0, 0));
  }
  if (o.antlers) {
    const c = o.antlers;
    for (const sx of [1, -1]) {
      p.push(box(0.08, 0.7, 0.08, c, sx * hs * 0.35, top + 0.3, hz - 0.1, 0, 0, sx * -0.4));
      p.push(box(0.07, 0.4, 0.07, c, sx * hs * 0.65, top + 0.5, hz, 0.4, 0, sx * -1.0));
      p.push(box(0.07, 0.35, 0.07, c, sx * hs * 0.45, top + 0.65, hz - 0.2, -0.5, 0, sx * -0.2));
    }
  }
  if (o.curl) {
    for (const sx of [1, -1]) {
      p.push(cyl(0.16, 0.12, 0.42, 6, o.curl, sx * hs * 0.55, top - 0.05, hz - 0.05, 0, 0, Math.PI / 2));
      p.push(cyl(0.12, 0.06, 0.3, 6, o.curl, sx * hs * 0.72, top - 0.28, hz + 0.12, 0.9, 0, 0));
    }
  }
  if (o.spikes) {
    for (let i = 0; i < 4; i++) p.push(cone(0.12, 0.42, 4, o.spikes, 0, by + h * 0.85, len * 0.3 - i * len * 0.22, -0.4, 0, 0));
  }
  if (o.glow) {
    // glowing cracks along the flanks
    p.push(box(w * 1.02, 0.08, len * 0.7, o.glow, 0, by - h * 0.1, 0));
    p.push(box(0.1, 0.08, 0.1, o.glow, 0, hy - hs * 0.42, hz + hs * 0.9));
  }
  if (o.bumps) {
    for (let i = 0; i < 5; i++) p.push(blob(0.18, o.bumps, (i % 2 ? 1 : -1) * w * 0.3, by + h * 0.55, len * 0.3 - i * len * 0.15));
  }
  return p;
}

// ---- two-legged creatures -----------------------------------------------------
function biped(o) {
  const w = o.w || 0.8, h = o.h || 0.9, legH = o.legH || 0.7, arm = o.arm || 0.85, th = o.thick || 0.22;
  const skin = o.skin, dark = o.dark, eye = o.eye || EYE;
  const ty = legH + h / 2;
  const hs = o.head || 0.5;
  const hz = o.hunch ? hs * 0.35 : 0;
  const hy = legH + h + hs * 0.45 - (o.hunch ? hs * 0.25 : 0);
  const p = [
    box(w, h, w * 0.6, skin, 0, ty, 0, o.hunch ? 0.25 : 0, 0, 0),
    box(hs, hs, hs, skin, 0, hy, hz),
    box(hs * 0.2, hs * 0.13, 0.05, eye, hs * 0.22, hy + hs * 0.05, hz + hs * 0.51),
    box(hs * 0.2, hs * 0.13, 0.05, eye, -hs * 0.22, hy + hs * 0.05, hz + hs * 0.51),
    box(w * 0.32, legH, w * 0.36, dark, w * 0.24, legH / 2, 0),
    box(w * 0.32, legH, w * 0.36, dark, -w * 0.24, legH / 2, 0),
    box(th, arm, th * 1.05, skin, w / 2 + th / 2, legH + h - arm / 2, 0.05),
    box(th, arm, th * 1.05, skin, -w / 2 - th / 2, legH + h - arm / 2, 0.05),
  ];
  const top = hy + hs / 2;
  if (o.hood) p.push(box(hs * 1.2, hs * 0.75, hs * 1.15, o.hood, 0, hy + hs * 0.2, hz - 0.06));
  if (o.helm) {
    p.push(box(hs * 1.12, hs * 0.5, hs * 1.12, o.helm, 0, top - hs * 0.1, hz));
    p.push(box(hs * 0.12, hs * 0.5, hs * 1.12, o.helm, 0, top + hs * 0.2, hz));
  }
  if (o.horns) {
    for (const sx of [1, -1]) p.push(cone(0.1, 0.5, 4, o.horns, sx * hs * 0.4, top + 0.18, hz, 0, 0, sx * -0.5));
  }
  if (o.crown) {
    for (let i = 0; i < 5; i++) p.push(cone(0.07, 0.3, 4, o.crown, -hs * 0.4 + i * hs * 0.2, top + 0.12, hz));
    p.push(box(hs * 1.05, 0.08, hs * 1.05, o.crown, 0, top, hz));
  }
  if (o.branches) {
    for (const sx of [1, -1]) {
      p.push(box(0.1, 0.8, 0.1, o.branches, sx * hs * 0.35, top + 0.35, hz, 0, 0, sx * -0.35));
      p.push(box(0.08, 0.45, 0.08, o.branches, sx * hs * 0.75, top + 0.55, hz, 0, 0, sx * -1.1));
    }
  }
  if (o.shoulders) {
    for (const sx of [1, -1]) p.push(box(th * 1.8, th * 1.2, th * 1.8, o.shoulders, sx * (w / 2 + th / 2), legH + h, 0.05));
  }
  if (o.belly) p.push(box(w * 0.7, h * 0.5, 0.08, o.belly, 0, ty - h * 0.1, w * 0.31));
  if (o.glow) {
    p.push(box(w * 0.5, 0.1, 0.06, o.glow, 0, ty + h * 0.15, w * 0.31));
    p.push(box(0.06, h * 0.6, 0.06, o.glow, 0, ty, w * 0.31));
  }
  if (o.wings) {
    for (const sx of [1, -1]) p.push(box(0.05, 0.6, 0.8, o.wings, sx * (w * 0.4 + 0.3), ty + h * 0.3, -w * 0.4, 0, sx * 0.6, sx * 0.4));
  }
  const hx = w / 2 + th / 2, hy2 = legH + h - arm;
  if (o.weapon === 'club') {
    p.push(cyl(0.16, 0.08, 1.1, 6, o.weaponColor || 0x5a4030, hx, hy2 - 0.1, 0.45, Math.PI / 2.6, 0, 0));
  } else if (o.weapon === 'bow') {
    p.push(box(0.06, 1.2, 0.08, o.weaponColor || 0x6a4a2a, hx + 0.05, hy2 + 0.35, 0.25));
    p.push(box(0.02, 1.1, 0.02, 0xe0e0e0, hx + 0.05, hy2 + 0.35, 0.1));
  } else if (o.weapon === 'staff') {
    p.push(cyl(0.05, 0.05, 1.7, 5, o.weaponColor || 0x4a3524, hx, hy2 + 0.4, 0.2));
    p.push(blob(0.16, o.orb || 0xffc030, hx, hy2 + 1.3, 0.2));
  } else if (o.weapon === 'sword') {
    p.push(box(0.1, 1.5, 0.22, o.weaponColor || 0xb0b8c8, hx, hy2 + 0.1, 0.55, Math.PI / 2.4, 0, 0));
  }
  return p;
}

// ---- small helpers for the rest ------------------------------------------------
function plant(o) {
  return [
    cyl(0.12, 0.2, 0.9, 5, o.stem, 0, 0.45, 0),
    blob(0.42, o.head, 0, 1.1, 0.05, 1, 0.9, 1),
    box(0.36, 0.14, 0.2, 0x401010, 0, 1.0, 0.36),
    box(0.1, 0.08, 0.05, EYE, 0.14, 1.22, 0.38),
    box(0.1, 0.08, 0.05, EYE, -0.14, 1.22, 0.38),
    cone(0.18, 0.5, 3, o.leaf, 0.35, 0.3, 0, 0, 0, -1.0),
    cone(0.18, 0.5, 3, o.leaf, -0.35, 0.3, 0, 0, 0, 1.0),
    cone(0.18, 0.5, 3, o.leaf, 0, 0.3, -0.35, 1.0, 0, 0),
    cone(0.06, 0.3, 3, o.leaf, 0.25, 1.4, 0, 0, 0, -0.7),
    cone(0.06, 0.3, 3, o.leaf, -0.25, 1.4, 0, 0, 0, 0.7),
  ];
}

function mushroom(o) {
  return [
    cyl(0.28, 0.36, 1.0, 6, o.stem, 0, 0.5, 0),
    cyl(0.2, 0.95, 0.55, 8, o.cap, 0, 1.25, 0),
    blob(0.12, o.spots, 0.4, 1.3, 0.3),
    blob(0.1, o.spots, -0.35, 1.35, 0.25),
    blob(0.11, o.spots, 0.1, 1.42, -0.4),
    box(0.12, 0.09, 0.05, EYE, 0.13, 0.75, 0.32),
    box(0.12, 0.09, 0.05, EYE, -0.13, 0.75, 0.32),
    box(0.1, 0.5, 0.1, o.stem, 0.3, 0.25, 0.2, 0, 0, -0.5),
    box(0.1, 0.5, 0.1, o.stem, -0.3, 0.25, 0.2, 0, 0, 0.5),
  ];
}

function wisp(o) {
  return [
    blob(0.5, o.body, 0, 1.3, 0, 1, 1.2, 1, 0),
    cone(0.16, 0.6, 4, o.spike, 0, 1.95, 0),
    cone(0.14, 0.5, 4, o.spike, 0.5, 1.3, 0, 0, 0, -1.4),
    cone(0.14, 0.5, 4, o.spike, -0.5, 1.3, 0, 0, 0, 1.4),
    cone(0.14, 0.6, 4, o.spike, 0, 0.6, 0, Math.PI, 0, 0),
    box(0.12, 0.09, 0.05, EYE, 0.15, 1.4, 0.45),
    box(0.12, 0.09, 0.05, EYE, -0.15, 1.4, 0.45),
  ];
}

// ---- all types --------------------------------------------------------------------
const BUILDERS = {
  // meadow
  gloomfang: () => quad({ fur: 0x4a4560, dark: 0x2e2a40, ears: true }),
  thornspitter: () => plant({ stem: 0x4a7a30, head: 0x7aa040, leaf: 0x3a6a28 }),
  tuskboar: () => quad({ fur: 0x6a4a3a, dark: 0x3e2a20, w: 0.85, h: 0.7, len: 1.3, legH: 0.42, head: 0.6, tusks: true, ears: true, tail: false }),
  // forest
  mossback: () => quad({ fur: 0x4a3a2a, dark: 0x2a2018, w: 1.0, h: 0.85, len: 1.5, legH: 0.55, head: 0.65, ears: true, tail: false, bumps: 0x4a8a3a }),
  hollowArcher: () => biped({ skin: 0x7a8a6a, dark: 0x3a3a30, w: 0.6, h: 0.75, legH: 0.7, arm: 0.75, thick: 0.15, head: 0.42, hood: 0x2e4030, weapon: 'bow' }),
  antlerstag: () => quad({ fur: 0x7a5a3a, dark: 0x4a3420, w: 0.65, h: 0.62, len: 1.4, legH: 0.75, head: 0.5, antlers: 0xd8c8a0 }),
  // swamp
  bogshambler: () => biped({ skin: 0x4a5a34, dark: 0x2a3420, w: 1.0, h: 0.95, legH: 0.6, arm: 1.0, thick: 0.3, head: 0.5, hunch: true, belly: 0x6a6a40, shoulders: 0x3a4a28 }),
  sporemother: () => mushroom({ stem: 0xd8c8b0, cap: 0x8a3ab0, spots: 0xe0a0ff }),
  mirecrawler: () => quad({ fur: 0x3a4a3a, dark: 0x203020, w: 0.85, h: 0.42, len: 1.6, legH: 0.3, head: 0.5, spikes: 0x6a8a40, tail: true }),
  // ruins
  sentinel: () => biped({ skin: 0x8a8478, dark: 0x5a564e, w: 1.0, h: 1.0, legH: 0.7, arm: 0.95, thick: 0.3, head: 0.5, helm: 0x6a645a, shoulders: 0x6a645a, glow: 0xffc030 }),
  acolyte: () => biped({ skin: 0xc8b8a0, dark: 0x3a2a3a, w: 0.6, h: 0.9, legH: 0.6, arm: 0.75, thick: 0.15, head: 0.42, hood: 0x5a2a5a, weapon: 'staff', orb: 0xffc030 }),
  ruinhound: () => quad({ fur: 0x7a7060, dark: 0x4a443a, w: 0.7, h: 0.6, len: 1.45, legH: 0.55, head: 0.55, spikes: 0xffc030, ears: true }),
  // ice
  frostTroll: () => biped({ skin: 0x8ab0c8, dark: 0x4a6a80, w: 1.05, h: 1.0, legH: 0.7, arm: 1.1, thick: 0.32, head: 0.55, hunch: true, horns: 0xe0f0ff, weapon: 'club', weaponColor: 0xa0d0f0 }),
  iceWisp: () => wisp({ body: 0x90d8ff, spike: 0xe0f8ff }),
  snowram: () => quad({ fur: 0xe8eef4, dark: 0x8090a0, w: 0.8, h: 0.7, len: 1.35, legH: 0.55, head: 0.55, curl: 0xa09080, tail: false }),
  // volcano
  magmaBrute: () => biped({ skin: 0x3a2a2a, dark: 0x201818, w: 1.05, h: 1.0, legH: 0.7, arm: 1.05, thick: 0.32, head: 0.55, shoulders: 0x2a1e1e, glow: 0xff7020, horns: 0x1a1414 }),
  emberImp: () => biped({ skin: 0xa03020, dark: 0x501818, w: 0.5, h: 0.55, legH: 0.45, arm: 0.5, thick: 0.13, head: 0.42, horns: 0x2a1010, wings: 0x501818 }),
  cinderhound: () => quad({ fur: 0x2a2222, dark: 0x181414, w: 0.7, h: 0.6, len: 1.45, legH: 0.55, head: 0.55, ears: true, glow: 0xff7020 }),

  // ---- bosses (drawn at the type's scale)
  thornmaw: () => quad({ fur: 0x3a3048, dark: 0x221c2e, w: 0.85, h: 0.7, len: 1.5, head: 0.65, ears: true, spikes: 0x4a8a3a }),
  barkhide: () => biped({ skin: 0x5a4030, dark: 0x3a2a1e, w: 1.1, h: 1.1, legH: 0.65, arm: 1.15, thick: 0.34, head: 0.55, hunch: true, branches: 0x6a5038, shoulders: 0x4a8a3a }),
  mireMatriarch: () => quad({ fur: 0x4a5a30, dark: 0x2a3418, w: 1.3, h: 0.75, len: 1.3, legH: 0.35, head: 0.9, tail: false, bumps: 0xb060d0 }),
  hollowKing: () => biped({ skin: 0x4a4a58, dark: 0x2a2a34, w: 1.0, h: 1.05, legH: 0.75, arm: 1.0, thick: 0.28, head: 0.5, helm: 0x3a3a48, crown: 0xffc030, shoulders: 0x5a5a6a, weapon: 'sword' }),
  rimeclaw: () => biped({ skin: 0xe0ecf6, dark: 0x8aa0b8, w: 1.1, h: 1.05, legH: 0.7, arm: 1.15, thick: 0.34, head: 0.6, hunch: true, horns: 0x80c8ff, shoulders: 0xa0d8ff }),
  pyrelord: () => biped({ skin: 0x2a1e1e, dark: 0x140e0e, w: 0.95, h: 1.1, legH: 0.75, arm: 1.0, thick: 0.26, head: 0.5, crown: 0xff7020, horns: 0x140e0e, glow: 0xff5010, weapon: 'staff', orb: 0xff5010, wings: 0x3a1a1a }),
};

export function buildEnemyGeometry(typeId) {
  return merge(BUILDERS[typeId]());
}

// Shadow version of an enemy: the same shape in near-black, only the eyes
// glow. The aura colour is applied per instance.
export function buildShadowGeometry(typeId) {
  const g = buildEnemyGeometry(typeId);
  const c = g.attributes.color.array;
  for (let i = 0; i < c.length; i += 3) {
    const r = c[i], gr = c[i + 1], b = c[i + 2];
    const glow = r > 0.5 && gr < 0.25; // eyes (and glowing embers)
    const v = glow ? 6 : 0.012 + ((r + gr + b) / 3) * 0.16;
    c[i] = c[i + 1] = c[i + 2] = v;
  }
  return g;
}
