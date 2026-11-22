// Co-op gates for up to four hunters. One hunter hosts: the host's game runs the gate (the monsters, the boss,
// their attacks), the others see it through a stream of snapshots, move and fight in their own game and tell the
// host what they hit. Everybody keeps their own world, save, loot and XP; nothing of the co-op is saved.
//
//  lobby : Pause > Co-op. The host gets a 5 character code, the others type it in. The host walks to a gate and
//          presses Enter: everybody who is in the lobby enters the same gate (stages, boss, rewards like alone).
//  host  : runs gates.js / enemies.js as always, sends a snapshot of the arena 10 times a second, takes hits that
//          the others report, sends enemy attacks that hit the others ('d'), mirrors shots and ground attacks ('hz').
//  guest : the arena is built from the same gate number (the arenas lie at the same place in every world); the
//          monsters come from the snapshots (enemies.updateRemote); a hit on a monster is reported to the host.
// The Necromancer's army and the Ranger's companion stay out of co-op gates (too much to send).
import { Channel } from './realtime.js';
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { createPlayerModel } from '../render/models/player.js';
import { arenaCenter } from '../world/gates.js';

const SEND_P = 1 / 12; // seconds between two position messages
const SEND_S = 1 / 10; // between two snapshots of the host
const STALE = 6; // seconds without a snapshot: the host is gone
const MAX_PLAYERS = 4;

const rnd = (n) => Math.round(n * 100) / 100;
const makeCode = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[(Math.random() * a.length) | 0];
  return s;
};

export class Coop {
  constructor(game) {
    this.game = game;
    this.me = Math.random().toString(36).slice(2, 10); // one per tab: two tabs of one browser are two players
    this.role = ''; // '' | 'host' | 'guest'
    this.code = '';
    this.phase = 'off'; // off | lobby | run
    this.ch = null;
    this.peers = new Map(); // id -> { id, name, cls, level, look, wp, x, z, yaw, hp, mhp, mv, at, dead, model, seen, inGate, tx, tz }
    this.targets = []; // host: the hunters the monsters can attack (alive, in the gate)
    this.pickD2 = 0;
    this.sendP = 0;
    this.sendS = 0;
    this.helloT = 0;
    this.lastSnap = 0;
    this.status = ''; // text for the panel
    this.listeners = new Set(); // the panel redraws when something changes
    this.stageInfo = null;
  }

  get hosting() { return this.role === 'host' && this.phase === 'run'; }
  get guest() { return this.role === 'guest' && this.phase === 'run'; }
  get active() { return this.phase === 'run'; }
  get inLobby() { return this.phase !== 'off'; }
  get lobbyHost() { return this.role === 'host' && this.phase === 'lobby'; }

  changed() { for (const f of this.listeners) f(); }

  // ---- lobby ---------------------------------------------------------------------
  async host() {
    if (this.phase !== 'off') return false;
    this.code = makeCode();
    return this.connect('host');
  }

  async join(code) {
    if (this.phase !== 'off') return false;
    this.code = String(code || '').trim().toUpperCase();
    if (this.code.length !== 5) { this.status = t('coop.badCode'); this.changed(); return false; }
    return this.connect('guest');
  }

  async connect(role) {
    this.role = role;
    this.phase = 'lobby';
    this.status = t('coop.connecting');
    this.changed();
    this.ch = new Channel('coop-' + this.code, (m) => this.onMsg(m), (s) => { if (s === 'closed') this.onClosed(); });
    const ok = await this.ch.join();
    if (!ok) {
      this.reset();
      this.status = t('coop.offline');
      this.changed();
      return false;
    }
    this.status = '';
    this.hello();
    this.changed();
    return true;
  }

  onClosed() {
    if (this.phase === 'off') return;
    if (this.phase === 'run') this.abort(t('coop.lost'));
    this.reset();
    this.status = t('coop.lost');
    this.changed();
  }

  // everything back to normal (the connection closed, or the player left)
  reset() {
    if (this.ch) { this.ch.close(); this.ch = null; }
    for (const p of this.peers.values()) this.dropModel(p);
    this.peers.clear();
    this.targets = [];
    this.role = '';
    this.code = '';
    this.phase = 'off';
    this.stageInfo = null;
  }

  // the player leaves the co-op (button, or the end of the gate)
  quit() {
    if (this.phase === 'off') return;
    this.say({ t: 'bye' });
    if (this.phase === 'run') this.abort('');
    this.reset();
    this.status = '';
    this.changed();
  }

  // ---- messages --------------------------------------------------------------------
  say(m) {
    if (this.ch) { m.f = this.me; this.ch.say(m); }
  }

  mine() {
    const g = this.game, P = g.player;
    return {
      name: (this.name || 'Hunter'), cls: g.mainClass, level: P.level, look: g.appearance,
      wp: P.equip && P.equip.weapon ? { type: P.equip.weapon.type, rarity: P.equip.weapon.rarity } : { type: 'sword', rarity: 0 },
    };
  }

  hello() {
    const g = this.game;
    let name = '';
    try { name = (JSON.parse(localStorage.getItem('noctis.settings') || '{}').hunterName) || ''; } catch (e) { /* none */ }
    this.name = name || t('coop.guestName');
    this.say({ t: 'hi', ...this.mine(), role: this.role, run: this.phase === 'run', gi: g.gates.active });
  }

  peer(m) {
    let p = this.peers.get(m.f);
    if (!p) {
      p = { id: m.f, x: 0, z: 0, tx: 0, tz: 0, yaw: 0, hp: 1, mhp: 1, mv: 0, at: 0, dead: false, model: null, inGate: false, seen: 0 };
      this.peers.set(m.f, p);
    }
    p.seen = performance.now();
    return p;
  }

  onMsg(m) {
    if (!m || !m.f || m.f === this.me) return;
    const g = this.game;
    switch (m.t) {
      case 'hi': {
        if (this.peers.size >= MAX_PLAYERS - 1 && !this.peers.has(m.f)) return;
        const fresh = !this.peers.has(m.f);
        const p = this.peer(m);
        p.name = String(m.name || '').slice(0, 20); p.cls = m.cls; p.level = m.level; p.look = m.look; p.wp = m.wp; p.role = m.role;
        if (fresh) { this.hello(); this.changed(); } // answer a newcomer so that he sees us
        break;
      }
      case 'bye': {
        const p = this.peers.get(m.f);
        if (p) { this.dropModel(p); this.peers.delete(m.f); this.changed(); }
        if (this.role === 'guest' && p && p.role === 'host') this.abort(t('coop.hostLeft'));
        break;
      }
      case 'start': // the host enters a gate
        if (this.role === 'guest' && this.phase === 'lobby') this.onStart(m);
        break;
      case 'p': {
        const p = this.peer(m);
        p.tx = m.x; p.tz = m.z; p.yaw = m.y; p.hp = m.h; p.mhp = m.mh; p.mv = m.mv; p.at = m.at; p.dead = !!m.d; p.inGate = true;
        if (!p.model && this.phase === 'run') this.makeModel(p);
        break;
      }
      case 's': if (this.guest) this.onSnapshot(m); break;
      case 'k': if (this.guest) this.onKill(m); break;
      case 'h': if (this.hosting) this.onHit(m); break;
      case 'd': if (m.to === this.me && !g.player.dead) g.player.damage(m.a); break;
      case 'hz': if (this.guest) g.hazards.add(m.x, m.z, m.r, m.dl, m.dm, m.c); break;
      case 'sh': if (this.guest) g.shots.fire(m.x - m.dx * 0.8, m.z - m.dz * 0.8, m.dx, m.dz, m.sp, m.dm, m.c, m.rg, m.r, m.k); break;
      case 'bn': if (this.guest) this.onBanner(m); break;
      case 'sc': if (this.guest) g.gates.stageCleared(); break;
      case 'end': if (this.guest) this.abort(t('coop.hostLeft')); break;
      case 'heal': if (m.to === this.me && !g.player.dead) g.player.hp = Math.min(g.player.maxHp, g.player.hp + m.a); break;
      default: break;
    }
  }

  // ---- starting and ending a gate ---------------------------------------------------------
  // the host is about to enter gate gi: tells the others (called by gates.enter)
  announce(gi, info) {
    if (!this.lobbyHost || this.peers.size === 0) return false;
    this.phase = 'run';
    this.say({ t: 'start', gi, ...info });
    this.lastSnap = performance.now();
    this.changed();
    return true;
  }

  // a guest: the host entered gate m.gi
  onStart(m) {
    const g = this.game, P = g.player;
    if (g.gates.active >= 0 || P.dead || m.gi < 0 || m.gi >= g.gates.list.length) return;
    this.phase = 'run';
    this.lastSnap = performance.now();
    g.menu.isOpen && g.menu.close();
    g.gates.enterCoop(m.gi, m);
    this.changed();
  }

  // the gate is over for this player (left, died) or the co-op broke off
  onGateLeft() {
    if (this.phase !== 'run') return;
    this.say({ t: 'bye' });
    // back to the lobby: the code stays, the hunters can go again
    for (const p of this.peers.values()) { this.dropModel(p); p.inGate = false; }
    this.targets = [];
    if (this.role === 'host') this.say({ t: 'end' });
    this.phase = 'lobby';
    this.hello();
    this.changed();
  }

  // the gate ends for everybody, text = why
  abort(text) {
    const g = this.game;
    const wasRun = this.phase === 'run';
    for (const p of this.peers.values()) { this.dropModel(p); p.inGate = false; }
    this.targets = [];
    if (wasRun) this.phase = 'lobby';
    if (text) g.hud.toast(text);
    if (wasRun && g.gates.active >= 0 && !g.gates.exitOpen) { g.gates.coopLeaving = true; g.gates.leave(false); g.gates.coopLeaving = false; }
    this.changed();
  }

  // ---- hunters ----------------------------------------------------------------------------
  makeModel(p) {
    const g = this.game;
    p.model = createPlayerModel({ ...CONFIG.defaultAppearance, ...(p.look || {}) }, p.cls || '');
    const w = p.wp || { type: 'sword', rarity: 0 };
    p.model.setEquipment({ weapon: { kind: 'weapon', type: w.type, rarity: w.rarity, level: 1, up: 0 } });
    p.model.root.position.set(p.tx || 0, 0, p.tz || 0);
    p.x = p.tx; p.z = p.tz;
    g.scene.add(p.model.root);
  }

  dropModel(p) {
    if (!p.model) return;
    this.game.scene.remove(p.model.root);
    p.model.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    p.model = null;
  }

  // number of hunters in the run (the monsters get more health with it)
  count() {
    let n = 1;
    for (const p of this.peers.values()) if (p.inGate) n++;
    return n;
  }

  hpMult() {
    return this.hosting ? 1 + 0.65 * (this.count() - 1) : 1;
  }

  // ---- every frame ---------------------------------------------------------------------------
  update(dt) {
    if (this.phase === 'off') return;
    const g = this.game, P = g.player, now = performance.now();
    this.helloT -= dt;
    if (this.helloT <= 0) { this.helloT = 3; this.hello(); }
    // hunters that went silent
    for (const p of [...this.peers.values()]) {
      if (now - p.seen > 12000) { this.dropModel(p); this.peers.delete(p.id); this.changed(); }
    }
    if (this.phase !== 'run') return;
    // remote hunters: glide to the last position, animate
    this.targets.length = 0;
    for (const p of this.peers.values()) {
      if (!p.inGate || !p.model) continue;
      const k = Math.min(1, dt * 12);
      p.x += (p.tx - p.x) * k;
      p.z += (p.tz - p.z) * k;
      p.model.root.position.set(p.x, 0, p.z);
      let d = p.yaw - p.model.root.rotation.y;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      p.model.root.rotation.y += d * Math.min(1, dt * 14);
      p.model.animate(dt, { moving: !!p.mv, attack: p.at, cast: 0, weapon: (p.wp && p.wp.type) || 'sword', combo: 0, dodging: false, rate: 1, dead: p.dead });
      g.effects.blob(p.x, p.z, 0.75);
      if (!p.dead) this.targets.push({ x: p.x, z: p.z, radius: 0.6, alive: true, peer: p });
    }
    // my own position
    if ((this.sendP -= dt) <= 0) {
      this.sendP = SEND_P;
      this.say({ t: 'p', x: rnd(P.x), z: rnd(P.z), y: rnd(Math.atan2(P.dirX, P.dirZ)), h: Math.round(P.hp), mh: Math.round(P.maxHp), mv: P.moving ? 1 : 0, at: rnd(P.attackAnim > 0 ? P.attackAnim : 0), d: P.dead ? 1 : 0 });
    }
    if (this.hosting) {
      if ((this.sendS -= dt) <= 0) { this.sendS = SEND_S; this.sendSnapshot(); }
      if (this.count() > 0 && this.peers.size > 0 && ![...this.peers.values()].some((p) => p.inGate) && g.gates.active >= 0) { /* alone again: carries on solo */ }
    } else if (this.guest) {
      if (now - this.lastSnap > STALE * 1000) this.abort(t('coop.hostLeft'));
    }
  }

  // ---- the host's snapshot ------------------------------------------------------------------------
  // the monsters of the arena in a fixed order: the boss, then the pool
  slots() {
    const E = this.game.enemies, gi = this.game.gates.active;
    return [E.arenaBoss[gi], ...E.arenaAdds[gi]];
  }

  ordinal(slot) {
    return this.slots().indexOf(slot);
  }

  sendSnapshot() {
    const g = this.game, E = g.enemies, G = g.gates;
    const list = [];
    this.slots().forEach((i, j) => {
      if (!E.alive[i]) return;
      list.push([j, E.type[i], E.tier[i], rnd(E.x[i]), rnd(E.z[i]), rnd(E.yaw[i]), Math.round(E.hp[i]), Math.round(E.maxHp[i]),
        E.state[i], E.flash[i] > 0 ? 1 : 0, E.moving[i], rnd(E.scale[i]), rnd(E.radius[i]), E.xpv[i], E.lvl[i], E.lunge[i] > 0 ? 1 : 0]);
    });
    this.say({ t: 's', e: list, si: G.stageI, sv: Math.ceil(G.surviveT), pl: G.poolLeft, sp: G.stagePause > 0 ? 1 : 0 });
  }

  onSnapshot(m) {
    const g = this.game, E = g.enemies, G = g.gates, gi = G.active;
    if (gi < 0) return;
    this.lastSnap = performance.now();
    const slots = this.slots(), seen = new Set();
    for (const e of m.e) {
      const i = slots[e[0]];
      if (i === undefined) continue;
      seen.add(i);
      if (!E.alive[i]) {
        E.alive[i] = 1;
        E.deathT[i] = 0;
        E.arena[i] = gi + 1;
        E.zone[i] = G.list[gi].zone;
        E.sx[i] = e[3]; E.sz[i] = e[4];
        E.x[i] = e[3]; E.z[i] = e[4];
      }
      E.type[i] = e[1]; E.tier[i] = e[2];
      E.sx[i] = e[3]; E.sz[i] = e[4];
      E.sy[i] = e[5];
      E.hp[i] = e[6]; E.maxHp[i] = e[7];
      E.state[i] = e[8];
      if (e[9]) E.flash[i] = 0.12;
      E.moving[i] = e[10];
      E.scale[i] = e[11]; E.radius[i] = e[12]; E.xpv[i] = e[13]; E.lvl[i] = e[14];
      if (e[15]) E.lunge[i] = 1;
    }
    // gone from the host (a helper that faded away): gone here too
    for (const i of slots) if (E.alive[i] && !seen.has(i)) E.vanish(i);
    G.stageI = m.si;
    G.surviveT = m.sv;
    G.poolLeft = m.pl;
    G.stagePause = m.sp ? 1 : 0;
  }

  // a monster died on the host: it dies here too (XP, loot and the boss reward come from my own game)
  onKill(m) {
    const E = this.game.enemies, i = this.slots()[m.j];
    if (i === undefined || !E.alive[i]) return;
    E.x[i] = E.sx[i]; E.z[i] = E.sz[i];
    E.kill(i, -1);
  }

  sendKill(slot) {
    const j = this.ordinal(slot);
    if (j >= 0) this.say({ t: 'k', j });
  }

  // a hit by a guest
  onHit(m) {
    const E = this.game.enemies, i = this.slots()[m.j];
    if (i === undefined || !E.alive[i]) return;
    E.damage(i, m.a, m.kx, m.kz, -1, !!m.c);
  }

  sendHit(slot, amount, kx, kz, crit) {
    const j = this.ordinal(slot);
    if (j >= 0) this.say({ t: 'h', j, a: Math.round(amount), kx: rnd(kx), kz: rnd(kz), c: crit ? 1 : 0 });
  }

  // ---- what the monsters do to the others ----------------------------------------------------------
  // the closest hunter that a monster at (x, z) could attack; -1 = none within reach
  pick(x, z, range) {
    let best = -1, bd = range * range;
    for (let k = 0; k < this.targets.length; k++) {
      const u = this.targets[k], dx = u.x - x, dz = u.z - z, d2 = dx * dx + dz * dz;
      if (d2 < bd) { bd = d2; best = k; }
    }
    this.pickD2 = bd;
    return best;
  }

  ghostOk(tg) {
    const u = this.targets[tg - 1000];
    return !!u && u.alive;
  }

  hitGhost(k, amount) {
    const u = this.targets[k];
    if (u) this.say({ t: 'd', to: u.peer.id, a: Math.round(amount) });
  }

  // ground attacks and shots of the host are shown (and hurt) on the guests too
  mirrorHazard(x, z, r, delay, dmg, color) {
    this.say({ t: 'hz', x: rnd(x), z: rnd(z), r: rnd(r), dl: rnd(delay), dm: Math.round(dmg), c: color });
  }

  mirrorShot(x, z, dx, dz, speed, dmg, color, range, radius, kind) {
    this.say({ t: 'sh', x: rnd(x), z: rnd(z), dx: rnd(dx), dz: rnd(dz), sp: speed, dm: Math.round(dmg), c: color, rg: range, r: radius, k: kind });
  }

  // a message for the banner of the stage
  sendBanner(kind, n, max, boss) {
    this.say({ t: 'bn', k: kind, n, mx: max, b: boss });
  }

  onBanner(m) {
    const g = this.game;
    g.hud.banner(t('gate.stage', { n: m.n, max: m.mx }), m.k === 'boss' ? t('gate.stage.boss', { boss: t('enemy.' + m.b) }) : t('gate.stage.' + m.k));
    if (m.k === 'boss') g.cam.shake(0.5, 0.5);
  }

  arenaCenterOf(gi) { return arenaCenter(gi); }
}

