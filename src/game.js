// Ties everything together: scene, world, player, enemies, input and the
// frame loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { rankOf, rankProgress, tierLevels, levelAt } from './core/levels.js';
import { input, resetInput, clearEvents } from './input/input.js';
import { initTouch } from './input/touch.js';
import { FollowCamera } from './render/camera.js';
import { Effects } from './render/effects.js';
import { AimIndicator } from './render/aim.js';
import { World } from './world/world.js';
import { Player } from './entities/player.js';
import { Enemies } from './entities/enemies.js';
import { Army } from './entities/army.js';
import { Souls } from './entities/souls.js';
import { Projectiles } from './combat/projectiles.js';
import { Zones } from './combat/zones.js';
import { EnemyShots } from './combat/enemyShots.js';
import { Hazards } from './combat/hazards.js';
import { Gates, RANKS } from './world/gates.js';
import { Minimap } from './ui/minimap.js';
import { Loot } from './entities/loot.js';
import { Menu } from './ui/menu.js';
import { skillDef } from './combat/skills.js';
import { t } from './strings.js';
import { Hud } from './ui/hud.js';
import { getRenderer, sizeRenderer, disposeScene } from './render/renderer.js';
import { setNextItemId, getNextItemId, rollLoot } from './core/items.js';
import { play } from './core/sfx.js';
import { reportFps } from './core/settings.js';

const _v = new THREE.Vector3();
const _col = new THREE.Color();

export class Game {
  // opts: { slot, name, seed, appearance } for a new world, or { slot, save }
  // to continue a saved one. slot -1 = test world that is never saved.
  constructor(app, uiRoot, opts) {
    const save = opts.save || null;
    this.app = app;
    this.uiRoot = uiRoot;
    this.slot = opts.slot === undefined ? -1 : opts.slot;
    this.name = save ? save.name : opts.name || '';
    this.seed = save ? save.seed : opts.seed;
    this.created = save ? save.created : Date.now();
    this.playTime = save ? save.playTime || 0 : 0;
    this.saveT = 0;
    this.fpsT = 0;
    this.fpsN = 0;
    this.hitStopT = 0;
    this.defeatedGates = save ? [...(save.defeatedGates || [])] : []; // zones whose gate boss was beaten
    const DL = CONFIG.difficulty;
    this.difficulty = save ? save.difficulty || DL.oldSaves : opts.difficulty || DL.default;
    if (!DL.levels[this.difficulty]) this.difficulty = DL.default;
    this.discovered = new Set(save ? save.discovered || [] : []); // outposts captured (index in world.safes)
    // zones the player has set foot in (the minimap only shows these)
    this.knownZones = new Set(save && save.knownZones ? save.knownZones : [0]);
    this.respawnIndex = save ? save.respawnIndex || 0 : 0; // safe place to come back to after dying
    this.lastSafe = 0;
    this.captureT = new Float32Array(64); // capture progress per outpost
    this.capture = { si: -1, p: 0, guards: 0 }; // shown by the HUD
    this.curZone = 0; // zone the player is in (the camp counts as the first)
    this.input = input; // handy for debugging
    this.running = false;
    this.paused = false;
    this.last = 0;
    this.kills = 0;
    this.zoneId = 'meadow';
    this.zoneRank = 'E';
    this.rankIndex = save ? save.rankIndex || 0 : 0; // player rank: 0 = E ... 5 = S (from the level)
    this.appearance = { ...CONFIG.defaultAppearance, ...(save ? save.appearance : opts.appearance) };
    this.soulNear = -1; // soul in reach of the Arise button
    this.ariseCost = 0;
    this.ariseChance = 1;
    this.ariseTries = 3;

    this.renderer = getRenderer();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0a16);
    this.hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a2238, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
    this.sun.position.set(-6, 12, 5);
    this.scene.add(this.sun);
    this.lightZone = -1;

    this.cam = new FollowCamera();
    this.hud = new Hud(uiRoot, this);
    this.effects = new Effects(this.scene, this.cam.camera, this.hud.els.fx);
    this.world = new World(this.scene, this.seed);
    this.gates = new Gates(this, save && save.gates);
    setNextItemId(save ? save.nextItemId || 1 : 1);
    this.player = new Player(this, this.appearance);
    this.enemies = new Enemies(this);
    this.army = new Army(this);
    this.souls = new Souls(this);
    this.shots = new EnemyShots(this);
    this.hazards = new Hazards(this);
    this.projectiles = new Projectiles(this);
    this.zones = new Zones(this);
    this.loot = new Loot(this);
    this.menu = new Menu(uiRoot, this);
    this.aim = new AimIndicator(this.scene);

    if (save) {
      this.player.restore(save.player);
      this.rankIndex = this.rankForLevel(this.player.level);
      this.army.restore(save.army);
      this.kills = save.kills || 0;
      setNextItemId(Math.max(save.nextItemId || 1, getNextItemId()));
    }

    // outposts taken in this world
    for (const si of this.discovered) this.markCaptured(si);
    if (save && !save.knownZones) {
      for (const si of this.discovered) this.knownZones.add(this.world.safes[si].zone);
      CONFIG.world.zones.forEach((z, i) => { if (this.defeatedGates.includes(z.id)) this.knownZones.add(i); });
    }
    this.minimap = new Minimap(this, this.hud.els.minimap);
    this.touchCleanup = initTouch(this.hud.els);
    this.hud.syncSkills();
    this.hud.setFps(opts.showFps);

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    this.onHide = () => {
      this.last = 0;
      if (document.hidden) this.save();
    };
    this.onPageHide = () => this.save();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    document.addEventListener('visibilitychange', this.onHide);
    window.addEventListener('pagehide', this.onPageHide);
    this.resize();

    this.world.update(this.player.x, this.player.z, true);
    this.cam.snap(this.player.x, this.player.z);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    sizeRenderer();
    this.cam.resize(w, h);
    this.effects.resize(w, h);
    // the rotate notice is shown by CSS; the game pauses while it is visible
    this.portrait = getComputedStyle(document.getElementById('rotate')).display !== 'none';
  }

  // ---- saving ---------------------------------------------------------------
  serialize() {
    return {
      version: 3,
      name: this.name,
      seed: this.seed,
      created: this.created,
      updated: Date.now(),
      playTime: Math.round(this.playTime),
      rankIndex: this.rankIndex,
      defeatedGates: [...this.defeatedGates],
      discovered: [...this.discovered],
      knownZones: [...this.knownZones],
      difficulty: this.difficulty,
      gates: this.gates.serialize(),
      respawnIndex: this.respawnIndex,
      kills: this.kills,
      appearance: { ...this.appearance },
      nextItemId: getNextItemId(),
      player: this.playerSave(),
      army: this.army.serialize(),
    };
  }

  // inside an arena the player is saved in front of its gate
  playerSave() {
    const d = this.player.serialize();
    if (this.gates.active >= 0) { d.x = this.gates.returnX; d.z = this.gates.returnZ; }
    return d;
  }

  // values of the world's difficulty
  diff() {
    return CONFIG.difficulty.levels[this.difficulty];
  }

  setDifficulty(id) {
    const L = CONFIG.difficulty.levels;
    if (!L[id] || id === this.difficulty) return;
    const a = L[this.difficulty], b = L[id];
    this.difficulty = id;
    this.enemies.rescale(b.enemyHp / a.enemyHp, b.enemyDamage / a.enemyDamage);
    this.player.recalc();
    this.save();
  }

  // rank that belongs to the player's level
  rankForLevel(level) {
    return rankOf(level);
  }

  // Called after a level up: a new rank gives lots of stat points.
  checkRank() {
    const P = this.player, G = CONFIG.progression;
    const r = this.rankForLevel(P.level);
    if (r <= this.rankIndex) return;
    let pts = 0;
    for (let k = this.rankIndex + 1; k <= r; k++) pts += G.rankPoints[k] || 0;
    this.rankIndex = r;
    P.points += pts;
    this.hud.banner(t('toast.rankUp', { rank: RANKS[r] }), t('toast.rankUpSub', { n: pts }));
    this.effects.ring(P.x, P.z, 0.5, 8, 0xffd24a, 0.8);
    this.save();
  }

  hitStop(t) {
    if (t > this.hitStopT) this.hitStopT = t;
  }

  // Writes the world into its slot. Returns a promise (true = saved).
  save(manual = false) {
    this.saveT = 0;
    this.fpsT = 0;
    this.fpsN = 0;
    this.hitStopT = 0;
    if (this.slot < 0 || !this.running) return Promise.resolve(false);
    const data = this.serialize();
    this.hud.showSaving();
    return this.app.store(this.slot, data).then((ok) => {
      if (manual) this.hud.toast(t(ok ? 'toast.saved' : 'toast.saveFailed'));
      return ok;
    });
  }

  // Leaves the world: stops the loop and frees everything it created.
  destroy() {
    this.running = false;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('orientationchange', this.resize);
    document.removeEventListener('visibilitychange', this.onHide);
    window.removeEventListener('pagehide', this.onPageHide);
    this.touchCleanup();
    disposeScene(this.scene);
    this.uiRoot.innerHTML = '';
    resetInput();
  }

  // New look from the skin editor in the camp.
  setAppearance(appearance) {
    this.appearance = { ...appearance };
    this.player.setAppearance(this.appearance);
    this.army.setAura(this.appearance.aura);
    this.souls.setAura(this.appearance.aura);
    this.projectiles.setAura(this.appearance.aura);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this.frame);
    const fresh = !this.last;
    let dt = this.last ? (now - this.last) / 1000 : 0.016;
    this.last = now;
    if (this.paused || this.portrait || document.hidden) {
      // one-shot inputs must not pile up while the game stands still
      clearEvents();
      this.fpsT = this.fpsN = 0;
      return;
    }
    // measure the real frame rate for the automatic graphics preset
    if (!fresh && dt < 0.5) {
      this.fpsT += dt;
      this.fpsN++;
      if (this.fpsT >= CONFIG.graphics.auto.measure) {
        reportFps(this.fpsN / this.fpsT);
        this.fpsT = this.fpsN = 0;
      }
    }
    if (dt > 0.05) dt = 0.05;
    // hit stop: the world nearly freezes for a moment on heavy hits
    if (this.hitStopT > 0) {
      this.hitStopT -= dt;
      dt *= 0.08;
    }
    this.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
  }

  update(dt) {
    const P = this.player;
    this.playTime += dt;
    this.saveT += dt;
    if (this.saveT >= CONFIG.save.autosaveInterval) this.save();
    this.updateCapture(dt);
    this.updateSafe();
    this.resolveMouse();
    this.effects.beginFrame();
    P.update(dt);
    this.handleArmyInput();
    this.army.update(dt);
    this.enemies.update(dt);
    this.projectiles.update(dt);
    this.zones.update(dt);
    this.shots.update(dt);
    this.hazards.update(dt);
    this.gates.update(dt);
    this.souls.update(dt);
    this.loot.update(dt);
    this.soulNear = P.dead ? -1 : this.souls.nearest(P.x, P.z, CONFIG.souls.ariseRange);
    if (this.soulNear >= 0) {
      this.ariseCost = CONFIG.arise.cost[this.souls.tier[this.soulNear]];
      this.ariseChance = this.chanceFor(this.soulNear);
      this.ariseTries = this.souls.tries[this.soulNear];
    }
    this.world.update(P.x, P.z, false);
    this.world.camp.update(dt);

    const zi = this.gates.active >= 0 ? this.gates.list[this.gates.active].zone : this.world.zoneIndexAt(Math.sqrt(P.x * P.x + P.z * P.z));
    this.curZone = Math.max(0, zi);
    if (zi >= 0 && !this.knownZones.has(zi)) this.knownZones.add(zi);
    if (zi >= 0) {
      const zone = CONFIG.world.zones[zi];
      this.zoneId = zone.id;
      this.zoneRank = zone.rank;
    }
    this.updateLight(dt, zi);
    this.minimap.update(dt);

    this.updateAim();

    this.cam.update(dt, P.x, P.z);
    this.effects.update(dt);
    this.hud.update(dt);
  }

  // Entering the camp or an outpost: discover it, make it the respawn point
  // and save.
  updateSafe() {
    const si = this.player.safeIndex;
    if (si >= 0 && si !== this.lastSafe) {
      this.respawnIndex = si;
      this.save();
    }
    this.lastSafe = si;
  }

  // Outposts in enemy hands: stand in the circle while no enemy is inside.
  updateCapture(dt) {
    const P = this.player, W = this.world, C = CONFIG.outposts, cap = this.capture;
    cap.si = -1;
    for (let si = 1; si < W.safes.length; si++) {
      const s = W.safes[si];
      if (s.captured) continue;
      const dx = P.x - s.x, dz = P.z - s.z;
      const inside = !P.dead && this.gates.active < 0 && dx * dx + dz * dz < s.r * s.r;
      if (!inside) {
        if (this.captureT[si] > 0) this.captureT[si] = Math.max(0, this.captureT[si] - dt * 0.5);
        continue;
      }
      cap.si = si;
      cap.guards = this.enemies.countNear(s.x, s.z, s.r + 2);
      if (cap.guards === 0) this.captureT[si] += dt;
      cap.p = Math.min(1, this.captureT[si] / C.captureTime);
      if (this.captureT[si] >= C.captureTime) this.captureOutpost(si);
    }
  }

  markCaptured(si) {
    const s = this.world.safes[si];
    if (!s || s.zone < 0) return;
    s.captured = true;
    this.discovered.add(si);
    this.enemies.freeOutpost(si);
    this.world.outposts.setCaptured(si, true);
  }

  captureOutpost(si) {
    const s = this.world.safes[si], C = CONFIG.outposts, P = this.player;
    const zone = CONFIG.world.zones[s.zone];
    this.markCaptured(si);
    this.capture.si = -1;
    // the chest opens
    for (let k = 0; k < C.chestItems; k++) {
      const a = (k / C.chestItems) * Math.PI * 2;
      this.loot.drop(s.x + 0.5 + Math.cos(a) * 1.8, s.z - 3 + Math.sin(a) * 1.8, rollLoot(levelAt(Math.hypot(s.x, s.z)), P.drop + 0.8, P.known, C.chestMinRarity));
    }
    this.effects.burst(s.x, 1, s.z, 50, 0x8a4dff, 8, 0.26, 0.9);
    this.hud.banner(t('toast.outpostCaptured'), this.safeName(si));
    play('chest');
  }

  safeName(si) {
    const s = this.world.safes[si];
    if (!s || s.zone < 0) return t('zone.camp');
    return t('outpost.name', { zone: t('zone.' + CONFIG.world.zones[s.zone].id), dir: t('dir.' + s.dir) });
  }

  respawnSpot() {
    const s = this.world.safes[this.respawnIndex] || this.world.safes[0];
    return { x: s.x, z: s.z + (s.zone < 0 ? 5 : 3) };
  }

  // Fast travel between the camp and discovered outposts (only from a safe place).
  travel(si) {
    const P = this.player, s = this.world.safes[si];
    if (!s || P.dead || !P.inCamp) return;
    P.x = s.x;
    P.z = s.z + (s.zone < 0 ? 5 : 3);
    this.respawnIndex = si;
    this.lastSafe = si;
    P.safeIndex = si;
    this.army.relocate(P.x, P.z);
    this.cam.snap(P.x, P.z);
    this.world.update(P.x, P.z, true);
    this.effects.burst(P.x, 1, P.z, 30, this.appearance.aura, 6, 0.24, 0.8);
    play('arise');
  }

  // Light colour follows the zone the player is in (soft blend).
  updateLight(dt, zi) {
    const L = CONFIG.world.zones[Math.max(0, zi)].light;
    const k = this.lightZone === -1 ? 1 : 1 - Math.exp(-dt * 1.5);
    this.lightZone = zi;
    _col.setHex(L.sky);
    this.hemi.color.lerp(_col, k);
    _col.setHex(L.ground);
    this.hemi.groundColor.lerp(_col, k);
    _col.setHex(L.sun);
    this.sun.color.lerp(_col, k);
    this.hemi.intensity += (L.sky_i - this.hemi.intensity) * k;
  }

  // Ground preview of the attack or skill that is being aimed.
  updateAim() {
    const P = this.player, sticks = input.sticks;
    let k = -1;
    if (!P.dead) for (let i = 0; i < 4; i++) if (sticks[i].aiming) { k = i; break; }
    if (k < 0) { this.aim.hide(); return; }
    const st = sticks[k];
    if (k === 0) {
      const w = CONFIG.weapons[P.weapon];
      const shape = w.shape === 'blast' ? 'point' : w.shape;
      this.aim.show(shape, P.x, P.z, st.x, st.z, st.power, w.range, w.arcDeg, w.width, shape === 'circle' ? w.range : w.radius);
      return;
    }
    const id = P.slots[k - 1];
    if (!id) { this.aim.hide(); return; }
    const d = skillDef(id);
    this.aim.show(d.aim === 'self' ? 'circle' : d.aim, P.x, P.z, st.x, st.z, st.power, d.range, d.arcDeg, d.width, d.radius);
  }

  // Mouse aiming for PC testing: hold the left button to aim, release to
  // fire. Q / R / F cast skill 1 / skill 2 / the ultimate towards the cursor.
  resolveMouse() {
    if (!input.mouseDown && !input.mouseReleased && input.keyCast < 0) return;
    const P = this.player, cam = this.cam.camera;
    _v.set((input.mouseX / window.innerWidth) * 2 - 1, -(input.mouseY / window.innerHeight) * 2 + 1, 0.5);
    _v.unproject(cam).sub(cam.position);
    const k = -cam.position.y / _v.y;
    let dx = cam.position.x + _v.x * k - P.x, dz = cam.position.z + _v.z * k - P.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.01) { dx /= d; dz /= d; } else { dx = P.dirX; dz = P.dirZ; }
    const s0 = input.sticks[0];
    const range = CONFIG.weapons[P.weapon].range;
    s0.aiming = input.mouseDown;
    s0.x = dx;
    s0.z = dz;
    s0.power = Math.min(1, d / range);
    if (input.mouseReleased) {
      input.mouseReleased = false;
      s0.fire = true;
      s0.auto = false;
      s0.fx = dx;
      s0.fz = dz;
      s0.fp = s0.power;
    }
    if (input.keyCast > 0) {
      const sk = input.sticks[input.keyCast];
      const id = P.slots[input.keyCast - 1];
      const def = id ? skillDef(id) : null;
      sk.fire = true;
      sk.auto = false;
      sk.fx = dx;
      sk.fz = dz;
      sk.fp = def && def.range ? Math.min(1, d / def.range) : 1;
      input.keyCast = -1;
    }
  }

  // Arise, squad behaviour and revive buttons (HUD and keyboard).
  handleArmyInput() {
    const P = this.player, army = this.army;
    if (input.arise) {
      input.arise = false;
      this.tryArise();
    }
    if (input.enterGate) {
      input.enterGate = false;
      if (this.gates.near >= 0) this.gates.enter(this.gates.near);
    }
    if (input.armyBehavior) {
      input.armyBehavior = false;
      army.toggleBehavior();
    }
    if (input.armySummon) {
      input.armySummon = false;
      if (!P.dead && army.toggleSummon()) play('arise');
    }
    if (input.armyRevive) {
      input.armyRevive = false;
      if (!P.dead && army.ready > 0 && army.reviveReady() === 0) this.hud.toast(t('toast.noMana'));
    }
  }

  // Chance that an arise try on soul i works: lower for strong enemies and
  // for enemies above the player's level, higher with Intelligence.
  chanceFor(i) {
    const A = CONFIG.arise, souls = this.souls, P = this.player;
    if (souls.level[i] < P.level) return 1; // weaker than you: always rises
    const ranks = rankProgress(souls.level[i]) - rankProgress(P.level);
    const c = A.chance[souls.tier[i]] * Math.pow(A.rankFalloff, ranks) + P.stats.int * CONFIG.progression.stats.int.arise
      + (souls.gate[i] ? CONFIG.gates.ariseBonus : 0);
    return Math.max(A.minChance, Math.min(1, c));
  }

  tryArise() {
    const P = this.player, souls = this.souls, army = this.army;
    if (P.dead) return;
    const i = souls.nearest(P.x, P.z, CONFIG.souls.ariseRange);
    if (i < 0) return;
    const cost = CONFIG.arise.cost[souls.tier[i]];
    if (!army.hasRoom()) {
      // army full: a weaker shadow has to be dismissed in the menu first
      this.hud.armyNote(t('arise.full'), 'bad');
      return;
    }
    if (P.mana < cost) { this.hud.armyNote(t('toast.noMana'), 'bad'); return; }
    P.mana -= cost;
    if (Math.random() >= this.chanceFor(i)) {
      // the shadow resists
      souls.tries[i]--;
      this.effects.burst(souls.x[i], 1, souls.z[i], 12, 0x707080, 3, 0.18, 0.5);
      if (souls.tries[i] <= 0) {
        souls.remove(i);
        this.hud.armyNote(t('toast.soulFaded'), 'bad');
      } else {
        this.hud.armyNote(t('toast.ariseFailed', { n: souls.tries[i] }), 'bad');
      }
      play('hurt');
      return;
    }
    const u = army.add(this.enemies.types[souls.type[i]].id, souls.tier[i], souls.x[i], souls.z[i], undefined, souls.zone[i], souls.plv[i]);
    if (!u) return;
    souls.remove(i);
    play('arise');
    this.effects.burst(u.x, 0.2, u.z, 22, this.appearance.aura, 6, 0.24, 0.8);
    this.effects.ring(u.x, u.z, 0.5, 4, this.appearance.aura, 0.55);
    this.effects.ring(u.x, u.z, 3.5, 0.3, 0xffffff, 0.5, 0.05);
    this.hud.armyNote(t('toast.joinsArmy', { name: army.name(u) }), 'good');
  }

  setPaused(paused) {
    this.paused = paused;
    this.last = 0;
    resetInput();
  }

  // src: -1 = killed by the player, otherwise the slot of the shadow
  onEnemyKilled(i, src) {
    this.kills++;
    const E = this.enemies;
    const xp = E.xpv[i], tier = E.tier[i], zi = E.zone[i];
    const level = E.lvl[i] + tierLevels(zi, tier);
    this.souls.spawn(E.x[i], E.z[i], E.type[i], tier, zi, level, E.arena[i] > 0, E.lvl[i]);
    this.army.grantXp(src, xp);
    // kills of the army count only partly for the hunter
    this.player.addXp(src < 0 ? xp : xp * CONFIG.progression.armyKillXp);
    if (tier === 3) this.gates.onBossKilled(E.arena[i] - 1, E.x[i], E.z[i]);
    else this.loot.enemyDrop(E.x[i], E.z[i], level, tier);
  }

  onPlayerRespawn() {
    if (this.gates.active >= 0) this.gates.leave(true);
    this.enemies.calmAll();
    this.cam.snap(this.player.x, this.player.z);
  }
}
