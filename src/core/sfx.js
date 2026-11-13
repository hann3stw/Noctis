// Small procedural sound effects (Web Audio, no sound files). The volume
// comes from the settings. Audio starts after the first touch or key press,
// as browsers require.
import { settings } from './settings.js';

let ctx = null;
let master = null;
let noise = null;
const lastPlay = {};

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  // one second of white noise, reused by every noisy sound
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}

export function unlockAudio() {
  init();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function tone(type, f0, f1, dur, vol, delay = 0) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function hiss(f0, f1, dur, vol, q = 1, delay = 0) {
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noise;
  f.type = 'bandpass';
  f.Q.value = q;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master);
  s.start(t);
  s.stop(t + dur + 0.02);
}

const SOUNDS = {
  swing: () => hiss(2400, 700, 0.14, 0.35, 0.8),
  hit: () => { hiss(900, 300, 0.08, 0.4, 1.5); tone('square', 180, 90, 0.06, 0.06); },
  crit: () => { hiss(1400, 400, 0.12, 0.5, 1.2); tone('triangle', 880, 440, 0.12, 0.12); },
  hurt: () => tone('sawtooth', 220, 90, 0.18, 0.14),
  skill: () => { hiss(500, 3000, 0.25, 0.3, 2); tone('sine', 300, 700, 0.25, 0.12); },
  ult: () => { tone('sawtooth', 80, 40, 0.8, 0.22); hiss(200, 2400, 0.7, 0.4, 0.7); tone('sine', 220, 880, 0.6, 0.12, 0.05); },
  arise: () => { tone('sine', 110, 330, 0.7, 0.2); tone('triangle', 220, 660, 0.7, 0.08, 0.08); hiss(150, 900, 0.6, 0.25, 3); },
  levelup: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.12, i * 0.09)),
  pickup: () => { tone('sine', 880, 1320, 0.1, 0.12); tone('sine', 1320, 1760, 0.1, 0.08, 0.06); },
  chest: () => { hiss(300, 120, 0.25, 0.3, 2); [660, 880, 1100].forEach((f, i) => tone('triangle', f, f, 0.16, 0.08, 0.1 + i * 0.07)); },
  death: () => { tone('sawtooth', 300, 50, 0.9, 0.16); hiss(400, 80, 0.8, 0.25, 1); },
  ui: () => tone('sine', 660, 760, 0.06, 0.08),
};

// minimum time between two plays of the same sound (seconds)
const GAP = { hit: 0.045, crit: 0.06, swing: 0.05, pickup: 0.05, hurt: 0.08 };

export function play(name) {
  if (!ctx || ctx.state !== 'running' || settings.volume <= 0) return;
  const now = ctx.currentTime;
  const gap = GAP[name] || 0.02;
  if (lastPlay[name] && now - lastPlay[name] < gap) return;
  lastPlay[name] = now;
  master.gain.value = settings.volume * 0.8;
  SOUNDS[name]();
}
