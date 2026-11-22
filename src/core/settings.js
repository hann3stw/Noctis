// Player settings (not part of a save): graphics, volume, button size and
// joystick sides. Stored in localStorage and applied at once.
import { CONFIG } from '../config.js';
import { input } from '../input/input.js';

const KEY = 'noctis.settings';

export const settings = {
  graphics: 'auto', // auto | low | medium | high | ultra
  autoLevel: '', // preset chosen by "auto" (remembered between sessions)
  autoScale: 0, // step of the render resolution chosen by "auto" (index into graphics.auto.scales)
  volume: 0.7, // 0..1 sound effects
  music: 0.5, // 0..1 background music
  vibrate: true, // short vibrations on hits, kills and ultimates (Android)
  buttonSize: 1, // 0.8 .. 1.3
  swap: false, // movement on the right, buttons on the left
  layout: null, // where the buttons on the right are and how big (core/hudLayout.js); null = the default
  showFps: false,
  lastSlot: -1, // slot of the world played last ("Continue")
  hunterName: '', // name on the Abyss leaderboard
  cloudSave: true, // copy of every save slot online
};

// Values of the current graphics preset, read by the game every frame.
export const gfx = {
  renderScale: 1, // share of the preset's resolution (auto lowers it before dropping a preset)
  pixelRatio: 1.5, particles: 1, decorRadius: 64, renderRadius: 36, shadows: true, realShadows: false,
  shadowMap: 1536, shadowRange: 26, lights: 3, bloom: false, level: 'medium',
};

const LEVELS = ['low', 'medium', 'high', 'ultra'];
let ceiling = 3; // "auto" never climbs back above a level that was too slow
let goodRuns = 0;
let scaleTop = 0; // "auto" never raises the resolution above this step again (one that was too slow)
let justRaised = false; // the last change was a step up of the resolution
let runs = 0; // measurements so far (the first ones are short)
let skip = 1; // measurements to skip (after the start and after every change)
let probeFps = 0; // frame rate before the last step down of the resolution (0 = none to judge)
let scaleUseless = false; // lowering the resolution did not help this device

// seconds the game measures the frame rate for before it calls reportFps
export function measureEvery() {
  const A = CONFIG.graphics.auto;
  return runs < A.warmRuns ? A.warmMeasure : A.measure;
}

const scales = () => CONFIG.graphics.auto.scales;
const scaleIdx = () => Math.max(0, Math.min(scales().length - 1, settings.autoScale | 0));

// first guess for "auto": phones with little memory or few cores start on
// medium, everything else on high (the render resolution then adapts to the device)
function guessLevel() {
  const touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.screen.width, window.screen.height) < 500;
  const weak = (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 6);
  return touch && small && weak ? 'medium' : 'high';
}

// Called by the game every few seconds with the measured frame rate.
// Too slow: first the render resolution steps down (a sharp picture costs the
// most on phones), and only when it is at its lowest the preset drops. If a
// step down does not make it noticeably faster, the device is slow in some
// other way (processor): the step is undone and the preset drops instead.
// Fast for a while: the resolution steps up again, then the preset.
export function reportFps(fps) {
  if (settings.graphics !== 'auto') return;
  // the first window after the start or a change holds shader compiles and the
  // resize itself: not a fair measurement
  if (skip > 0) { skip--; return; }
  runs++;
  const A = CONFIG.graphics.auto;
  const i = LEVELS.indexOf(gfx.level), s = scaleIdx(), last = scales().length - 1;
  const raised = justRaised, probe = probeFps;
  justRaised = false;
  probeFps = 0;
  let changed = false;
  const dropPreset = () => {
    ceiling = i - 1;
    settings.autoLevel = LEVELS[i - 1];
    settings.autoScale = 0;
    scaleTop = 0;
    changed = true;
  };
  if (fps < A.lowFps) {
    goodRuns = 0;
    if (probe > 0 && s > 0 && fps < probe * A.scaleGain) {
      // the last step down did not help: not the resolution that is slow
      scaleUseless = true;
      settings.autoScale = 0;
      changed = true;
      if (i > 0) dropPreset();
    } else if (!scaleUseless && s < last) {
      // a step up that did not hold is not tried again
      if (raised) scaleTop = s + 1;
      settings.autoScale = s + 1;
      probeFps = fps;
      changed = true;
    } else if (i > 0) {
      dropPreset();
    }
  } else if (fps >= A.highFps) {
    if (++goodRuns >= A.upAfter) {
      goodRuns = 0;
      if (s > scaleTop) {
        settings.autoScale = s - 1;
        justRaised = true;
        changed = true;
      } else if (i < ceiling) {
        settings.autoLevel = LEVELS[i + 1];
        settings.autoScale = scaleUseless ? 0 : Math.min(1, last); // the next preset starts a little below its full resolution
        scaleTop = 0;
        changed = true;
      }
    }
  } else {
    goodRuns = 0;
  }
  if (changed) { applySettings(); saveSettings(); }
}

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    for (const k in settings) if (k in s && typeof s[k] === typeof settings[k]) settings[k] = s[k];
  } catch (_) { /* private mode or broken data: keep the defaults */ }
  settings.autoScale = 0; // every session finds its resolution again (a device that was only slow once stays sharp)
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
  gfx.realShadows = !!p.realShadows; // shadow maps from the sun (high, ultra)
  gfx.shadowMap = p.shadowMap || 1536;
  gfx.shadowRange = p.shadowRange || 26;
  gfx.lights = p.lights || 1;
  gfx.bloom = !!p.bloom;
  gfx.pixelRatio = p.pixelRatio;
  gfx.renderScale = settings.graphics === 'auto' ? scales()[scaleIdx()] : 1;
  gfx.particles = p.particles;
  gfx.decorRadius = p.decorRadius;
  gfx.renderRadius = p.renderRadius;
  const root = document.documentElement.style;
  root.setProperty('--btn', String(settings.buttonSize));
  input.swap = settings.swap;
  const hud = document.getElementById('hud');
  if (hud) hud.classList.toggle('swap', settings.swap);
  window.dispatchEvent(new Event('noctis-layout')); // the HUD places its buttons again
  skip = 1;
  if (onGraphics) onGraphics();
}

// Changes one setting, applies and stores it.
export function setSetting(key, value) {
  settings[key] = value;
  if (key === 'graphics') { ceiling = 3; goodRuns = 0; scaleTop = 0; justRaised = false; runs = 0; probeFps = 0; scaleUseless = false; if (value === 'auto') settings.autoScale = 0; }
  applySettings();
  saveSettings();
}
