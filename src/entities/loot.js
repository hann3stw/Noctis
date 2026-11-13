// Loot: treasure chests placed by the world seed and item pickups lying on
// the ground. Walking into a chest opens it, walking over a pickup takes it.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { mulberry32, hashSeed } from '../core/rng.js';
import { box, merge, flatMaterial } from '../render/geo.js';
import { rollLoot, RARITY_COLORS } from '../core/items.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

const MAX_PICKUPS = 32;
const _c = new THREE.Color();

function chestGeometry() {
  const wood = 0x6b4526, band = 0xd9a441, dark = 0x3a2412;
  return merge([
    box(1.3, 0.7, 0.9, wood, 0, 0.35, 0),
    box(1.36, 0.3, 0.96, dark, 0, 0.85, 0),
    box(0.16, 1.02, 0.98, band, 0.42, 0.51, 0),
    box(0.16, 1.02, 0.98, band, -0.42, 0.51, 0),
    box(0.22, 0.26, 0.1, band, 0, 0.62, 0.48),
  ]);
}

export class Loot {
  constructor(game) {
    this.game = game;
    this.time = 0;
    this.fullT = 0;

    // ---- pickups
    this.items = new Array(MAX_PICKUPS).fill(null);
    this.px = new Float32Array(MAX_PICKUPS);
    this.pz = new Float32Array(MAX_PICKUPS);
    this.pAge = new Float32Array(MAX_PICKUPS);
    this.pickMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshBasicMaterial(), MAX_PICKUPS);
    this.pickMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pickMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_PICKUPS * 3).fill(1), 3);
    this.pickMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    this.pickMesh.frustumCulled = false;
    this.pickMesh.count = 0;
    const a = this.pickMesh.instanceMatrix.array;
    for (let i = 0; i < MAX_PICKUPS; i++) a[i * 16 + 15] = 1;
    game.scene.add(this.pickMesh);

    // ---- chests, placed by the world seed
    const C = CONFIG.loot.chest;
    const rng = mulberry32(hashSeed(game.seed, 303, 404));
    const xs = [], zs = [], levels = [];
    const world = game.world;
    for (const zone of CONFIG.world.zones) {
      let placed = 0, tries = 0;
      while (placed < zone.chests && tries++ < zone.chests * 40) {
        const rIn = zone.inner + 10, rOut = zone.outer - 6;
        const r = Math.sqrt(rIn * rIn + rng() * (rOut * rOut - rIn * rIn));
        const ang = rng() * Math.PI * 2;
        const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
        if (world.nearSafe(x, z, 4) || world.nearGate(x, z, 10)) continue;
        let ok = true;
        for (let k = 0; k < xs.length; k++) {
          const dx = xs[k] - x, dz = zs[k] - z;
          if (dx * dx + dz * dz < 400) { ok = false; break; }
        }
        if (!ok) continue;
        xs.push(x); zs.push(z); levels.push(zone.level);
        placed++;
      }
    }
    this.chestCount = xs.length;
    this.cx = Float32Array.from(xs);
    this.cz = Float32Array.from(zs);
    this.cLevel = Uint8Array.from(levels);
    this.cYaw = new Float32Array(this.chestCount);
    this.cT = new Float32Array(this.chestCount); // > 0: opened, seconds until it is back
    for (let i = 0; i < this.chestCount; i++) this.cYaw[i] = rng() * 6.28;
    this.chestMesh = new THREE.InstancedMesh(chestGeometry(), flatMaterial, Math.max(1, this.chestCount));
    this.chestMesh.frustumCulled = false;
    game.scene.add(this.chestMesh);
    this.chestDirty = true;
  }

  // ---- drops ------------------------------------------------------------------
  drop(x, z, item) {
    let slot = -1;
    for (let i = 0; i < MAX_PICKUPS; i++) if (!this.items[i]) { slot = i; break; }
    if (slot < 0) slot = 0; // pool full: the oldest slot is replaced
    this.items[slot] = item;
    this.px[slot] = x;
    this.pz[slot] = z;
    this.pAge[slot] = 0;
  }

  // loot of a defeated enemy; tier 0 = normal ... 3 = boss
  enemyDrop(x, z, level, tier) {
    const P = this.game.player;
    if (Math.random() > CONFIG.loot.dropChance[tier] * (1 + P.drop)) return;
    const n = tier === 2 ? 2 : 1;
    for (let k = 0; k < n; k++) {
      this.drop(x + k * 1.5, z, rollLoot(level, P.drop + tier * 0.6, P.known, tier > 0 ? 1 : 0));
    }
  }

  openChest(i) {
    const C = CONFIG.loot.chest, P = this.game.player;
    this.cT[i] = C.respawn;
    this.chestDirty = true;
    const n = C.items[0] + ((Math.random() * (C.items[1] - C.items[0] + 1)) | 0);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * 6.28;
      this.drop(this.cx[i] + Math.cos(a) * 1.6, this.cz[i] + Math.sin(a) * 1.6, rollLoot(this.cLevel[i], P.drop + 0.4, P.known));
    }
    this.game.effects.burst(this.cx[i], 0.8, this.cz[i], 24, 0xffd24a, 6, 0.2, 0.7);
    play('chest');
  }

  update(dt) {
    const game = this.game, P = game.player;
    this.time += dt;
    if (this.fullT > 0) this.fullT -= dt;

    // ---- chests
    const open2 = CONFIG.loot.chest.openRange * CONFIG.loot.chest.openRange;
    for (let i = 0; i < this.chestCount; i++) {
      if (this.cT[i] > 0) {
        this.cT[i] -= dt;
        if (this.cT[i] <= 0) this.chestDirty = true;
        continue;
      }
      if (P.dead) continue;
      const dx = this.cx[i] - P.x, dz = this.cz[i] - P.z;
      if (dx * dx + dz * dz < open2) this.openChest(i);
    }
    if (this.chestDirty) {
      this.chestDirty = false;
      const a = this.chestMesh.instanceMatrix.array;
      let n = 0;
      for (let i = 0; i < this.chestCount; i++) {
        if (this.cT[i] > 0) continue;
        const o = n++ * 16, sin = Math.sin(this.cYaw[i]), cos = Math.cos(this.cYaw[i]);
        a.fill(0, o, o + 16);
        a[o] = cos; a[o + 2] = -sin; a[o + 5] = 1; a[o + 8] = sin; a[o + 10] = cos;
        a[o + 12] = this.cx[i]; a[o + 14] = this.cz[i]; a[o + 15] = 1;
      }
      this.chestMesh.count = n;
      this.chestMesh.instanceMatrix.needsUpdate = true;
    }

    // ---- pickups
    const a = this.pickMesh.instanceMatrix.array, col = this.pickMesh.instanceColor.array;
    const range2 = CONFIG.loot.pickupRange * CONFIG.loot.pickupRange;
    let n = 0;
    for (let i = 0; i < MAX_PICKUPS; i++) {
      const item = this.items[i];
      if (!item) continue;
      this.pAge[i] += dt;
      const dx = this.px[i] - P.x, dz = this.pz[i] - P.z;
      if (!P.dead && this.pAge[i] > 0.4 && dx * dx + dz * dz < range2) {
        if (P.addItem(item)) {
          game.effects.burst(this.px[i], 1, this.pz[i], 10, RARITY_COLORS[item.rarity], 4, 0.16, 0.5);
          play('pickup');
          this.items[i] = null;
          continue;
        }
        if (this.fullT <= 0) { this.fullT = 3; game.hud.toast(t('toast.bagFull')); }
      }
      const o = n * 16;
      const yaw = this.time * 2 + i, sin = Math.sin(yaw), cos = Math.cos(yaw);
      const s = Math.min(1, this.pAge[i] * 4) * (item.kind === 'skill' ? 1.25 : 0.85 + item.rarity * 0.12);
      a[o] = cos * s; a[o + 2] = -sin * s;
      a[o + 5] = s * 1.3;
      a[o + 8] = sin * s; a[o + 10] = cos * s;
      a[o + 12] = this.px[i]; a[o + 13] = 0.9 + Math.sin(this.time * 3 + i) * 0.18; a[o + 14] = this.pz[i];
      _c.setHex(item.kind === 'skill' ? 0x7df0ff : RARITY_COLORS[item.rarity]);
      col[n * 3] = _c.r; col[n * 3 + 1] = _c.g; col[n * 3 + 2] = _c.b;
      n++;
    }
    this.pickMesh.count = n;
    this.pickMesh.instanceMatrix.needsUpdate = true;
    this.pickMesh.instanceColor.needsUpdate = true;
  }
}
