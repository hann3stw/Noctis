// Ties everything together: scene, world, player, enemies, input and the
// frame loop.
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { input } from './input/input.js';
import { initTouch } from './input/touch.js';
import { initKeyboard } from './input/keyboard.js';
import { FollowCamera } from './render/camera.js';
import { Effects } from './render/effects.js';
import { AimIndicator } from './render/aim.js';
import { World } from './world/world.js';
import { Player } from './entities/player.js';
import { Enemies } from './entities/enemies.js';
import { Hud } from './ui/hud.js';

const _v = new THREE.Vector3();

export class Game {
  constructor(canvas, uiRoot, opts) {
    this.seed = opts.seed;
    this.canvas = canvas;
    this.running = false;
    this.paused = false;
    this.last = 0;
    this.kills = 0;
    this.zoneId = 'meadow';
    this.zoneRank = 'E';

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
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
    this.player = new Player(this, opts.appearance || CONFIG.defaultAppearance);
    this.enemies = new Enemies(this);
    this.aim = new AimIndicator(this.scene);

    initTouch(this.hud.els);
    initKeyboard();
    this.hud.showFps = !!opts.showFps;
    this.hud.fpsEl.style.display = opts.showFps ? '' : 'none';

    this.resize = this.resize.bind(this);
    this.frame = this.frame.bind(this);
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
    document.addEventListener('visibilitychange', () => { this.last = 0; });
    this.resize();

    this.world.update(this.player.x, this.player.z, true);
    this.cam.snap(this.player.x, this.player.z);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.graphics.maxPixelRatio));
    this.renderer.setSize(w, h, false);
    this.cam.resize(w, h);
    this.effects.resize(w, h);
    // the rotate notice is shown by CSS; the game pauses while it is visible
    this.portrait = getComputedStyle(this.hud.rotate).display !== 'none';
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
    if (this.paused || this.portrait || document.hidden) return;
    this.update(dt);
    this.renderer.render(this.scene, this.cam.camera);
  }

  update(dt) {
    const P = this.player;
    this.resolveMouse();
    this.effects.beginFrame();
    P.update(dt);
    this.enemies.update(dt);
    this.world.update(P.x, P.z, false);
    this.world.camp.update(dt);

    const zone = this.world.zoneAt(Math.sqrt(P.x * P.x + P.z * P.z));
    if (zone) { this.zoneId = zone.id; this.zoneRank = zone.rank; }

    const w = CONFIG.weapons[P.weapon];
    if (input.aiming && !P.dead) {
      this.aim.setWeapon(w);
      this.aim.show(P.x, P.z, input.aimX, input.aimZ);
    } else {
      this.aim.hide();
    }

    this.cam.update(dt, P.x, P.z);
    this.effects.update(dt);
    this.hud.update(dt);
  }

  // Mouse aiming for PC testing: hold the left button to aim, release to fire.
  resolveMouse() {
    if (!input.mouseDown && !input.mouseReleased) return;
    const P = this.player, cam = this.cam.camera;
    _v.set((input.mouseX / window.innerWidth) * 2 - 1, -(input.mouseY / window.innerHeight) * 2 + 1, 0.5);
    _v.unproject(cam).sub(cam.position);
    const k = -cam.position.y / _v.y;
    let dx = cam.position.x + _v.x * k - P.x, dz = cam.position.z + _v.z * k - P.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 0.01) { dx /= d; dz /= d; } else { dx = P.dirX; dz = P.dirZ; }
    input.aiming = input.mouseDown;
    input.aimX = dx;
    input.aimZ = dz;
    if (input.mouseReleased) {
      input.mouseReleased = false;
      input.fire = true;
      input.fireAuto = false;
      input.fireX = dx;
      input.fireZ = dz;
    }
  }

  onEnemyKilled() {
    this.kills++;
  }

  onPlayerRespawn() {
    this.enemies.calmAll();
    this.cam.snap(this.player.x, this.player.z);
  }
}
