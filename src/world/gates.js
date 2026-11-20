// Gates: the zone the player is in has one gate of each difficulty (normal,
// hard, deadly) open somewhere; the gates of other zones are not there.
// Entering a gate takes the player (and the deployed shadows) into an
// enclosed arena far outside the world. There the player fights through the
// stages of the gate (waves of the zone's monsters, holding out, champions;
// harder gates have more) and then meets the zone's boss. The gate closes
// behind the player and opens again later at another spot. After the boss
// the player leaves with the Leave button.
// The boss brain (attack patterns, phases, exhaustion) lives here too.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flatMaterial } from '../render/geo.js';
import { gateFrameGeometry, arenaPillarGeometry } from '../render/models/props.js';
import { ST_IDLE, ST_CHASE, ST_WINDUP, ST_CHARGE } from '../entities/enemies.js';
import { rollLoot } from '../core/items.js';
import { hashSeed } from '../core/rng.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

import { RANKS } from '../core/levels.js';
export { RANKS };
const PAUSE = 0, WINDUP = 1, CHARGE = 2, ROAR = 3;

// arenas lie far outside the world, one per gate
export function arenaCenter(i) {
  return { x: 4200 + i * 220, z: 4200 };
}

// the values of a gate: the rank trial or one of the gate difficulties
export function gateDiff(g) {
  return g.trial ? CONFIG.trial : CONFIG.gates.difficulties[g.diff];
}

function portalMesh(color, w, h) {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(1, 28),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  m.scale.set(w, h, 1);
  return m;
}

export class Gates {
  // saved: [{ open, gen, t }] per gate from the save game
  constructor(game, saved) {
    this.game = game;
    this.list = game.world.gates; // { zone, diff, level, x, z, open, gen, t }
    this.active = -1; // gate whose arena the player is in
    this.near = -1; // gate in reach of the Enter button
    this.cx = 0; // result of clamp()
    this.cz = 0;
    this.returnX = 0;
    this.returnZ = 0;
    this.exitOpen = false;
    this.zoneNow = -1; // zone whose gates are shown
    this.time = 0;
    this.b = { state: PAUSE, t: 0, pattern: '', last: '', cdx: 0, cdz: 0, bite: 0, hitP: false, hitS: new Set(), phase: 1, tired: 0, combo: false };
    // stages of the gate the player is in
    this.stages = [];
    this.stageI = -1;
    this.stagePause = 0;
    this.surviveT = 0;
    this.spawnT = 0;
    this.poolLeft = 0; // monsters of the stage still standing
    this.abyssIndex = this.list.findIndex((g) => g.abyss);
    this.trialIndex = this.list.findIndex((g) => g.trial);
    this.runMods = []; // modifiers of the gate the player is in
    this.timeLeft = 0; // Against the Clock in a normal gate

    // gates in the world
    const frameGeo = gateFrameGeometry();
    // bigger gates and a coloured core for the harder ones
    this.portals = this.list.map((g) => {
      const zone = CONFIG.world.zones[g.zone], diff = gateDiff(g);
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(frameGeo, flatMaterial));
      // the Abyss: a deep red portal with a black core; the rank trial: gold
      const portal = portalMesh(g.abyss ? 0xff2850 : g.trial ? CONFIG.trial.color : zone.gateColor, 1.9, 2.4);
      portal.position.y = 2.55;
      const core = portalMesh(g.abyss ? 0x0a0010 : g.trial ? 0xffffff : diff.color, 1.0, 1.4);
      core.material.opacity = 0.35;
      core.position.set(0, 2.55, 0.02);
      grp.add(portal, core);
      grp.scale.setScalar(g.abyss ? 1.25 : g.trial ? 1.15 : 1 + g.diff * 0.18);
      game.scene.add(grp);
      return { grp, portal, core };
    });
    this.list.forEach((g, gi) => {
      const s = saved && saved[gi];
      if (s) { g.open = !!s.open; g.gen = s.gen || 0; g.t = s.t || 0; g.keyed = !!s.keyed; }
      this.place(gi);
    });

    this.arenas = [];
    this.exit = new THREE.Group();
    this.exit.add(new THREE.Mesh(frameGeo, flatMaterial));
    const ep = portalMesh(0xe8dcff, 1.9, 2.4);
    ep.position.y = 2.55;
    this.exit.add(ep);
    this.exitPortal = ep;
    this.exit.visible = false;
    game.scene.add(this.exit);
  }

  // ---- where the gates stand ----------------------------------------------------------
  // Puts gate gi on a site of its zone that the other gates of the zone do not
  // use. Which one depends on the world seed and how often it opened (gen).
  place(gi) {
    const g = this.list[gi], world = this.game.world;
    if (g.abyss || g.trial) {
      const p = this.portals[gi];
      p.grp.position.set(g.x, 0, g.z);
      p.grp.rotation.y = Math.atan2(-g.x, -g.z);
      p.grp.visible = !!g.abyss;
      return;
    }
    const sites = world.gateSites.filter((s) => s.zone === g.zone);
    const taken = (s) => this.list.some((o, oi) => oi !== gi && o.zone === g.zone && o.open && o.x === s.x && o.z === s.z);
    let k = hashSeed(this.game.seed, 900 + gi, g.gen) % sites.length;
    for (let n = 0; n < sites.length && taken(sites[k]); n++) k = (k + 1) % sites.length;
    g.x = sites[k].x;
    g.z = sites[k].z;
    const p = this.portals[gi];
    p.grp.position.set(g.x, 0, g.z);
    p.grp.rotation.y = Math.atan2(-g.x, -g.z); // faces the camp
    p.grp.visible = g.open && g.zone === this.zoneNow;
  }

  close(gi) {
    const g = this.list[gi], R = CONFIG.gates.respawn;
    g.open = false;
    g.t = R[0] + Math.random() * (R[1] - R[0]);
    this.portals[gi].grp.visible = false;
  }

  serialize() {
    return this.list.map((g) => ({ open: g.open, gen: g.gen, t: Math.round(g.t), keyed: !!g.keyed }));
  }

  get inAbyss() {
    return this.active >= 0 && this.active === this.abyssIndex;
  }

  // the boss brain starts fresh (a new gate or an Abyss boss floor)
  resetBrain() {
    const br = this.b;
    br.state = PAUSE;
    br.t = 2.5; // a moment to get ready
    br.bite = 0;
    br.last = '';
    br.pattern = '';
    br.phase = 1;
    br.tired = 0;
    br.combo = false;
  }

  get stageKind() {
    return this.stageI >= 0 ? this.stages[this.stageI] : '';
  }

  // Deadly gates and the Abyss: the boss has a third phase
  phaseCount(gi) {
    const g = this.list[gi];
    return g && (g.abyss || g.trial || CONFIG.gates.difficulties[g.diff].id === 'deadly') ? 3 : 2;
  }

  // ---- arena ---------------------------------------------------------------------
  buildArena(gi) {
    const old = this.arenas[gi];
    if (old && old.userData.zone === this.list[gi].zone) return old;
    if (old) {
      // the rank trial changes its zone: a new arena in the new colours
      this.game.scene.remove(old);
      old.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    }
    const zone = CONFIG.world.zones[this.list[gi].zone];
    const c = arenaCenter(gi), R = CONFIG.gates.arenaRadius;
    const grp = new THREE.Group();
    const flat = (geo, mat, y) => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = y;
      grp.add(m);
    };
    flat(new THREE.CircleGeometry(R + 1.5, 56), new THREE.MeshLambertMaterial({ color: zone.groundColors[0] }), 0.0);
    flat(new THREE.RingGeometry(R + 1.5, R + 14, 56), new THREE.MeshLambertMaterial({ color: 0x15101f }), 0.0);
    flat(new THREE.RingGeometry(R - 0.2, R + 0.4, 64), new THREE.MeshBasicMaterial({ color: zone.gateColor }), 0.03);
    flat(new THREE.RingGeometry(R * 0.42, R * 0.44, 48), new THREE.MeshBasicMaterial({ color: zone.gateColor, transparent: true, opacity: 0.5 }), 0.03);
    flat(new THREE.RingGeometry(R * 0.78, R * 0.79, 56), new THREE.MeshBasicMaterial({ color: zone.gateColor, transparent: true, opacity: 0.35 }), 0.03);
    const n = 20;
    const pillars = new THREE.InstancedMesh(arenaPillarGeometry(), flatMaterial, n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      m.makeTranslation(Math.cos(a) * (R + 1.4), 0, Math.sin(a) * (R + 1.4));
      pillars.setMatrixAt(i, m);
    }
    pillars.frustumCulled = false;
    grp.add(pillars);
    grp.position.set(c.x, 0, c.z);
    grp.visible = false;
    grp.userData.zone = this.list[gi].zone;
    this.game.scene.add(grp);
    this.arenas[gi] = grp;
    return grp;
  }

  // Keeps a circle inside the active arena. Result in this.cx / this.cz.
  clamp(x, z, r) {
    if (this.active < 0) { this.cx = x; this.cz = z; return; }
    const c = arenaCenter(this.active), lim = CONFIG.gates.arenaRadius - r;
    const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz;
    if (d2 > lim * lim) {
      const k = lim / Math.sqrt(d2);
      x = c.x + dx * k;
      z = c.z + dz * k;
    }
    this.cx = x;
    this.cz = z;
  }

  bossIndex() {
    return this.active >= 0 ? this.game.enemies.arenaBoss[this.active] : -1;
  }

  // The rank trial: the boss of the next zone at the last level of your rank,
  // in an arena of the next zone's colours.
  setupTrial(gi) {
    const game = this.game, E = game.enemies, g = this.list[gi], zones = CONFIG.world.zones;
    const r = game.rankIndex;
    g.zone = Math.min(zones.length - 1, r + 1);
    g.level = zones[Math.min(zones.length - 1, r)].levelTo;
    const b = E.arenaBoss[gi];
    E.vanish(b);
    E.type[b] = E.typeIndex[zones[g.zone].boss];
    E.zone[b] = g.zone;
  }

  // floor: where an Abyss run starts
  enter(gi, floor = 1) {
    const game = this.game, P = game.player, E = game.enemies;
    if (this.active >= 0 || P.dead || gi < 0 || !this.list[gi].open) return;
    const g = this.list[gi], c = arenaCenter(gi), R = CONFIG.gates.arenaRadius;
    if (g.trial) this.setupTrial(gi);
    else if (!g.abyss) this.close(gi); // one try: the gate is gone afterwards
    // deadly gates: the tier of their zone (Deadly +1, +2 ...)
    g.tier = !g.abyss && !g.trial && CONFIG.gates.difficulties[g.diff].id === 'deadly' ? game.gateTier(g.zone) : 0;
    // a Gate Key was used on this gate: harder and richer, once
    g.keyRun = !!g.keyed && !g.abyss && !g.trial;
    g.keyed = false;
    if (g.keyRun) g.tier += CONFIG.quests.keyGate.tier;
    this.runMods = game.modsOpen() ? [...game.mods] : [];
    const tl = this.runMods.includes('timeLimit') ? CONFIG.modifiers.list.timeLimit : null;
    this.timeLeft = 0;
    this.buildArena(gi).visible = true;
    // come back in front of the gate, on the camp side
    const d = Math.hypot(g.x, g.z) || 1;
    this.returnX = g.x - (g.x / d) * 5;
    this.returnZ = g.z - (g.z / d) * 5;
    this.active = gi;
    this.near = -1;
    this.exitOpen = false;
    this.exit.visible = false;
    this.exit.position.set(c.x, 0, c.z + R - 3);
    this.exit.rotation.y = Math.PI;

    E.calmAll();
    this.stages = [];
    this.stageI = -1;
    if (g.abyss) {
      for (const a of E.arenaAdds[gi]) E.vanish(a);
    } else {
      // the stages come first, the boss last
      const D = gateDiff(g);
      E.usePool(gi);
      E.vanish(E.arenaBoss[gi]);
      this.stages = [...D.stages, 'boss'];
      this.stagePause = 2.2;
      this.surviveT = 0;
      if (tl) this.timeLeft = tl.gate + (tl.perStage || 0) * D.stages.length;
      this.resetBrain();
    }

    game.shots.clear();
    game.hazards.clear();
    P.x = c.x;
    P.z = c.z + R - 7;
    P.dirX = 0;
    P.dirZ = -1;
    game.army.relocate(P.x, P.z);
    game.cam.snap(P.x, P.z);
    game.world.update(P.x, P.z, true);
    if (g.abyss) {
      game.abyss.begin(floor);
    } else if (g.trial) {
      game.hud.banner(t('trial.name', { rank: RANKS[game.rankIndex + 1] }), t('trial.entered', { n: this.stages.length, boss: t('enemy.' + CONFIG.world.zones[g.zone].boss) }));
      play('arise');
    } else {
      game.hud.toast(t('gate.entered', { n: this.stages.length, boss: t('enemy.' + CONFIG.world.zones[g.zone].boss) }));
      play('arise');
      if (game.tips) game.tips.show('gateStages');
    }
  }

  // victory: the Leave button; toCamp: died and respawned in the camp
  leave(toCamp) {
    const gi = this.active;
    if (gi < 0) return;
    const game = this.game, P = game.player, E = game.enemies;
    this.active = -1;
    this.exitOpen = false;
    this.exit.visible = false;
    if (this.arenas[gi]) this.arenas[gi].visible = false;
    E.vanish(E.arenaBoss[gi]);
    for (const a of E.arenaAdds[gi]) E.vanish(a);
    game.shots.clear();
    game.hazards.clear();
    if (this.list[gi].abyss) game.abyss.end();
    this.runMods = [];
    this.timeLeft = 0;
    this.stages = [];
    this.stageI = -1;
    this.surviveT = 0;
    if (!toCamp) {
      // loot that still lies in the arena comes along
      game.loot.moveAll(arenaCenter(gi), CONFIG.gates.arenaRadius + 2, this.returnX, this.returnZ);
      P.x = this.returnX;
      P.z = this.returnZ;
      game.cam.snap(P.x, P.z);
      game.world.update(P.x, P.z, true);
    }
    game.army.relocate(P.x, P.z);
    game.save();
    // a pick of the Path that came with the rank trial
    if (!toCamp && game.path.due()) { game.path.announced = true; game.menu.open('path'); }
  }

  onBossKilled(gi, x, z) {
    const game = this.game, P = game.player, E = game.enemies;
    const gate = this.list[gi], zone = CONFIG.world.zones[gate.zone], D = gateDiff(gate);
    const modLuck = this.runMods.length * CONFIG.modifiers.luck;
    // deadly gate tiers: more luck and a better chance for the top rarity
    const GT = CONFIG.gateTiers, tier = gate.tier || 0;
    const luck = P.luck + D.luck + modLuck + tier * GT.luck, top = Math.min(1, CONFIG.items.bossTopChance + tier * GT.topChance);
    this.timeLeft = 0;
    const items = D.items + (gate.keyRun ? CONFIG.quests.keyGate.items : 0);
    for (let k = 0; k < items; k++) {
      const a = (k / items) * Math.PI * 2;
      game.loot.drop(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5, rollLoot(gate.level, luck, P.known, D.minRarity, k < items - 1, top));
    }
    // the helpers fade away
    for (const a of E.arenaAdds[gi]) {
      if (!E.alive[a]) continue;
      game.effects.burst(E.x[a], 1, E.z[a], 10, 0x6a4dbf, 4, 0.2, 0.5);
      E.vanish(a);
    }
    game.shots.clear();
    game.hazards.clear();
    // runes: a gate boss may carry one (deadly: always)
    const rc = gate.trial ? 1 : { normal: 0.25, hard: 0.6, deadly: 1 }[D.id] || 0;
    if (Math.random() < rc) game.runes.find();
    if (gate.keyRun) game.runes.find();
    this.exitOpen = true;
    if (gate.trial) {
      const ess = CONFIG.trial.essence * (game.rankIndex + 1);
      P.essence += ess;
      game.hud.toast(t('trial.passed') + ' · ' + t('toast.essence', { n: ess }));
      game.passTrial(); // the level, the new rank and its banner
    } else {
      const ess = Math.round(10 * (gate.zone + 1) * (gate.diff + 1) * (1 + modLuck) * (1 + 0.3 * D.stages.length) * (1 + tier * GT.essence));
      P.essence += ess;
      game.hud.toast(t('toast.essence', { n: ess }));
      if (!game.defeatedGates.includes(zone.id)) game.defeatedGates.push(zone.id);
      game.quests.add('gate', { diff: gate.diff });
      const up = D.id === 'deadly' && !gate.keyRun && game.gateTierUp(gate.zone);
      if (up && game.tips) game.tips.show('gateTier');
      game.hud.banner(t('toast.gateCleared'), up ? t('gate.tierUp', { n: game.gateTier(gate.zone) }) : t('gate.clearedSub', { boss: t('enemy.' + zone.boss) }));
    }
    this.exit.visible = true;
    game.effects.burst(x, 2, z, 60, zone.gateColor, 10, 0.3, 1.2);
    play('levelup');
    game.save();
  }

  // ---- stages ---------------------------------------------------------------------
  // somewhere along the arena, not right next to the hunter
  spot(gi) {
    const c = arenaCenter(gi), R = CONFIG.gates.arenaRadius, P = this.game.player;
    let x = c.x, z = c.z;
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, r = R * (0.45 + Math.random() * 0.45);
      x = c.x + Math.cos(a) * r;
      z = c.z + Math.sin(a) * r;
      if ((x - P.x) ** 2 + (z - P.z) ** 2 > 100) break;
    }
    return { x, z };
  }

  // one monster of the zone joins the stage (-1: the pool is full)
  spawnOne(gi, tier, x, z) {
    const game = this.game, E = game.enemies, g = this.list[gi];
    const a = E.freeSlot(E.pool);
    if (a < 0) return -1;
    const types = CONFIG.world.zones[g.zone].enemyTypes;
    if (x === undefined) ({ x, z } = this.spot(gi));
    E.spawnAt(a, types[(Math.random() * types.length) | 0], tier, x, z);
    game.effects.burst(x, 0.5, z, 12, CONFIG.world.zones[g.zone].gateColor, 4, 0.22, 0.6);
    game.effects.ring(x, z, 0.3, 2.2, CONFIG.world.zones[g.zone].gateColor, 0.4);
    return a;
  }

  eliteRoll(D) {
    const el = this.game.modOn('elites');
    return Math.random() < (el ? Math.max(el.chance, D.elite) : D.elite) ? 1 : 0;
  }

  nextStage() {
    const game = this.game, E = game.enemies, gi = this.active, g = this.list[gi];
    const D = gateDiff(g), G = CONFIG.gates, zone = CONFIG.world.zones[g.zone];
    this.stageI++;
    const kind = this.stageKind, n = this.stageI + 1, max = this.stages.length;
    if (kind === 'boss') {
      // the boss steps in, its helpers wait in the pool for its summons
      const elites = game.modOn('elites') || D.eliteAdds;
      const addType = E.typeIndex[CONFIG.enemies.types[zone.boss].adds];
      for (const a of E.pool) if (!E.alive[a]) { E.type[a] = addType; E.tier[a] = elites ? 1 : 0; E.kid[a] = 0; }
      const c = arenaCenter(gi), b = E.arenaBoss[gi];
      E.place(b, c.x, c.z - 3);
      E.packAggro[E.pack[b]] = 1;
      E.state[b] = ST_CHASE;
      E.yaw[b] = 0;
      this.resetBrain();
      game.effects.burst(c.x, 1, c.z - 3, 60, zone.gateColor, 10, 0.3, 1.2);
      game.effects.ring(c.x, c.z - 3, 0.5, 8, zone.gateColor, 0.6);
      game.cam.shake(0.5, 0.5);
      game.hud.banner(t('gate.stage', { n, max }), t('gate.stage.boss', { boss: t('enemy.' + zone.boss) }));
      play('roar');
      return;
    }
    game.hud.banner(t('gate.stage', { n, max }), t('gate.stage.' + kind));
    play('arise');
    if (kind === 'wave') {
      for (let k = 0; k < D.wave; k++) this.spawnOne(gi, this.eliteRoll(D));
    } else if (kind === 'survive') {
      this.surviveT = D.survive;
      this.spawnT = 0;
    } else if (kind === 'guard') {
      // champions, each with a few guards around it
      for (let c = 0; c < D.guards; c++) {
        const at = this.spot(gi);
        this.spawnOne(gi, 2, at.x, at.z);
        for (let k = 0; k < G.escorts; k++) {
          const a = (k / G.escorts) * Math.PI * 2;
          this.clamp(at.x + Math.cos(a) * 3, at.z + Math.sin(a) * 3, 1);
          this.spawnOne(gi, this.eliteRoll(D), this.cx, this.cz);
        }
      }
    }
  }

  stageCleared() {
    const game = this.game, P = game.player, gi = this.active, g = this.list[gi];
    const D = gateDiff(g);
    // a little reward for every stage
    const a = Math.atan2(P.dirX, P.dirZ);
    this.clamp(P.x + Math.sin(a) * 3, P.z + Math.cos(a) * 3, 1);
    const modLuck = this.runMods.length * CONFIG.modifiers.luck;
    game.loot.drop(this.cx, this.cz, rollLoot(g.level, P.luck + D.luck * CONFIG.gates.stageLuck + modLuck, P.known, 1, true));
    const ess = Math.round(3 * (g.zone + 1) * (g.diff + 1) * (1 + modLuck) * (1 + (g.tier || 0) * CONFIG.gateTiers.essence));
    P.essence += ess;
    game.hud.toast(t('gate.stageCleared', { n: this.stageI + 1 }) + ' · ' + t('toast.essence', { n: ess }));
    play('stage');
    game.quests.add('stage');
    this.stagePause = CONFIG.gates.stagePause;
  }

  // the stage of the gate the player is in
  runStages(dt) {
    const game = this.game, E = game.enemies, gi = this.active, G = CONFIG.gates;
    const kind = this.stageKind;
    if (kind === 'boss') return;
    if (this.stagePause > 0) {
      this.stagePause -= dt;
      if (this.stagePause <= 0) this.nextStage();
      return;
    }
    let alive = 0;
    for (const a of E.pool) if (E.alive[a]) alive++;
    this.poolLeft = alive;
    if (kind === 'survive' && this.surviveT > 0) {
      // they keep coming until the time is up
      this.surviveT -= dt;
      this.spawnT -= dt;
      if (this.spawnT <= 0 && alive < G.surviveAlive) {
        this.spawnOne(gi, this.eliteRoll(gateDiff(this.list[gi])));
        this.spawnT = G.surviveEvery;
      }
      if (this.surviveT <= 0) { this.surviveT = 0; game.hud.toast(t('gate.surviveDone')); }
      return;
    }
    if (alive === 0) this.stageCleared();
  }

  // ---- per frame ------------------------------------------------------------------
  update(dt) {
    const game = this.game, P = game.player;
    this.time += dt;
    const pulse = 1 + Math.sin(this.time * 3) * 0.06;
    for (const p of this.portals) {
      p.portal.scale.set(1.9 * pulse, 2.4 * pulse, 1);
      p.core.material.opacity = 0.25 + Math.sin(this.time * 4.3) * 0.15;
    }
    // Only the zone the player is in has gates. Closed gates open again
    // later somewhere else in their zone, but only while the player is there.
    if (this.active < 0) {
      const zone = game.curZone, arrived = zone !== this.zoneNow;
      this.zoneNow = zone;
      for (let i = 0; i < this.list.length; i++) {
        const g = this.list[i], here = g.zone === zone;
        if (g.abyss || g.trial) continue;
        if (!g.open) {
          if (g.t > 0) g.t -= dt;
          if (g.t <= 0 && here) {
            g.open = true;
            g.gen++;
            this.place(i);
            if (!arrived) game.hud.toast(t('gate.opened', { diff: t('gate.diff.' + CONFIG.gates.difficulties[g.diff].id) }));
          }
        }
        this.portals[i].grp.visible = g.open && here;
      }
      this.near = -1;
      if (P.dead) return;
      const r2 = CONFIG.gates.enterRange * CONFIG.gates.enterRange;
      for (let i = 0; i < this.list.length; i++) {
        if (!this.list[i].open || this.list[i].abyss || this.list[i].trial || this.list[i].zone !== zone) continue;
        const dx = this.list[i].x - P.x, dz = this.list[i].z - P.z;
        if (dx * dx + dz * dz < r2) { this.near = i; break; }
      }
      if (this.near >= 0 && game.tips) game.tips.show('gate');
      const ab = this.list[this.abyssIndex];
      if (this.near < 0 && ab && (ab.x - P.x) ** 2 + (ab.z - P.z) ** 2 < r2 * 2.5) this.near = this.abyssIndex; // a bigger portal
      // the rank trial: open while it is due
      const tr = this.list[this.trialIndex];
      if (tr) {
        tr.open = game.trialDue();
        this.portals[this.trialIndex].grp.visible = tr.open;
        if (tr.open && this.near < 0 && (tr.x - P.x) ** 2 + (tr.z - P.z) ** 2 < r2 * 2) this.near = this.trialIndex;
      }
    } else if (this.exitOpen) {
      this.exitPortal.scale.set(1.9 * pulse, 2.4 * pulse, 1);
    } else {
      if (!this.inAbyss && !P.dead) this.runStages(dt);
      if (!(this.timeLeft > 0 && !P.dead)) return;
      // Against the Clock: out of the gate when the time is up
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        game.hud.toast(t('abyss.timeUp'));
        this.leave(false);
      }
    }
  }

  // the Enter / Leave button of the gate panel
  press() {
    const game = this.game, P = game.player;
    if (P.dead) return;
    if (this.active >= 0) {
      if (!this.exitOpen) return;
      if (this.inAbyss) game.abyss.next();
      else this.leave(false);
    } else if (this.near >= 0 && this.near === this.abyssIndex) {
      if (game.abyss.unlocked) game.abyssPanel.open('abyss');
      else game.hud.toast(t('abyss.locked', { level: CONFIG.abyss.unlockLevel }));
    } else if (this.near >= 0) {
      this.enter(this.near);
    }
  }

  // the second button: leave the Abyss, or choose modifiers in front of a gate
  press2() {
    const game = this.game;
    if (game.player.dead) return;
    if (this.active >= 0) { if (this.exitOpen && this.inAbyss) this.leave(false); }
    else if (this.near >= 0 && this.near !== this.abyssIndex && this.near !== this.trialIndex && game.modsOpen()) game.abyssPanel.open('mods');
  }

  // ---- boss brain -----------------------------------------------------------------
  // Called by Enemies.update for the boss. Writes the wanted movement into
  // enemies.mvx / mvz / mvs and sets the enemy state for the telegraph tint.
  think(i, dt, dx, dz, dist, tg, targetable) {
    const game = this.game, E = game.enemies, b = this.b;
    const def = E.types[E.type[i]].def, B = CONFIG.boss, BP = CONFIG.bossPatterns;
    E.mvx = E.mvz = E.mvs = 0;
    if (!targetable) { E.state[i] = ST_IDLE; return; }
    // a new phase: the boss roars (a shockwave around it) and gets meaner
    const gi = E.arena[i] - 1;
    if (b.phase < this.phaseCount(gi) && E.hp[i] < E.maxHp[i] * B.phases[b.phase - 1] && b.state !== CHARGE && b.state !== ROAR) {
      this.roar(i, def);
      return;
    }
    if (b.state === ROAR) {
      b.t -= dt;
      E.state[i] = ST_WINDUP;
      if (b.t <= 0) this.endPattern(true);
      return;
    }
    // exhausted after a big attack: stands still and takes more damage
    if (b.tired > 0) {
      b.tired -= dt;
      E.state[i] = ST_IDLE;
      if (Math.random() < dt * 14) {
        const a = Math.random() * Math.PI * 2, h = 2.6 * E.scale[i];
        game.effects.sparks(E.x[i] + Math.cos(a) * 0.9, h, E.z[i] + Math.sin(a) * 0.9, 1, 0xffe070, 1.2, 0.3, 0.5, 0.5);
      }
      return;
    }
    const enraged = b.phase >= 2;
    const speed = def.speed * (enraged ? B.enrageSpeed : 1);
    if (dist > 0.01 && b.state !== CHARGE) {
      let diff = Math.atan2(dx, dz) - E.yaw[i];
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      E.yaw[i] += diff * Math.min(1, dt * 6);
    }

    if (b.state === PAUSE) {
      b.t -= dt;
      if (b.bite > 0) {
        // basic swipe
        b.bite -= dt;
        E.state[i] = ST_WINDUP;
        if (b.bite <= 0) {
          E.lunge[i] = 1;
          E.atkCd[i] = def.attackCooldown;
          if (dist <= def.attackRange + E.radius[i] * 0.5 + 1.2) E.hitTarget(tg, E.dmg[i]);
          E.state[i] = ST_CHASE;
        }
        return;
      }
      E.state[i] = ST_CHASE;
      const reach = def.attackRange + E.radius[i] * 0.5;
      if (dist > reach) { E.mvx = dx; E.mvz = dz; E.mvs = speed; }
      if (dist <= reach + 0.5 && E.atkCd[i] <= 0) b.bite = def.attackWindup;
      if (b.t <= 0) this.startPattern(i, def, dx, dz, dist, BP);
    } else if (b.state === WINDUP) {
      b.t -= dt;
      E.state[i] = ST_WINDUP;
      if (b.t <= 0) this.act(i, def, dx, dz, dist, BP, enraged);
    } else if (b.state === CHARGE) {
      // charging
      b.t -= dt;
      E.state[i] = ST_CHARGE;
      E.mvx = b.cdx; E.mvz = b.cdz; E.mvs = BP.charge.speed;
      this.chargeHits(i, E.dmg[i] * BP.charge.damage);
      if (b.t <= 0) this.endPattern(enraged);
    }
  }

  roar(i, def) {
    const game = this.game, E = game.enemies, b = this.b, R = CONFIG.boss.roar;
    b.phase++;
    b.state = ROAR;
    b.t = R.time;
    b.bite = 0;
    b.tired = 0;
    b.combo = false;
    E.lunge[i] = 1;
    const x = E.x[i], z = E.z[i];
    game.hazards.add(x, z, R.radius + E.radius[i], R.time, E.dmg[i] * R.damage, 0xff2060);
    game.effects.ring(x, z, 0.5, R.radius + 3, 0xff2060, 0.6);
    game.effects.flare(x, 2, z, 6, 0xff2060, 0.5, 1.6);
    game.cam.shake(0.7, 0.6);
    game.hud.banner(t('boss.phase', { n: b.phase }), t('boss.phase.' + b.phase, { boss: t('enemy.' + E.types[E.type[i]].id) }));
    play('roar');
    if (game.tips) game.tips.show('bossPhase');
  }

  startPattern(i, def, dx, dz, dist, BP) {
    const game = this.game, E = game.enemies, b = this.b;
    const gi = E.arena[i] - 1;
    let addsAlive = 0;
    for (const a of E.arenaAdds[gi]) if (E.alive[a]) addsAlive++;
    // phase 2 and 3: the boss knows its extra attacks too
    const all = b.phase >= 2 && def.patterns2 ? [...def.patterns, ...def.patterns2] : def.patterns;
    const options = all.filter((p) => p !== b.last && (p !== 'summon' || addsAlive < BP.summon.maxAdds - 1));
    const p = options.length ? options[(Math.random() * options.length) | 0] : 'slam';
    b.pattern = p;
    b.last = p;
    b.state = WINDUP;
    b.t = BP[p].windup || 0.8;
    const dmg = E.dmg[i];
    const bx = E.x[i], bz = E.z[i];
    if (p === 'slam') {
      game.hazards.add(bx, bz, BP.slam.radius + E.radius[i], b.t, dmg * BP.slam.damage, 0xff3030);
    } else if (p === 'eruption') {
      const ER = BP.eruption, P = game.player, D = game.army.deployed;
      for (let k = 0; k < ER.count; k++) {
        let x = P.x, z = P.z;
        if (k > 0) {
          // around the player or a random shadow
          const u = D.length && Math.random() < 0.5 ? D[(Math.random() * D.length) | 0] : null;
          if (u && u.alive) { x = u.x; z = u.z; }
          x += (Math.random() - 0.5) * ER.spread;
          z += (Math.random() - 0.5) * ER.spread;
        }
        this.clamp(x, z, 0);
        game.hazards.add(this.cx, this.cz, ER.radius, b.t + k * 0.12, dmg * ER.damage, 0xff7020);
      }
    } else if (p === 'fissure') {
      // a line of bursts from the boss towards its target
      const F = BP.fissure, ux = dist > 0.01 ? dx / dist : 0, uz = dist > 0.01 ? dz / dist : 1;
      for (let k = 0; k < F.count; k++) {
        const r = E.radius[i] + 1 + k * F.step;
        this.clamp(bx + ux * r, bz + uz * r, 0);
        game.hazards.add(this.cx, this.cz, F.radius, b.t + k * F.delay, dmg * F.damage, 0xff5030);
      }
    } else if (p === 'meteor') {
      // a rain of strikes all over the arena, the first one on the hunter
      const M = BP.meteor, P = game.player, c = arenaCenter(gi);
      for (let k = 0; k < M.count; k++) {
        let x = P.x, z = P.z;
        if (k > 0) {
          const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * M.spread;
          x = c.x + Math.cos(a) * r;
          z = c.z + Math.sin(a) * r;
        }
        this.clamp(x, z, 0);
        game.hazards.add(this.cx, this.cz, M.radius, b.t + k * M.delay, dmg * M.damage, 0xff9040);
      }
    }
  }

  act(i, def, dx, dz, dist, BP, enraged) {
    const game = this.game, E = game.enemies, b = this.b;
    const dmg = E.dmg[i], bx = E.x[i], bz = E.z[i];
    const color = CONFIG.world.zones[this.list[E.arena[i] - 1].zone].gateColor;
    const dirX = dist > 0.01 ? dx / dist : 0, dirZ = dist > 0.01 ? dz / dist : 1;
    const p = b.pattern;
    E.lunge[i] = 1;
    if (p === 'charge') {
      b.state = CHARGE;
      b.t = BP.charge.time;
      b.cdx = dirX;
      b.cdz = dirZ;
      b.hitP = false;
      b.hitS.clear();
      return;
    }
    if (p === 'nova') {
      const N = BP.nova.shots, off = Math.random() * 6.28;
      for (let k = 0; k < N; k++) {
        const a = off + (k / N) * Math.PI * 2;
        game.shots.fire(bx, bz, Math.cos(a), Math.sin(a), BP.nova.speed, dmg * BP.nova.damage, color, 34, CONFIG.boss.shotRadius);
      }
    } else if (p === 'volley') {
      const V = BP.volley, base = Math.atan2(dirZ, dirX), spread = (V.spreadDeg * Math.PI) / 180;
      for (let k = 0; k < V.shots; k++) {
        const a = base + (V.shots > 1 ? (k / (V.shots - 1) - 0.5) * spread : 0);
        game.shots.fire(bx, bz, Math.cos(a), Math.sin(a), V.speed, dmg * V.damage, color, 34, CONFIG.boss.shotRadius);
      }
    } else if (p === 'summon') {
      const gi = E.arena[i] - 1;
      let n = 0;
      for (const a of E.arenaAdds[gi]) {
        if (E.alive[a] || E.deathT[a] > 0 || n >= BP.summon.count) continue;
        const ang = Math.random() * Math.PI * 2;
        this.clamp(bx + Math.cos(ang) * 4, bz + Math.sin(ang) * 4, 1);
        E.spawnAt(a, E.types[E.type[a]].id, E.tier[a], this.cx, this.cz);
        game.effects.burst(this.cx, 0.5, this.cz, 14, color, 4, 0.22, 0.6);
        n++;
      }
    }
    // slam, eruption, fissure and meteor do their damage through the hazards
    this.endPattern(enraged);
  }

  // after an attack: sometimes a second one right away (phase 2 and 3), after
  // a heavy one the boss is exhausted for a moment, otherwise a short pause
  endPattern(enraged) {
    const b = this.b, B = CONFIG.boss;
    b.state = PAUSE;
    if (!b.combo && Math.random() < B.combo[b.phase - 1]) {
      b.combo = true;
      b.t = 0.3;
      return;
    }
    b.combo = false;
    b.t = B.pause * (b.phase >= 3 ? 0.5 : enraged ? 0.65 : 1) + Math.random() * 0.5;
    if (B.tired.patterns.includes(b.pattern)) {
      b.tired = B.tired.time * (b.phase >= 3 ? 0.6 : 1);
      play('tired');
      if (this.game.tips) this.game.tips.show('bossTired');
    }
    b.pattern = '';
  }

  chargeHits(i, dmg) {
    const game = this.game, E = game.enemies, P = game.player, army = game.army, b = this.b;
    const x = E.x[i], z = E.z[i], r = E.radius[i] + 0.5;
    if (!b.hitP && !P.dead) {
      const dx = P.x - x, dz = P.z - z, m = r + P.radius;
      if (dx * dx + dz * dz < m * m) { b.hitP = true; P.damage(dmg); }
    }
    for (const u of army.deployed) {
      if (b.hitS.has(u.slot) || !army.targetable(u)) continue;
      const dx = u.x - x, dz = u.z - z, m = r + u.radius;
      if (dx * dx + dz * dz < m * m) { b.hitS.add(u.slot); army.damage(u.slot, dmg); }
    }
  }
}
