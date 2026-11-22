// Skills and ultimates. Every skill is one case below; its numbers live in
// CONFIG.skills / CONFIG.ultimates.
import { CONFIG } from '../config.js';
import { POWER_PER_LEVEL, COOLDOWN_PER_LEVEL } from '../core/mastery.js';
import { hitArc, hitCircle, hitLine, playerHit } from './weapons.js';
import { SWEEP, EXPAND, FLASH } from '../render/effects.js';
import { RUNE_KINDS } from '../core/runes.js';

// The glow of every cast: colour ('aura' = the hunter's aura colour), where
// (self, target, front of the hunter, or along a line) and how strong.
const GLOW = {
  shadowStep: { at: 'self', light: 70 },
  shadowWave: { at: 'front', light: 80, sparks: 30 },
  rulersGrasp: { at: 'target', light: 90 },
  umbralShield: { at: 'self', color: 0x6aa8ff, light: 70 },
  daggerRain: { at: 'target', color: 0xd8d2ff, light: 50 },
  warCry: { at: 'self', color: 0xff6070, light: 130, sparks: 36 },
  lifeLeech: { at: 'front', color: 0x5cf08a, light: 60 },
  nightLance: { at: 'line', light: 90 },
  bladeDance: { at: 'self', color: 0xe8dcff, light: 60 },
  phantomStrike: { at: 'self', light: 90 },
  blackFrost: { at: 'self', color: 0x9fe0ff, light: 110, sparks: 40 },
  huntersMark: { at: 'target', color: 0xff4060, light: 70 },
  darkMend: { at: 'self', color: 0x5cf08a, light: 90, rise: 4 },
  bloodRage: { at: 'self', color: 0xff3040, light: 110, rise: 4 },
  voidStorm: { at: 'target', light: 160, big: true },
  umbralAegis: { at: 'self', color: 0x6aa8ff, light: 160, big: true },
  oblivionRay: { at: 'line', light: 180, big: true },
  nightfall: { at: 'self', light: 220, big: true },
  legionsCall: { at: 'self', light: 160, big: true, rise: 5 },
  eclipse: { at: 'self', color: 0xffd24a, light: 180, big: true, rise: 4 },
};

function castGlow(game, id, tx, tz, dx, dz) {
  const G = GLOW[id];
  if (!G) return;
  const P = game.player, fx = game.effects, def = skillDef(id);
  const col = G.color || game.appearance.aura;
  const big = !!G.big;
  let x = P.x, z = P.z;
  if (G.at === 'target') { x = tx; z = tz; }
  if (G.at === 'front') { const r = (def.range || 6) * 0.45; x += dx * r; z += dz * r; }
  if (G.at === 'line') {
    const len = def.range || 10;
    for (let k = 1; k <= 6; k++) {
      const f = k / 6;
      fx.flare(P.x + dx * len * f, 1, P.z + dz * len * f, (big ? 3.2 : 2) * (1.2 - f * 0.5), col, 0.35 + f * 0.15, 1.5);
    }
    fx.sparks(P.x + dx * len * 0.5, 1, P.z + dz * len * 0.5, big ? 40 : 22, col, 7, 0.5, 0.8, 1.5);
    x = P.x + dx * len * 0.35; z = P.z + dz * len * 0.35;
  }
  fx.light(x, 2.2, z, col, G.light, big ? 22 : 13, big ? 0.8 : 0.45);
  fx.flare(x, 1.2, z, big ? 9 : 4.5, col, big ? 0.6 : 0.4, 1.8);
  fx.flare(x, 1.2, z, big ? 4 : 2, 0xffffff, big ? 0.35 : 0.22, 1.5);
  fx.sparks(x, 0.8, z, G.sparks || (big ? 60 : 24), col, big ? 10 : 6, big ? 0.6 : 0.45, big ? 1.3 : 0.9, G.rise || 2);
}

// the runes the hunter wears (set by the game)
let mastery = null;
export function setMastery(m) {
  mastery = m;
}
let runes = null;
export function setRunes(r) {
  runes = r;
}
const runed = new Map(); // 'skill:rune' -> the skill with the rune's numbers
let runedVer = -1; // the rune levels the cache was made for

// The numbers of a skill (with the rune worn for it, if any).
export function skillDef(id) {
  const base = CONFIG.skills[id] || CONFIG.ultimates[id];
  const r = runes && base ? runes.of(id) : '';
  const perks = mastery && base ? mastery.perkList(id) : [], mlv = mastery && base ? mastery.level(id) : 0;
  if (!r && !perks.length && !mlv) return base;
  const ver = (runes ? runes.ver : 0) * 1000 + (mastery ? mastery.ver : 0);
  if (ver !== runedVer) { runed.clear(); runedVer = ver; }
  const key = id + ':' + r + ':' + perks.join('+') + ':' + mlv;
  let d = runed.get(key);
  if (!d) {
    d = { ...base };
    // mastery: every level a little more power and a shorter cooldown
    if (mlv) {
      if (typeof d.power === 'number') d.power = Math.round(d.power * (1 + POWER_PER_LEVEL * mlv) * 100) / 100;
      if (typeof d.cooldown === 'number') d.cooldown = Math.round(d.cooldown * (1 - COOLDOWN_PER_LEVEL * mlv) * 100) / 100;
    }
    // the kinds: the runes worn, then the perks picked by mastery (as strong as a rune without Rune Workshop levels)
    for (const kind of [...(r ? r.split('+') : []), ...perks]) {
      const mods = RUNE_KINDS[kind] || {};
      const lvl = 1 + CONFIG.runeWorkshop.levelBonus * (runes && r.split('+').includes(kind) ? runes.level(id, kind) : 0); // Rune Workshop
      for (const k in mods) {
        if (typeof d[k] !== 'number') continue;
        d[k] = d[k] * (1 + (mods[k] - 1) * lvl);
        if (k === 'mana' || k === 'ticks') d[k] = Math.max(1, Math.round(d[k]));
        else d[k] = Math.round(d[k] * 100) / 100;
      }
    }
    runed.set(key, d);
  }
  return d;
}

// dx, dz = aim direction, power (0..1) = distance for skills aimed at a point
export function castSkill(game, id, dx, dz, power) {
  const def = skillDef(id);
  const P = game.player, E = game.enemies, fx = game.effects, army = game.army;
  const aura = game.appearance.aura;
  let base = P.skillPower() * (def.power || 0);
  // Rogue: a finisher spends all Combo Points for more damage
  if (def.finisher && P.cp > 0) { base *= 1 + P.cp * CONFIG.rogue.finisher; P.cp = 0; P.cpT = 0; }
  const dist = (def.range || 0) * Math.max(0.15, power);
  let tx = P.x + dx * dist, tz = P.z + dz * dist;
  const yaw = Math.atan2(dx, dz);

  switch (id) {
    case 'shadowStep': {
      fx.burst(P.x, 1, P.z, 16, aura, 4, 0.22, 0.5);
      if (game.gates.active >= 0) {
        game.gates.clamp(tx, tz, P.radius);
        P.x = game.gates.cx;
        P.z = game.gates.cz;
      } else {
        const lim = game.world.radius - 1.5, r = Math.sqrt(tx * tx + tz * tz);
        if (r > lim) { tx *= lim / r; tz *= lim / r; }
        game.world.resolve(tx, tz, P.radius);
        P.x = game.world.rx;
        P.z = game.world.rz;
      }
      P.invuln = Math.max(P.invuln, 0.4);
      hitCircle(game, P.x, P.z, def.radius, base);
      fx.slash(P.x, P.z, 0, def.radius, 360, aura, EXPAND, 1, 0.3);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, aura, 0.35);
      fx.burst(P.x, 1, P.z, 16, aura, 6, 0.22, 0.5);
      game.cam.shake(0.15, 0.15);
      break;
    }
    case 'shadowWave':
      hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      // a wave that rolls outwards
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, aura, EXPAND, 1, 0.4);
      fx.slash(P.x, P.z, yaw, def.range * 0.75, def.arcDeg, 0xffffff, EXPAND, 1, 0.3);
      game.cam.shake(0.2, 0.2);
      break;
    case 'rulersGrasp':
      E.pull(tx, tz, def.radius, 0.8);
      hitCircle(game, tx, tz, def.radius, base, def.stun);
      // everything is pulled together: a shrinking ring
      fx.ring(tx, tz, def.radius + 1, 0.4, aura, 0.35);
      fx.ring(tx, tz, def.radius * 0.7, 0.3, 0xffffff, 0.3, 0.08);
      fx.slash(tx, tz, 0, def.radius * 0.6, 360, aura, FLASH, 1, 0.4);
      fx.burst(tx, 1, tz, 20, aura, 3, 0.24, 0.7);
      game.cam.shake(0.15, 0.2);
      break;
    case 'umbralShield':
      P.shield = P.shieldMax = Math.round(P.maxHp * def.shield);
      P.shieldT = def.duration;
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0x6aa8ff, 0.4);
      fx.burst(P.x, 1.2, P.z, 18, 0x6aa8ff, 4, 0.18, 0.6);
      break;
    case 'daggerRain':
      // daggers fall from the sky before every hit
      game.zones.add(tx, tz, def.radius, 0.3, def.ticks, def.interval, base, 0, 0xd8d2ff, true);
      break;
    case 'warCry':
      army.buff(def.armyDamage, def.duration);
      fx.ring(P.x, P.z, 1, def.radius, 0xff6070, 0.5);
      fx.ring(P.x, P.z, 1, def.radius * 0.7, 0xffd0a0, 0.45, 0.1);
      fx.burst(P.x, 1.5, P.z, 24, 0xff6070, 8, 0.2, 0.6);
      game.cam.shake(0.25, 0.3);
      break;
    case 'lifeLeech': {
      const n = hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, 0x5cf08a, SWEEP, P.combo ? -1 : 1, 0.3);
      if (n > 0) {
        P.heal(Math.min(P.maxHp * 0.4, base * def.heal * n));
        fx.burst(P.x, 1.4, P.z, 10, 0x5cf08a, 3, 0.18, 0.6);
      }
      break;
    }
    case 'nightLance':
      hitLine(game, P.x, P.z, dx, dz, def.range, def.width, base);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width, aura);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 0.35, 0xffffff);
      fx.ring(P.x + dx * def.range, P.z + dz * def.range, 0.5, 3, aura, 0.3);
      game.cam.shake(0.2, 0.18);
      break;

    case 'bladeDance':
      // a whirl of blades where the hunter stands: several quick hits
      game.zones.add(P.x, P.z, def.radius, 0.05, def.ticks, def.interval, base, 0, aura);
      fx.slash(P.x, P.z, yaw, def.radius, 360, 0xffffff, SWEEP, 1, 0.3);
      game.cam.shake(0.12, 0.2);
      break;
    case 'phantomStrike': {
      // jumps to the enemy nearest to the target point and strikes it alone
      let i = E.nearest(tx, tz, def.radius);
      if (i < 0) i = E.nearest(P.x, P.z, def.range);
      fx.burst(P.x, 1, P.z, 14, aura, 4, 0.22, 0.4);
      if (i < 0) {
        // no enemy: the mana is not wasted on a long cooldown
        P.cds[0] = Math.min(P.cds[0], 1);
        P.cds[1] = Math.min(P.cds[1], 1);
        break;
      }
      let ex = E.x[i] - P.x, ez = E.z[i] - P.z;
      const d = Math.sqrt(ex * ex + ez * ez) || 1;
      ex /= d; ez /= d;
      // land in front of it, on the hunter's side
      const lx = E.x[i] - ex * (E.radius[i] + 1.1), lz = E.z[i] - ez * (E.radius[i] + 1.1);
      if (game.gates.active >= 0) {
        game.gates.clamp(lx, lz, P.radius);
        P.x = game.gates.cx;
        P.z = game.gates.cz;
      } else {
        game.world.resolve(lx, lz, P.radius);
        P.x = game.world.rx;
        P.z = game.world.rz;
      }
      P.dirX = ex;
      P.dirZ = ez;
      P.invuln = Math.max(P.invuln, 0.35);
      playerHit(game, i, base, ex, ez);
      fx.slash(E.x[i], E.z[i], Math.atan2(ex, ez), 2.6, 200, 0xffffff, SWEEP, 1, 0.22);
      fx.ring(E.x[i], E.z[i], 0.4, 3, aura, 0.3);
      game.cam.shake(0.25, 0.18);
      game.hitStop(0.05);
      break;
    }
    case 'blackFrost':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0x9fe0ff, EXPAND, 1, 0.45);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0xd8f4ff, 0.45);
      fx.ring(P.x, P.z, 0.5, def.radius * 0.6, 0x9fe0ff, 0.4, 0.1);
      fx.burst(P.x, 1, P.z, 30, 0xc8f0ff, 8, 0.2, 0.8);
      game.cam.shake(0.2, 0.25);
      break;
    case 'huntersMark':
      E.markArea(tx, tz, def.radius, def.duration);
      fx.ring(tx, tz, def.radius + 1, 0.5, 0xff4060, 0.4);
      fx.ring(tx, tz, def.radius, def.radius * 0.96, 0xff4060, 0.7, 0.1);
      fx.burst(tx, 1.5, tz, 16, 0xff4060, 3, 0.2, 0.7);
      break;
    case 'darkMend':
      P.heal(P.maxHp * def.healSelf);
      army.healAll(def.healArmy);
      fx.ring(P.x, P.z, 1, def.radius, 0x5cf08a, 0.55);
      fx.ring(P.x, P.z, 1, def.radius * 0.6, 0xb8ffd2, 0.5, 0.1);
      fx.burst(P.x, 1.4, P.z, 24, 0x5cf08a, 5, 0.2, 0.8);
      break;
    case 'bloodRage':
      P.rageT = def.duration;
      fx.ring(P.x, P.z, 0.5, 5, 0xff3040, 0.45);
      fx.burst(P.x, 1.4, P.z, 26, 0xff3040, 7, 0.22, 0.7);
      game.cam.shake(0.2, 0.2);
      break;

    // ---- Warrior
    case 'shieldBash':
      hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base, def.stun);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, 0xc8d8ff, EXPAND, 1, 0.3);
      fx.ring(P.x + dx * def.range * 0.6, P.z + dz * def.range * 0.6, 0.3, 2.4, 0xffffff, 0.3);
      P.addRage(def.rage || 0);
      game.cam.shake(0.22, 0.16);
      game.hitStop(0.05);
      break;
    case 'cleave':
      hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, 0xffb070, SWEEP, P.combo ? -1 : 1, 0.35);
      fx.slash(P.x, P.z, yaw, def.range * 0.7, def.arcDeg, 0xffffff, SWEEP, P.combo ? -1 : 1, 0.25);
      game.cam.shake(0.2, 0.18);
      break;
    case 'groundSlam':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xd0a070, EXPAND, 1, 0.4);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0xffe0b0, 0.4);
      fx.burst(P.x, 0.6, P.z, 30, 0xd0a070, 7, 0.24, 0.7);
      game.cam.shake(0.3, 0.25);
      game.hitStop(0.06);
      break;
    case 'shieldRush': {
      // rushes forward and hits everything on the way, then stands where the rush ended
      const len = Math.max(2, dist);
      hitLine(game, P.x, P.z, dx, dz, len, def.width, base);
      fx.beam(P.x, P.z, dx, dz, len, def.width, 0xc8d8ff);
      fx.beam(P.x, P.z, dx, dz, len, def.width * 0.4, 0xffffff);
      if (game.gates.active >= 0) {
        game.gates.clamp(tx, tz, P.radius);
        P.x = game.gates.cx;
        P.z = game.gates.cz;
      } else {
        const lim = game.world.radius - 1.5, r = Math.sqrt(tx * tx + tz * tz);
        if (r > lim) { tx *= lim / r; tz *= lim / r; }
        game.world.resolve(tx, tz, P.radius);
        P.x = game.world.rx;
        P.z = game.world.rz;
      }
      P.invuln = Math.max(P.invuln, 0.35);
      fx.ring(P.x, P.z, 0.4, 3, 0xc8d8ff, 0.3);
      fx.burst(P.x, 1, P.z, 16, 0xc8d8ff, 6, 0.22, 0.5);
      game.cam.shake(0.25, 0.2);
      break;
    }
    case 'challengingRoar':
      E.pull(P.x, P.z, def.radius, 0.7);
      hitCircle(game, P.x, P.z, def.radius, base);
      P.guardT = def.duration;
      P.guardV = def.guard;
      P.addRage(def.rage || 0);
      fx.ring(P.x, P.z, 1, def.radius, 0xff6040, 0.5);
      fx.ring(P.x, P.z, 1, def.radius * 0.6, 0xffd0a0, 0.45, 0.1);
      fx.burst(P.x, 1.5, P.z, 26, 0xff6040, 8, 0.22, 0.6);
      game.cam.shake(0.28, 0.3);
      break;
    case 'ironWill':
      P.shield = P.shieldMax = Math.round(P.maxHp * def.shield);
      P.shieldT = def.duration;
      P.guardT = def.duration;
      P.guardV = def.guard;
      P.heal(P.maxHp * def.healSelf);
      fx.ring(P.x, P.z, 0.5, 4, 0xc8d8ff, 0.45);
      fx.burst(P.x, 1.2, P.z, 22, 0xc8d8ff, 4, 0.18, 0.6);
      break;

    // ---- Mage
    case 'arcaneBolt':
      hitLine(game, P.x, P.z, dx, dz, def.range, def.width, base);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width, 0x8aa8ff);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 0.35, 0xffffff);
      fx.ring(P.x + dx * def.range, P.z + dz * def.range, 0.4, 2.4, 0x8aa8ff, 0.25);
      game.cam.shake(0.12, 0.12);
      break;
    case 'fireball':
      game.zones.add(tx, tz, def.radius, 0.35, 1, 0, base, 0, 0xff7a30);
      fx.ring(tx, tz, def.radius + 1, 0.4, 0xff7a30, 0.4);
      fx.burst(tx, 1.2, tz, 34, 0xff7a30, 8, 0.26, 0.8);
      game.cam.shake(0.2, 0.2);
      break;
    case 'frostNova':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0x9fe0ff, EXPAND, 1, 0.45);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0xd8f4ff, 0.45);
      fx.burst(P.x, 1, P.z, 30, 0xc8f0ff, 8, 0.2, 0.8);
      game.cam.shake(0.2, 0.2);
      break;
    case 'chainLightning': {
      let i = E.nearest(tx, tz, def.radius);
      if (i < 0) i = E.nearest(P.x, P.z, def.range);
      if (i < 0) {
        // no enemy: the mana is not wasted on a long cooldown
        P.cds[0] = Math.min(P.cds[0], 1);
        P.cds[1] = Math.min(P.cds[1], 1);
        break;
      }
      const done = new Set();
      let px = P.x, pz = P.z;
      for (let n = 0; n < def.jumps && i >= 0; n++) {
        done.add(i);
        const ex = E.x[i] - px, ez = E.z[i] - pz, len = Math.hypot(ex, ez) || 1;
        fx.beam(px, pz, ex / len, ez / len, len, 0.5, 0xa0d8ff);
        fx.burst(E.x[i], 1, E.z[i], 8, 0xa0d8ff, 4, 0.2, 0.4);
        playerHit(game, i, base, ex / len, ez / len);
        px = E.x[i];
        pz = E.z[i];
        // the next one: the nearest enemy that was not hit yet
        let best = -1, bd = def.jumpRange * def.jumpRange;
        for (let k = 0; k < E.activeCount; k++) {
          const j = E.active[k];
          if (!E.alive[j] || done.has(j)) continue;
          const d2 = (E.x[j] - px) ** 2 + (E.z[j] - pz) ** 2;
          if (d2 < bd) { bd = d2; best = j; }
        }
        i = best;
      }
      game.cam.shake(0.18, 0.15);
      break;
    }
    case 'meteor':
      // a meteor falls where you aimed, a moment after the cast
      game.zones.add(tx, tz, def.radius, 1.1, 1, 0, base, def.stun, 0xff5020, true);
      fx.ring(tx, tz, def.radius + 1, 0.5, 0xff5020, 0.5);
      game.cam.shake(0.15, 0.2);
      break;
    case 'arcaneSurge':
      P.surgeT = def.duration;
      P.addArcane(def.arcane);
      fx.ring(P.x, P.z, 0.5, 5, 0x8aa8ff, 0.45);
      fx.ring(P.x, P.z, 0.5, 3, 0xffffff, 0.4, 0.1);
      fx.burst(P.x, 1.4, P.z, 26, 0x8aa8ff, 7, 0.22, 0.7);
      break;

    // ---- Cleric
    case 'smite':
      hitCircle(game, tx, tz, def.radius, base);
      P.heal(P.maxHp * def.healSelf);
      fx.ring(tx, tz, def.radius + 0.5, 0.4, 0xfff0a0, 0.4);
      fx.flare(tx, 1.2, tz, 6, 0xffffff, 0.35, 1.6);
      fx.burst(tx, 2, tz, 22, 0xfff0a0, 5, 0.22, 0.6);
      game.cam.shake(0.14, 0.14);
      break;
    case 'holyNova':
      hitCircle(game, P.x, P.z, def.radius, base);
      P.heal(P.maxHp * def.healSelf);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xfff0a0, EXPAND, 1, 0.4);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0xffffff, 0.4);
      fx.burst(P.x, 1.2, P.z, 28, 0xfff0a0, 7, 0.22, 0.7);
      game.cam.shake(0.18, 0.18);
      break;
    case 'consecration':
      // holy ground that hurts enemies and heals you for as long as it lasts
      game.zones.add(P.x, P.z, def.radius, 0.1, def.ticks, def.interval, base, 0, 0xfff0a0);
      P.hotT = def.duration;
      P.hotV = def.healSelf / def.duration;
      P.addFaith(def.faith || 0);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0xfff0a0, 0.5);
      fx.burst(P.x, 1, P.z, 20, 0xfff0a0, 4, 0.2, 0.7);
      break;
    case 'mend':
      P.heal(P.maxHp * def.healSelf);
      P.addFaith(def.faith || 0);
      fx.ring(P.x, P.z, 0.5, 5, 0x9affc0, 0.5);
      fx.ring(P.x, P.z, 0.5, 3, 0xffffff, 0.4, 0.1);
      fx.burst(P.x, 1.4, P.z, 26, 0x9affc0, 5, 0.2, 0.8);
      break;
    case 'divineShield':
      P.shield = P.shieldMax = Math.round(P.maxHp * def.shield);
      P.shieldT = def.duration;
      P.guardT = def.duration;
      P.guardV = def.guard;
      fx.ring(P.x, P.z, 0.5, 4, 0xfff0a0, 0.45);
      fx.burst(P.x, 1.2, P.z, 22, 0xfff0a0, 4, 0.18, 0.6);
      break;
    case 'judgement':
      hitCircle(game, tx, tz, def.radius, base, def.stun);
      fx.ring(tx, tz, def.radius + 1, 0.4, 0xffd24a, 0.45);
      fx.flare(tx, 1.4, tz, 9, 0xffffff, 0.4, 1.6);
      fx.burst(tx, 2, tz, 30, 0xffd24a, 7, 0.24, 0.8);
      game.cam.shake(0.25, 0.22);
      game.hitStop(0.05);
      break;

    // ---- Rogue
    case 'backstab':
      hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      P.addCombo(def.combo || 0, true);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, 0xd8d2ff, SWEEP, P.combo ? -1 : 1, 0.25);
      fx.burst(P.x + dx * 2, 1, P.z + dz * 2, 10, 0xd8d2ff, 4, 0.18, 0.4);
      game.cam.shake(0.14, 0.12);
      break;
    case 'fanOfKnives':
      hitCircle(game, P.x, P.z, def.radius, base);
      P.addCombo(def.combo || 0, true);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xd8d2ff, EXPAND, 1, 0.35);
      fx.ring(P.x, P.z, 0.5, def.radius + 0.5, 0xffffff, 0.35);
      fx.burst(P.x, 1, P.z, 22, 0xd8d2ff, 7, 0.2, 0.6);
      game.cam.shake(0.15, 0.15);
      break;
    case 'eviscerate': {
      // one enemy: a heavy cut
      let i = E.nearest(tx, tz, def.radius);
      if (i < 0) i = E.nearest(P.x, P.z, def.range);
      if (i < 0) {
        P.cds[0] = Math.min(P.cds[0], 1);
        P.cds[1] = Math.min(P.cds[1], 1);
        break;
      }
      let ex = E.x[i] - P.x, ez = E.z[i] - P.z;
      const d = Math.sqrt(ex * ex + ez * ez) || 1;
      ex /= d; ez /= d;
      playerHit(game, i, base, ex, ez);
      fx.slash(E.x[i], E.z[i], Math.atan2(ex, ez), 2.6, 220, 0xff4060, SWEEP, 1, 0.22);
      fx.ring(E.x[i], E.z[i], 0.4, 3, 0xff4060, 0.3);
      game.cam.shake(0.22, 0.16);
      game.hitStop(0.05);
      break;
    }
    case 'rupture':
      // the enemies bleed: several hits over time
      game.zones.add(tx, tz, def.radius, 0.2, def.ticks, def.interval, base, 0, 0xff4060);
      fx.ring(tx, tz, def.radius + 1, 0.4, 0xff4060, 0.4);
      fx.burst(tx, 1, tz, 18, 0xff4060, 4, 0.2, 0.6);
      break;
    case 'smokeBomb':
      hitCircle(game, P.x, P.z, def.radius, 0, def.stun);
      P.ambushT = def.duration;
      P.invuln = Math.max(P.invuln, 0.8);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0x9a9ab8, EXPAND, 1, 0.5);
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0xc8c8e0, 0.45);
      fx.burst(P.x, 1, P.z, 34, 0x9a9ab8, 4, 0.3, 1.0);
      break;
    case 'evasion':
      P.invuln = Math.max(P.invuln, def.duration);
      P.ambushT = def.duration + 2;
      fx.ring(P.x, P.z, 0.5, 4, 0xd8d2ff, 0.4);
      fx.burst(P.x, 1.2, P.z, 22, 0xd8d2ff, 6, 0.2, 0.6);
      break;

    // ---- Ranger
    case 'piercingShot':
      hitLine(game, P.x, P.z, dx, dz, def.range, def.width, base);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width, 0xb8e080);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 0.35, 0xffffff);
      fx.ring(P.x + dx * def.range, P.z + dz * def.range, 0.4, 2.2, 0xb8e080, 0.25);
      game.cam.shake(0.12, 0.12);
      break;
    case 'multiShot':
      hitArc(game, P.x, P.z, dx, dz, def.range, def.arcDeg, base);
      fx.slash(P.x, P.z, yaw, def.range, def.arcDeg, 0xb8e080, EXPAND, 1, 0.3);
      fx.slash(P.x, P.z, yaw, def.range * 0.7, def.arcDeg, 0xffffff, EXPAND, 1, 0.22);
      game.cam.shake(0.16, 0.14);
      break;
    case 'bearTrap':
    case 'explosiveTrap':
      game.ranger.addTrap(tx, tz, def, base);
      fx.ring(tx, tz, 0.3, def.radius, id === 'bearTrap' ? 0x7fd6a0 : 0xff9040, 0.4);
      fx.burst(tx, 0.4, tz, 10, 0xb8e080, 3, 0.2, 0.4);
      break;
    case 'huntersFocus':
      P.focusT = def.duration;
      fx.ring(P.x, P.z, 0.5, 4, 0xb8e080, 0.45);
      fx.burst(P.x, 1.4, P.z, 22, 0xb8e080, 6, 0.2, 0.7);
      break;
    case 'beastCommand':
      army.buff(def.armyDamage, def.duration);
      army.healAll(def.healArmy);
      army.reviveAll(); // the companion stands up at once
      fx.ring(P.x, P.z, 1, def.radius, 0xb8e080, 0.5);
      fx.burst(P.x, 1.4, P.z, 24, 0xb8e080, 7, 0.22, 0.7);
      game.cam.shake(0.2, 0.2);
      break;

    // ---- ultimates
    case 'voidStorm':
      // a storm that stays where it was cast
      game.zones.add(tx, tz, def.radius, 0.4, def.ticks, def.interval, base, 0, aura);
      fx.ring(tx, tz, def.radius + 3, 0.5, aura, 0.5);
      fx.ring(tx, tz, 0.5, def.radius, 0xffffff, 0.5, 0.15);
      fx.burst(tx, 2, tz, 40, aura, 9, 0.26, 0.9);
      game.cam.shake(0.35, 0.3);
      break;
    case 'umbralAegis':
      P.heal(P.maxHp * def.healSelf);
      P.shield = P.shieldMax = Math.round(P.maxHp * def.shield);
      P.shieldT = def.duration;
      hitCircle(game, P.x, P.z, def.radius, 0, def.stun);
      E.pull(P.x, P.z, def.radius, -0.6); // pushed away
      fx.ring(P.x, P.z, 0.5, def.radius + 1, 0x6aa8ff, 0.5);
      fx.ring(P.x, P.z, 0.5, def.radius * 0.6, 0xffffff, 0.45, 0.1);
      fx.burst(P.x, 1.4, P.z, 40, 0x6aa8ff, 8, 0.24, 0.9);
      game.cam.shake(0.3, 0.3);
      break;
    case 'oblivionRay':
      hitLine(game, P.x, P.z, dx, dz, def.range, def.width, base);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width, aura);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 0.5, 0xffffff);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 1.5, aura);
      fx.ring(P.x, P.z, 0.5, 4, 0xffffff, 0.35);
      fx.burst(P.x + dx * 3, 1.2, P.z + dz * 3, 40, aura, 14, 0.26, 0.7);
      game.cam.shake(0.6, 0.4);
      game.hitStop(0.1);
      break;
    case 'nightfall':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      // night falls: a dark dome, three shock rings, heavy shake
      fx.slash(P.x, P.z, 0, def.radius, 360, aura, EXPAND, 1, 0.55);
      fx.slash(P.x, P.z, 0, def.radius * 0.6, 360, 0xb48cff, FLASH, 1, 0.3);
      fx.ring(P.x, P.z, 1, def.radius + 2, aura, 0.5);
      fx.ring(P.x, P.z, 1, def.radius * 0.8, 0xffffff, 0.45, 0.1);
      fx.ring(P.x, P.z, 1, def.radius + 5, aura, 0.7, 0.2);
      fx.burst(P.x, 1, P.z, 60, aura, 12, 0.3, 0.9);
      game.cam.shake(0.6, 0.45);
      game.hitStop(0.09);
      break;
    case 'legionsCall':
      army.reviveAll();
      army.buff(def.armyDamage, def.duration);
      fx.ring(P.x, P.z, 1, def.radius, aura, 0.6);
      fx.ring(P.x, P.z, def.radius, 1, 0xffffff, 0.5, 0.15);
      fx.burst(P.x, 1, P.z, 40, aura, 9, 0.26, 0.9);
      game.cam.shake(0.35, 0.35);
      break;
    case 'arrowStorm':
      // a storm of arrows where you aimed
      game.zones.add(tx, tz, def.radius, 0.4, def.ticks, def.interval, base, 0, 0xb8e080, true);
      fx.ring(tx, tz, def.radius + 3, 0.5, 0xb8e080, 0.5);
      fx.ring(tx, tz, 0.5, def.radius, 0xffffff, 0.5, 0.15);
      fx.burst(tx, 2, tz, 40, 0xb8e080, 9, 0.26, 0.9);
      game.cam.shake(0.35, 0.3);
      break;
    case 'primalFury':
      army.buff(def.armyDamage, def.duration);
      army.reviveAll();
      P.focusT = def.duration;
      fx.ring(P.x, P.z, 1, def.radius, 0xff9040, 0.6);
      fx.ring(P.x, P.z, def.radius, 1, 0xffffff, 0.5, 0.15);
      fx.burst(P.x, 1, P.z, 40, 0xff9040, 9, 0.26, 0.9);
      game.cam.shake(0.35, 0.35);
      break;
    case 'deathBlossom':
      // a whirl of blades around the Rogue: many quick hits
      game.zones.add(P.x, P.z, def.radius, 0.05, def.ticks, def.interval, base, 0, 0xff4060);
      P.ambushT = 5;
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xff4060, EXPAND, 1, 0.5);
      fx.slash(P.x, P.z, 0, def.radius * 0.6, 360, 0xffffff, SWEEP, 1, 0.4);
      fx.ring(P.x, P.z, 1, def.radius + 2, 0xff4060, 0.5);
      fx.burst(P.x, 1, P.z, 50, 0xff4060, 10, 0.28, 0.9);
      game.cam.shake(0.4, 0.35);
      break;
    case 'assassinate': {
      // jumps to the enemy nearest to the target and kills it with one cut
      let i = E.nearest(tx, tz, def.radius);
      if (i < 0) i = E.nearest(P.x, P.z, def.range);
      fx.burst(P.x, 1, P.z, 14, 0xff4060, 4, 0.22, 0.4);
      if (i < 0) { hitCircle(game, tx, tz, def.radius, base * 0.3); break; } // nothing to jump to: a weak cut where you aimed
      let ex = E.x[i] - P.x, ez = E.z[i] - P.z;
      const d = Math.sqrt(ex * ex + ez * ez) || 1;
      ex /= d; ez /= d;
      const lx = E.x[i] - ex * (E.radius[i] + 1.1), lz = E.z[i] - ez * (E.radius[i] + 1.1);
      if (game.gates.active >= 0) {
        game.gates.clamp(lx, lz, P.radius);
        P.x = game.gates.cx;
        P.z = game.gates.cz;
      } else {
        game.world.resolve(lx, lz, P.radius);
        P.x = game.world.rx;
        P.z = game.world.rz;
      }
      P.dirX = ex;
      P.dirZ = ez;
      P.invuln = Math.max(P.invuln, 0.5);
      playerHit(game, i, base, ex, ez);
      fx.slash(E.x[i], E.z[i], Math.atan2(ex, ez), 3, 260, 0xffffff, SWEEP, 1, 0.3);
      fx.ring(E.x[i], E.z[i], 0.4, 4, 0xff4060, 0.4);
      game.cam.shake(0.4, 0.25);
      game.hitStop(0.1);
      break;
    }
    case 'divineIntervention':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      P.heal(P.maxHp * def.healSelf);
      P.shield = P.shieldMax = Math.round(P.maxHp * def.shield);
      P.shieldT = def.duration;
      P.addFaith(def.faith || 0);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xfff0a0, EXPAND, 1, 0.5);
      fx.ring(P.x, P.z, 1, def.radius + 2, 0xffffff, 0.55);
      fx.ring(P.x, P.z, 1, def.radius * 0.7, 0xffd24a, 0.5, 0.12);
      fx.burst(P.x, 1.4, P.z, 50, 0xfff0a0, 10, 0.28, 0.9);
      game.cam.shake(0.4, 0.35);
      break;
    case 'sunburst':
      hitLine(game, P.x, P.z, dx, dz, def.range, def.width, base);
      P.heal(P.maxHp * def.healSelf);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width, 0xffd24a);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 0.5, 0xffffff);
      fx.beam(P.x, P.z, dx, dz, def.range, def.width * 1.5, 0xfff0a0);
      fx.ring(P.x, P.z, 0.5, 4, 0xffffff, 0.35);
      game.cam.shake(0.5, 0.4);
      game.hitStop(0.08);
      break;
    case 'cataclysm':
      game.zones.add(tx, tz, def.radius, 0.9, 1, 0, base, def.stun, 0xff4020, true);
      fx.ring(tx, tz, def.radius + 3, 0.6, 0xff4020, 0.6);
      fx.ring(tx, tz, 0.5, def.radius, 0xffffff, 0.5, 0.15);
      fx.burst(tx, 2, tz, 50, 0xff4020, 10, 0.28, 0.9);
      game.cam.shake(0.5, 0.4);
      break;
    case 'timeStop':
      hitCircle(game, P.x, P.z, def.radius, 0, def.stun);
      P.surgeT = def.duration;
      P.addArcane(CONFIG.mage.arcaneMax);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0x8aa8ff, EXPAND, 1, 0.5);
      fx.ring(P.x, P.z, 1, def.radius + 2, 0xffffff, 0.6);
      fx.ring(P.x, P.z, 1, def.radius * 0.7, 0x8aa8ff, 0.5, 0.15);
      fx.burst(P.x, 1.2, P.z, 50, 0x8aa8ff, 10, 0.28, 0.9);
      game.cam.shake(0.3, 0.3);
      break;
    case 'earthshatter':
      hitCircle(game, P.x, P.z, def.radius, base, def.stun);
      P.addRage(30);
      fx.slash(P.x, P.z, 0, def.radius, 360, 0xd0a070, EXPAND, 1, 0.55);
      fx.slash(P.x, P.z, 0, def.radius * 0.6, 360, 0xffffff, FLASH, 1, 0.3);
      fx.ring(P.x, P.z, 1, def.radius + 2, 0xffe0b0, 0.5);
      fx.ring(P.x, P.z, 1, def.radius * 0.8, 0xffffff, 0.45, 0.1);
      fx.burst(P.x, 0.6, P.z, 60, 0xd0a070, 12, 0.3, 0.9);
      game.cam.shake(0.6, 0.45);
      game.hitStop(0.09);
      break;
    case 'unbreakable':
      P.guardT = def.duration;
      P.guardV = def.guard;
      P.rageT = def.duration; // hits harder, like Blood Rage
      P.heal(P.maxHp * def.healSelf);
      fx.ring(P.x, P.z, 0.5, 6, 0xffd24a, 0.5);
      fx.ring(P.x, P.z, 0.5, 9, 0xfff0b0, 0.6, 0.12);
      fx.burst(P.x, 1.4, P.z, 40, 0xffd24a, 8, 0.24, 0.8);
      game.cam.shake(0.3, 0.3);
      break;
    case 'eclipse':
      P.eclipseT = def.duration;
      P.charges = P.maxCharges;
      fx.ring(P.x, P.z, 0.5, 6, 0xffd24a, 0.5);
      fx.ring(P.x, P.z, 0.5, 9, 0xfff0b0, 0.6, 0.12);
      fx.burst(P.x, 1.4, P.z, 40, 0xffd24a, 8, 0.24, 0.8);
      game.cam.shake(0.3, 0.3);
      game.hitStop(0.06);
      break;
  }
  castGlow(game, id, tx, tz, dx, dz);
}
