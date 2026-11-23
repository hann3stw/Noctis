// Fog of the map: a whole zone (one ring of the world) lies in the fog until the
// hunter steps into it; then the entire zone is uncovered at once. The map
// (minimap and big map) shows unexplored zones dark. The world is cut into
// squares for it. The uncovered squares are kept as a small picture (one pixel per
// square, transparent = explored) that the maps lay over the land, smoothly
// scaled, so the edge of the fog looks soft. Saved with the world as bits.
import { CONFIG } from '../config.js';

const DARK = [9, 6, 16, 238];

export class Fog {
  constructor(game, saved) {
    this.game = game;
    const zones = CONFIG.world.zones;
    this.cell = CONFIG.minimap.fogCell;
    this.R = zones[zones.length - 1].outer + CONFIG.world.voidWidth; // the map reaches this far
    this.n = Math.ceil((this.R * 2) / this.cell);
    this.bits = new Uint8Array(this.n * this.n);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = this.n;
    this.ctx = this.canvas.getContext('2d');
    this.img = this.ctx.createImageData(this.n, this.n);
    const d = this.img.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = DARK[0]; d[i + 1] = DARK[1]; d[i + 2] = DARK[2]; d[i + 3] = DARK[3]; }
    this.t = 0;
    this.dirty = true;
    this.count = 0;
    if (saved === 'legacy') this.revealKnown();
    else if (typeof saved === 'string') this.load(saved);
    this.revealAround(0, 0, CONFIG.world.campRadius + 30); // the camp is always known
    this.completeZones(); // a zone that was begun (older saves had patches) is uncovered whole
    this.zone = -1;
    this.flush();
  }

  idx(x, z) {
    const cx = Math.floor((x + this.R) / this.cell), cz = Math.floor((z + this.R) / this.cell);
    if (cx < 0 || cz < 0 || cx >= this.n || cz >= this.n) return -1;
    return cz * this.n + cx;
  }

  explored(x, z) {
    const i = this.idx(x, z);
    return i >= 0 && this.bits[i] === 1;
  }

  set(i) {
    if (this.bits[i]) return;
    this.bits[i] = 1;
    this.img.data[i * 4 + 3] = 0;
    this.count++;
    this.dirty = true;
  }

  revealAround(x, z, r) {
    const c = this.cell, r2 = r * r;
    const x0 = Math.floor((x - r + this.R) / c), x1 = Math.floor((x + r + this.R) / c);
    const z0 = Math.floor((z - r + this.R) / c), z1 = Math.floor((z + r + this.R) / c);
    for (let cz = Math.max(0, z0); cz <= Math.min(this.n - 1, z1); cz++) {
      for (let cx = Math.max(0, x0); cx <= Math.min(this.n - 1, x1); cx++) {
        const wx = (cx + 0.5) * c - this.R - x, wz = (cz + 0.5) * c - this.R - z;
        if (wx * wx + wz * wz <= r2) this.set(cz * this.n + cx);
      }
    }
  }

  // worlds from before the fog: every zone they already know is uncovered
  revealKnown() {
    const zones = CONFIG.world.zones, known = this.game.knownZones, c = this.cell;
    for (let cz = 0; cz < this.n; cz++) {
      for (let cx = 0; cx < this.n; cx++) {
        const r = Math.hypot((cx + 0.5) * c - this.R, (cz + 0.5) * c - this.R);
        const zi = zones.findIndex((z) => r < z.outer);
        if (zi >= 0 && known.has(zi)) this.set(cz * this.n + cx);
      }
    }
  }

  // the zone (ring) of a world point, -1 outside the world
  zoneAt(x, z) {
    const r = Math.hypot(x, z), zones = CONFIG.world.zones;
    return zones.findIndex((zn) => r < zn.outer);
  }

  // uncovers a whole zone
  revealZone(zi) {
    const zones = CONFIG.world.zones, c = this.cell;
    for (let cz = 0; cz < this.n; cz++) {
      for (let cx = 0; cx < this.n; cx++) {
        const r = Math.hypot((cx + 0.5) * c - this.R, (cz + 0.5) * c - this.R);
        if (zones.findIndex((zn) => r < zn.outer) === zi) this.set(cz * this.n + cx);
      }
    }
  }

  // every zone with at least one uncovered square is uncovered whole (the camp alone does not count for the meadow)
  completeZones() {
    const zones = CONFIG.world.zones, c = this.cell, seen = new Set();
    for (let cz = 0; cz < this.n; cz++) {
      for (let cx = 0; cx < this.n; cx++) {
        if (!this.bits[cz * this.n + cx]) continue;
        const r = Math.hypot((cx + 0.5) * c - this.R, (cz + 0.5) * c - this.R);
        const zi = zones.findIndex((zn) => r < zn.outer);
        if (zi >= 0 && (zi > 0 || r > CONFIG.world.campRadius + 40)) seen.add(zi);
      }
    }
    for (const zi of seen) this.revealZone(zi);
  }

  // share of the world (inside the last zone) that is explored
  share() {
    const zones = CONFIG.world.zones, outer = zones[zones.length - 1].outer;
    return Math.min(1, (this.count * this.cell * this.cell) / (Math.PI * outer * outer));
  }

  flush() {
    if (!this.dirty) return;
    this.dirty = false;
    this.ctx.putImageData(this.img, 0, 0);
  }

  update(dt) {
    if ((this.t -= dt) > 0) return;
    this.t = 0.25;
    const P = this.game.player;
    if (this.game.gates.active >= 0 || P.dead) return;
    const zi = this.zoneAt(P.x, P.z);
    if (zi >= 0 && zi !== this.zone) { this.zone = zi; this.revealZone(zi); } // stepping into a zone uncovers all of it
  }

  // Draws the fog over a map: (cx, cz) world point in the middle, k pixels
  // per world unit, size W x H.
  draw(g, cx, cz, k, W, H = W) {
    this.flush();
    const c = this.cell;
    // the world rectangle seen, in fog pixels
    const sx = (cx - W / 2 / k + this.R) / c, sz = (cz - H / 2 / k + this.R) / c, sw = W / k / c, sh = H / k / c;
    g.save();
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    // the part of the view outside the fog picture (outside the world) stays dark
    const n = this.canvas.width;
    const x0 = Math.max(0, sx), z0 = Math.max(0, sz), x1 = Math.min(n, sx + sw), z1 = Math.min(n, sz + sh);
    if (x1 > x0 && z1 > z0) {
      g.drawImage(this.canvas, x0, z0, x1 - x0, z1 - z0, ((x0 - sx) / sw) * W, ((z0 - sz) / sh) * H, ((x1 - x0) / sw) * W, ((z1 - z0) / sh) * H);
    }
    g.restore();
  }

  serialize() {
    // 8 squares per byte, as text
    const out = new Uint8Array(Math.ceil(this.bits.length / 8));
    for (let i = 0; i < this.bits.length; i++) if (this.bits[i]) out[i >> 3] |= 1 << (i & 7);
    let s = '';
    for (let i = 0; i < out.length; i += 4096) s += String.fromCharCode.apply(null, out.subarray(i, i + 4096));
    return btoa(s);
  }

  load(text) {
    try {
      const s = atob(text);
      for (let i = 0; i < this.bits.length && (i >> 3) < s.length; i++) {
        if (s.charCodeAt(i >> 3) & (1 << (i & 7))) this.set(i);
      }
    } catch (_) { this.revealKnown(); }
  }
}
