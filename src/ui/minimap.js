// Minimap (2D canvas, redrawn a few times per second). Shows the zones, the
// camp, the gates (also as arrows on the edge when they are out of view),
// elites, champions, the army and the player. Tap it (or press M) to switch
// between the close view and the whole world. Inside an arena it shows the
// arena with the boss and its helpers.
import { CONFIG } from '../config.js';
import { input } from '../input/input.js';
import { arenaCenter } from '../world/gates.js';

const css = (n) => '#' + n.toString(16).padStart(6, '0');

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.world = false; // false = close view
    this.size = 0;
    this.zoneColors = CONFIG.world.zones.map((z) => css(z.groundColors[0]));
    canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      this.world = !this.world;
      this.t = 0;
    });
  }

  update(dt) {
    if (input.toggleMap) {
      input.toggleMap = false;
      this.world = !this.world;
      this.t = 0;
    }
    this.t -= dt;
    if (this.t > 0) return;
    this.t = CONFIG.minimap.refresh;
    this.draw();
  }

  outpostIcon(g, x, y, r, captured, respawn, S) {
    if (respawn) {
      g.strokeStyle = '#e9c77b';
      g.lineWidth = Math.max(1.5, S / 70);
      g.beginPath();
      g.arc(x, y, r * 1.45, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = captured ? '#2fb85e' : '#d8243c';
    g.strokeStyle = '#0d0716';
    g.lineWidth = Math.max(1.5, S / 80);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // little tent
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(x, y - r * 0.6);
    g.lineTo(x + r * 0.6, y + r * 0.45);
    g.lineTo(x - r * 0.6, y + r * 0.45);
    g.closePath();
    g.fill();
    g.fillStyle = captured ? '#2fb85e' : '#d8243c';
    g.fillRect(x - r * 0.12, y + r * 0.05, r * 0.24, r * 0.4);
  }

  draw() {
    const game = this.game, P = game.player, cv = this.canvas, g = this.ctx;
    // match the canvas resolution to its size on screen
    const px = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1));
    if (px <= 0) return;
    if (px !== this.size) { cv.width = cv.height = px; this.size = px; }
    const S = px, half = S / 2;
    const gates = game.gates;
    const arena = gates.active;
    let cx, cz, R;
    if (arena >= 0) {
      const c = arenaCenter(arena);
      cx = c.x; cz = c.z; R = CONFIG.gates.arenaRadius + 3;
    } else if (this.world) {
      // the whole known world: grows with every new zone
      let outer = CONFIG.world.campRadius;
      CONFIG.world.zones.forEach((z, i) => { if (game.knownZones.has(i)) outer = Math.max(outer, z.outer); });
      cx = 0; cz = 0; R = outer + 10;
    } else {
      cx = P.x; cz = P.z; R = CONFIG.minimap.localRadius;
    }
    const k = half / R;
    const X = (x) => half + (x - cx) * k;
    const Y = (z) => half + (z - cz) * k;

    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = '#0d0a16';
    g.fillRect(0, 0, S, S);

    if (arena >= 0) {
      g.fillStyle = this.zoneColors[arena];
      g.beginPath();
      g.arc(half, half, CONFIG.gates.arenaRadius * k, 0, Math.PI * 2);
      g.fill();
    } else {
      // zones from the outside in; unknown zones stay dark
      const zones = CONFIG.world.zones;
      for (let i = zones.length - 1; i >= 0; i--) {
        g.fillStyle = game.knownZones.has(i) ? this.zoneColors[i] : '#141019';
        g.beginPath();
        g.arc(X(0), Y(0), zones[i].outer * k, 0, Math.PI * 2);
        g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,0.35)';
      g.lineWidth = Math.max(1, S / 120);
      for (let i = 0; i < zones.length; i++) {
        if (!game.knownZones.has(i)) break;
        g.beginPath();
        g.arc(X(0), Y(0), zones[i].outer * k, 0, Math.PI * 2);
        g.stroke();
      }
      // camp
      g.fillStyle = '#5a4f48';
      g.beginPath();
      g.arc(X(0), Y(0), Math.max(S / 40, CONFIG.world.campRadius * k), 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#b48cff';
      g.lineWidth = Math.max(1.5, S / 70);
      g.stroke();
    }

    // elites, champions, bosses and helpers
    const E = game.enemies;
    const dot = Math.max(2, S / 45);
    for (let k2 = 0; k2 < E.activeCount; k2++) {
      const i = E.active[k2];
      if (!E.alive[i]) continue;
      const tier = E.tier[i];
      if (tier === 0 && arena < 0) continue;
      g.fillStyle = tier === 1 ? '#ffc030' : tier >= 2 ? '#ff4050' : '#ff8090';
      g.beginPath();
      g.arc(X(E.x[i]), Y(E.z[i]), dot * (tier === 3 ? 2 : tier === 2 ? 1.4 : 1), 0, Math.PI * 2);
      g.fill();
    }
    // army
    g.fillStyle = css(game.army.auraHex);
    for (const u of game.army.deployed) {
      if (!u.alive) continue;
      g.fillRect(X(u.x) - dot * 0.5, Y(u.z) - dot * 0.5, dot, dot);
    }
    g.restore();

    // gates (always visible: on the edge when they are out of view)
    if (arena < 0) {
      for (const gt of gates.list) {
        if (!gt.open || !game.knownZones.has(gt.zone)) continue;
        const zone = CONFIG.world.zones[gt.zone];
        let x = X(gt.x), y = Y(gt.z);
        const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - S / 14;
        const out = d > lim;
        if (out) { x = half + (dx / d) * lim; y = half + (dy / d) * lim; }
        const s = S / (out ? 24 : this.world ? 30 : 18) * (1 + gt.diff * 0.15);
        g.save();
        g.translate(x, y);
        g.rotate(Math.PI / 4);
        g.fillStyle = css(zone.gateColor);
        g.strokeStyle = css(CONFIG.gates.difficulties[gt.diff].color);
        g.lineWidth = Math.max(1.5, S / 70);
        g.fillRect(-s, -s, s * 2, s * 2);
        g.strokeRect(-s, -s, s * 2, s * 2);
        g.restore();
      }
    }

    // outposts: a tent badge in the close view (green = captured, red = held
    // by enemies, gold ring = respawn point; nearby ones out of view sit on the
    // edge), small dots in the world view
    if (arena < 0) {
      const r = Math.max(4, S / 19);
      game.world.safes.forEach((s, si) => {
        if (si === 0 || !game.knownZones.has(s.zone)) return;
        let x = X(s.x), y = Y(s.z);
        if (this.world) {
          g.fillStyle = s.captured ? '#5cf08a' : '#ff4050';
          g.strokeStyle = '#0d0716';
          g.lineWidth = Math.max(1, S / 140);
          g.beginPath();
          g.arc(x, y, Math.max(1.8, S / 70), 0, Math.PI * 2);
          g.fill();
          g.stroke();
          if (si === game.respawnIndex) {
            g.strokeStyle = '#e9c77b';
            g.beginPath();
            g.arc(x, y, Math.max(3.5, S / 40), 0, Math.PI * 2);
            g.stroke();
          }
          return;
        }
        const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - r * 1.25;
        if (d > lim) {
          if (d > lim * 2.5) return; // far away
          x = half + (dx / d) * lim;
          y = half + (dy / d) * lim;
        }
        this.outpostIcon(g, x, y, r, s.captured, si === game.respawnIndex, S);
      });
    }

    // player arrow (smaller in the world view)
    const ax = X(P.x), ay = Y(P.z), a = Math.atan2(P.dirZ, P.dirX), r = S / (this.world ? 24 : 18);
    g.save();
    g.translate(ax, ay);
    g.rotate(a);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#120a20';
    g.lineWidth = Math.max(1, S / 100);
    g.beginPath();
    g.moveTo(r, 0);
    g.lineTo(-r * 0.7, r * 0.65);
    g.lineTo(-r * 0.35, 0);
    g.lineTo(-r * 0.7, -r * 0.65);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
  }
}
