// The maps. The minimap (top right) shows the land around the hunter; a tap
// on it (or M) opens the big map with the whole world. Both are 2D canvases
// drawn by the same painter: zones as coloured rings, the fog over what was
// never explored, and symbols for the camp, outposts, gates, chests, the
// quest zone and the hunter. Inside an arena the minimap shows the arena with
// the boss and its helpers.
import { CONFIG } from '../config.js';
import { input } from '../input/input.js';
import { arenaCenter } from '../world/gates.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';

const css = (n) => '#' + n.toString(16).padStart(6, '0');
// a colour a bit lighter (k > 0) or darker (k < 0)
function shade(hex, k) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k))));
  return `rgb(${f(hex >> 16)},${f((hex >> 8) & 255)},${f(hex & 255)})`;
}

// ---- symbols --------------------------------------------------------------------
export const ICON = {
  camp(g, x, y, r) {
    g.fillStyle = '#2a2036';
    g.strokeStyle = '#e9c77b';
    g.lineWidth = Math.max(1.5, r * 0.18);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    // a little fire
    g.fillStyle = '#ff9a3c';
    g.beginPath();
    g.moveTo(x, y - r * 0.62);
    g.quadraticCurveTo(x + r * 0.55, y, x, y + r * 0.5);
    g.quadraticCurveTo(x - r * 0.55, y, x, y - r * 0.62);
    g.fill();
    g.fillStyle = '#ffe27a';
    g.beginPath(); g.arc(x, y + r * 0.15, r * 0.22, 0, Math.PI * 2); g.fill();
  },
  outpost(g, x, y, r, captured, respawn) {
    if (respawn) {
      g.strokeStyle = '#e9c77b';
      g.lineWidth = Math.max(1.5, r * 0.22);
      g.beginPath(); g.arc(x, y, r * 1.45, 0, Math.PI * 2); g.stroke();
    }
    const c = captured ? '#2fb85e' : '#d8243c';
    g.fillStyle = c;
    g.strokeStyle = '#0d0716';
    g.lineWidth = Math.max(1.2, r * 0.18);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(x, y - r * 0.6); g.lineTo(x + r * 0.6, y + r * 0.45); g.lineTo(x - r * 0.6, y + r * 0.45);
    g.closePath(); g.fill();
    g.fillStyle = c;
    g.fillRect(x - r * 0.12, y + r * 0.05, r * 0.24, r * 0.4);
  },
  gate(g, x, y, s, zoneHex, diffHex) {
    g.save();
    g.translate(x, y);
    g.rotate(Math.PI / 4);
    g.shadowColor = css(zoneHex);
    g.shadowBlur = s * 1.6;
    g.fillStyle = css(zoneHex);
    g.fillRect(-s, -s, s * 2, s * 2);
    g.shadowBlur = 0;
    g.strokeStyle = css(diffHex);
    g.lineWidth = Math.max(1.5, s * 0.32);
    g.strokeRect(-s, -s, s * 2, s * 2);
    g.fillStyle = '#ffffff';
    g.fillRect(-s * 0.3, -s * 0.3, s * 0.6, s * 0.6);
    g.restore();
  },
  // a hunted monster: a red skull-like mark
  hunt(g, x, y, r) {
    g.save();
    g.shadowColor = '#ff3048';
    g.shadowBlur = r * 1.4;
    g.fillStyle = '#ff3048';
    g.strokeStyle = '#2a0008';
    g.lineWidth = Math.max(1.2, r * 0.22);
    g.beginPath(); g.arc(x, y - r * 0.15, r * 0.8, 0, Math.PI * 2); g.fill(); g.stroke();
    g.shadowBlur = 0;
    g.fillRect(x - r * 0.45, y + r * 0.35, r * 0.9, r * 0.5);
    g.fillStyle = '#2a0008';
    g.beginPath(); g.arc(x - r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2); g.arc(x + r * 0.3, y - r * 0.2, r * 0.2, 0, Math.PI * 2); g.fill();
    g.restore();
  },
  abyss(g, x, y, r) {
    g.fillStyle = '#0a0010';
    g.strokeStyle = '#ff2850';
    g.lineWidth = Math.max(1.5, r * 0.3);
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
  },
  chest(g, x, y, s) {
    g.fillStyle = '#ffcf4a';
    g.strokeStyle = '#3a2208';
    g.lineWidth = Math.max(1, s * 0.22);
    g.beginPath();
    g.rect(x - s, y - s * 0.7, s * 2, s * 1.4);
    g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - s, y - s * 0.1); g.lineTo(x + s, y - s * 0.1); g.stroke();
    g.fillStyle = '#3a2208';
    g.fillRect(x - s * 0.18, y - s * 0.3, s * 0.36, s * 0.4);
  },
  player(g, x, y, a, r) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#120a20';
    g.lineWidth = Math.max(1, r * 0.2);
    g.beginPath();
    g.moveTo(r, 0); g.lineTo(-r * 0.7, r * 0.65); g.lineTo(-r * 0.35, 0); g.lineTo(-r * 0.7, -r * 0.65);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
  },
  // the marked target: a gold pin with its tip at (x, y)
  mark(g, x, y, s) {
    g.fillStyle = '#ffd24a';
    g.strokeStyle = '#2a1a00';
    g.lineWidth = Math.max(1.2, s * 0.14);
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y - s * 1.1, s * 0.62, Math.PI * 0.8, Math.PI * 2.2);
    g.closePath();
    g.fill(); g.stroke();
    g.fillStyle = '#2a1a00';
    g.beginPath(); g.arc(x, y - s * 1.1, s * 0.24, 0, Math.PI * 2); g.fill();
  },
  // points from the edge of the minimap towards the target (a = angle)
  arrow(g, x, y, a, s) {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = '#ffd24a';
    g.strokeStyle = '#2a1a00';
    g.lineWidth = Math.max(1.2, s * 0.12);
    g.beginPath();
    g.moveTo(s * 0.7, 0); g.lineTo(-s * 0.5, -s * 0.55); g.lineTo(-s * 0.2, 0); g.lineTo(-s * 0.5, s * 0.55);
    g.closePath();
    g.fill(); g.stroke();
    g.restore();
  },
  quest(g, x, y, s) {
    g.strokeStyle = '#ffd24a';
    g.lineWidth = Math.max(1.5, s * 0.3);
    g.setLineDash([s * 0.7, s * 0.5]);
    g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#ffd24a';
    g.font = `800 ${Math.round(s * 1.3)}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', x, y + s * 0.05);
  },
};

// The world part of a map, W x H pixels: (cx, cz) in the middle, k pixels per
// world unit. big: the big map (thinner lines, the Abyss); chests: draw the
// chests. S is the shorter side (symbol sizes follow it).
function paintWorld(game, g, W, H, cx, cz, k, big, chests = true) {
  const hx = W / 2, hy = H / 2, S = Math.min(W, H);
  const X = (x) => hx + (x - cx) * k, Y = (z) => hy + (z - cz) * k;
  const zones = CONFIG.world.zones, ox = X(0), oy = Y(0);
  // zones from the outside in, each a soft ring
  g.fillStyle = '#0b0814';
  g.fillRect(0, 0, W, H);
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i], c = z.groundColors[0];
    const gr = g.createRadialGradient(ox, oy, Math.max(0, z.inner * k), ox, oy, z.outer * k);
    gr.addColorStop(0, shade(c, -0.35));
    gr.addColorStop(0.45, shade(c, 0.06));
    gr.addColorStop(1, shade(c, -0.45));
    g.fillStyle = gr;
    g.beginPath(); g.arc(ox, oy, z.outer * k, 0, Math.PI * 2); g.fill();
  }
  // borders in the colour of the zone's gates
  g.lineWidth = Math.max(1, S / (big ? 320 : 140));
  for (const z of zones) {
    g.strokeStyle = shade(z.gateColor, -0.2);
    g.globalAlpha = 0.55;
    g.beginPath(); g.arc(ox, oy, z.outer * k, 0, Math.PI * 2); g.stroke();
  }
  g.globalAlpha = 1;
  // what was never explored lies in the fog
  game.fog.draw(g, cx, cz, k, W, H);

  // the zone of today's quests
  const q = game.quests.list.find((x) => !x.done && (x.kind === 'kill' || x.kind === 'type'));
  if (q) {
    const z = zones[q.zone], r = ((z.inner + z.outer) / 2) * k;
    g.strokeStyle = 'rgba(255, 210, 74, 0.75)';
    g.lineWidth = Math.max(1.5, S / (big ? 220 : 110));
    g.setLineDash([S / 60, S / 80]);
    g.beginPath(); g.arc(ox, oy, r, 0, Math.PI * 2); g.stroke();
    g.setLineDash([]);
  }

  // chests that are ready, where the land is explored
  const L = game.loot, cs = Math.max(2.5, S / (big ? 110 : 60));
  for (let i = 0; chests && i < L.chestCount; i++) {
    if (L.cT[i] > 0) continue;
    const sx = X(L.cx[i]), sy = Y(L.cz[i]);
    if (sx < -cs || sx > W + cs || sy < -cs || sy > H + cs || !game.fog.explored(L.cx[i], L.cz[i])) continue;
    ICON.chest(g, sx, sy, cs);
  }

  // the camp and the Abyss portal
  ICON.camp(g, ox, oy, Math.max(S / (big ? 45 : 26), CONFIG.world.campRadius * k));
  const ab = game.gates.list[game.gates.abyssIndex];
  if (ab && big && k > 0.2) ICON.abyss(g, X(ab.x), Y(ab.z), S / 80);
  // the rank trial, while it is due
  const tr = game.gates.list[game.gates.trialIndex];
  if (tr && tr.open && game.gates.active < 0) ICON.gate(g, X(tr.x), Y(tr.z), Math.max(4, S / (big ? 80 : 30)), CONFIG.trial.color, 0xffffff);
  // the hunted monster on the big map
  const hi = game.hunts.i;
  if (big && hi >= 0 && game.enemies.alive[hi]) ICON.hunt(g, X(game.enemies.x[hi]), Y(game.enemies.z[hi]), Math.max(5, S / 60));
  return { X, Y, k };
}

// zone names on the big map: on each ring up and to the left (the outposts
// sit on the straight lines through the camp), on a dark plate, drawn last.
// A plate only shows when it lies completely inside the map.
function paintLabels(game, g, W, H, ox, oy, k) {
  const zones = CONFIG.world.zones, dpr = Math.min(2, window.devicePixelRatio || 1);
  const fs = Math.round(Math.max(9 * dpr, Math.min(13 * dpr, (zones[1].outer - zones[1].inner) * k * 0.3)));
  g.font = `700 ${fs}px Cinzel, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  zones.forEach((z, i) => {
    if ((z.outer - z.inner) * k < fs * 1.5) return; // ring too thin
    const r = ((z.inner + z.outer) / 2) * k;
    const known = game.knownZones.has(i);
    const label = known ? t('zone.' + z.id) + ' · ' + z.rank : '? · ' + z.rank;
    const w = g.measureText(label).width + fs * 1.2, h = fs * 1.6;
    const fits = (x, y) => x - w / 2 > 2 && x + w / 2 < W - 2 && y - h / 2 > 2 && y + h / 2 < H - 2;
    // a little left of the top; outer rings move up to the top, where there is room
    let x = 0, y = 0, ok = false;
    for (const f of [0.62, 0.58, 0.54, 0.5]) {
      x = ox + Math.cos(-Math.PI * f) * r; y = oy + Math.sin(-Math.PI * f) * r;
      if ((ok = fits(x, y))) break;
    }
    if (!ok) return;
    g.fillStyle = 'rgba(8, 5, 16, 0.72)';
    g.beginPath();
    if (g.roundRect) g.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
    else g.rect(x - w / 2, y - h / 2, w, h);
    g.fill();
    g.fillStyle = known ? '#f4ecff' : 'rgba(200, 190, 220, 0.6)';
    g.fillText(label, x, y + fs * 0.06);
  });
}

export class Minimap {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.t = 0;
    this.size = 0;
    this.big = new BigMap(game, game.hud.hud);
    this.zoneColors = CONFIG.world.zones.map((z) => css(z.groundColors[0]));
    canvas.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (game.gates.active < 0) { play('ui'); this.big.open(); }
    });
  }

  update(dt) {
    if (input.toggleMap) {
      input.toggleMap = false;
      if (this.game.gates.active < 0) this.big.open();
    }
    this.game.fog.update(dt);
    this.t -= dt;
    if (this.t > 0) return;
    this.t = CONFIG.minimap.refresh;
    this.draw();
  }

  draw() {
    const game = this.game, P = game.player, cv = this.canvas, g = this.ctx;
    // match the canvas resolution to its size on screen
    const px = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1));
    if (px <= 0) return;
    if (px !== this.size) { cv.width = cv.height = px; this.size = px; }
    const S = px, half = S / 2;
    const gates = game.gates, arena = gates.active;
    let cx, cz, R;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.clip();
    let X, Y;
    if (arena >= 0) {
      const c = arenaCenter(arena);
      cx = c.x; cz = c.z; R = CONFIG.gates.arenaRadius + 3;
      const k = half / R;
      X = (x) => half + (x - cx) * k;
      Y = (z) => half + (z - cz) * k;
      g.fillStyle = '#0d0a16';
      g.fillRect(0, 0, S, S);
      g.fillStyle = this.zoneColors[gates.list[arena].zone];
      g.beginPath();
      g.arc(half, half, CONFIG.gates.arenaRadius * k, 0, Math.PI * 2);
      g.fill();
    } else {
      cx = P.x; cz = P.z; R = CONFIG.minimap.localRadius;
      ({ X, Y } = paintWorld(game, g, S, S, cx, cz, half / R, false));
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

    if (arena < 0) {
      // gates: always visible, on the edge when they are out of view
      for (const gt of gates.list) {
        if (!gt.open || gt.abyss || gt.trial || gt.zone !== game.curZone) continue;
        let x = X(gt.x), y = Y(gt.z);
        const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - S / 14;
        const out = d > lim;
        if (out) { x = half + (dx / d) * lim; y = half + (dy / d) * lim; }
        const s = (S / (out ? 24 : 18)) * (1 + gt.diff * 0.15);
        ICON.gate(g, x, y, s, CONFIG.world.zones[gt.zone].gateColor, CONFIG.gates.difficulties[gt.diff].color);
      }
      // the hunted monster: always visible, on the edge when out of view
      const hi = game.hunts.i;
      if (hi >= 0 && game.enemies.alive[hi]) {
        let x = X(game.enemies.x[hi]), y = Y(game.enemies.z[hi]);
        const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - S / 14;
        if (d > lim) { x = half + (dx / d) * lim; y = half + (dy / d) * lim; }
        ICON.hunt(g, x, y, S / 20);
      }
      // outposts nearby (those just out of view sit on the edge)
      const r = Math.max(4, S / 19);
      game.world.safes.forEach((s, si) => {
        if (si === 0 || !game.knownZones.has(s.zone)) return;
        let x = X(s.x), y = Y(s.z);
        const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - r * 1.25;
        if (d > lim) {
          if (d > lim * 2.5) return; // far away
          x = half + (dx / d) * lim;
          y = half + (dy / d) * lim;
        }
        ICON.outpost(g, x, y, r, s.captured, si === game.respawnIndex);
      });
    }

    // the marked target: a pin, or an arrow on the edge with the distance
    const wp = game.waypoint.pos();
    if (wp && arena < 0) {
      let x = X(wp.x), y = Y(wp.z);
      const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - S / 9;
      // the distance sits next to the symbol, towards the middle
      let tx, ty;
      if (d > lim) {
        const ux = dx / d, uy = dy / d;
        ICON.arrow(g, half + ux * lim, half + uy * lim, Math.atan2(dy, dx), S / 13);
        tx = half + ux * (lim - S / 5.5); ty = half + uy * (lim - S / 7);
      } else {
        ICON.mark(g, x, y, S / 15);
        tx = x; ty = y + S / 12;
      }
      const m = Math.round(Math.hypot(wp.x - P.x, wp.z - P.z));
      g.font = `800 ${Math.round(S / 11)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = Math.max(2, S / 40);
      g.strokeStyle = 'rgba(10, 6, 18, 0.9)';
      g.strokeText(m + ' m', tx, ty);
      g.fillStyle = '#ffd24a';
      g.fillText(m + ' m', tx, ty);
    }

    ICON.player(g, X(P.x), Y(P.z), Math.atan2(P.dirZ, P.dirX), S / 18);
  }
}

// ---- the big map ---------------------------------------------------------------------
// Opens over the game (which pauses). Three zoom steps: around the hunter,
// the known world, the whole world. A tap on the map picks what is there (an
// outpost, a gate, the camp, or just the spot); the side panel then shows it
// with its buttons: travel there (captured outposts and the camp, from a safe
// place) and mark it as the target. Without a pick the side shows the legend.
const LEGEND = [
  ['you', (g, s) => ICON.player(g, s / 2, s / 2, -Math.PI / 2, s * 0.4)],
  ['camp', (g, s) => ICON.camp(g, s / 2, s / 2, s * 0.38)],
  ['outpost', (g, s) => ICON.outpost(g, s / 2, s / 2, s * 0.32, true, false)],
  ['outpostEnemy', (g, s) => ICON.outpost(g, s / 2, s / 2, s * 0.32, false, false)],
  ['respawn', (g, s) => ICON.outpost(g, s / 2, s / 2, s * 0.25, true, true)],
  ['gate', (g, s) => ICON.gate(g, s / 2, s / 2, s * 0.24, 0x8a4dff, 0xff3050)],
  ['mark', (g, s) => ICON.mark(g, s / 2, s * 0.86, s * 0.32)],
  ['quest', (g, s) => ICON.quest(g, s / 2, s / 2, s * 0.32)],
  ['hunt', (g, s) => ICON.hunt(g, s / 2, s / 2, s * 0.36)],
  ['trial', (g, s) => ICON.gate(g, s / 2, s / 2, s * 0.24, 0xffd24a, 0xffffff)],
];

// pressed and released on the same element
function tap(el, fn) {
  let id = -1;
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); id = e.pointerId; });
  el.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    if (e.pointerId !== id) return;
    id = -1;
    fn(e);
  });
  el.addEventListener('pointercancel', () => { id = -1; });
}

class BigMap {
  constructor(game, root) {
    this.game = game;
    this.isOpen = false;
    // the view: (cx, cz) in the middle, k canvas pixels per world unit
    this.v = { cx: 0, cz: 0, k: 1 };
    this.sel = null; // what was tapped: { kind: 'outpost' | 'gate' | 'hunt' | 'spot', si | gi | x, z }
    this.hits = []; // tappable symbols of the last drawing (canvas pixels)
    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.el = document.createElement('div');
    this.el.id = 'bigmap';
    this.el.innerHTML = `<div class="bm-map"><canvas></canvas></div>
      <div class="bm-side">
        <b class="bm-title">${t('map.title')}</b>
        <small class="bm-zone"></small>
        <div class="bm-zoom"><button class="ap-btn" data-z="-1" aria-label="${t('map.zoomOut')}">−</button><span></span><button class="ap-btn" data-z="1" aria-label="${t('map.zoomIn')}">+</button></div>
        <div class="bm-fit"><button class="ap-btn small" data-fit="me">${t('map.fitMe')}</button><button class="ap-btn small" data-fit="world">${t('map.fitWorld')}</button></div>
        <small class="bm-hint"></small>
        <div class="bm-sel"></div>
        <div class="bm-legend">${LEGEND.map(([id]) => `<div><canvas data-l="${id}"></canvas><span>${t('map.l.' + id)}</span></div>`).join('')}</div>
        <small class="bm-explored"></small>
        <button class="ap-btn ghost bm-close">${t('menu.close')}</button>
      </div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('.bm-map canvas');
    this.ctx = this.canvas.getContext('2d');
    this.selEl = this.el.querySelector('.bm-sel');
    // taps work like the other HUD buttons (pressed and released on the same
    // element); a plain click does not reach the HUD on phones
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    tap(this.el.querySelector('.bm-close'), () => this.close());
    this.gestures();
    this.el.querySelectorAll('[data-z]').forEach((b) => tap(b, () => {
      this.zoomBy(Number(b.dataset.z) > 0 ? 1.6 : 1 / 1.6, this.W / 2, this.H / 2);
      play('ui');
    }));
    this.el.querySelectorAll('[data-fit]').forEach((b) => tap(b, () => {
      this.fit(b.dataset.fit === 'me' ? 0 : 2);
      play('ui');
      this.draw();
    }));
    // the buttons of the picked thing (the panel is rebuilt, so one listener)
    let selDown = -1;
    this.selEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); selDown = e.pointerId; });
    this.selEl.addEventListener('pointerup', (e) => {
      e.stopPropagation();
      if (e.pointerId !== selDown) return;
      selDown = -1;
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) this.act(b.dataset.act);
    });
    window.addEventListener('resize', () => { if (this.isOpen) this.draw(); });
    this.onKey = (e) => {
      if (e.code === 'KeyM' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
      else if (e.code === 'Equal' || e.code === 'NumpadAdd') this.zoomBy(1.4, this.W / 2, this.H / 2);
      else if (e.code === 'Minus' || e.code === 'NumpadSubtract') this.zoomBy(1 / 1.4, this.W / 2, this.H / 2);
    };
  }

  // ---- the view ------------------------------------------------------------------
  // world radius the whole world needs, and the zoom limits (canvas pixels per unit)
  worldR() {
    const zones = CONFIG.world.zones;
    return zones[zones.length - 1].outer + 20;
  }

  kMin() {
    return (Math.min(this.W, this.H) / 2 / this.worldR()) * 0.95;
  }

  kMax() {
    return 5 * this.dpr;
  }

  // preset views: 0 around the hunter, 1 the known world, 2 the whole world
  fit(mode) {
    const game = this.game, P = game.player, zones = CONFIG.world.zones, v = this.v;
    this.size();
    const half = Math.min(this.W, this.H) / 2;
    if (mode === 0) { v.cx = P.x; v.cz = P.z; v.k = half / 200; }
    else {
      let known = CONFIG.world.campRadius;
      zones.forEach((z, i) => { if (game.knownZones.has(i)) known = Math.max(known, z.outer); });
      const R = mode === 1 ? Math.min(this.worldR(), known + 120) : this.worldR();
      v.cx = 0; v.cz = 0; v.k = half / R;
    }
    this.clampView();
  }

  clampView() {
    const v = this.v;
    v.k = Math.max(this.kMin(), Math.min(this.kMax(), v.k));
    // the centre stays inside the world
    const R = this.worldR(), d = Math.hypot(v.cx, v.cz);
    if (d > R) { v.cx *= R / d; v.cz *= R / d; }
  }

  // zoom by factor f, the world point under (px, py) stays under it
  zoomBy(f, px, py) {
    const v = this.v, k0 = v.k;
    const wx = v.cx + (px - this.W / 2) / k0, wz = v.cz + (py - this.H / 2) / k0;
    v.k = Math.max(this.kMin(), Math.min(this.kMax(), k0 * f));
    v.cx = wx - (px - this.W / 2) / v.k;
    v.cz = wz - (py - this.H / 2) / v.k;
    this.clampView();
    this.draw();
  }

  // ---- touch, mouse wheel ----------------------------------------------------------
  // one finger: tap picks, drag moves the map; two fingers: pinch zooms (and
  // moves); mouse wheel zooms at the pointer
  gestures() {
    const cv = this.canvas, pts = new Map();
    let moved = false, pinch = 0;
    const pos = (e) => {
      const b = cv.getBoundingClientRect();
      return { x: (e.clientX - b.left) * (cv.width / b.width), y: (e.clientY - b.top) * (cv.height / b.height) };
    };
    cv.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      try { cv.setPointerCapture(e.pointerId); } catch (_) { /* fine */ }
      pts.set(e.pointerId, pos(e));
      moved = pts.size > 1;
      pinch = 0;
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const n = pos(e), v = this.v;
      if (pts.size === 1) {
        // a small slop first, so a tap with a shaky finger still picks
        if (!moved && Math.hypot(n.x - p.x, n.y - p.y) < 8 * this.dpr) return;
        moved = true;
        v.cx -= (n.x - p.x) / v.k;
        v.cz -= (n.y - p.y) / v.k;
        pts.set(e.pointerId, n);
        this.clampView();
        this.draw();
      } else if (pts.size === 2) {
        const ids = [...pts.keys()], o = pts.get(ids[0] === e.pointerId ? ids[1] : ids[0]);
        const d0 = Math.hypot(p.x - o.x, p.y - o.y), d1 = Math.hypot(n.x - o.x, n.y - o.y);
        const m0 = { x: (p.x + o.x) / 2, y: (p.y + o.y) / 2 }, m1 = { x: (n.x + o.x) / 2, y: (n.y + o.y) / 2 };
        pts.set(e.pointerId, n);
        if (d0 < 4) return;
        // the world point under the old middle goes under the new one
        const wx = v.cx + (m0.x - this.W / 2) / v.k, wz = v.cz + (m0.y - this.H / 2) / v.k;
        v.k = Math.max(this.kMin(), Math.min(this.kMax(), v.k * (d1 / d0)));
        v.cx = wx - (m1.x - this.W / 2) / v.k;
        v.cz = wz - (m1.y - this.H / 2) / v.k;
        this.clampView();
        this.draw();
      }
    });
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (!pts.size && !moved && e.type === 'pointerup') this.pick(e);
      if (!pts.size) moved = false;
    };
    cv.addEventListener('pointerup', (e) => { e.stopPropagation(); up(e); });
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const p = pos(e);
      this.zoomBy(e.deltaY < 0 ? 1.25 : 1 / 1.25, p.x, p.y);
    }, { passive: false });
  }

  open(zoom) {
    if (this.isOpen || this.game.menu.isOpen) return;
    this.isOpen = true;
    this.sel = null;
    this.game.setPaused(true);
    this.el.classList.add('on');
    window.addEventListener('keydown', this.onKey, true);
    // the legend symbols
    this.el.querySelectorAll('[data-l]').forEach((cv) => {
      const s = Math.round(cv.clientWidth * Math.min(2, window.devicePixelRatio || 1)) || 24;
      cv.width = cv.height = s;
      const g = cv.getContext('2d');
      g.clearRect(0, 0, s, s);
      LEGEND.find((l) => l[0] === cv.dataset.l)[1](g, s);
    });
    this.size();
    this.fit(zoom === undefined ? 1 : zoom);
    this.draw();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('on');
    window.removeEventListener('keydown', this.onKey, true);
    this.game.setPaused(false);
    play('ui');
  }

  // the canvas fills the area left of the side panel
  size() {
    const cv = this.canvas, box = cv.parentElement.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(50, Math.floor(box.width)), h = Math.max(50, Math.floor(box.height));
    const before = Math.min(this.W, this.H);
    this.W = Math.round(w * this.dpr);
    this.H = Math.round(h * this.dpr);
    // the screen changed (turned, resized): the same part of the world stays in view
    if (before > 0) this.v.k *= Math.min(this.W, this.H) / before;
    if (cv.width !== this.W || cv.height !== this.H) { cv.width = this.W; cv.height = this.H; }
  }

  // ---- picking -------------------------------------------------------------------
  pick(e) {
    const b = this.canvas.getBoundingClientRect(), v = this.v;
    const px = (e.clientX - b.left) * (this.W / b.width), py = (e.clientY - b.top) * (this.H / b.height);
    // the nearest symbol in reach of the finger, else the spot itself
    const reach = 26 * this.dpr;
    let best = null, bd = Infinity;
    for (const h of this.hits) {
      const d = Math.hypot(px - h.x, py - h.y);
      if (d < Math.max(reach, h.r * 1.4) && d < bd) { bd = d; best = h; }
    }
    if (best) this.sel = { ...best.sel };
    else {
      const x = v.cx + (px - this.W / 2) / v.k, z = v.cz + (py - this.H / 2) / v.k;
      if (Math.hypot(x, z) > this.worldR()) return; // outside the world
      this.sel = { kind: 'spot', x, z };
    }
    play('ui');
    this.draw();
  }

  // world position of the pick
  selPos(s = this.sel) {
    const game = this.game;
    if (!s) return null;
    if (s.kind === 'outpost') return game.world.safes[s.si];
    if (s.kind === 'gate') return game.gates.list[s.gi];
    if (s.kind === 'hunt') {
      const i = game.hunts.i, E = game.enemies;
      return i >= 0 && E.alive[i] ? { x: E.x[i], z: E.z[i] } : null;
    }
    return s;
  }

  act(a) {
    const game = this.game, s = this.sel, W = game.waypoint;
    if (!s) return;
    if (a === 'back') { this.sel = null; play('ui'); }
    else if (a === 'travel') {
      if (!game.player.inCamp || s.kind !== 'outpost') return;
      this.close();
      game.travel(s.si);
      return;
    } else if (a === 'center') {
      const p = this.selPos();
      if (p) { this.v.cx = p.x; this.v.cz = p.z; this.clampView(); }
      play('ui');
    } else if (a === 'mark') {
      const p = this.selPos();
      if (!p) { this.sel = null; this.draw(); return; }
      if (s.kind === 'gate') W.set({ kind: 'gate', gi: s.gi, gen: game.gates.list[s.gi].gen, x: p.x, z: p.z });
      else if (s.kind === 'outpost') W.set({ kind: 'outpost', si: s.si, x: p.x, z: p.z });
      else W.set({ kind: 'spot', x: Math.round(p.x), z: Math.round(p.z) });
      game.hud.toast(t('map.marked'));
    } else if (a === 'unmark') {
      W.clear();
      play('ui');
    }
    this.draw();
  }

  // the side panel for the pick
  selPanel() {
    const game = this.game, s = this.sel, P = game.player, W = game.waypoint;
    if (!s) return '';
    const p = this.selPos();
    if (!p) { this.sel = null; return ''; } // the hunted monster is gone
    const dist = Math.round(Math.hypot(p.x - P.x, p.z - P.z));
    let title = '', sub = '', extra = '';
    const btns = [];
    let marked = false;
    if (s.kind === 'outpost') {
      const sf = game.world.safes[s.si];
      title = game.safeName(s.si);
      marked = W.is('outpost', s.si);
      if (sf.captured) {
        sub = s.si === game.respawnIndex ? t('travel.respawn') : t('map.yourOutpost');
        if (s.si === P.safeIndex) extra = t('travel.here');
        else {
          btns.push(`<button class="ap-btn" data-act="travel"${P.inCamp ? '' : ' disabled'}>${t('travel.go')}</button>`);
          if (!P.inCamp) extra = t('map.travelFrom');
        }
      } else {
        sub = t('map.enemyOutpost');
      }
    } else if (s.kind === 'gate') {
      const gt = game.gates.list[s.gi], zone = CONFIG.world.zones[gt.zone];
      const tier = CONFIG.gates.difficulties[gt.diff].id === 'deadly' ? game.gateTier(gt.zone) : 0;
      title = t('map.gateName', { zone: t('zone.' + zone.id), diff: t('gate.diff.' + CONFIG.gates.difficulties[gt.diff].id) + (tier ? ' +' + tier : '') });
      sub = t('map.gateLevel', { level: gt.level });
      marked = W.is('gate', s.gi);
    } else if (s.kind === 'hunt') {
      title = t('hunt.mapName', { name: game.hunts.name });
      sub = t('zone.' + CONFIG.world.zones[game.hunts.zone].id);
      extra = t('map.huntNote');
    } else {
      title = t('map.spot');
      const zi = game.world.zoneIndexAt(Math.hypot(p.x, p.z));
      sub = zi >= 0 && game.knownZones.has(zi) ? t('zone.' + CONFIG.world.zones[zi].id) : '';
      const m = W.m && W.m.kind === 'spot' ? W.m : null;
      marked = !!m && Math.hypot(m.x - p.x, m.z - p.z) < 8;
    }
    btns.push(marked
      ? `<button class="ap-btn ghost" data-act="unmark">${t('map.unmark')}</button>`
      : `<button class="ap-btn gold" data-act="mark">${t('map.mark')}</button>`);
    btns.push(`<button class="ap-btn ghost" data-act="center">${t('map.center')}</button>`);
    return `<div class="bm-card"><div class="bm-ch"><b>${title}</b><button class="bm-x" data-act="back" aria-label="${t('menu.close')}">×</button></div>
      <small>${[sub, t('map.dist', { n: dist })].filter(Boolean).join(' · ')}</small>
      ${extra ? `<em>${extra}</em>` : ''}<div class="bm-btns">${btns.join('')}</div></div>`;
  }

  // ---- drawing -------------------------------------------------------------------
  draw() {
    if (!this.isOpen) return;
    const game = this.game, P = game.player, cv = this.canvas, g = this.ctx;
    this.size();
    const W = this.W, H = this.H, S = Math.min(W, H), v = this.v;
    const zones = CONFIG.world.zones;
    this.clampView();
    const k = v.k;
    g.clearRect(0, 0, W, H);
    const { X, Y } = paintWorld(game, g, W, H, v.cx, v.cz, k, true, k > 0.5 * this.dpr);
    const hits = this.hits = [];
    const on = (x, y, r) => x >= r && x <= W - r && y >= r && y <= H - r;
    const sym = Math.max(S / 70, 3.5 * this.dpr); // the base size of the symbols

    // the camp can be picked too (travel back)
    hits.push({ x: X(0), y: Y(0), r: Math.max(S / 45, CONFIG.world.campRadius * k), sel: { kind: 'outpost', si: 0 } });
    // outposts of known zones (enemy ones once their land is explored)
    const r = Math.max(4, Math.min(S / 40, 30 * k, sym * 2.4));
    game.world.safes.forEach((s, si) => {
      if (si === 0 || !game.knownZones.has(s.zone)) return;
      if (!s.captured && !game.fog.explored(s.x, s.z)) return; // still in the fog
      const x = X(s.x), y = Y(s.z);
      if (!on(x, y, -r)) return;
      ICON.outpost(g, x, y, r, s.captured, si === game.respawnIndex);
      hits.push({ x, y, r, sel: { kind: 'outpost', si } });
    });
    // every open gate of the zones you know, so you can head for it
    game.gates.list.forEach((gt, gi) => {
      if (!gt.open || gt.abyss || gt.trial || !game.knownZones.has(gt.zone)) return;
      const x = X(gt.x), y = Y(gt.z), s = sym * 1.15 * (1 + gt.diff * 0.15);
      if (!on(x, y, -s)) return;
      ICON.gate(g, x, y, s, zones[gt.zone].gateColor, CONFIG.gates.difficulties[gt.diff].color);
      hits.push({ x, y, r: s * 1.3, sel: { kind: 'gate', gi } });
    });
    // the hunted monster
    const hi = game.hunts.i;
    if (hi >= 0 && game.enemies.alive[hi]) {
      const x = X(game.enemies.x[hi]), y = Y(game.enemies.z[hi]), hr = sym * 1.9;
      if (on(x, y, -hr)) {
        ICON.hunt(g, x, y, hr);
        hits.push({ x, y, r: hr, sel: { kind: 'hunt' } });
      }
    }
    paintLabels(game, g, W, H, X(0), Y(0), k);
    // the target
    const wp = game.waypoint.pos();
    if (wp && on(X(wp.x), Y(wp.z), -20)) ICON.mark(g, X(wp.x), Y(wp.z), Math.max(7, S / 40));
    // what was tapped
    const sp = this.selPos();
    if (sp) {
      const x = X(sp.x), y = Y(sp.z), rr = Math.max(10, S / 28);
      g.strokeStyle = '#ffffff';
      g.lineWidth = Math.max(2, S / 260);
      g.setLineDash([rr * 0.5, rr * 0.35]);
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.stroke();
      g.setLineDash([]);
    }
    // the hunter, with a ring so it is easy to find; far off screen: an arrow at the edge
    const px = X(P.x), py = Y(P.z), pr = Math.max(7, S / 45);
    if (on(px, py, -pr)) {
      g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      g.lineWidth = Math.max(1.5, S / 300);
      g.beginPath(); g.arc(px, py, pr * 1.6, 0, Math.PI * 2); g.stroke();
      ICON.player(g, px, py, Math.atan2(P.dirZ, P.dirX), pr);
    } else {
      const m = pr * 2.2, ex = Math.max(m, Math.min(W - m, px)), ey = Math.max(m, Math.min(H - m, py));
      ICON.arrow(g, ex, ey, Math.atan2(py - H / 2, px - W / 2), pr * 1.5);
    }

    const zi = game.curZone, z = zones[zi];
    this.el.querySelector('.bm-zone').textContent = t('zone.' + z.id) + ' · ' + t('map.rank', { rank: z.rank });
    this.el.querySelector('.bm-zoom span').textContent = '×' + (k / this.kMin()).toFixed(1);
    this.el.querySelector('.bm-explored').textContent = t('map.explored', { pct: Math.round(game.fog.share() * 100) });
    this.el.querySelector('.bm-hint').textContent = this.sel ? '' : t(P.inCamp ? 'map.hintTravel' : 'map.hint');
    // the side panel is rebuilt only when it changed (it holds the buttons being pressed)
    const panel = this.selPanel();
    if (panel !== this.panelHtml) { this.panelHtml = panel; this.selEl.innerHTML = panel; }
    this.el.classList.toggle('picked', !!this.sel);
  }
}
