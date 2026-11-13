// The world: ring shaped zones around the camp, ground mesh, streamed
// decoration chunks (InstancedMesh, pooled) and simple circle colliders.
import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { gfx } from '../core/settings.js';
import { mulberry32, hashSeed } from '../core/rng.js';
import { flatMaterial } from '../render/geo.js';
import { DECOR, FLOWER_COLORS } from '../render/models/props.js';
import { buildCamp } from './camp.js';
import { buildOutposts } from './outposts.js';

const VOID_COLOR = 0x0d0a16;
const MAX_CHUNK_COLLIDERS = 48;
const GATE_CLEAR = 9; // no decoration this close to a gate
// unlit material for glowing decoration (lava, crystals, glowing mushrooms)
const glowMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color();
const _c2 = new THREE.Color();

function chunkKey(cx, cz) {
  return (cx + 512) * 1024 + (cz + 512);
}

export class World {
  constructor(scene, seed) {
    this.scene = scene;
    this.seed = seed;
    this.zones = CONFIG.world.zones;
    this.radius = this.zones[this.zones.length - 1].outer;
    this.campRadius = CONFIG.world.campRadius;

    // result of resolve()
    this.rx = 0;
    this.rz = 0;

    // static colliders (camp props): x, z, r triples
    this.statics = [];

    this.chunks = new Map();
    this.freeChunks = [];
    this.meshPool = {};
    this.decor = {};
    for (const type in DECOR) {
      let cap = 0;
      for (const z of this.zones) cap = Math.max(cap, Math.ceil(z.decor[type] || 0));
      this.decor[type] = { def: DECOR[type], geo: null, cap: cap + 1 };
      this.meshPool[type] = [];
    }
    this.lastCx = 1e9;
    this.lastCz = 1e9;
    this.pending = false;

    // Safe places: the camp (index 0) and 4 outposts per zone at north, east,
    // south and west, half way through the ring.
    this.safes = [{ x: 0, z: 0, r: this.campRadius, zone: -1, dir: -1 }];
    const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // north, east, south, west
    this.zones.forEach((zone, zi) => {
      const r = (zone.inner + zone.outer) / 2;
      DIRS.forEach(([dx, dz], d) => {
        this.safes.push({ x: dx * r, z: dz * r, r: CONFIG.outposts.radius, zone: zi, dir: d });
      });
    });

    // one gate per zone, half way through the ring, between two outposts
    const grng = mulberry32(hashSeed(seed, 777, 13));
    this.gates = this.zones.map((zone, i) => {
      const a = Math.PI / 4 + ((grng() * 4) | 0) * (Math.PI / 2) + (grng() - 0.5) * 0.5;
      const r = (zone.inner + zone.outer) / 2;
      return { zone: i, x: Math.cos(a) * r, z: Math.sin(a) * r };
    });

    this.buildGround();
    this.camp = buildCamp(scene, this);
    this.outposts = buildOutposts(scene, this.safes);
  }

  zoneAt(r) {
    const zs = this.zones;
    for (let i = 0; i < zs.length; i++) if (r >= zs[i].inner && r < zs[i].outer) return zs[i];
    return null;
  }

  // index of the zone at distance r from the centre (-1 = camp or outside)
  zoneIndexAt(r) {
    const zs = this.zones;
    for (let i = 0; i < zs.length; i++) if (r >= zs[i].inner && r < zs[i].outer) return i;
    return -1;
  }

  // index of the safe place (0 = camp) at (x, z), or -1
  safeIndexAt(x, z) {
    const S = this.safes;
    for (let i = 0; i < S.length; i++) {
      const dx = x - S[i].x, dz = z - S[i].z;
      if (dx * dx + dz * dz < S[i].r * S[i].r) return i;
    }
    return -1;
  }

  nearSafe(x, z, extra) {
    const S = this.safes;
    for (let i = 0; i < S.length; i++) {
      const dx = x - S[i].x, dz = z - S[i].z, r = S[i].r + extra;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // Pushes a circle out of every safe place (enemies use this). Result in rx / rz.
  pushOutOfSafe(x, z, r) {
    const S = this.safes;
    for (let i = 0; i < S.length; i++) {
      const dx = x - S[i].x, dz = z - S[i].z, m = S[i].r + r + 1.2;
      const d2 = dx * dx + dz * dz;
      if (d2 < m * m && d2 > 1e-4) {
        const k = m / Math.sqrt(d2);
        x = S[i].x + dx * k;
        z = S[i].z + dz * k;
      }
    }
    this.rx = x;
    this.rz = z;
  }

  nearGate(x, z, dist) {
    for (const g of this.gates) {
      const dx = g.x - x, dz = g.z - z;
      if (dx * dx + dz * dz < dist * dist) return true;
    }
    return false;
  }

  // ---- ground -------------------------------------------------------------
  // The ground is split into square tiles so the camera only draws the few
  // tiles it can see. Vertex colours come from the zone at that distance;
  // shared tile borders get the same colour (hash of the vertex position).
  buildGround() {
    const T = CONFIG.world.groundTile, C = CONFIG.world.groundCell, n = Math.round(T / C);
    const maxR = this.radius + CONFIG.world.voidWidth;
    const span = Math.ceil(maxR / T);
    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const seed = this.seed;
    const rnd = (ix, iz, k) => hashSeed(seed, ix * 7 + k, iz) / 4294967296;
    _c2.setHex(VOID_COLOR);
    // one index buffer shared by all tiles
    const idx = [];
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const a = j * (n + 1) + i, b = a + 1, c = a + n + 1, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    const index = new THREE.Uint16BufferAttribute(idx, 1);
    const normals = new Float32Array((n + 1) * (n + 1) * 3);
    for (let i = 1; i < normals.length; i += 3) normals[i] = 1;
    const normalAttr = new THREE.BufferAttribute(normals, 3);
    this.ground = new THREE.Group();
    for (let tz = -span; tz < span; tz++) {
      for (let tx = -span; tx < span; tx++) {
        const x0 = tx * T, z0 = tz * T;
        // skip tiles completely outside the world
        const nx = Math.max(x0, Math.min(0, x0 + T)), nz = Math.max(z0, Math.min(0, z0 + T));
        if (nx * nx + nz * nz > maxR * maxR) continue;
        const pos = new Float32Array((n + 1) * (n + 1) * 3);
        const col = new Float32Array((n + 1) * (n + 1) * 3);
        let k = 0;
        for (let j = 0; j <= n; j++) {
          for (let i = 0; i <= n; i++) {
            const ix = tx * n + i, iz = tz * n + j;
            const x = ix * C, z = iz * C;
            pos[k] = x; pos[k + 1] = 0; pos[k + 2] = z;
            const r = Math.max(Math.hypot(x, z), this.campRadius);
            // ragged borders: near a zone edge the vertex may take the other colour
            const jitter = (rnd(ix, iz, 1) - 0.5) * 18;
            const zone = this.zoneAt(r + jitter) || this.zoneAt(r);
            if (zone) {
              const gc = zone.groundColors;
              _c.setHex(gc[(rnd(ix, iz, 2) * gc.length) | 0]);
              _c.multiplyScalar(0.9 + rnd(ix, iz, 3) * 0.2);
              const edge = (r - (this.radius - 12)) / 12; // fade into the void
              if (edge > 0) _c.lerp(_c2, Math.min(1, edge));
            } else {
              _c.copy(_c2);
            }
            col[k] = _c.r; col[k + 1] = _c.g; col[k + 2] = _c.b;
            k += 3;
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', normalAttr);
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        g.setIndex(index);
        g.computeBoundingSphere();
        const mesh = new THREE.Mesh(g, material);
        mesh.matrixAutoUpdate = false;
        this.ground.add(mesh);
      }
    }
    this.scene.add(this.ground);
  }

  // ---- collision ----------------------------------------------------------
  addStatic(x, z, r) {
    this.statics.push(x, z, r);
  }

  // Pushes a circle out of all nearby colliders. Result in this.rx / this.rz.
  resolve(x, z, r) {
    const cr = this.campRadius + 4;
    if (x * x + z * z < cr * cr) {
      const s = this.statics;
      for (let i = 0; i < s.length; i += 3) {
        const dx = x - s[i], dz = z - s[i + 1], min = r + s[i + 2];
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-6) {
          const d = Math.sqrt(d2), k = (min - d) / d;
          x += dx * k; z += dz * k;
        }
      }
    }
    const cs = CONFIG.world.chunkSize;
    const m = r + 1.6;
    const cx0 = Math.floor((x - m) / cs), cx1 = Math.floor((x + m) / cs);
    const cz0 = Math.floor((z - m) / cs), cz1 = Math.floor((z + m) / cs);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cz = cz0; cz <= cz1; cz++) {
        const ch = this.chunks.get(chunkKey(cx, cz));
        if (!ch) continue;
        const col = ch.col;
        for (let j = 0, n = ch.nCol * 3; j < n; j += 3) {
          const dx = x - col[j], dz = z - col[j + 1], min = r + col[j + 2];
          const d2 = dx * dx + dz * dz;
          if (d2 < min * min && d2 > 1e-6) {
            const d = Math.sqrt(d2), k = (min - d) / d;
            x += dx * k; z += dz * k;
          }
        }
      }
    }
    this.rx = x;
    this.rz = z;
  }

  // ---- decoration streaming ----------------------------------------------
  update(px, pz, force) {
    const cs = CONFIG.world.chunkSize;
    const pcx = Math.floor(px / cs), pcz = Math.floor(pz / cs);
    if (!force && !this.pending && pcx === this.lastCx && pcz === this.lastCz) return;
    this.lastCx = pcx;
    this.lastCz = pcz;
    const R = gfx.decorRadius;
    const span = Math.ceil(R / cs);
    let budget = force ? 999 : 2;
    this.pending = false;
    for (let cx = pcx - span; cx <= pcx + span; cx++) {
      for (let cz = pcz - span; cz <= pcz + span; cz++) {
        const dx = (cx + 0.5) * cs - px, dz = (cz + 0.5) * cs - pz;
        if (dx * dx + dz * dz > R * R) continue;
        if (this.chunks.has(chunkKey(cx, cz))) continue;
        if (budget <= 0) { this.pending = true; continue; }
        this.loadChunk(cx, cz);
        budget--;
      }
    }
    // unload far chunks
    const U = R + cs * 1.5;
    for (const ch of this.chunks.values()) {
      const dx = (ch.cx + 0.5) * cs - px, dz = (ch.cz + 0.5) * cs - pz;
      if (dx * dx + dz * dz > U * U) this.unloadChunk(ch);
    }
  }

  takeMesh(type) {
    const pool = this.meshPool[type];
    if (pool.length) return pool.pop();
    const d = this.decor[type];
    if (!d.geo) d.geo = d.def.build();
    const mesh = new THREE.InstancedMesh(d.geo, d.def.glow ? glowMaterial : flatMaterial, d.cap);
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(d.cap * 3).fill(1), 3);
    mesh.boundingSphere = new THREE.Sphere();
    mesh.matrixAutoUpdate = false;
    return mesh;
  }

  loadChunk(cx, cz) {
    const cs = CONFIG.world.chunkSize;
    const ch = this.freeChunks.pop() || {
      cx: 0, cz: 0, key: 0, meshes: [], types: [], col: new Float32Array(MAX_CHUNK_COLLIDERS * 3), nCol: 0,
    };
    ch.cx = cx; ch.cz = cz; ch.key = chunkKey(cx, cz); ch.nCol = 0;
    this.chunks.set(ch.key, ch);

    const rng = mulberry32(hashSeed(this.seed, cx, cz));
    const x0 = cx * cs, z0 = cz * cs;
    const dc = Math.hypot(x0 + cs / 2, z0 + cs / 2), hd = cs * 0.7072;
    for (const zone of this.zones) {
      if (dc + hd < zone.inner || dc - hd > zone.outer) continue;
      for (const type in zone.decor) {
        const d = this.decor[type];
        const dens = zone.decor[type];
        const n = Math.floor(dens) + (rng() < dens % 1 ? 1 : 0);
        let mesh = null, cnt = 0;
        for (let k = 0; k < n; k++) {
          const x = x0 + rng() * cs, z = z0 + rng() * cs;
          const sc = d.def.scale[0] + rng() * (d.def.scale[1] - d.def.scale[0]);
          const rot = rng() * Math.PI * 2;
          const tint = rng();
          const rr = Math.hypot(x, z);
          if (rr < zone.inner + 2 || rr >= zone.outer - 1) continue;
          if (this.nearGate(x, z, GATE_CLEAR) || this.nearSafe(x, z, 2)) continue;
          if (!mesh) mesh = this.takeMesh(type);
          _q.setFromAxisAngle(_up, rot);
          _m.compose(_p.set(x, 0, z), _q, _s.set(sc, sc, sc));
          mesh.setMatrixAt(cnt, _m);
          if (d.def.tint === 'flower') _c.setHex(FLOWER_COLORS[(tint * FLOWER_COLORS.length) | 0]);
          else _c.setScalar(0.82 + tint * 0.36);
          mesh.setColorAt(cnt, _c);
          cnt++;
          if (d.def.collide > 0 && ch.nCol < MAX_CHUNK_COLLIDERS) {
            const o = ch.nCol++ * 3;
            ch.col[o] = x; ch.col[o + 1] = z; ch.col[o + 2] = d.def.collide * sc;
          }
        }
        if (mesh) {
          mesh.count = cnt;
          mesh.instanceMatrix.needsUpdate = true;
          mesh.instanceColor.needsUpdate = true;
          mesh.boundingSphere.center.set(x0 + cs / 2, 2, z0 + cs / 2);
          mesh.boundingSphere.radius = hd + 4;
          this.scene.add(mesh);
          ch.meshes.push(mesh);
          ch.types.push(type);
        }
      }
    }
  }

  unloadChunk(ch) {
    for (let i = 0; i < ch.meshes.length; i++) {
      this.scene.remove(ch.meshes[i]);
      this.meshPool[ch.types[i]].push(ch.meshes[i]);
    }
    ch.meshes.length = 0;
    ch.types.length = 0;
    this.chunks.delete(ch.key);
    this.freeChunks.push(ch);
  }
}
