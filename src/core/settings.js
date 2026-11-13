// Player settings (not part of a save): graphics, volume, button size and
// joystick sides. Stored in localStorage and applied at once.
import { CONFIG } from '../config.js';
import { input } from '../input/input.js';

const KEY = 'noctis.settings';

export const settings = {
  graphics: 'auto', // auto | low | medium | high
  autoLevel: '', // preset chosen by "auto" (remembered between sessions)
  volume: 0.7, // 0..1
  buttonSize: 1, // 0.8 .. 1.3
  swap: false, // movement on the right, buttons on the left
  showFps: false,
  lastSlot: -1, // slot of the world played last ("Continue")
};

// Values of the current graphics preset, read by the game every frame.
export const gfx = { pixelRatio: 1.5, particles: 1, decorRadius: 64, renderRadius: 36, shadows: true, level: 'medium' };

const LEVELS = ['low', 'medium', 'high'];
let ceiling = 2; // "auto" never climbs back above a level that was too slow
let goodRuns = 0;

// first guess for "auto": small touch screens start on medium
function guessLevel() {
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 500;
  return touch && small ? 'medium' : 'high';
}

// Called by the game every few seconds with the measured frame rate.
export function reportFps(fps) {
  if (settings.graphics !== 'auto') return;
  const A = CONFIG.graphics.auto;
  const i = LEVELS.indexOf(gfx.level);
  if (fps < A.lowFps && i > 0) {
    ceiling = i - 1;
    goodRuns = 0;
    settings.autoLevel = LEVELS[i - 1];
    applySettings();
    saveSettings();
  } else if (fps >= A.highFps && i < ceiling) {
    if (++goodRuns >= A.upAfter) {
      goodRuns = 0;
      settings.autoLevel = LEVELS[i + 1];
      applySettings();
      saveSettings();
    }
  } else {
    goodRuns = 0;
  }
}

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k in settings) if (k in s && typeof s[k] === typeof settings[k]) settings[k] = s[k];
  } catch (_) { /* private mode or broken data: keep the defaults */ }
  applySettings();
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (_) { /* ignore */ }
}

let onGraphics = null;
// called after the graphics preset changed (the app resizes the renderer)
export function onGraphicsChange(fn) {
  onGraphics = fn;
}

export function applySettings() {
  if (!LEVELS.includes(settings.autoLevel)) settings.autoLevel = guessLevel();
  const level = settings.graphics === 'auto' ? settings.autoLevel : settings.graphics;
  const p = CONFIG.graphics.presets[level] || CONFIG.graphics.presets.medium;
  gfx.level = CONFIG.graphics.presets[level] ? level : 'medium';
  gfx.shadows = p.shadows;
  gfx.pixelRatio = p.pixelRatio;
  gfx.particles = p.particles;
  gfx.decorRadius = p.decorRadius;
  gfx.renderRadius = p.renderRadius;
  const root = document.documentElement.style;
  root.setProperty('--btn', String(settings.buttonSize));
  input.swap = settings.swap;
  const hud = document.getElementById('hud');
  if (hud) hud.classList.toggle('swap', settings.swap);
  if (onGraphics) onGraphics();
}

// Changes one setting, applies and stores it.
export function setSetting(key, value) {
  settings[key] = value;
  if (key === 'graphics') { ceiling = 2; goodRuns = 0; }
  applySettings();
  saveSettings();
}
