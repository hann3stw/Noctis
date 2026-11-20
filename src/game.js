// Ties everything together: scene, world, player, enemies, input and the
// frame loop.
import * as THREE from 'three';
import { setMood, duckMusic, sting } from './core/music.js';
import { CONFIG } from './config.js';
import { rankOf, rankProgress, tierLevels, levelAt, enemyPower } from './core/levels.js';
import { input, resetInput, clearEvents } from './input/input.js';
import { initTouch } from './input/touch.js';
import { FollowCamera } from './render/camera.js';
import { Effects } from './render/effects.js';
import { AimIndicator } from './render/aim.js';
import { Xray } from './render/xray.js';
import { Bloom } from './render/bloom.js';
import { World } from './world/world.js';
import { Player } from './entities/player.js';
import { Enemies, ST_CHASE, ST_WINDUP, ST_CHARGE } from './entities/enemies.js';
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
import { Abyss } from './world/abyss.js';
import { AbyssPanel } from './ui/abyssPanel.js';
import { skillDef, setRunes } from './combat/skills.js';
import { t } from './strings.js';
import { Hud } from './ui/hud.js';
import { Tutorial, OLD_STEP_COUNT } from './ui/tutorial.js';
import { Tips, BASIC_TIPS } from './ui/tips.js';
import { Fog } from './ui/fog.js';
import { Quests } from './core/quests.js';
import { Bestiary } from './core/bestiary.js';
import { Paths } from './core/paths.js';
import { Profile } from './core/profile.js';
import { Titles } from './core/titles.js';
import { Runes } from './core/runes.js';
import { Waypoint } from './core/waypoint.js';
import { Hunts } from './core/hunts.js';
import { getRenderer, sizeRenderer, disposeScene } from './render/renderer.js';
import { setNextItemId, getNextItemId, rollLoot } from './core/items.js';
import { play } from './core/sfx.js';
import { reportFps, measureEvery, settings, gfx } from './core/settings.js';
import { submitScore, publicLook, publicGear, publicStats } from './net/online.js';

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
    this.fpsMax = 0;
    this.hitStopT = 0;
    this.defeatedGates = save ? [...(save.defeatedGates || [])] : []; // zones whose gate boss was beaten
    const DL = CONFIG.difficulty;
    this.difficulty = save ? save.difficulty || DL.oldSaves : opts.difficulty || DL.default;
    if (!DL.levels[this.difficulty]) this.difficulty = DL.default;
    this.discovered = new Set(save ? save.discovered || [] : []); // outposts captured (index in world.safes)
    // zones the player has set foot in (the minimap only shows these)
    this.knownZones = new Set(save && save.knownZones ? save.knownZones : [0]);
    // gate modifiers chosen by the player (kept until changed)
    this.mods = (save && save.mods ? save.mods : []).filter((id) => CONFIG.modifiers.list[id]).slice(0, CONFIG.modifiers.max);
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
    this.trialRank = save ? save.trialRank || 0 : 0; // highest rank whose trial was passed
    this.xpBoostT = save ? Math.max(0, save.xpBoostT || 0) : 0; // seconds of Double XP left
    this.gateTiers = save && Array.isArray(save.gateTiers) ? save.gateTiers.map((n) => n | 0) : []; // deadly gate tier per zone
    this.appearance = { ...CONFIG.defaultAppearance, ...(save ? save.appearance : opts.appearance) };
    this.soulNear = -1; // soul in reach of the Arise button
    this.ariseCost = 0;
    this.ariseChance = 1;
    this.ariseTries = 3;

    this.renderer = getRenderer();
    this.xray = new Xray(this.renderer);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0a16);
    this.hemi = new THREE.HemisphereLight(0xb9c4ff, 0x2a2238, 1.5);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
    this.sun.position.set(-6, 12, 5);
    this.scene.add(this.sun);
    this.scene.add(this.sun.target); // follows the player (shadow maps)
    this.shadowsOn = null;
    this.lightZone = -1;

    this.cam = new FollowCamera();
    this.hud = new Hud(uiRoot, this);
    this.effects = new Effects(this.scene, this.cam.camera, this.hud.els.fx);
    this.world = new World(this.scene, this.seed);
    this.gates = new Gates(this, save && save.gates);
    setNextItemId(save ? save.nextItemId || 1 : 1);
    this.runes = new Runes(this, save && save.runes); // skill runes
    setRunes(this.runes);
    this.profile = new Profile(save && save.profile); // how the hunter plays (the Path uses it)
    this.path = new Paths(this, save && save.path); // the class tree (before the player: it adds bonuses)
    this.player = new Player(this, this.appearance);
    this.enemies = new Enemies(this);
    this.army = new Army(this);
    this.souls = new Souls(this);
    this.shots = new EnemyShots(this);
    this.hazards = new Hazards(this);
    this.projectiles = new Projectiles(this);
    this.zones = new Zones(this);
    this.loot = new Loot(this);
    this.abyss = new Abyss(this, save && save.abyss);
    this.quests = new Quests(this, save && save.quests);
    this.titles = new Titles(this, save && save.titles);
    this.bestiary = new Bestiary(this, save && save.bestiary);
    this.menu = new Menu(uiRoot, this);
    this.abyssPanel = new AbyssPanel(uiRoot, this);
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
    // the fog of the map (older worlds: the zones they know are uncovered)
    this.fog = new Fog(this, save ? save.fog || 'legacy' : null);
    // Worlds from before the outposts were turned: the outposts stand somewhere
    // else now, so the hunter starts at the respawn point and the land around
    // the captured outposts is uncovered on the map.
    if (save && save.layout !== 2) {
      const sp = this.respawnSpot();
      this.player.x = sp.x;
      this.player.z = sp.z;
      this.army.relocate(sp.x, sp.z);
      for (const si of this.discovered) { const o = this.world.safes[si]; this.fog.revealAround(o.x, o.z, CONFIG.minimap.fogReveal); }
    }
    this.waypoint = new Waypoint(this, save && save.mark);
    this.hunts = new Hunts(this);
    if (!this.quests.list.length || this.quests.day < 0) this.quests.make();
    this.minimap = new Minimap(this, this.hud.els.minimap);
    this.touchCleanup = initTouch(this.hud.els);
    this.hud.syncSkills();
    this.hud.setFps(opts.showFps);
    // the tutorial of a new world, or the step a saved world stopped at
    let tut = save ? (typeof save.tutorial === 'number' ? save.tutorial : -1) : opts.tutorial ? 0 : -1;
    // worlds from before the shorter tutorial: the steps that became tips end it
    if (save && tut >= 0 && save.tutorialV !== 2 && tut >= OLD_STEP_COUNT) tut = OLD_STEP_COUNT;
    this.tutorial = tut >= 0 ? new Tutorial(this, this.hud.hud, tut) : null;
    // tips: things are explained the first time you meet them. Worlds that
    // already know the basics (older worlds, or no tutorial) skip those.
    let seen = save && save.tips;
    if (!seen) seen = tut >= 0 ? [] : [...BASIC_TIPS];
    this.tips = new Tips(this, this.hud.hud, seen);

    this.applyShadows();

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
    this.submitRecords(); // records from before the leaderboards existed
  }

  // Sends level and Abyss record to the leaderboards (waits offline or without
  // a hunter name). Floor 0 = not in the Abyss yet: on the level board only.
  submitRecords() {
    if (this.slot < 0) return;
    const P = this.player;
    const look = publicLook(this.appearance), gear = publicGear(P.equip), stats = publicStats(P, this.army), title = this.titles.worn;
    this.shownKey = JSON.stringify([look, gear, stats, title]);
    submitScore({
      floor: this.abyss.best || 0, level: P.level, mastery: P.mastery.lv,
      rank: RANKS[this.rankIndex] || 'E', difficulty: this.difficulty, look, gear, stats, title,
    }, settings.hunterName);
  }

  // new gear or a new look: the leaderboard shows it too (checked on saving)
  submitLookIfChanged() {
    if (this.slot < 0) return;
    const key = JSON.stringify([publicLook(this.appearance), publicGear(this.player.equip), publicStats(this.player, this.army), this.titles.worn]);
    if (key !== this.shownKey) this.submitRecords();
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
      trialRank: this.trialRank,
      path: this.path.serialize(),
      profile: this.profile.serialize(),
      titles: this.titles.serialize(),
      runes: this.runes.serialize(),
      xpBoostT: Math.round(this.xpBoostT),
      gateTiers: [...this.gateTiers],
      defeatedGates: [...this.defeatedGates],
      discovered: [...this.discovered],
      knownZones: [...this.knownZones],
      difficulty: this.difficulty,
      abyss: this.abyss.serialize(),
      mods: [...this.mods],
      tutorial: this.tutorial ? this.tutorial.step : -1,
      tutorialV: 2,
      tips: this.tips.serialize(),
      quests: this.quests.serialize(),
      bestiary: this.bestiary.serialize(),
      fog: this.fog.serialize(),
      mark: this.waypoint.serialize(),
      layout: 2,
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

  // gate modifiers can be chosen from rank A on
  modsOpen() {
    return this.rankIndex >= CONFIG.modifiers.minRank;
  }

  // Values of a modifier while it is on (only inside a gate or the Abyss), else null.
  modOn(id) {
    const g = this.gates;
    return g && g.active >= 0 && g.runMods.includes(id) ? CONFIG.modifiers.list[id] : null;
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

  // Highest level the hunter can reach now: the last level of the rank, until
  // the rank trial is passed (the last rank has none).
  levelCap() {
    const L = CONFIG.levels, r = Math.max(this.rankIndex, this.trialRank);
    return r + 1 < L.rankLevels.length ? L.rankLevels[r + 1] - 1 : L.maxLevel;
  }

  // the rank trial waits in the camp
  trialDue() {
    const P = this.player;
    return this.rankIndex + 1 < RANKS.length && this.trialRank <= this.rankIndex && P.level >= this.levelCap();
  }

  announceTrial() {
    this.hud.banner(t('trial.ready'), t('trial.readySub', { rank: RANKS[this.rankIndex + 1] }));
    if (this.tips) this.tips.show('trial');
  }

  // the boss of the rank trial fell: the level and the new rank
  passTrial() {
    const P = this.player;
    this.trialRank = this.rankIndex + 1;
    P.xp = Math.max(P.xp, P.xpNeed());
    P.addXp(0);
    this.quests.add('gate', { diff: 2 });
    this.save();
  }

  // tier of the deadly gate of zone zi (0 = plain)
  gateTier(zi) {
    return this.gateTiers[zi] || 0;
  }

  // the deadly gate of zone zi was cleared at its tier: the next one is harder
  gateTierUp(zi) {
    const n = this.gateTier(zi);
    if (n >= CONFIG.gateTiers.max) return false;
    while (this.gateTiers.length <= zi) this.gateTiers.push(0);
    this.gateTiers[zi] = n + 1;
    return true;
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
    // a new pick of the Path: the window opens (in the arena of the trial it waits for the Leave button)
    if (this.path.due() && this.gates.active < 0) { this.path.announced = true; this.menu.open('path'); }
    else this.path.check();
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
    this.submitLookIfChanged();
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
    if (this.bloom) this.bloom.dispose();
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
      this.fpsT = this.fpsN = this.fpsMax = 0;
      return;
    }
    // measure the real frame rate for the automatic graphics preset
    if (!fresh && dt < 0.5) {
      this.fpsT += dt;
      this.fpsN++;
      if (dt > this.fpsMax) this.fpsMax = dt;
      if (this.fpsT >= measureEvery()) {
        // one stall (shader compile, a piece of the world loading) says nothing about the frame rate
        const stall = this.fpsMax > 0.1 && this.fpsMax > (6 * this.fpsT) / this.fpsN;
        if (!stall) reportFps(this.fpsN / this.fpsT);
        this.fpsT = this.fpsN = this.fpsMax = 0;
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
    this.xray.render(this.player.model.root, this.scene, this.cam.camera);
    if (gfx.bloom) {
      if (!this.bloom) this.bloom = new Bloom(this.renderer, CONFIG.graphics.bloom);
      this.bloom.render(this.scene, this.cam.camera, dt);
    }
  }

  update(dt) {
    const P = this.player;
    this.playTime += dt;
    const pf = this.profile;
    pf.time += dt;
    if (this.abyss.on) pf.timeAbyss += dt;
    else if (this.gates.active >= 0) pf.timeGate += dt;
    else if (this.player.inCamp) pf.timeCamp += dt;
    if (this.player.sprint) pf.sprintTime += dt;
    if (!this.path.announced && this.path.due() && this.playTime > 3) this.path.check(); // a pick waits (older worlds, or after a gate)
    if (this.xpBoostT > 0 && (this.xpBoostT -= dt) <= 0) { this.xpBoostT = 0; this.hud.toast(t('quest.xpOff')); }
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
    this.abyss.update(dt);
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
    this.updateSun();
    this.updateMusic(dt, zi);
    // the kill streak ends when no kill follows in time
    if (this.streakT > 0 && (this.streakT -= dt) <= 0) this.streak = 0;
    this.minimap.update(dt);

    this.updateAim();

    this.cam.update(dt, P.x, P.z);
    this.effects.update(dt);
    this.hud.update(dt);
    if (this.tutorial) this.tutorial.update(dt);
    this.tips.update(dt);
    this.quests.update(dt);
    this.titles.update(dt);
    this.waypoint.update(dt);
    this.hunts.update(dt);
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
    this.quests.add('outpost');
    // the chest opens
    for (let k = 0; k < C.chestItems; k++) {
      const a = (k / C.chestItems) * Math.PI * 2;
      this.loot.drop(s.x + 0.5 + Math.cos(a) * 1.8, s.z - 3 + Math.sin(a) * 1.8, rollLoot(levelAt(Math.hypot(s.x, s.z)), P.luck + 0.8, P.known, C.chestMinRarity));
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

  // Real shadows from the sun (graphics preset "high"): every solid body casts
  // one, the ground and floors receive them. Without them the soft blob
  // shadows under every unit are used (render/effects.js).
  applyShadows() {
    const on = !!gfx.realShadows, r = this.renderer;
    this.effects.setLights(gfx.lights);
    const key = on ? gfx.shadowMap + ':' + gfx.shadowRange : 'off';
    if (this.shadowsOn === key) return;
    const was = !!this.shadowsOn && this.shadowsOn !== 'off';
    this.shadowsOn = key;
    r.shadowMap.enabled = on;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = on;
    if (on) {
      const c = this.sun.shadow.camera;
      const R = gfx.shadowRange;
      c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 100;
      c.updateProjectionMatrix();
      this.sun.shadow.mapSize.set(gfx.shadowMap, gfx.shadowMap);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
      this.sun.shadow.radius = gfx.shadowMap > 2048 ? 3 : 1;
      this.sun.shadow.bias = -0.0008;
      this.sun.shadow.normalBias = 0.05;
      this.markShadows(this.scene);
      this.world.ground.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
    }
    if (was === on) return;
    // the materials are built again with (or without) shadows
    this.scene.traverse((o) => {
      if (!o.material) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.needsUpdate = true;
    });
  }

  markShadows(root) {
    root.traverse((o) => {
      if (!o.isMesh || !o.material || o.material.transparent || !o.material.isMeshLambertMaterial) return;
      const g = o.geometry && o.geometry.type;
      const flat = g === 'CircleGeometry' || g === 'RingGeometry' || g === 'PlaneGeometry';
      o.castShadow = !flat;
      o.receiveShadow = true;
    });
  }

  // The music follows what happens: enemies hunting the player (combat), a
  // boss (boss), the Abyss, or calm travel. Checked twice a second; a fight
  // keeps its music a few seconds after the last enemy gave up.
  updateMusic(dt, zi) {
    this.musicT = (this.musicT || 0) - dt;
    if (this.musicT > 0) return;
    this.musicT = 0.5;
    const P = this.player, E = this.enemies;
    if (P.dead) { setMood('calm'); return; }
    let fight = false, boss = false;
    for (let i = 0; i < E.count; i++) {
      if (!E.alive[i]) continue;
      const st = E.state[i];
      if (st !== ST_CHASE && st !== ST_WINDUP && st !== ST_CHARGE) continue;
      const dx = E.x[i] - P.x, dz = E.z[i] - P.z;
      if (dx * dx + dz * dz > 32 * 32) continue;
      fight = true;
      if (E.tier[i] === 3) boss = true;
    }
    const bi = this.gates.bossIndex();
    if (bi >= 0 && E.alive[bi]) boss = true;
    this.fightHold = fight ? 6 : Math.max(0, (this.fightHold || 0) - 0.5);
    this.bossHold = boss ? 4 : Math.max(0, (this.bossHold || 0) - 0.5);
    if (this.bossHold > 0) setMood('boss');
    else if (this.fightHold > 0) setMood('combat');
    else if (this.abyss.on) setMood('abyss');
    else if (P.inCamp) setMood('camp');
    else setMood('explore', zi); // every zone has its own tune
  }

  // the sun (and its shadow area) moves with the player
  updateSun() {
    if (!gfx.realShadows) return;
    const P = this.player;
    this.sun.position.set(P.x - 14, 28, P.z + 12);
    this.sun.target.position.set(P.x, 0, P.z);
    this.sun.target.updateMatrixWorld();
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
      // how each weapon is shown: blast and slam as a circle at a distance,
      // thrust as a line, the chain bolt as its cone
      const shape = { blast: 'point', slam: 'point', thrust: 'line', chain: 'arc' }[w.shape] || w.shape;
      this.aim.show(shape, P.x, P.z, st.x, st.z, w.shape === 'slam' ? 1 : st.power, w.range, w.arcDeg || w.coneDeg, w.width,
        shape === 'circle' ? w.range : w.radius);
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
      this.gates.press();
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
    let c = A.chance[souls.tier[i]] * Math.pow(A.rankFalloff, ranks) + P.stats.int * CONFIG.progression.stats.int.arise;
    if (souls.gate[i] && souls.tier[i] === 3) c *= CONFIG.gates.bossAriseFactor; // gate bosses are a bit harder to raise
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
    this.quests.add('arise');
    this.profile.raised++;
    play('arise');
    this.effects.burst(u.x, 0.2, u.z, 22, this.appearance.aura, 6, 0.24, 0.8);
    this.effects.ring(u.x, u.z, 0.5, 4, this.appearance.aura, 0.55);
    this.effects.ring(u.x, u.z, 3.5, 0.3, 0xffffff, 0.5, 0.05);
    this.hud.armyNote(t('toast.joinsArmy', { name: army.name(u) }), 'good');
  }

  // XP bonus of the running kill streak (0 = none)
  streakBonus() {
    let b = 0;
    for (const [n, v] of CONFIG.streak.tiers) if (this.streak >= n) b = v;
    return b;
  }

  setPaused(paused) {
    this.paused = paused;
    duckMusic(paused);
    this.last = 0;
    resetInput();
  }

  // src: -1 = killed by the player, otherwise the slot of the shadow
  onEnemyKilled(i, src) {
    this.kills++;
    if (src < 0) this.profile.hunterKills++; else this.profile.armyKills++;
    const E = this.enemies;
    if (E.tier[i] === 3) this.profile.bossKills++; else if (E.tier[i] >= 1) this.profile.eliteKills++;
    const xp = E.xpv[i], tier = E.tier[i], zi = E.zone[i];
    if (tier === 3) sting('victory'); // a boss falls
    this.bestiary.add(E.type[i]);
    this.quests.kill(E.types[E.type[i]].id, zi, tier);
    const level = E.lvl[i] + tierLevels(zi, tier);
    this.souls.spawn(E.x[i], E.z[i], E.type[i], tier, zi, level, E.arena[i] > 0, E.lvl[i]);
    this.army.grantXp(src, xp);
    // kill streak of the hunter: more XP the longer it runs
    let bonus = 0;
    if (src < 0) {
      const S = CONFIG.streak;
      this.streak = this.streakT > 0 ? this.streak + 1 : 1;
      this.streakT = S.window;
      bonus = this.streakBonus();
      const st = S.tiers.find((x) => x[0] === this.streak);
      if (st) this.hud.toast(t('streak.milestone', { n: st[0], pct: Math.round(st[1] * 100) }));
      play(tier >= 2 ? 'killBig' : 'kill', this.streak);
    }
    // enemies above your level: more XP, but less than their power (progression.xpAbove)
    const over = enemyPower(E.lvl[i]) / enemyPower(this.player.level);
    let hxp = over > 1 ? xp * Math.pow(over, CONFIG.progression.xpAbove - 1) : xp;
    if (this.xpBoostT > 0) hxp *= CONFIG.quests.xpBoost.mult; // Double XP Token
    // kills of the army count only partly for the hunter
    this.player.addXp(src < 0 ? hxp * (1 + bonus) * this.path.mult('selfXp') : hxp * CONFIG.progression.armyKillXp * (this.path.rule('armyKillXp') || 1));
    // Path rule of the Soul Mage: kills (also by shadows) give mana back
    const km = this.path.rule('killMana');
    if (km && !this.player.dead) this.player.mana = Math.min(this.player.maxMana, this.player.mana + this.player.maxMana * km);
    if (src < 0) this.player.onKill();
    // Volatile: enemies in gates explode when they die
    const ex = this.modOn('explode');
    if (ex && E.arena[i] && tier < 3) this.hazards.add(E.x[i], E.z[i], ex.radius, ex.delay, E.dmg[i] * ex.damage, 0xff6030);
    // trait "volatile": this kind of monster always explodes
    else if (tier < 3 && E.types[E.type[i]].trait === 'volatile') {
      const V = CONFIG.traits.volatile;
      this.hazards.add(E.x[i], E.z[i], V.radius * (E.kid[i] ? 0.7 : 1) * (1 + tier * 0.2), V.delay, E.dmg[i] * V.damage, 0xff6030);
    }
    const gate = E.arena[i] ? this.gates.list[E.arena[i] - 1] : null;
    if (gate && gate.abyss) this.abyss.onKill(i, tier);
    else if (tier === 3) this.gates.onBossKilled(E.arena[i] - 1, E.x[i], E.z[i]);
    else this.loot.enemyDrop(E.x[i], E.z[i], level, tier);
    if (i === this.hunts.i) this.hunts.onKill(i);
  }

  onPlayerRespawn() {
    this.profile.deaths++;
    if (this.gates.active >= 0) this.gates.leave(true);
    this.enemies.calmAll();
    this.cam.snap(this.player.x, this.player.z);
  }
}
