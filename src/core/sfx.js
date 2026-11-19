// Procedural sound effects (Web Audio, no sound files). Every sound is built
// from a few layers: a low thump for weight, filtered noise for the crunch or
// the whoosh, and tones for the shine. A short generated hall gives them room,
// a compressor at the end keeps everything loud but clean. The volume comes
// from the settings. Audio starts after the first touch or key press, as
// browsers require. The music (core/music.js) uses the same audio graph.
import { settings } from './settings.js';

let ctx = null;
let master = null; // sound effects
let musicBus = null; // background music (core/music.js)
let verbIn = null; // send into the hall
let noise = null;
const lastPlay = {};

// a generated impulse response: 2.4 s of decaying stereo noise
function hall(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return b;
}

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 12;
  comp.ratio.value = 5;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;
  comp.connect(ctx.destination);
  master = ctx.createGain();
  master.connect(comp);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0;
  musicBus.connect(comp);
  const verb = ctx.createConvolver();
  verb.buffer = hall(2.4, 3);
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  verbIn = ctx.createGain();
  verbIn.connect(verb).connect(wet).connect(comp);
  // one second of white noise, reused by every noisy sound
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function unlockAudio() {
  init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

// the shared audio graph for the music (null before the first touch)
export function audio() {
  return ctx ? { ctx, bus: musicBus, verb: verbIn, noise } : null;
}

// ---- building blocks ------------------------------------------------------------

// a gain envelope into the effects bus (and a part of it into the hall)
function out(t, vol, dur, wet, attack = 0.004) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  g.connect(master);
  if (wet > 0) {
    const s = ctx.createGain();
    s.gain.value = wet;
    g.connect(s).connect(verbIn);
  }
  return g;
}

function tone(type, f0, f1, dur, vol, delay = 0, wet = 0, attack = 0.004) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  o.connect(out(t, vol, dur, wet, attack));
  o.start(t);
  o.stop(t + dur + 0.03);
}

// a tone through a closing low-pass filter: brassy, warm (chords, roars)
function warm(type, f, dur, vol, delay = 0, wet = 0, cut0 = 3000, cut1 = 300, attack = 0.01) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), f1 = ctx.createBiquadFilter();
  o.type = type;
  o.frequency.value = f;
  f1.type = 'lowpass';
  f1.frequency.setValueAtTime(cut0, t);
  f1.frequency.exponentialRampToValueAtTime(cut1, t + dur);
  o.connect(f1).connect(out(t, vol, dur, wet, attack));
  o.start(t);
  o.stop(t + dur + 0.03);
}

function hiss(f0, f1, dur, vol, q = 1, delay = 0, wet = 0, type = 'bandpass', attack = 0.003) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter();
  s.buffer = noise;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  s.connect(f).connect(out(t, vol, dur, wet, attack));
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur + 0.03);
}

// the weight of an impact: a sine that falls fast (like a kick drum)
const thump = (f0, f1, dur, vol, delay = 0) => tone('sine', f0, f1, dur, vol, delay, 0, 0.002);
// a slow swell of noise that rises in pitch (before a big blow)
const riser = (dur, vol, delay = 0) => hiss(300, 5000, dur, vol, 2, delay, 0.3, 'bandpass', dur * 0.9);
const vary = (f) => f * (0.94 + Math.random() * 0.12);

// ---- kill streak: every kill rings one step higher on a pentatonic scale ------
const PENTA = [0, 2, 4, 7, 9];
let streak = 0, lastKill = -9;
function streakNote() {
  const now = ctx.currentTime;
  streak = now - lastKill < 2.2 ? Math.min(streak + 1, 14) : 0;
  lastKill = now;
  const st = PENTA[streak % 5] + 12 * Math.floor(streak / 5);
  return 523.25 * Math.pow(2, st / 12);
}

// ---- skills: a sound family for each kind of power ------------------------------
const FAMILY = {
  shadowStep: 'shadow', phantomStrike: 'shadow', shadowWave: 'shadow', rulersGrasp: 'shadow', nightLance: 'shadow',
  umbralShield: 'shield', umbralAegis: 'shield',
  darkMend: 'heal', lifeLeech: 'heal',
  warCry: 'rage', bloodRage: 'rage', huntersMark: 'rage',
  blackFrost: 'frost',
  bladeDance: 'blades', daggerRain: 'blades',
  voidStorm: 'shadow', oblivionRay: 'shadow', nightfall: 'shadow', legionsCall: 'shadow', eclipse: 'heal',
};

const SKILL = {
  shadow: () => {
    hiss(400, 4200, 0.22, 0.38, 1.4, 0, 0.35);
    warm('sawtooth', 73, 0.45, 0.2, 0, 0.3, 1600, 120);
    tone('sine', 220, 660, 0.3, 0.1, 0.02, 0.5);
    thump(140, 50, 0.22, 0.4, 0.04);
  },
  shield: () => {
    [587, 880, 1175, 1760].forEach((f, i) => tone('triangle', f, f * 1.003, 0.7, 0.07, i * 0.03, 0.7));
    hiss(5000, 9000, 0.4, 0.08, 3, 0, 0.6);
    thump(110, 60, 0.25, 0.3);
  },
  heal: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, f, 0.45, 0.09, i * 0.06, 0.7, 0.02));
    hiss(2000, 7000, 0.6, 0.07, 1.2, 0, 0.6, 'bandpass', 0.2);
  },
  rage: () => {
    warm('sawtooth', 98, 0.5, 0.24, 0, 0.35, 2600, 200);
    warm('sawtooth', 147, 0.45, 0.14, 0, 0.35, 2600, 200);
    hiss(800, 200, 0.45, 0.3, 0.7, 0, 0.3, 'lowpass');
    thump(160, 40, 0.3, 0.6);
  },
  frost: () => {
    hiss(9000, 2500, 0.12, 0.4, 0.8, 0, 0.3, 'highpass');
    [1568, 2093, 2637, 3136].forEach((f, i) => tone('sine', f, f, 0.35, 0.05, 0.04 + i * 0.05, 0.8));
    thump(120, 50, 0.25, 0.45);
  },
  blades: () => {
    for (let i = 0; i < 4; i++) hiss(vary(4200), 1100, 0.1, 0.24, 1.1, i * 0.055, 0.2);
    tone('triangle', 2400, 2300, 0.2, 0.05, 0.02, 0.5);
  },
};

// the ultimate: a rising swell, then a deep boom with a crack and a big chord
const ULT_CHORD = {
  shadow: [110, 165, 220, 262, 330],
  shield: [147, 220, 294, 370, 440],
  heal: [131, 196, 262, 330, 392],
  rage: [98, 147, 196, 233, 294],
  frost: [123, 185, 247, 294, 370],
  blades: [110, 165, 220, 277, 330],
};
function ult(fam) {
  const R = 0.32; // length of the swell
  riser(R, 0.3);
  tone('sawtooth', 55, 220, R, 0.06, 0, 0.3, R * 0.8);
  // impact
  thump(120, 28, 1.3, 1, R);
  thump(60, 30, 0.9, 0.5, R);
  hiss(6000, 300, 0.5, 0.55, 0.5, R, 0.6, 'lowpass');
  hiss(3000, 900, 0.18, 0.4, 0.8, R, 0.4);
  (ULT_CHORD[fam] || ULT_CHORD.shadow).forEach((f, i) =>
    warm(i < 2 ? 'sawtooth' : 'triangle', f, 1.8, i < 2 ? 0.1 : 0.07, R + 0.01, 0.65, 3500, 250, 0.02));
  tone('sine', 880, 1760, 1.2, 0.04, R + 0.05, 0.8, 0.3);
}

const SOUNDS = {
  swing: () => { hiss(vary(3200), 800, 0.13, 0.32, 0.9); hiss(700, 300, 0.1, 0.1, 0.8, 0, 0, 'lowpass'); },
  hit: () => {
    thump(vary(210), 70, 0.08, 0.42);
    hiss(vary(1900), 500, 0.07, 0.38, 1.2);
    tone('square', 1300, 500, 0.025, 0.04);
  },
  crit: () => {
    thump(240, 55, 0.14, 0.6);
    hiss(4200, 700, 0.12, 0.5, 0.9, 0, 0.2);
    tone('triangle', 1760, 1720, 0.32, 0.1, 0.01, 0.5);
    tone('sine', 2637, 2600, 0.24, 0.05, 0.02, 0.6);
  },
  kill: () => {
    const f = streakNote();
    thump(170, 42, 0.2, 0.55);
    hiss(2600, 500, 0.14, 0.3, 0.9);
    tone('triangle', f, f, 0.4, 0.11, 0.025, 0.45);
    tone('sine', f * 2, f * 2, 0.3, 0.05, 0.035, 0.55);
    hiss(7000, 10000, 0.3, 0.05, 2, 0.03, 0.6, 'bandpass', 0.05);
  },
  killBig: () => {
    const f = streakNote();
    thump(130, 30, 0.6, 0.9);
    hiss(5000, 250, 0.45, 0.45, 0.6, 0, 0.5, 'lowpass');
    warm('sawtooth', 82, 0.7, 0.15, 0, 0.4, 2000, 150);
    [1, 1.25, 1.5, 2].forEach((m, i) => tone('triangle', f * m, f * m, 0.6, 0.09, 0.05 + i * 0.06, 0.6));
    hiss(6000, 11000, 0.6, 0.07, 2, 0.08, 0.7, 'bandpass', 0.1);
  },
  hurt: () => { thump(160, 60, 0.15, 0.4); warm('sawtooth', 196, 0.2, 0.12, 0, 0.1, 1800, 200); hiss(1200, 300, 0.12, 0.2, 1); },
  skill: (id) => (SKILL[FAMILY[id]] || SKILL.shadow)(),
  ult: (id) => ult(FAMILY[id]),
  arise: () => {
    tone('sine', 110, 330, 0.8, 0.2, 0, 0.5, 0.05);
    tone('triangle', 220, 660, 0.8, 0.08, 0.08, 0.6);
    hiss(150, 1600, 0.7, 0.25, 3, 0, 0.5, 'bandpass', 0.3);
    thump(90, 35, 0.5, 0.5, 0.55);
  },
  levelup: () => {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.5, 0.1, i * 0.08, 0.6));
    hiss(3000, 10000, 0.8, 0.08, 1, 0.1, 0.6, 'bandpass', 0.3);
    thump(110, 50, 0.4, 0.4);
  },
  pickup: () => { tone('sine', vary(880), 1320, 0.1, 0.12, 0, 0.3); tone('sine', 1320, 1760, 0.12, 0.08, 0.06, 0.4); },
  chest: () => { hiss(300, 120, 0.25, 0.3, 2); [660, 880, 1100, 1320].forEach((f, i) => tone('triangle', f, f, 0.3, 0.08, 0.1 + i * 0.07, 0.6)); },
  death: () => { warm('sawtooth', 110, 1.4, 0.16, 0, 0.5, 2000, 80); tone('sine', 300, 50, 1.2, 0.16, 0, 0.4); hiss(400, 80, 0.9, 0.25, 1, 0, 0.4); },
  ui: () => tone('sine', 660, 760, 0.06, 0.08),
  unique: () => {
    tone('sawtooth', 70, 140, 1.2, 0.16, 0, 0.4);
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone('triangle', f, f * 1.01, 0.6, 0.1, 0.25 + i * 0.09, 0.6));
    hiss(2000, 9000, 1.6, 0.18, 0.6, 0.2, 0.5);
  },
};

// minimum time between two plays of the same sound (seconds)
const GAP = { hit: 0.045, crit: 0.06, swing: 0.05, pickup: 0.05, hurt: 0.08, kill: 0.05, killBig: 0.1 };

// arg: the skill id for 'skill' and 'ult' (a sound family per power)
export function play(name, arg) {
  if (!ctx || ctx.state !== 'running' || settings.volume <= 0) return;
  const now = ctx.currentTime;
  const gap = GAP[name] || 0.02;
  if (lastPlay[name] && now - lastPlay[name] < gap) return;
  lastPlay[name] = now;
  master.gain.value = settings.volume * 0.75;
  SOUNDS[name](arg);
}
