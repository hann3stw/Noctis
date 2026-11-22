// Where the buttons on the right of the screen are. Every button is a circle:
//   x, y = its centre, in u (the size unit of the interface), from the right and the bottom edge
//          (with "movement on the right" it is the left edge)
//   d    = its diameter in u
// The default is the arrangement the game always had. The player can move and resize the buttons in
// the settings (settings.layout); they can never overlap and stay in the zone at the right of the screen.
import { settings } from './settings.js';

export const IDS = ['attack', 'dodge', 'skill0', 'skill1', 'skill2', 'ult', 'arise'];
export const SELECTORS = { attack: '#btn-attack', dodge: '#btn-dodge', skill0: '#btn-skill0', skill1: '#btn-skill1', skill2: '#btn-skill2', ult: '#btn-ult', arise: '#btn-arise' };
export const DEFAULT = {
  attack: { x: 19, y: 20, d: 26 },
  dodge: { x: 40, y: 10.4, d: 14 },
  skill0: { x: 37.7, y: 25.2, d: 11.4 },
  skill1: { x: 27.8, y: 41.8, d: 11.4 },
  skill2: { x: 39.5, y: 41.8, d: 11.4 },
  ult: { x: 13.8, y: 43.4, d: 12.5 },
  arise: { x: 50.2, y: 23.6, d: 11.4 },
};
export const SIZE_MIN = 0.7; // a button is at least this share of its default size ...
export const SIZE_MAX = 1.5; // ... and at most this much more
const GAP = 0.9; // two buttons may touch: their distance must be at least this share of the sum of their radii

const num = (v) => typeof v === 'number' && isFinite(v);

// the layout in use: the saved one where it is valid, else the default
export function layout() {
  const out = {};
  const s = settings.layout;
  for (const id of IDS) {
    const d = DEFAULT[id], c = s && s[id];
    out[id] = c && num(c.x) && num(c.y) && num(c.d) && c.d >= d.d * SIZE_MIN - 0.01 && c.d <= d.d * SIZE_MAX + 0.01 ? { x: c.x, y: c.y, d: c.d } : { ...d };
  }
  return out;
}

export function isDefault(L) {
  return IDS.every((id) => Math.abs(L[id].x - DEFAULT[id].x) < 0.01 && Math.abs(L[id].y - DEFAULT[id].y) < 0.01 && Math.abs(L[id].d - DEFAULT[id].d) < 0.01);
}

// the button that a button at (x, y) with diameter d would overlap ('' = none)
export function overlap(L, id, x, y, d) {
  for (const o of IDS) {
    if (o === id) continue;
    const e = L[o];
    if (Math.hypot(x - e.x, y - e.y) < (d + e.d) / 2 * GAP) return o;
  }
  return '';
}

// the zone the centres may be in, in u: the right part of the screen and the lower part
export function zone(u) {
  return { maxX: (innerWidth / u) * 0.46, maxY: (innerHeight / u) * 0.72 };
}

export function clampToZone(x, y, d, u) {
  const Z = zone(u), r = d / 2;
  return { x: Math.max(r + 1, Math.min(Z.maxX, x)), y: Math.max(r + 1, Math.min(Z.maxY, y)) };
}
