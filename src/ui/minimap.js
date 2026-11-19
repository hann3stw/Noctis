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

// The world part of a map: (cx, cz) in the middle, R world units to the
// edge, S pixels wide. big: the big map (thinner lines, the Abyss);
// chests: draw the chests (the big map only shows them nearby).
function paintWorld(game, g, S, cx, cz, R, big, chests = true) {
  const half = S / 2, k = half / R;
  const X = (x) => half + (x - cx) * k, Y = (z) => half + (z - cz) * k;
  const zones = CONFIG.world.zones, ox = X(0), oy = Y(0);
  // zones from the outside in, each a soft ring
  g.fillStyle = '#0b0814';
  g.fillRect(0, 0, S, S);
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
  game.fog.draw(g, cx, cz, k, S);

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
  const lim = R * R * 1.05;
  for (let i = 0; chests && i < L.chestCount; i++) {
    if (L.cT[i] > 0) continue;
    const dx = L.cx[i] - cx, dz = L.cz[i] - cz;
    if (dx * dx + dz * dz > lim || !game.fog.explored(L.cx[i], L.cz[i])) continue;
    ICON.chest(g, X(L.cx[i]), Y(L.cz[i]), cs);
  }

  // the camp and the Abyss portal
  ICON.camp(g, ox, oy, Math.max(S / (big ? 45 : 26), CONFIG.world.campRadius * k));
  const ab = game.gates.list[game.gates.abyssIndex];
  if (ab && big && k > 0.2) ICON.abyss(g, X(ab.x), Y(ab.z), S / 80);
  return { X, Y, k };
}

// zone names on the big map: on each ring up and to the left (the outposts
// sit on the straight lines through the camp), on a dark plate, drawn last
function paintLabels(game, g, S, ox, oy, k) {
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
    const lim = S / 2 - h * 0.3; // the whole plate inside the round map
    const fits = (x, y) => Math.hypot(x - w / 2 - S / 2, y - S / 2) < lim && Math.hypot(x + w / 2 - S / 2, y - S / 2) < lim
      && Math.abs(y - S / 2) + h / 2 < lim;
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
      ({ X, Y } = paintWorld(game, g, S, cx, cz, R, false));
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
        if (!gt.open || gt.abyss || gt.zone !== game.curZone) continue;
        let x = X(gt.x), y = Y(gt.z);
        const dx = x - half, dy = y - half, d = Math.hypot(dx, dy), lim = half - S / 14;
        const out = d > lim;
        if (out) { x = half + (dx / d) * lim; y = half + (dy / d) * lim; }
        const s = (S / (out ? 24 : 18)) * (1 + gt.diff * 0.15);
        ICON.gate(g, x, y, s, CONFIG.world.zones[gt.zone].gateColor, CONFIG.gates.difficulties[gt.diff].color);
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

    ICON.player(g, X(P.x), Y(P.z), Math.atan2(P.dirZ, P.dirX), S / 18);
  }
}

// ---- the big map ---------------------------------------------------------------------
// Opens over the game (which pauses). Three zoom steps: around the hunter,
// the known world, the whole world.
const LEGEND = [
  ['you', (g, s) => ICON.player(g, s / 2, s / 2, -Math.PI / 2, s * 0.4)],
  ['camp', (g, s) => ICON.camp(g, s / 2, s / 2, s * 0.38)],
  ['outpost', (g, s) => ICON.outpost(g, s / 2, s / 2, s * 0.32, true, false)],
  ['outpostEnemy', (g, s) => ICON.outpost(g, s / 2, s / 2, s * 0.32, false, false)],
  ['respawn', (g, s) => ICON.outpost(g, s / 2, s / 2, s * 0.25, true, true)],
  ['gate', (g, s) => ICON.gate(g, s / 2, s / 2, s * 0.24, 0x8a4dff, 0xff3050)],
  ['chest', (g, s) => ICON.chest(g, s / 2, s / 2, s * 0.28)],
  ['quest', (g, s) => ICON.quest(g, s / 2, s / 2, s * 0.32)],
];

// pressed and released on the same element
function tap(el, fn) {
  let id = -1;
  el.addEventListener('pointerdown', (e) => { e.stopPropagation(); id = e.pointerId; });
  el.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    if (e.pointerId !== id) return;
    id = -1;
    fn();
  });
  el.addEventListener('pointercancel', () => { id = -1; });
}

class BigMap {
  constructor(game, root) {
    this.game = game;
    this.isOpen = false;
    this.zoom = 1; // 0 around the hunter, 1 known world, 2 whole world
    this.el = document.createElement('div');
    this.el.id = 'bigmap';
    this.el.innerHTML = `<div class="bm-map"><canvas></canvas></div>
      <div class="bm-side">
        <b class="bm-title">${t('map.title')}</b>
        <small class="bm-zone"></small>
        <div class="bm-zoom"><button class="ap-btn" data-z="-1">−</button><span></span><button class="ap-btn" data-z="1">+</button></div>
        <div class="bm-legend">${LEGEND.map(([id]) => `<div><canvas data-l="${id}"></canvas><span>${t('map.l.' + id)}</span></div>`).join('')}</div>
        <small class="bm-explored"></small>
        <button class="ap-btn ghost bm-close">${t('menu.close')}</button>
      </div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('.bm-map canvas');
    this.ctx = this.canvas.getContext('2d');
    // taps work like the other HUD buttons (pressed and released on the same
    // element); a plain click does not reach the HUD on phones
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    tap(this.el.querySelector('.bm-close'), () => this.close());
    tap(this.el.querySelector('.bm-map'), () => this.close());
    this.el.querySelectorAll('[data-z]').forEach((b) => tap(b, () => {
      this.zoom = Math.max(0, Math.min(2, this.zoom - Number(b.dataset.z)));
      play('ui');
      this.draw();
    }));
    this.onKey = (e) => {
      if (e.code === 'KeyM' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
    };
  }

  open() {
    if (this.isOpen || this.game.menu.isOpen) return;
    this.isOpen = true;
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

  draw() {
    const game = this.game, P = game.player, cv = this.canvas, g = this.ctx;
    const box = cv.parentElement.getBoundingClientRect();
    const css = Math.floor(Math.min(box.width, box.height));
    const S = Math.round(css * Math.min(2, window.devicePixelRatio || 1));
    cv.style.width = cv.style.height = css + 'px';
    if (cv.width !== S) cv.width = cv.height = S;
    const zones = CONFIG.world.zones;
    let known = CONFIG.world.campRadius;
    zones.forEach((z, i) => { if (game.knownZones.has(i)) known = Math.max(known, z.outer); });
    const full = zones[zones.length - 1].outer + 20;
    let cx = 0, cz = 0, R;
    if (this.zoom === 0) { cx = P.x; cz = P.z; R = 260; }
    else if (this.zoom === 1) R = Math.min(full, known + 120);
    else R = full;
    g.clearRect(0, 0, S, S);
    g.save();
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2 - 1, 0, Math.PI * 2);
    g.clip();
    const { X, Y, k } = paintWorld(game, g, S, cx, cz, R, true, this.zoom === 0);
    g.restore();

    // outposts of known zones
    const r = Math.max(4, Math.min(S / 40, 30 * k));
    game.world.safes.forEach((s, si) => {
      if (si === 0 || !game.knownZones.has(s.zone)) return;
      if (!s.captured && !game.fog.explored(s.x, s.z)) return; // still in the fog
      const x = X(s.x), y = Y(s.z);
      if (Math.hypot(x - S / 2, y - S / 2) > S / 2 - r) return;
      ICON.outpost(g, x, y, r, s.captured, si === game.respawnIndex);
    });
    // the open gates of the zone you are in
    for (const gt of game.gates.list) {
      if (!gt.open || gt.abyss || gt.zone !== game.curZone) continue;
      const x = X(gt.x), y = Y(gt.z);
      if (Math.hypot(x - S / 2, y - S / 2) > S / 2) continue;
      ICON.gate(g, x, y, Math.max(4, S / 70) * (1 + gt.diff * 0.15), zones[gt.zone].gateColor, CONFIG.gates.difficulties[gt.diff].color);
    }
    paintLabels(game, g, S, X(0), Y(0), k);
    // the hunter, with a ring so it is easy to find
    const px = X(P.x), py = Y(P.z), pr = Math.max(7, S / 45);
    g.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    g.lineWidth = Math.max(1.5, S / 300);
    g.beginPath(); g.arc(px, py, pr * 1.6, 0, Math.PI * 2); g.stroke();
    ICON.player(g, px, py, Math.atan2(P.dirZ, P.dirX), pr);
    // the frame
    g.strokeStyle = 'rgba(233, 199, 123, 0.8)';
    g.lineWidth = Math.max(2, S / 200);
    g.beginPath(); g.arc(S / 2, S / 2, S / 2 - g.lineWidth, 0, Math.PI * 2); g.stroke();

    const zi = game.curZone, z = zones[zi];
    this.el.querySelector('.bm-zone').textContent = t('zone.' + z.id) + ' · ' + t('map.rank', { rank: z.rank });
    this.el.querySelector('.bm-zoom span').textContent = t('map.zoom' + this.zoom);
    this.el.querySelector('.bm-explored').textContent = t('map.explored', { pct: Math.round(game.fog.share() * 100) });
  }
}
