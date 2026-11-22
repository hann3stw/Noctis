// Coloured icons for the gear: one per weapon type and one per armour piece of
// every set, drawn like the 3D models (hood and mask for the Nightstalker,
// closed helm and pauldrons for Ironbark, bone crown and ribs for the
// Gravecaller, wings for the Stormrunner, wizard hat and robe for the
// Voidweaver, horns and spikes for the Bloodreaver).
// Drawn in the storybook style of the interface: every part has a thick dark outline, a soft light on top and
// a shade at the bottom, small white highlights on edges. 32 x 32 (a little room around for the outline); the
// parts in var(--rc) take the rarity colour of the tile.
const INK = '#1f0f08';
const A = 'style="fill:var(--rc,#c9a8ff)"'; // accent = rarity colour
const SHADE = '<defs><linearGradient id="gi-sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".36"/></linearGradient></defs>';
const fillOf = (c) => (c === A ? A : `fill="${c}"`);
// one part: colour, outline, light and shade
const p = (d, c) => `<path d="${d}" ${fillOf(c)} stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><path d="${d}" fill="url(#gi-sh)"/>`;
// a part without outline (a darker half, a groove)
const q = (d, c) => `<path d="${d}" ${fillOf(c)}/>`;
// a small bright line on an edge
const h = (d, o = 0.7) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width=".9" stroke-linecap="round"/>`;
const rot = (a, x, y, ...parts) => `<g transform="rotate(${a} ${x} ${y})">${parts.join('')}</g>`;
const icon = (...parts) => `<svg class="gi" viewBox="-1.5 -1.5 35 35" aria-hidden="true">${SHADE}${parts.join('')}</svg>`;

// ---- weapons -------------------------------------------------------------------
const METAL = '#eef2fa', METAL2 = '#a4aec6', WOOD = '#a8703f', WOOD2 = '#6a4224', GRIP = '#4a3260', DARK = '#16121e', GOLD = '#e0ac3a';

export const WEAPON_ICONS = {
  // drawn pointing up, then turned
  sword: icon(rot(45, 16, 15.8,
    p('M16 -4.5L19.6 1.2V21.5H12.4V1.2z', METAL),
    q('M16 -4.5L12.4 1.2V21.5H16z', METAL2),
    q('M15.2 3H16.8V19.6H15.2z', '#7c86a0'),
    h('M18.4 2.6V19.4'),
    p('M6.5 21.2Q16 19 25.5 21.2V24.8Q16 22.6 6.5 24.8z', GOLD),
    p('M13.4 22.8a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 1 0-5.2 0z', A),
    p('M14.2 24.6H17.8V31.4H14.2z', GRIP),
    h('M14.8 26H17.2M14.8 27.8H17.2M14.8 29.6H17.2', 0.35),
    p('M13.3 33.2a2.7 2.7 0 1 0 5.4 0 2.7 2.7 0 1 0-5.4 0z', A),
  )),
  daggers: icon(
    rot(-34, 16, 17,
      p('M16 1L19.2 6.4 18.2 18H13.8L12.8 6.4z', METAL),
      q('M16 1L12.8 6.4 13.8 18H16z', METAL2),
      h('M17.9 7.2L17.2 17', 0.6),
      p('M10.4 18H21.6V20.6H10.4z', A),
      p('M14.3 20.6H17.7V27.6H14.3z', GRIP),
      p('M13.6 28.6a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0z', GOLD),
    ),
    rot(34, 16, 17,
      p('M16 1L19.2 6.4 18.2 18H13.8L12.8 6.4z', METAL),
      q('M16 1L12.8 6.4 13.8 18H16z', METAL2),
      h('M17.9 7.2L17.2 17', 0.6),
      p('M10.4 18H21.6V20.6H10.4z', A),
      p('M14.3 20.6H17.7V27.6H14.3z', GRIP),
      p('M13.6 28.6a2.4 2.4 0 1 0 4.8 0 2.4 2.4 0 1 0-4.8 0z', GOLD),
    ),
  ),
  spear: icon(rot(45, 16, 15.5,
    p('M14.7 8H17.3V34H14.7z', WOOD),
    q('M16.2 8H17.3V34H16.2z', WOOD2),
    p('M16 -4.5Q21.6 3.5 20.6 8.2Q16 10.6 11.4 8.2Q10.4 3.5 16 -4.5z', METAL),
    q('M16 -4.5Q10.4 3.5 11.4 8.2Q13.6 9.4 16 9.5z', METAL2),
    h('M17.8 1L19 6.4'),
    p('M12.6 8.6H19.4V11H12.6z', GOLD),
    p('M17.2 12Q24 12.6 23.6 19.4Q20 16.4 17.2 17.4z', A),
    p('M14.2 32H17.8V35H14.2z', GRIP),
  )),
  hammer: icon(rot(28, 16, 17,
    p('M14.6 11H17.4V32H14.6z', WOOD),
    q('M16.2 11H17.4V32H16.2z', WOOD2),
    p('M14.2 17H17.8V19H14.2zM14.2 22H17.8V24H14.2z', GRIP),
    p('M6 1.5H26Q27.5 1.5 27.5 3V12Q27.5 13.5 26 13.5H6Q4.5 13.5 4.5 12V3Q4.5 1.5 6 1.5z', METAL),
    q('M4.5 8H27.5V12Q27.5 13.5 26 13.5H6Q4.5 13.5 4.5 12z', METAL2),
    h('M7 3.6H25'),
    p('M12.6 1.5H19.4V13.5H12.6z', A),
    p('M2 3H4.6V12H2zM27.4 3H30V12H27.4z', METAL2),
    p('M14.2 31H17.8V34H14.2z', GRIP),
  )),
  scythe: icon(rot(-8, 16, 17,
    p('M13.6 1H16.6V34H13.6z', WOOD),
    q('M15.4 1H16.6V34H15.4z', WOOD2),
    p('M16.6 1.6C25.4-.4 31.6 4 32.4 12.6 27 8 22 7.6 16.6 9.4z', METAL),
    q('M16.6 9.4C22 7.6 27 8 32.4 12.6 28 9.8 22 9.4 16.6 11.2z', METAL2),
    h('M18 3.4C24 2.4 29 5 31 9.4'),
    p('M12.4 5.4H17.8V9.4H12.4z', A),
    p('M13 18H17.2V20.4H13zM13 24H17.2V26.4H13z', GRIP),
  )),
  bow: icon(
    p('M7.4 1C23 4.6 28.6 11 28.6 16S23 27.4 7.4 31L6.6 28.2C17 25 22.6 20.6 22.6 16S17 7 6.6 3.8z', WOOD),
    q('M7.4 1C23 4.6 28.6 11 28.6 16H26.4C26.4 11.6 20 6.4 7 3z', WOOD2),
    h('M9 2.2C20 5 26 10 27 14', 0.5),
    `<path d="M6.8 3.4V28.6" stroke="#efe6d0" stroke-width=".9" fill="none"/>`,
    p('M2.4 15.2H26V16.8H2.4z', WOOD),
    p('M26 13.4L31.4 16 26 18.6z', METAL),
    p('M1.2 12.6L6 15.2V16.8L1.2 19.4z', A),
    p('M21 12.4H26.4V19.6H21z', GRIP),
  ),
  crossbow: icon(
    p('M4 11C12 8 20 8 28 11L27 14C20 12 12 12 5 14z', WOOD),
    q('M4 11C12 8 20 8 28 11L27.4 12.6C20 10.2 12 10.2 4.6 12.6z', WOOD2),
    `<path d="M5 12.5L16 28M27 12.5L16 28" stroke="#efe6d0" stroke-width=".9" fill="none"/>`,
    p('M14 10H18V30H14z', WOOD),
    p('M15 1L17.6 7 16.8 14H15.2L14.4 7z', METAL),
    p('M12.6 15H19.4V17.8H12.6z', A),
    p('M14.4 27H17.6V31H14.4z', GRIP),
  ),
  javelin: icon(rot(40, 16, 15.5,
    p('M14.9 7H17.1V32H14.9z', WOOD),
    q('M16.2 7H17.1V32H16.2z', WOOD2),
    p('M16 -3Q20.4 3 19.6 7.4Q16 9 12.4 7.4Q11.6 3 16 -3z', METAL),
    q('M16 -3Q11.6 3 12.4 7.4Q14 8.4 16 8.6z', METAL2),
    p('M12.8 9H19.2V11.4H12.8z', A),
    p('M13.6 17H18.4V19H13.6zM13.6 23H18.4V25H13.6z', GRIP),
    p('M15.2 31L12 34.4H20L16.8 31z', A),
  )),
  wand: icon(rot(35, 16, 16,
    p('M14.8 9H17.2V32H14.8z', WOOD),
    q('M16.2 9H17.2V32H16.2z', WOOD2),
    p('M12.8 8H19.2V11H12.8z', GOLD),
    p('M16 -4L21 3 16 9.4 11 3z', A),
    `<path d="M14 2.4L16 -1" stroke="#fff" stroke-opacity=".8" stroke-width="1.1" fill="none" stroke-linecap="round"/>`,
    p('M14.2 29H17.8V33H14.2z', GRIP),
  )),
  orb: icon(
    p('M16 2a11 11 0 1 0 0 22 11 11 0 0 0 0-22z', A),
    q('M16 2a11 11 0 0 0-8 18.6C10 14 14 9 22 7.4A11 11 0 0 0 16 2z', '#fff'),
    `<ellipse cx="12" cy="8.5" rx="3.4" ry="2.2" fill="#fff" fill-opacity=".8"/>`,
    `<ellipse cx="16" cy="13" rx="14" ry="4.6" fill="none" stroke="${INK}" stroke-width="3.4" transform="rotate(-12 16 13)"/>`,
    `<ellipse cx="16" cy="13" rx="14" ry="4.6" fill="none" stroke="${GOLD}" stroke-width="1.6" transform="rotate(-12 16 13)"/>`,
    p('M10.4 24H21.6L23 29H9z', GRIP),
  ),
  staff: icon(rot(14, 16, 17,
    p('M14.6 12H17.4V34H14.6z', WOOD),
    q('M16.2 12H17.4V34H16.2z', WOOD2),
    p('M10.4 11.6C9 6 12 3.6 16 3.6S23 6 21.6 11.6L19.6 14.2H12.4z', GRIP),
    p('M16 .4a6.4 6.4 0 1 0 0 12.8 6.4 6.4 0 0 0 0-12.8z', A),
    `<ellipse cx="13.8" cy="4" rx="2.4" ry="1.6" fill="#fff" fill-opacity=".75"/>`,
    p('M13.4 22H18.6V24.4H13.4z', A),
    p('M14.2 32H17.8V35H14.2z', GRIP),
  )),
  grimoire: icon(
    p('M5.6 2.4H25Q27.4 2.4 27.4 4.8V26.8H7.8Q5.6 26.8 5.6 24.6z', '#4a2a82'),
    q('M5.6 2.4H10V26.8H7.8Q5.6 26.8 5.6 24.6z', '#2c1850'),
    p('M8 26.8H28V29.6H8Q6.6 29.6 6.6 28.2Q6.6 26.8 8 26.8z', '#f4ecd6'),
    `<path d="M11.4 6H24V22.6H11.4z" fill="none" stroke="${GOLD}" stroke-width="1"/>`,
    p('M17.7 8.2L19.3 11.6 23 12.1 20.3 14.7 21 18.4 17.7 16.6 14.4 18.4 15.1 14.7 12.4 12.1 16.1 11.6z', A),
    p('M25.4 11H29.4V17H25.4z', METAL),
    p('M5.6 2.4H9.4V6.2H5.6zM23.6 23H27.4V26.8H23.6z', GOLD),
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
