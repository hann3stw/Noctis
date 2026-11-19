// Background music, made while it plays (Web Audio, no music files). A small
// sequencer plays five layers (pad, bass, arpeggio, drums, bell melody) in
// sixteenth notes. Each mood has its own tempo, key, chords and patterns:
//   menu     slow and wide, the title screens
//   explore  calm, travelling the world (a tune for every zone)
//   camp     quiet, at the camp fire
//   combat   driving drums and bass while enemies hunt the player
//   boss     heavy, a boss is fighting
//   abyss    eerie, a run in the Abyss
//   calm     almost silent (the hunter has fallen)
//
// Smooth changes: every mood plays on its own "deck". A new mood starts on
// the next beat of the old one and both play together for a few seconds while
// one fades in and the other out (equal power, so the music never dips).
// Fights and bosses come in quickly after a short swell, calm music returns
// slowly. Fights, the boss and the Abyss play in the key of the zone around
// them, so the two tunes fit together while they overlap. The volume is
// settings.music; the music is quieter in the pause menu.
import { audio } from './sfx.js';
import { settings } from './settings.js';

const AEOLIAN = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const HARMONIC = [0, 2, 3, 5, 7, 8, 11];
const LOCRIAN = [0, 1, 3, 5, 6, 8, 10];
const HUNGARIAN = [0, 2, 3, 6, 7, 8, 11];
const DOMINANT = [0, 1, 4, 5, 7, 8, 10];

// prog: one chord (scale degree) per bar; layers: volumes 0..1;
// follow: plays in the key of the zone around it
const MOODS = {
  menu: { bpm: 64, root: 50, scale: AEOLIAN, prog: [0, 5, 3, 4], layers: { pad: 1, bass: 0.6, arp: 0.45, drums: 0, bell: 0.7 }, bass: 'long', arp: 4, drums: null },
  explore: { bpm: 84, root: 50, scale: DORIAN, prog: [0, 3, 0, 6], layers: { pad: 0.75, bass: 0.6, arp: 0.65, drums: 0.35, bell: 0.55 }, bass: 'walk', arp: 2, drums: 'soft' },
  combat: { bpm: 124, root: 45, scale: AEOLIAN, prog: [0, 5, 6, 4], layers: { pad: 0.5, bass: 1, arp: 0.6, drums: 1, bell: 0 }, bass: 'drive', arp: 1, drums: 'beat', follow: true },
  boss: { bpm: 136, root: 43, scale: PHRYGIAN, prog: [0, 1, 0, 6], layers: { pad: 0.8, bass: 1, arp: 0.7, drums: 1, bell: 0 }, bass: 'gallop', arp: 1, drums: 'war', stab: true, follow: true },
  abyss: { bpm: 90, root: 47, scale: PHRYGIAN, prog: [0, 0, 1, 5], layers: { pad: 1, bass: 0.7, arp: 0.4, drums: 0.5, bell: 0.4 }, bass: 'long', arp: 2, drums: 'heart' },
  camp: { bpm: 70, root: 50, scale: DORIAN, prog: [0, 3, 4, 0], layers: { pad: 0.8, bass: 0.45, arp: 0.5, drums: 0, bell: 0.65 }, bass: 'long', arp: 2, drums: null },
  calm: { bpm: 60, root: 50, scale: AEOLIAN, prog: [0, 5], layers: { pad: 0.5, bass: 0, arp: 0, drums: 0, bell: 0.25 }, bass: 'long', arp: 4, drums: null, follow: true },
};
// Travel music of each zone (meadow, forest, swamp, ruins, ice, volcano,
// shard waste, storm spire, bone field, void throne): key, scale and pace change.
const EXPLORE = [
  {},
  { bpm: 78, root: 52, scale: AEOLIAN, prog: [0, 5, 2, 6], arp: 2 },
  { bpm: 72, root: 48, scale: PHRYGIAN, prog: [0, 1, 0, 4], arp: 4, drums: 'heart' },
  { bpm: 80, root: 45, scale: HARMONIC, prog: [0, 3, 4, 0], arp: 2 },
  { bpm: 70, root: 54, scale: LYDIAN, prog: [0, 1, 5, 4], arp: 2, drums: null, layers: { pad: 0.85, bass: 0.5, arp: 0.6, drums: 0, bell: 0.8 } },
  { bpm: 96, root: 43, scale: PHRYGIAN, prog: [0, 1, 6, 1], arp: 2, bass: 'drive', layers: { pad: 0.7, bass: 0.6, arp: 0.5, drums: 0.45, bell: 0.3 } },
  { bpm: 88, root: 49, scale: HUNGARIAN, prog: [0, 4, 0, 5], arp: 2 },
  { bpm: 100, root: 47, scale: AEOLIAN, prog: [0, 6, 5, 6], arp: 1, layers: { pad: 0.7, bass: 0.6, arp: 0.45, drums: 0.45, bell: 0.3 } },
  { bpm: 66, root: 46, scale: LOCRIAN, prog: [0, 4, 0, 1], arp: 4, drums: 'heart' },
  { bpm: 76, root: 44, scale: DOMINANT, prog: [0, 1, 0, 6], arp: 2, drums: 'heart', layers: { pad: 1, bass: 0.7, arp: 0.5, drums: 0.5, bell: 0.45 } },
];
for (let i = 0; i < EXPLORE.length; i++) {
  const v = EXPLORE[i];
  MOODS['explore' + i] = { ...MOODS.explore, ...v, layers: { ...MOODS.explore.layers, ...(v.layers || {}) } };
}
const INTENSE = { combat: 1, boss: 1 };

const SEND = { pad: 0.45, bass: 0, arp: 0.4, drums: 0.1, bell: 0.75 };

let A = null; // { ctx, bus, verb, noise }
let musicIn = null, stingG = null;
let deck = null; // the deck playing now
const fading = []; // decks fading out
let want = 'menu', home = 50; // home: root of the zone tune
let lastSwitch = -99, timer = 0;
let duck = 1;

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

// equal power fades: the sum of both decks stays as loud as one
const CURVE = 32;
const FADE_IN = new Float32Array(CURVE), FADE_OUT = new Float32Array(CURVE);
for (let i = 0; i < CURVE; i++) {
  const x = i / (CURVE - 1);
  FADE_IN[i] = Math.max(0.0001, Math.sin(x * Math.PI / 2));
  FADE_OUT[i] = Math.max(0.0001, Math.cos(x * Math.PI / 2));
}

function voice(type, freq, t, dur, vol, dest, attack = 0.01, release = 0.08, detune = 0) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  o.detune.value = detune;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, t + Math.max(attack, dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function drop(f0, f1, t, dur, vol, dest) {
  const c = A.ctx, o = c.createOscillator(), g = c.createGain();
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.6);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function noiseHit(t, dur, vol, type, freq, dest, q = 0.8, f1 = 0) {
  const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noise;
  f.type = type;
  f.frequency.setValueAtTime(freq, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  f.Q.value = q;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(dest);
  s.start(t, Math.random() * 0.8);
  s.stop(t + dur + 0.05);
}

// a slow swell of noise that peaks when the new music starts (into a fight)
function swell(t0, t1, vol) {
  const c = A.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = A.noise;
  s.loop = true;
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(400, t0);
  f.frequency.exponentialRampToValueAtTime(5000, t1);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t1);
  g.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.35);
  s.connect(f).connect(g).connect(musicIn);
  const w = c.createGain();
  w.gain.value = 0.5;
  g.connect(w).connect(A.verb);
  s.start(t0);
  s.stop(t1 + 0.4);
}

// the root of a mood that plays in the key of the zone: nearest to "home"
function fitRoot(r) {
  let d = (((home - r) % 12) + 12) % 12;
  if (d > 6) d -= 12;
  return r + d;
}

// ---- a deck: one mood, its own layers, echo and filter --------------------------
class Deck {
  constructor(name, start, fadeIn) {
    const c = A.ctx, base = MOODS[name];
    this.name = name;
    this.M = base.follow ? { ...base, root: fitRoot(base.root) } : base;
    this.step = 0;
    this.bar = 0;
    this.nextT = start;
    this.arpOrder = 0;
    this.bellNote = 4;
    this.dead = false;
    // out: everything dry; wet: everything into the hall (both fade together)
    this.out = c.createGain();
    this.wet = c.createGain();
    this.out.gain.setValueAtTime(0.0001, c.currentTime);
    this.wet.gain.setValueAtTime(0.0001, c.currentTime);
    this.out.connect(musicIn);
    this.wet.connect(A.verb);
    this.L = {};
    for (const k of Object.keys(SEND)) {
      const g = c.createGain();
      g.gain.value = this.M.layers[k];
      g.connect(this.out);
      if (SEND[k]) {
        const s = c.createGain();
        s.gain.value = SEND[k];
        g.connect(s).connect(this.wet);
      }
      this.L[k] = g;
    }
    // the pad is soft and breathes (a slow filter sweep)
    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padFilter.Q.value = 0.8;
    this.padFilter.connect(this.L.pad);
    this.lfo = c.createOscillator();
    const lg = c.createGain();
    this.lfo.frequency.value = 0.07;
    lg.gain.value = 450;
    this.lfo.connect(lg).connect(this.padFilter.frequency);
    this.lfo.start();
    // the arpeggio echoes
    this.delay = c.createDelay(2);
    this.delay.delayTime.value = (60 / this.M.bpm / 4) * 3;
    const fb = c.createGain(), dl = c.createGain();
    fb.gain.value = 0.32;
    dl.gain.value = 0.35;
    this.delay.connect(fb).connect(this.delay);
    this.delay.connect(dl).connect(this.L.arp);
    this.fade(FADE_IN, start, fadeIn);
  }

  // follows the curve from time t on; whatever was planned after t is dropped
  // (a deck that is still fading in can start to fade out at any moment)
  fade(curve, t, dur) {
    dur = Math.max(0.05, dur);
    for (const g of [this.out.gain, this.wet.gain]) {
      if (g.cancelAndHoldAtTime) g.cancelAndHoldAtTime(t);
      else { g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); }
      for (let i = 0; i < curve.length; i++) g.linearRampToValueAtTime(curve[i], t + (dur * i) / (curve.length - 1));
    }
  }

  // fades out over dur seconds and keeps playing meanwhile, then it is removed
  retire(t, dur) {
    // a deck still fading in starts its fade out from where it is
    const now = this.out.gain.value;
    const curve = FADE_OUT.map((v) => Math.max(0.0001, v * Math.max(0.0001, now)));
    this.fade(curve, t, dur);
    this.endT = t + dur;
  }

  dispose() {
    this.dead = true;
    try { this.lfo.stop(); } catch (_) { /* already stopped */ }
    this.out.disconnect();
    this.wet.disconnect();
  }

  // the time of the next beat (a new deck starts there)
  nextBeat() {
    const sd = 60 / this.M.bpm / 4;
    return this.nextT + ((4 - (this.step % 4)) % 4) * sd;
  }

  schedule(until) {
    while (this.nextT < until && !(this.endT && this.nextT > this.endT)) {
      this.play16(this.nextT, this.step);
      this.nextT += 60 / this.M.bpm / 4;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) { this.bar++; this.arpOrder = Math.floor(Math.random() * 3); }
    }
  }

  note(d, o = 0) {
    const s = this.M.scale, n = s.length;
    const k = ((d % n) + n) % n;
    return this.M.root + s[k] + 12 * (Math.floor(d / n) + o);
  }

  // ---- one sixteenth note ----
  play16(t, s) {
    const M = this.M, L = this.L, sd = 60 / M.bpm / 4, barDur = sd * 16;
    const deg = M.prog[this.bar % M.prog.length];
    const chord = [this.note(deg), this.note(deg + 2), this.note(deg + 4)];

    // pad: the chord over the whole bar (two voices a little apart)
    if (s === 0 && M.layers.pad > 0) {
      for (const m of [...chord, this.note(deg, 1)]) {
        voice('sawtooth', hz(m), t, barDur + 0.9, 0.035, this.padFilter, 0.7, 0.9, -7);
        voice('sawtooth', hz(m), t, barDur + 0.9, 0.035, this.padFilter, 0.7, 0.9, 7);
      }
    }
    // boss: a heavy stab on the first beat
    if (M.stab && s === 0) {
      for (const m of chord) voice('sawtooth', hz(m - 12), t, sd * 3, 0.06, L.bass, 0.005, sd * 2);
    }

    // bass
    const root = hz(this.note(deg, -1));
    if (M.layers.bass > 0) {
      if (M.bass === 'long' && (s === 0 || s === 8)) {
        voice('triangle', root, t, sd * 7.5, 0.22, L.bass, 0.05, 0.3);
      } else if (M.bass === 'walk' && (s === 0 || s === 6 || s === 8 || s === 14)) {
        const m = s === 14 ? hz(this.note(deg + 4, -1)) : root;
        voice('triangle', m, t, sd * (s === 0 || s === 8 ? 5 : 1.8), 0.24, L.bass, 0.01, 0.12);
      } else if (M.bass === 'drive' && s % 2 === 0) {
        const oct = s === 6 || s === 14 ? 2 : 1;
        voice('sawtooth', root * oct, t, sd * 1.6, 0.11, L.bass, 0.005, 0.06);
        voice('sine', root, t, sd * 1.6, 0.2, L.bass, 0.005, 0.06);
      } else if (M.bass === 'gallop' && [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15].includes(s)) {
        voice('sawtooth', root, t, sd * 0.9, 0.12, L.bass, 0.004, 0.05);
        voice('sine', root, t, sd * 0.9, 0.2, L.bass, 0.004, 0.05);
      }
    }

    // arpeggio: chord tones going up (and down again on some bars)
    if (M.layers.arp > 0 && s % M.arp === 0) {
      const tones = [chord[0], chord[1], chord[2], chord[0] + 12, chord[1] + 12];
      const n = s / M.arp, o = this.arpOrder;
      const i = o === 0 ? n % 5 : o === 1 ? [0, 1, 2, 3, 4, 3, 2, 1][n % 8] : [0, 2, 1, 3, 2, 4, 3, 1][n % 8];
      const f = hz(tones[i] + 12);
      voice('triangle', f, t, sd * Math.min(M.arp, 2) * 1.6, 0.07, L.arp, 0.004, sd);
      voice('triangle', f, t, sd * Math.min(M.arp, 2) * 1.6, 0.07, this.delay, 0.004, sd);
    }

    // drums
    if (M.layers.drums > 0 && M.drums) {
      const D = L.drums;
      if (M.drums === 'beat') {
        if (s % 4 === 0) drop(150, 42, t, 0.32, 0.9, D);
        if (s === 4 || s === 12) { noiseHit(t, 0.16, 0.38, 'bandpass', 1800, D); drop(220, 160, t, 0.1, 0.2, D); }
        if (s % 2 === 0) noiseHit(t, 0.035, s % 4 === 2 ? 0.22 : 0.11, 'highpass', 8000, D);
        if (this.bar % 4 === 3 && s >= 13) noiseHit(t, 0.1, 0.25, 'bandpass', 2400, D);
      } else if (M.drums === 'war') {
        if ([0, 3, 6, 8, 11, 14].includes(s)) drop(130, 38, t, 0.4, 0.95, D);
        if (s === 4 || s === 12) { noiseHit(t, 0.22, 0.45, 'bandpass', 1500, D); drop(200, 140, t, 0.14, 0.25, D); }
        if (s % 2 === 1) noiseHit(t, 0.03, 0.12, 'highpass', 9000, D);
        if (this.bar % 2 === 1 && s >= 12) drop(160 - (s - 12) * 20, 70, t, 0.3, 0.5, D);
      } else if (M.drums === 'soft') {
        if (s === 0 || s === 10) drop(110, 45, t, 0.3, 0.45, D);
        if (s % 4 === 2) noiseHit(t, 0.05, 0.08, 'highpass', 7000, D);
      } else if (M.drums === 'heart') {
        if (s === 0 || s === 8) drop(80, 40, t, 0.3, 0.75, D);
        if (s === 2 || s === 10) drop(70, 38, t, 0.25, 0.45, D);
      }
    }

    // bell: a slow, wandering melody high above
    if (M.layers.bell > 0 && (s === 0 || s === 8) && Math.random() < 0.55) {
      this.bellNote = Math.max(2, Math.min(11, this.bellNote + [-2, -1, 1, 2, 0][Math.floor(Math.random() * 5)]));
      const f = hz(this.note(this.bellNote, 1));
      voice('sine', f, t, 1.8, 0.07, L.bell, 0.005, 1.6);
      voice('sine', f * 2.01, t, 0.9, 0.025, L.bell, 0.005, 0.8);
    }
  }
}

// ---- changing the mood --------------------------------------------------------
function switchTo(name, now) {
  const into = INTENSE[name], from = deck && INTENSE[deck.name];
  // fights come in fast, calm music returns slowly; zone to zone is the slowest
  const zoneChange = deck && name.startsWith('explore') && deck.name.startsWith('explore');
  const fadeIn = into ? 1.2 : zoneChange ? 6 : from ? 4.5 : 3.5;
  const fadeOut = into ? 2.2 : zoneChange ? 6 : from ? 4 : 3.5;
  let start = now + 0.08;
  if (deck) {
    const beat = deck.nextBeat();
    if (beat - now < 0.9) start = Math.max(start, beat);
  }
  if (into && deck && !from) swell(Math.max(now, start - 1), start, 0.08);
  if (deck) {
    deck.retire(start, fadeOut);
    fading.push(deck);
  }
  // too many tunes at once: the oldest ones go quickly
  while (fading.length > 2) {
    const d = fading.shift();
    d.retire(now, 0.3);
    d.endT = now + 0.3;
    setTimeout(() => d.dispose(), 1500);
  }
  if (!MOODS[name].follow && name !== 'menu') home = MOODS[name].root;
  deck = new Deck(name, start, fadeIn);
  lastSwitch = now;
}

function tick() {
  if (!A) return;
  const c = A.ctx, now = c.currentTime;
  const vol = (settings.music ?? 0.5) * duck * (document.hidden ? 0 : 1);
  A.bus.gain.setTargetAtTime(vol * 0.9, now, 0.25);
  if (vol <= 0 || c.state !== 'running') return;
  // after a break (hidden tab, music off): pick up where the time is now
  for (const d of [deck, ...fading]) if (d && d.nextT < now - 0.1) d.nextT = now + 0.05;
  // a change of mood (fights at once, everything else not more than every 2 s)
  if (!deck || (want !== deck.name && (INTENSE[want] || now - lastSwitch > 2))) switchTo(want, now);
  deck.schedule(now + 0.25);
  for (let i = fading.length - 1; i >= 0; i--) {
    const d = fading[i];
    if (now > d.endT + 3) { d.dispose(); fading.splice(i, 1); continue; } // tails ring out first
    d.schedule(Math.min(now + 0.25, d.endT));
  }
}

// call after the first touch (audio needs it)
export function startMusic() {
  if (A) return;
  A = audio();
  if (!A) return;
  const c = A.ctx;
  musicIn = c.createGain();
  musicIn.connect(A.bus);
  // stings play over every mood
  stingG = c.createGain();
  stingG.connect(musicIn);
  const ss = c.createGain();
  ss.gain.value = 0.6;
  stingG.connect(ss).connect(A.verb);
  timer = setInterval(tick, 60);
  tick();
}

// variant: the zone for 'explore' (each zone has its own tune)
export function setMood(name, variant) {
  if (name === 'explore' && typeof variant === 'number') {
    const k = 'explore' + Math.max(0, Math.min(EXPLORE.length - 1, variant));
    if (MOODS[k]) { want = k; return; }
  }
  if (MOODS[name]) want = name;
}

export function musicMood() {
  return want;
}

// quieter music (pause menu)
export function duckMusic(on) {
  duck = on ? 0.4 : 1;
}

// a short phrase over the music: 'victory' (a boss falls)
export function sting(name) {
  if (!A || (settings.music ?? 0.5) <= 0) return;
  const t = A.ctx.currentTime + 0.05;
  if (name === 'victory') {
    const r = 57;
    [[0, 4, 7], [2, 5, 9], [4, 7, 12]].forEach((ch, i) =>
      ch.forEach((d) => voice('sawtooth', hz(r + d), t + i * 0.22, i === 2 ? 1.8 : 0.3, 0.05, stingG, 0.01, i === 2 ? 1.4 : 0.1)));
    drop(140, 40, t + 0.44, 0.6, 0.8, stingG);
  }
}

export function stopMusic() {
  clearInterval(timer);
}
