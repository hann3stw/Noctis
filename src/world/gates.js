// Gates: one per zone. Entering a gate takes the player (and the deployed
// shadows) into an enclosed arena far outside the world, where the zone's
// boss waits. Beating a boss for the first time raises the hunter's rank.
// The boss brain (attack patterns) lives here too.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { flatMaterial } from '../render/geo.js';
import { gateFrameGeometry, arenaPillarGeometry } from '../render/models/props.js';
import { ST_IDLE, ST_CHASE, ST_WINDUP, ST_CHARGE } from '../entities/enemies.js';
import { rollLoot } from '../core/items.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

export const RANKS = 'EDCBAS';
const PAUSE = 0, WINDUP = 1, CHARGE = 2;

// arenas lie far outside the world, one per gate
export function arenaCenter(i) {
  return { x: 2400 + i * 220, z: 2400 };
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
  constructor(game) {
    this.game = game;
    this.list = game.world.gates; // { zone, x, z }
    this.active = -1; // gate whose arena the player is in
    this.near = -1; // gate in reach of the Enter button
    this.cx = 0; // result of clamp()
    this.cz = 0;
    this.returnX = 0;
    this.returnZ = 0;
    this.exitOpen = false;
    this.time = 0;
    this.b = { state: PAUSE, t: 0, pattern: '', last: '', cdx: 0, cdz: 0, bite: 0, hitP: false, hitS: new Set() };

    // gates in the world
    const frameGeo = gateFrameGeometry();
    this.portals = this.list.map((g) => {
      const zone = CONFIG.world.zones[g.zone];
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(frameGeo, flatMaterial));
      const portal = portalMesh(zone.gateColor, 1.9, 2.4);
      portal.position.y = 2.55;
      const core = portalMesh(0xffffff, 1.0, 1.4);
      core.material.opacity = 0.35;
      core.position.set(0, 2.55, 0.02);
      grp.add(portal, core);
      grp.position.set(g.x, 0, g.z);
      grp.rotation.y = Math.atan2(-g.x, -g.z); // faces the camp
      game.scene.add(grp);
      return { grp, portal, core };
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

  // ---- arena ---------------------------------------------------------------------
  buildArena(gi) {
    if (this.arenas[gi]) return this.arenas[gi];
    const zone = CONFIG.world.zones[gi];
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

  enter(gi) {
    const game = this.game, P = game.player, E = game.enemies;
    if (this.active >= 0 || P.dead || gi < 0) return;
    const g = this.list[gi], c = arenaCenter(gi), R = CONFIG.gates.arenaRadius;
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
    for (const a of E.arenaAdds[gi]) E.vanish(a);
    const b = E.arenaBoss[gi];
    E.place(b, c.x, c.z - 3);
    E.packAggro[E.pack[b]] = 1;
    E.state[b] = ST_CHASE;
    E.yaw[b] = 0;
    const br = this.b;
    br.state = PAUSE;
    br.t = 2.5; // a moment to get ready
    br.bite = 0;
    br.last = '';
    br.pattern = '';

    game.shots.clear();
    game.hazards.clear();
    P.x = c.x;
    P.z = c.z + R - 7;
    P.dirX = 0;
    P.dirZ = -1;
    game.army.relocate(P.x, P.z);
    game.cam.snap(P.x, P.z);
    game.world.update(P.x, P.z, true);
    game.hud.toast(t('gate.entered', { boss: t('enemy.' + CONFIG.world.zones[gi].boss) }));
    play('arise');
  }

  // victory: walked through the exit; toCamp: died and respawned in the camp
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
    if (!toCamp) {
      P.x = this.returnX;
      P.z = this.returnZ;
      game.cam.snap(P.x, P.z);
      game.world.update(P.x, P.z, true);
    }
    game.army.relocate(P.x, P.z);
    game.save();
  }

  onBossKilled(gi, x, z) {
    const game = this.game, P = game.player, E = game.enemies, G = CONFIG.gates;
    const zone = CONFIG.world.zones[gi];
    for (let k = 0; k < G.rewardItems; k++) {
      const a = (k / G.rewardItems) * Math.PI * 2;
      game.loot.drop(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5, rollLoot(zone.level, P.drop + 1.5, P.known, G.rewardMinRarity));
    }
    // the helpers fade away
    for (const a of E.arenaAdds[gi]) {
      if (!E.alive[a]) continue;
      game.effects.burst(E.x[a], 1, E.z[a], 10, 0x6a4dbf, 4, 0.2, 0.5);
      E.vanish(a);
    }
    game.shots.clear();
    game.hazards.clear();
    if (!game.defeatedGates.includes(zone.id)) {
      game.defeatedGates.push(zone.id);
      const before = game.rankIndex;
      game.rankIndex = Math.min(RANKS.length - 1, game.defeatedGates.length);
      if (game.rankIndex > before) {
        game.army.rebuild();
        game.hud.banner(t('toast.rankUp', { rank: RANKS[game.rankIndex] }), t('toast.rankUpSub', { n: CONFIG.shadows.slotsPerRank }));
      } else {
        game.hud.banner(t('toast.gateCleared'), t('enemy.' + zone.boss));
      }
    } else {
      game.hud.banner(t('toast.gateCleared'), t('enemy.' + zone.boss));
    }
    this.exitOpen = true;
    this.exit.visible = true;
    game.effects.burst(x, 2, z, 60, zone.gateColor, 10, 0.3, 1.2);
    play('levelup');
    game.save();
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
    if (this.active < 0) {
      this.near = -1;
      if (P.dead) return;
      const r2 = CONFIG.gates.enterRange * CONFIG.gates.enterRange;
      for (let i = 0; i < this.list.length; i++) {
        const dx = this.list[i].x - P.x, dz = this.list[i].z - P.z;
        if (dx * dx + dz * dz < r2) { this.near = i; break; }
      }
    } else if (this.exitOpen && !P.dead) {
      this.exitPortal.scale.set(1.9 * pulse, 2.4 * pulse, 1);
      const dx = this.exit.position.x - P.x, dz = this.exit.position.z - P.z;
      if (dx * dx + dz * dz < CONFIG.gates.exitRange * CONFIG.gates.exitRange) this.leave(false);
    }
  }

  // ---- boss brain -----------------------------------------------------------------
  // Called by Enemies.update for the boss. Writes the wanted movement into
  // enemies.mvx / mvz / mvs and sets the enemy state for the telegraph tint.
  think(i, dt, dx, dz, dist, tg, targetable) {
    const game = this.game, E = game.enemies, b = this.b;
    const def = E.types[E.type[i]].def, B = CONFIG.boss, BP = CONFIG.bossPatterns;
    E.mvx = E.mvz = E.mvs = 0;
    if (!targetable) { E.state[i] = ST_IDLE; return; }
    const enraged = E.hp[i] < E.maxHp[i] * B.enrageAt;
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
    } else {
      // charging
      b.t -= dt;
      E.state[i] = ST_CHARGE;
      E.mvx = b.cdx; E.mvz = b.cdz; E.mvs = BP.charge.speed;
      this.chargeHits(i, E.dmg[i] * BP.charge.damage);
      if (b.t <= 0) this.endPattern(enraged);
    }
  }

  startPattern(i, def, dx, dz, dist, BP) {
    const game = this.game, E = game.enemies, b = this.b;
    const gi = E.arena[i] - 1;
    let addsAlive = 0;
    for (const a of E.arenaAdds[gi]) if (E.alive[a]) addsAlive++;
    const options = def.patterns.filter((p) => p !== b.last && (p !== 'summon' || addsAlive < BP.summon.maxAdds - 1));
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
    }
  }

  act(i, def, dx, dz, dist, BP, enraged) {
    const game = this.game, E = game.enemies, b = this.b;
    const dmg = E.dmg[i], bx = E.x[i], bz = E.z[i];
    const color = CONFIG.world.zones[E.arena[i] - 1].gateColor;
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
        if (E.alive[a] || n >= BP.summon.count) continue;
        const ang = Math.random() * Math.PI * 2;
        this.clamp(bx + Math.cos(ang) * 4, bz + Math.sin(ang) * 4, 1);
        E.place(a, this.cx, this.cz);
        E.packAggro[E.pack[a]] = 1;
        E.state[a] = ST_CHASE;
        game.effects.burst(this.cx, 0.5, this.cz, 14, color, 4, 0.22, 0.6);
        n++;
      }
    }
    // slam and eruption do their damage through the hazards
    this.endPattern(enraged);
  }

  endPattern(enraged) {
    const b = this.b;
    b.state = PAUSE;
    b.t = CONFIG.boss.pause * (enraged ? 0.65 : 1) + Math.random() * 0.5;
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
