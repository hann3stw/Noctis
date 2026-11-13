// Player settings (not part of a save): graphics, volume, button size and
// joystick sides. Stored in localStorage and applied at once.
import { CONFIG } from '../config.js';
import { input } from '../input/input.js';

const KEY = 'noctis.settings';

export const settings = {
  graphics: 'medium', // low | medium | high
  volume: 0.7, // 0..1
  buttonSize: 1, // 0.8 .. 1.3
  swap: false, // movement on the right, buttons on the left
  showFps: false,
  lastSlot: -1, // slot of the world played last ("Continue")
};

// Values of the current graphics preset, read by the game every frame.
export const gfx = { pixelRatio: 1.5, particles: 1, decorRadius: 64, renderRadius: 36 };

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
  const p = CONFIG.graphics.presets[settings.graphics] || CONFIG.graphics.presets.medium;
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
  applySettings();
  saveSettings();
}
