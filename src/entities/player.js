// The player: movement, dodge, attack charges, health and respawn.
import { CONFIG } from '../config.js';
import { input } from '../input/input.js';
import { createPlayerModel } from '../render/models/player.js';
import { fireWeapon } from '../combat/weapons.js';

const ANIM = { moving: false, attack: 0, dodging: false, dead: false };

export class Player {
  constructor(game, appearance) {
    this.game = game;
    const c = CONFIG.player;
    this.x = 0;
    this.z = 5;
    this.dirX = 0; // facing
    this.dirZ = 1;
    this.radius = c.radius;
    this.maxHp = c.baseHp;
    this.hp = this.maxHp;
    this.speed = c.baseSpeed;
    this.weapon = c.startWeapon;

    this.charges = c.charges.max;
    this.maxCharges = c.charges.max;
    this.reloadT = 0; // 0..1 progress of the charge being reloaded
    this.atkCd = 0;
    this.attackAnim = 0;
    this.pendingFire = false;
    this.pendingAuto = false;
    this.pendingX = 0;
    this.pendingZ = 1;
    this.noAmmoFlash = 0;

    this.dodgeT = 0;
    this.dodgeCd = 0;
    this.dodgeX = 0;
    this.dodgeZ = 0;
    this.invuln = 0;

    this.dead = false;
    this.respawnT = 0;
    this.inCamp = true;
    this.moving = false;
    this.hurtFlash = 0;

    this.model = createPlayerModel(appearance);
    game.scene.add(this.model.root);
  }

  damage(amount) {
    if (this.dead || this.invuln > 0) return;
    this.hp -= amount;
    this.hurtFlash = 1;
    this.game.effects.number(this.x, 2.6, this.z, String(amount), 'hurt');
    this.game.effects.burst(this.x, 1.2, this.z, 5, 0xff4a5a, 4, 0.14, 0.35);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.respawnT = CONFIG.player.respawnDelay;
      this.game.effects.burst(this.x, 1.2, this.z, 24, 0x8a4dff, 6, 0.22, 0.8);
    }
  }

  respawn() {
    this.dead = false;
    this.x = 0;
    this.z = 5;
    this.dirX = 0;
    this.dirZ = 1;
    this.hp = this.maxHp;
    this.charges = this.maxCharges;
    this.reloadT = 0;
    this.invuln = 1;
    this.pendingFire = false;
    this.game.onPlayerRespawn();
  }

  update(dt) {
    const c = CONFIG.player;
    const game = this.game;
    if (this.hurtFlash > 0) this.hurtFlash -= dt * 2.5;
    if (this.noAmmoFlash > 0) this.noAmmoFlash -= dt;

    if (this.dead) {
      input.fire = input.dodge = false;
      this.moving = false;
      this.respawnT -= dt;
      if (this.respawnT <= 0) this.respawn();
      this.sync(dt);
      return;
    }

    if (this.atkCd > 0) this.atkCd -= dt;
    if (this.attackAnim > 0) this.attackAnim -= dt * 4.5;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dodgeCd > 0) this.dodgeCd -= dt;

    // ---- movement
    let mx = input.touchX + input.keyX, mz = input.touchZ + input.keyZ;
    const ml = Math.sqrt(mx * mx + mz * mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    this.moving = ml > 0.01;

    if (input.dodge) {
      input.dodge = false;
      if (this.dodgeCd <= 0 && this.dodgeT <= 0) {
        if (this.moving) { this.dodgeX = mx / Math.min(ml, 1); this.dodgeZ = mz / Math.min(ml, 1); }
        else { this.dodgeX = this.dirX; this.dodgeZ = this.dirZ; }
        this.dirX = this.dodgeX;
        this.dirZ = this.dodgeZ;
        this.dodgeT = c.dodge.duration;
        this.dodgeCd = c.dodge.cooldown;
        this.invuln = Math.max(this.invuln, c.dodge.invuln);
        game.effects.burst(this.x, 0.6, this.z, 10, 0x8a4dff, 3, 0.2, 0.4);
      }
    }

    let nx = this.x, nz = this.z;
    if (this.dodgeT > 0) {
      const step = Math.min(dt, this.dodgeT);
      const v = c.dodge.distance / c.dodge.duration;
      nx += this.dodgeX * v * step;
      nz += this.dodgeZ * v * step;
      this.dodgeT -= dt;
      this.moving = true;
    } else if (this.moving) {
      nx += mx * this.speed * dt;
      nz += mz * this.speed * dt;
    }

    // world edge and obstacles
    const lim = game.world.radius - 1.5;
    const r2 = nx * nx + nz * nz;
    if (r2 > lim * lim) { const k = lim / Math.sqrt(r2); nx *= k; nz *= k; }
    game.world.resolve(nx, nz, this.radius);
    this.x = game.world.rx;
    this.z = game.world.rz;
    const cr = game.world.campRadius;
    this.inCamp = this.x * this.x + this.z * this.z < cr * cr;

    // ---- charges reload one after another
    if (this.charges < this.maxCharges) {
      this.reloadT += dt / c.charges.reload;
      if (this.reloadT >= 1) { this.charges++; this.reloadT = this.charges < this.maxCharges ? this.reloadT - 1 : 0; }
    }

    // ---- attack
    if (input.fire) {
      input.fire = false;
      this.pendingFire = true;
      this.pendingAuto = input.fireAuto;
      this.pendingX = input.fireX;
      this.pendingZ = input.fireZ;
    }
    if (this.pendingFire) {
      if (this.charges <= 0) {
        this.pendingFire = false;
        this.noAmmoFlash = 0.3;
      } else if (this.atkCd <= 0 && this.dodgeT <= 0) {
        this.pendingFire = false;
        this.attack();
      }
    }

    // ---- facing
    if (input.aiming) { this.dirX = input.aimX; this.dirZ = input.aimZ; }
    else if (this.attackAnim <= 0 && this.dodgeT <= 0 && ml > 0.01) { this.dirX = mx / ml; this.dirZ = mz / ml; }

    // ---- camp heals
    if (this.inCamp && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + c.campRegenPerSec * dt);
    }

    this.sync(dt);
  }

  attack() {
    const game = this.game;
    const w = CONFIG.weapons[this.weapon];
    let dx = this.pendingX, dz = this.pendingZ;
    if (this.pendingAuto) {
      const i = game.enemies.nearest(this.x, this.z, w.range + CONFIG.player.autoAimExtraRange);
      if (i >= 0) {
        dx = game.enemies.x[i] - this.x;
        dz = game.enemies.z[i] - this.z;
        const d = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= d; dz /= d;
      } else {
        dx = this.dirX; dz = this.dirZ;
      }
    }
    this.dirX = dx;
    this.dirZ = dz;
    this.charges--;
    this.atkCd = w.cooldown;
    this.attackAnim = 1;
    fireWeapon(game, this.weapon, dx, dz);
  }

  sync(dt) {
    const root = this.model.root;
    root.position.set(this.x, 0, this.z);
    // turn smoothly towards the facing direction
    const target = Math.atan2(this.dirX, this.dirZ);
    let diff = target - root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    root.rotation.y += diff * Math.min(1, dt * 22);
    ANIM.moving = this.moving;
    ANIM.attack = this.attackAnim > 0 ? this.attackAnim : 0;
    ANIM.dodging = this.dodgeT > 0;
    ANIM.dead = this.dead;
    this.model.animate(dt, ANIM);
    this.game.effects.blob(this.x, this.z, 0.75);
  }
}
