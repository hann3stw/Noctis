// Coloured icons for the gear: one per weapon type and one per armour piece of
// every set, drawn like the 3D models (hood and mask for the Nightstalker,
// closed helm and pauldrons for Ironbark, bone crown and ribs for the
// Gravecaller, wings for the Stormrunner, wizard hat and robe for the
// Voidweaver, horns and spikes for the Bloodreaver). 32 x 32, the parts in
// var(--rc) take the rarity colour of the tile.
const A = 'style="fill:var(--rc,#c9a8ff)"'; // accent = rarity colour
const p = (d, c) => `<path d="${d}" ${c === A ? A : `fill="${c}"`}/>`;
const icon = (...parts) => `<svg class="gi" viewBox="0 0 32 32" aria-hidden="true">${parts.join('')}</svg>`;

// ---- weapons -------------------------------------------------------------------
const METAL = '#e3e8f4', METAL2 = '#9aa4bc', WOOD = '#9a6638', WOOD2 = '#6a4224', GRIP = '#3c2c48', DARK = '#16121e';

export const WEAPON_ICONS = {
  sword: icon(
    p('M26 2h4v4L14 22l-4-4z', METAL),
    p('M30 2v4L14 22l-2-2z', METAL2),
    p('M6 16l3-3 10 10-3 3z', A),
    p('M9 22l2 2-6 6-2-2z', GRIP),
    p('M2 27a2.5 2.5 0 1 0 3 3 2.5 2.5 0 0 0-3-3z', A),
  ),
  daggers: icon(
    p('M23 2l3 1-8 12-3-2z', METAL),
    p('M26 3l-8 12-1.5-1z', METAL2),
    p('M9 2L6 3l8 12 3-2z', METAL),
    p('M6 3l8 12 1.5-1z', METAL2),
    p('M12 14l3 2-2 3-3-2zM20 14l-3 2 2 3 3-2z', A),
    p('M11 18l3 2-6 9-3-2zM21 18l-3 2 6 9 3-2z', GRIP),
  ),
  spear: icon(
    p('M5 29l-2-2L21 9l2 2z', WOOD),
    p('M5 29l-1-1L22 10l1 1z', WOOD2),
    p('M30 2l-3 11-3-2-3-3-2-3z', METAL),
    p('M30 2l-3 11-3-2z', METAL2),
    p('M18 10l4 4-2 2-4-4z', A),
    p('M16 14l2 2-3 7-1-5-5-1z', A),
  ),
  hammer: icon(
    p('M14.5 12h3v18h-3z', WOOD),
    p('M16 12h1.5v18H16z', WOOD2),
    p('M4 3h24v10H4z', METAL),
    p('M4 9h24v4H4z', METAL2),
    p('M13 3h6v10h-6z', A),
    p('M2 4h2v8H2zM28 4h2v8h-2z', METAL2),
    p('M14 27h4v3h-4z', GRIP),
  ),
  scythe: icon(
    p('M8 4h3v26H8z', WOOD),
    p('M9.5 4H11v26H9.5z', WOOD2),
    p('M11 4c9 0 16 4 19 12-5-5-11-7-19-6z', METAL),
    p('M11 8c8-1 14 2 19 8-6-4-12-5-19-4z', METAL2),
    p('M7 3h5v4H7z', A),
    p('M7 17h5v2H7z', GRIP),
  ),
  bow: icon(
    p('M7 2c11 3 17 9 17 14S18 27 7 30l-1-2.5c9-3 14-8 14-11.5S15 7.5 6 4.5z', WOOD),
    p('M7 2c11 3 17 9 17 14h-2c0-4-6-9.5-15-12.5z', WOOD2),
    p('M6.5 3.5h1v25h-1z', '#e8e4d8'),
    p('M3 15h22v2H3z', METAL2),
    p('M25 12l6 4-6 4z', METAL),
    p('M2 13l4 3-4 3H0l3-3-3-3z', A),
    p('M17 14h4v4h-4z', GRIP),
  ),
  staff: icon(
    p('M14.5 12h3v18h-3z', WOOD),
    p('M16 12h1.5v18H16z', WOOD2),
    p('M11 10c0-2 2-3 5-3s5 1 5 3l-2 3h-6z', GRIP),
    p('M16 1a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', A),
    p('M14 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4z', '#ffffff'),
    p('M14 22h4v2h-4z', A),
  ),
  grimoire: icon(
    p('M6 3h19a2 2 0 0 1 2 2v23H8a2 2 0 0 1-2-2z', '#3a2266'),
    p('M8 24h19v4H8a2 2 0 0 1 0-4z', '#efe6d0'),
    p('M6 3h4v21H8a2 2 0 0 0-2 2z', '#24143f'),
    p('M18 7l1.6 3.4 3.4.6-2.5 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5-2.5-2.5 3.4-.6z', A),
    p('M25 12h3v5h-3z', METAL),
  ),
};

// ---- armour --------------------------------------------------------------------
// [main, second, trim] per set, lighter than the 3D colours so they read on the dark tile
const C = {
  stalker: ['#2f7f86', '#3a3546', '#8fe3d6'],
  bulwark: ['#b9c2d4', '#7a5636', '#6e7a90'],
  gravecaller: ['#5e3c9c', '#e8e0ca', '#2c1a4c'],
  tempest: ['#e9f1f9', '#47aef0', '#a9d8f8'],
  arcanist: ['#2f42a0', '#e8b848', '#1c2766'],
  bloodreaver: ['#a81d2e', '#2a2230', '#e8dccc'],
};

// base shapes every set builds on
const HAND = 'M9 30V19l-2.5-4.5V9.2c0-2 3.5-2 3.5 0V13h1V5.5c0-2 3.5-2 3.5 0V12h1V4.5c0-2 3.5-2 3.5 0V12h1V6c0-2 3.5-2 3.5 0v8.5l2.2-3c1.2-1.6 3.6-.2 2.6 1.6L23 21v9z';
const BOOT = 'M9 3h10v16l8 4c1.5.8 2 2 2 4v2H7v-7l2-3z';
const SOLE = 'M7 27h22v3H7z';
const TORSO = 'M9 5l4-1.5c1 2 5 2 6 0L23 5l5 4-2 6-2-1v15H8V14l-2 1-2-6z';

const S = C.stalker, B = C.bulwark, G = C.gravecaller, T = C.tempest, R = C.arcanist, X = C.bloodreaver;

export const ARMOR_ICONS = {
  stalker: {
    helmet: icon(
      p('M16 2C9 2 5 8 5 16v12h22V16C27 8 23 2 16 2z', S[0]),
      p('M16 2c4 3 5 7 4 10l3 2c1-6-2-10-7-12z', S[1]),
      p('M9.5 14c3-4 10-4 13 0v8c-3 3-10 3-13 0z', DARK),
      p('M9.5 18h13v4c-3 3-10 3-13 0z', S[2]),
      p('M11.5 15.2h3v1.4h-3zM17.5 15.2h3v1.4h-3z', A),
    ),
    chest: icon(
      p(TORSO, S[0]),
      p('M11 5l11 20-2.5 1.5L8.5 7z', S[1]),
      p('M8 21h16v3H8z', S[1]),
      p('M14.5 20.5h3v4h-3z', A),
      p('M13 3.5c1 2 5 2 6 0l1 1.5c-2 2-6 2-8 0z', S[2]),
    ),
    gloves: icon(
      p(HAND, S[0]),
      p('M8 22h15v8H8z', S[1]),
      p('M11 13h11v2.5H11z', S[1]),
      p('M10 25h11v2H10z', A),
    ),
    boots: icon(
      p(BOOT, S[0]),
      p(SOLE, S[1]),
      p('M9 7h10v2H9zM9 12h10v2H9zM9 17h10v2H9z', S[1]),
      p('M21 22l4 2-1 2-4-2z', A),
    ),
  },
  bulwark: {
    helmet: icon(
      p('M6 9c0-5 4-7 10-7s10 2 10 7v18H6z', B[0]),
      p('M15 2h2v25h-2z', B[2]),
      p('M8 12h16v3.5H8z', DARK),
      p('M9 19h2v2H9zM9 23h2v2H9zM21 19h2v2h-2zM21 23h2v2h-2z', B[2]),
      p('M13 0h6v3h-6z', A),
      p('M10.5 13h3v1.5h-3zM18.5 13h3v1.5h-3z', A),
    ),
    chest: icon(
      p(TORSO, B[0]),
      p('M1 11c0-5 4-7 9-6l1 7-8 2zM31 11c0-5-4-7-9-6l-1 7 8 2z', B[2]),
      p('M15 6h2v16h-2z', B[2]),
      p('M8 22h16v3H8z', B[1]),
      p('M14.5 21.5h3v4h-3z', A),
    ),
    gloves: icon(
      p(HAND, B[0]),
      p('M6 21h20l-2 9H8z', B[2]),
      p('M10 12h12v3H10z', B[2]),
      p('M14 24h4v4h-4z', A),
    ),
    boots: icon(
      p(BOOT, B[0]),
      p(SOLE, B[1]),
      p('M8 3h12v4H8z', B[2]),
      p('M11 9h6v8h-6z', B[2]),
      p('M12.5 11h3v3h-3z', A),
      p('M19 21l8 4v2h-8z', B[2]),
    ),
  },
  gravecaller: {
    helmet: icon(
      p('M5 14c0-6 5-9 11-9s11 3 11 9v15H5z', G[0]),
      p('M5 13l2-9 3 6 2-8 4 7 4-7 2 8 3-6 2 9z', G[1]),
      p('M9.5 16h13v10h-13z', G[2]),
      p('M11 18h4v3h-4zM17 18h4v3h-4z', A),
      p('M13 23h6v1.5h-6z', G[1]),
    ),
    chest: icon(
      p(TORSO, G[0]),
      p('M15 6h2v18h-2z', G[1]),
      p('M10 9h12l-1 2H11zM10 13h12l-1 2H11zM11 17h10l-1 2h-8z', G[1]),
      p('M14.5 3.5h3v3h-3z', A),
      p('M8 24h16v2H8z', G[2]),
    ),
    gloves: icon(
      p(HAND, G[0]),
      p('M7.5 9h2v1.5h-2zM11.5 6h2v1.5h-2zM15.5 5h2v1.5h-2zM19.5 7h2v1.5h-2z', G[1]),
      p('M8 22h15v8H8z', G[1]),
      p('M9 24h13v1.5H9zM9 27h13v1.5H9z', G[2]),
      p('M13 15a2.5 2.5 0 1 0 5 0 2.5 2.5 0 0 0-5 0z', A),
    ),
    boots: icon(
      p(BOOT, G[0]),
      p(SOLE, G[2]),
      p('M11 4h6v15h-6z', G[1]),
      p('M11 8h6v1.5h-6zM11 12h6v1.5h-6zM11 16h6v1.5h-6z', G[2]),
      p('M22 23a2 2 0 1 0 4 0 2 2 0 0 0-4 0z', A),
    ),
  },
  tempest: {
    helmet: icon(
      p('M8 19c0-7 3.5-11 8-11s8 4 8 11z', T[0]),
      p('M7 17h18v4H7z', T[1]),
      p('M8 15L1 8l2 6-2 2 6 4zM24 15l7-7-2 6 2 2-6 4z', T[2]),
      p('M8 15L3 10l1 4 4 2zM24 15l5-5-1 4-4 2z', T[1]),
      p('M14 17h4l-2 4z', A),
      p('M9.5 23c2 4 11 4 13 0z', T[0]),
    ),
    chest: icon(
      p(TORSO, T[0]),
      p('M13 8l6 5-3 2 6 9-9-7 3-2z', T[1]),
      p('M8 24h16v2.5H8z', T[1]),
      p('M4 9l2 6 2-1V11z', T[2]),
      p('M28 9l-2 6-2-1V11z', T[2]),
      p('M14.5 3.5h3v2h-3z', A),
    ),
    gloves: icon(
      p(HAND, T[0]),
      p('M8 22h15v8H8z', T[1]),
      p('M23 22l7-4-2 5 2 1-7 4z', T[2]),
      p('M14 13l2 2-2 2 4 0-2-2 2-2z', A),
    ),
    boots: icon(
      p(BOOT, T[0]),
      p(SOLE, T[1]),
      p('M9 6L1 1l2 6-2 2 8 4z', T[2]),
      p('M9 6L4 4l1 4 4 2z', T[1]),
      p('M9 16h10v2.5H9z', T[1]),
      p('M21 22l4 2-1 2-4-2z', A),
    ),
  },
  arcanist: {
    helmet: icon(
      p('M17 1c-2 0-4 3-5 7L8 22h16L20 8c3 0 5 1 6 3-1-5-5-10-9-10z', R[0]),
      p('M2 23c4 4 24 4 28 0-4-3-24-3-28 0z', R[2]),
      p('M8.5 19h15l1 3.5h-17z', R[1]),
      p('M16 10l1 2.2 2.4.3-1.8 1.6.5 2.4-2.1-1.2-2.1 1.2.5-2.4-1.8-1.6 2.4-.3z', A),
    ),
    chest: icon(
      p('M9 5l4-1.5c1 2 5 2 6 0L23 5l5 4-2 5-2-1 3 17H5l3-17-2 1-2-5z', R[0]),
      p('M15 7h2v23h-2z', R[1]),
      p('M12 3.5c1 2.5 7 2.5 8 0l1.5 1.5c-2 3-9 3-11 0z', R[1]),
      p('M5.5 28h21l.5 2H5z', R[1]),
      p('M16 12l2 3-2 3-2-3z', A),
    ),
    gloves: icon(
      p(HAND, R[0]),
      p('M7 21h17l-1 9H8z', R[1]),
      p('M9 23h13v2H9z', R[2]),
      p('M16 12l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z', A),
    ),
    boots: icon(
      p('M9 3h10v16l7 3c3 1 4 3 2 5-1-1-2-1-3 0H7v-7l2-3z', R[0]),
      p(SOLE, R[2]),
      p('M8 3h12v4H8z', R[1]),
      p('M28 22a2 2 0 1 1-1 3.5c1.3-.3 1.8-1.5 1-3.5z', R[1]),
      p('M12.5 9l1.5 2 1.5-2 1.5 2-1.5 2-1.5-2-1.5 2-1.5-2z', A),
    ),
  },
  bloodreaver: {
    helmet: icon(
      p('M8 13c0-5 3-8 8-8s8 3 8 8v15H8z', X[0]),
      p('M8.5 12C3 11 1 6 2 1c2 4 5 6 9 7zM23.5 12C29 11 31 6 30 1c-2 4-5 6-9 7z', X[2]),
      p('M11 14h10v3.5h-3V26h-4v-8.5h-3z', X[1]),
      p('M12 14.8h2.5v1.5H12zM17.5 14.8H20v1.5h-2.5z', A),
      p('M15 5h2l-1-4z', X[1]),
    ),
    chest: icon(
      p(TORSO, X[1]),
      p('M6 9L1 2l8 3zM26 9l5-7-8 3z', X[0]),
      p('M10 8h12l-2 10-4 2.5-4-2.5z', X[0]),
      p('M8 24h16v2.5H8z', X[0]),
      p('M14 11h4l-2 5z', A),
    ),
    gloves: icon(
      p(HAND, X[1]),
      p('M6.5 9.5l1.7-6 1.7 6zM11 5.5L12.75 0l1.75 5.5zM15 4.5L16.75-1l1.75 5.5zM19 6l1.75-5.5L22.5 6z', X[2]),
      p('M8 22h15v8H8z', X[0]),
      p('M23 24l6-2-4 5zM8 24l-6-2 4 5z', X[0]),
      p('M13 14h5v3h-5z', A),
    ),
    boots: icon(
      p(BOOT, X[1]),
      p(SOLE, X[0]),
      p('M19 6l6-3-2 5zM19 12l6-3-2 5z', X[0]),
      p('M9 3h10v3H9z', X[0]),
      p('M27 23l4-2-1 5z', X[2]),
      p('M12 15h4v4h-4z', A),
    ),
  },
};

export function gearIcon(item) {
  if (item.kind === 'weapon') return WEAPON_ICONS[item.type] || '';
  const set = ARMOR_ICONS[item.set];
  return (set && set[item.type]) || '';
}
