// Ties everything together: scene, world, player, enemies, input and the
// frame loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
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
import { Loot } from './entities/loot.js';
import { Menu } from './ui/menu.js';
import { skillDef } from './combat/skills.js';
import { t } from './strings.js';
import { Hud } from './ui/hud.js';
import { getRenderer, sizeRenderer, disposeScene } from './render/renderer.js';
import { setNextItemId, getNextItemId } from './core/items.js';
import { play } from './core/sfx.js';

const _v = new THREE.Vector3();

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
    this.defeatedGates = save ? [...(save.defeatedGates || [])] : []; // gate bosses (milestone 5)
    this.input = input; // handy for debugging
    this.running = false;
    this.paused = false;
    this.last = 0;
    this.kills = 0;
    this.zoneId = 'meadow';
    this.zoneRank = 'E';
    this.rankIndex = save ? save.rankIndex || 0 : 0; // player rank: 0 = E ... 5 = S
    this.appearance = { ...CONFIG.defaultAppearance, ...(save ? save.appearance : opts.appearance) };
    this.soulNear = -1; // soul in reach of the Arise button
    this.ariseCost = 0;

    this.renderer = getRenderer();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d0a16);
    this.scene.add(new THREE.HemisphereLight(0xb9c4ff, 0x2a2238, 1.5));
    const sun = new THREE.DirectionalLight(0xfff0d8, 1.9);
    sun.position.set(-6, 12, 5);
    this.scene.add(sun);

    this.cam = new FollowCamera();
    this.hud = new Hud(uiRoot, this);
    this.effects = new Effects(this.scene, this.cam.camera, this.hud.els.fx);
    this.world = new World(this.scene, this.seed);
    setNextItemId(save ? save.nextItemId || 1 : 1);
    this.player = new Player(this, this.appearance);
    this.enemies = new Enemies(this);
    this.army = new Army(this);
    this.souls = new Souls(this);
    this.projectiles = new Projectiles(this);
    this.zones = new Zones(this);
    this.loot = new Loot(this);
    this.menu = new Menu(uiRoot, this);
    this.aim = new AimIndicator(this.scene);

    if (save) {
      this.player.restore(save.player);
      this.army.restore(save.army);
      this.kills = save.kills || 0;
      setNextItemId(Math.max(save.nextItemId || 1, getNextItemId()));
    }
    this.wasInCamp = true;

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
      version: 1,
      name: this.name,
      seed: this.seed,
      created: this.created,
      updated: Date.now(),
      playTime: Math.round(this.playTime),
      rankIndex: this.rankIndex,
      defeatedGates: [...this.defeatedGates],
      kills: this.kills,
      appearance: { ...this.appearance },
      nextItemId: getNextItemId(),
      player: this.player.serialize(),
      army: this.army.serialize(),
    };
  }

  // Writes the world into its slot. Returns a promise (true = saved).
  save(manual = false) {
    this.saveT = 0;
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
    let dt = this.last ? (now - this.last) / 1000 : 0.016;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (this.paused || this.portrait || document.hidden) {
      // one-shot inputs must not pile up while the game stands still
      clearEvents();
      return;
    }
    this.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
  }

  update(dt) {
    const P = this.player;
    this.playTime += dt;
    this.saveT += dt;
    if (this.saveT >= CONFIG.save.autosaveInterval) this.save();
    if (P.inCamp && !this.wasInCamp) this.save(); // autosave when entering the camp
    this.wasInCamp = P.inCamp;
    this.resolveMouse();
    this.effects.beginFrame();
    P.update(dt);
    this.handleArmyInput();
    this.army.update(dt);
    this.enemies.update(dt);
    this.projectiles.update(dt);
    this.zones.update(dt);
    this.souls.update(dt);
    this.loot.update(dt);
    this.soulNear = P.dead ? -1 : this.souls.nearest(P.x, P.z, CONFIG.souls.ariseRange);
    if (this.soulNear >= 0) this.ariseCost = CONFIG.arise.cost[this.souls.tier[this.soulNear]];
    this.world.update(P.x, P.z, false);
    this.world.camp.update(dt);

    const zone = this.world.zoneAt(Math.sqrt(P.x * P.x + P.z * P.z));
    if (zone) { this.zoneId = zone.id; this.zoneRank = zone.rank; }

    this.updateAim();

    this.cam.update(dt, P.x, P.z);
    this.effects.update(dt);
    this.hud.update(dt);
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
    if (input.squadCycle >= 0) {
      army.cycleBehavior(input.squadCycle);
      input.squadCycle = -1;
    }
    if (input.reviveSquad >= 0) {
      const k = input.reviveSquad;
      input.reviveSquad = -1;
      if (!P.dead) {
        const sq = army.squads[k];
        if (sq.ready > 0 && army.reviveSquad(k) === 0) this.hud.toast(t('toast.noMana'));
      }
    }
  }

  tryArise() {
    const P = this.player, souls = this.souls, army = this.army;
    if (P.dead) return;
    const i = souls.nearest(P.x, P.z, CONFIG.souls.ariseRange);
    if (i < 0) return;
    const cost = CONFIG.arise.cost[souls.tier[i]];
    if (P.mana < cost) { this.hud.toast(t('toast.noMana')); return; }
    if (!army.hasRoom()) { this.hud.toast(t('toast.armyFull')); return; }
    const u = army.add(this.enemies.types[souls.type[i]].id, souls.tier[i], souls.x[i], souls.z[i]);
    if (!u) return;
    P.mana -= cost;
    souls.remove(i);
    play('arise');
    this.effects.burst(u.x, 0.2, u.z, 22, this.appearance.aura, 6, 0.24, 0.8);
    if (u.squad < 0) this.hud.toast(t('toast.toReserve', { name: army.name(u) }));
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
    const xp = E.types[E.type[i]].def.xp;
    const zone = this.world.zoneAt(Math.sqrt(E.x[i] * E.x[i] + E.z[i] * E.z[i]));
    this.souls.spawn(E.x[i], E.z[i], E.type[i], 0);
    this.army.grantXp(src, xp);
    this.player.addXp(xp);
    this.loot.enemyDrop(E.x[i], E.z[i], zone ? zone.level : 1, 0);
  }

  onPlayerRespawn() {
    this.enemies.calmAll();
    this.cam.snap(this.player.x, this.player.z);
  }
}
