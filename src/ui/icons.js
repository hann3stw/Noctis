// Small SVG icons for the HUD and the menus (24 x 24, filled with currentColor).
const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;

export const SKILL_ICONS = {
  shadowStep: svg('M4 18c3-1 5-3 6-6l2 2 1-5-5 1 2 2c-1 2-3 4-6 5zM14 6a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm1 4h3l2 3-2 5h-2l1-4-2-2z'),
  shadowWave: svg('M3 18c4-9 14-9 18 0l-2 1c-3-7-11-7-14 0zm4 1c2-5 8-5 10 0l-2 1c-1-3-5-3-6 0zm4 1a1.5 1.5 0 1 1 2 0z'),
  rulersGrasp: svg('M7 21v-6L4 11V7h2v3h1V4h2v6h1V3h2v7h1V4h2v7h1V6h2v8l-2 3v4zM11 13l-3-2 1-1 3 2z'),
  umbralShield: svg('M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zm0 3L7 7v4c0 3 2 6 5 8z'),
  daggerRain: svg('M5 2h2v9l-1 3-1-3zm6 3h2v9l-1 3-1-3zm6-3h2v9l-1 3-1-3zM3 18h18v2H3z'),
  warCry: svg('M3 9h4l7-5v16l-7-5H3zm13-1l2-2 1.5 1.5-2 2zm1 4h3v2h-3zm-1 4l1.5-1.5 2 2L18 18z'),
  lifeLeech: svg('M12 3c3 5 6 8 6 11a6 6 0 0 1-12 0c0-3 3-6 6-11zm-2 9v2h-2v2h2v2h2v-2h2v-2h-2v-2z'),
  nightLance: svg('M20 3l1 1-1 5-2-2L6 19l2 2-3 1-2-2 1-3 2 2L18 7l-2-2z'),
  nightfall: svg('M15 3a8 8 0 1 0 6 13A7 7 0 0 1 15 3zM3 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1z'),
  legionsCall: svg('M12 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM5 6a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm14 0a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM7 21v-4a5 5 0 0 1 10 0v4zm-6 0v-3a4 4 0 0 1 5-4 7 7 0 0 0-1 3v4zm22 0h-4v-4a7 7 0 0 0-1-3 4 4 0 0 1 5 4z'),
  eclipse: svg('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3a7 7 0 1 0 0 14 9 9 0 0 1 0-14z'),
  bladeDance: svg('M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7zM12 22A10 10 0 0 1 2 12h3a7 7 0 0 0 7 7zM9 12a3 3 0 1 1 6 0 3 3 0 0 1-6 0z'),
  phantomStrike: svg('M21 3l-1 6-9 9-3-3 9-9zM7 16l1 1-4 4-1-1zM3 8h6v2H3zM5 4h6v2H5z'),
  blackFrost: svg('M11 2h2v4l2-2 1.4 1.4L13 8.8V11h2.2l3.4-3.4L20 9l-2 2h4v2h-4l2 2-1.4 1.4-3.4-3.4H13v2.2l3.4 3.4L15 20l-2-2v4h-2v-4l-2 2-1.4-1.4 3.4-3.4V13H8.8l-3.4 3.4L4 15l2-2H2v-2h4L4 9l1.4-1.4L8.8 11H11V8.8L7.6 5.4 9 4l2 2z'),
  huntersMark: svg('M11 2h2v3.1A7 7 0 0 1 18.9 11H22v2h-3.1A7 7 0 0 1 13 18.9V22h-2v-3.1A7 7 0 0 1 5.1 13H2v-2h3.1A7 7 0 0 1 11 5.1zM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'),
  darkMend: svg('M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11zm-1-13v2H9v2h2v2h2v-2h2v-2h-2V8z'),
  bloodRage: svg('M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 3 3 5 1-2 1-6 1-10z'),
  voidStorm: svg('M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7 4 4 0 0 0-4 4H5a7 7 0 0 1 7-7zm0 20A10 10 0 0 1 2 12h3a7 7 0 0 0 7 7 4 4 0 0 0 4-4h3a7 7 0 0 1-7 7zm0-13a3 3 0 1 1 0 6 3 3 0 0 1 0-6z'),
  umbralAegis: svg('M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5zm0 5l-1.4 2.9-3.1.4 2.3 2.2-.6 3.1 2.8-1.5 2.8 1.5-.6-3.1 2.3-2.2-3.1-.4z'),
  oblivionRay: svg('M2 10h12V6l8 6-8 6v-4H2zM3 5h7v2H3zM3 17h7v2H3z'),
};

// emblem of every armour set
export const SET_ICONS = {
  stalker: svg('M15 3a9 9 0 1 0 6 13A7.5 7.5 0 0 1 15 3z'),
  bulwark: svg('M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z'),
  gravecaller: svg('M12 2a8 8 0 0 0-8 8c0 3 1.5 5 3.5 6.5V21h9v-4.500C18.5 15 20 13 20 10a8 8 0 0 0-8-8zM9 9a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z'),
  tempest: svg('M13 2L5 14h6l-2 8 8-12h-6z'),
  arcanist: svg('M12 2l2.500 7.500L22 12l-7.500 2.500L12 22l-2.500-7.500L2 12l7.500-2.500z'),
  bloodreaver: svg('M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z'),
};
export const SET_CSS = {
  stalker: '#3fd0b8', bulwark: '#c2ccde', gravecaller: '#b07cff',
  tempest: '#6fd0ff', arcanist: '#ffd86a', bloodreaver: '#ff5a68',
};

export const TAB_ICONS = {
  gear: svg('M14 3l7 7-2 2-2-2-6 6 2 2-2 2-7-7 2-2 2 2 6-6-2-2zM4 18l2 2-2 2-2-2z'),
  stats: svg('M4 20V10h3v10zm6 0V4h3v16zm6 0v-7h3v7z'),
  skills: svg('M13 2L5 14h6l-2 8 8-12h-6z'),
  army: svg('M12 2c3 2 5 5 5 8 0 2-1 4-2 5l-1 5h-4l-1-5c-1-1-2-3-2-5 0-3 2-6 5-8zm-2 8a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z'),
  look: svg('M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zm-7 16a7 7 0 0 1 14 0z'),
};

export const UI_ICONS = {
  menu: svg('M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z'),
  travel: svg('M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'),
  summon: svg('M12 2c3 2 5 5 5 8 0 2-1 4-2 5l-1 5h-4l-1-5c-1-1-2-3-2-5 0-3 2-6 5-8zM3 21h18v1H3z'),
  revive: svg('M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11zm-1-12v2H9v2h2v2h2v-2h2v-2h-2V9z'),
  // main menu
  worlds: svg('M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 2c-1.2 1.6-2 4.4-2 8s.8 6.4 2 8c1.2-1.6 2-4.4 2-8s-.8-6.4-2-8zM4.3 9h15.4a8 8 0 0 0-.6-1.5H4.9A8 8 0 0 0 4.3 9zm0 6a8 8 0 0 0 .6 1.5h14.2a8 8 0 0 0 .6-1.5z'),
  trophy: svg('M6 3h12v2h3v3a5 5 0 0 1-4.6 5 6 6 0 0 1-3.4 3.4V19h4v2H7v-2h4v-2.6A6 6 0 0 1 7.6 13 5 5 0 0 1 3 8V5h3zm0 4H5v1a3 3 0 0 0 1.4 2.5A6 6 0 0 1 6 9zm12 0v2c0 .5 0 1-.1 1.5A3 3 0 0 0 19 8V7z'),
  cloud: svg('M7 19a5 5 0 0 1-.6-10A6.5 6.5 0 0 1 19 9.5a4.8 4.8 0 0 1-.5 9.5z'),
  gear: svg('M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z'),
};
