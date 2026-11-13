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
};
