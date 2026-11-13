// Draws the Noctis app icon (a glowing violet crescent on a dark background)
// in code and writes it as PNG files in every size the PWA needs, plus an SVG
// favicon. No image library needed: pixels come from distance functions and
// are written with a tiny PNG encoder (zlib is part of Node).
//
// Run: node scripts/make-icons.mjs   (also runs before every build)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const OUT = path.resolve('public/icons');
fs.mkdirSync(OUT, { recursive: true });

// ---- PNG encoder ---------------------------------------------------------------
const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- the picture -------------------------------------------------------------------
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

// scale < 1 leaves room around the crescent (maskable icons get cropped)
function draw(size, scale, rounded) {
  const px = Buffer.alloc(size * size * 4);
  const aa = 1.5 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // coordinates: -1..1, y up
      const u = ((x + 0.5) / size) * 2 - 1, v = 1 - ((y + 0.5) / size) * 2;
      // background: dark violet radial gradient
      const r0 = Math.hypot(u + 0.15, v - 0.1);
      let R = mix(0.16, 0.035, smooth(0, 1.3, r0));
      let G = mix(0.08, 0.02, smooth(0, 1.3, r0));
      let B = mix(0.32, 0.07, smooth(0, 1.3, r0));
      // crescent = big disc minus a shifted disc
      const cu = u / scale, cv = v / scale;
      const d1 = Math.hypot(cu + 0.05, cv) - 0.62;
      const d2 = Math.hypot(cu - 0.27, cv - 0.2) - 0.52;
      const d = Math.max(d1, -d2) * scale;
      // glow around it
      const glow = Math.exp(-Math.max(0, d) / 0.11) * 0.75;
      R += 0.54 * glow; G += 0.3 * glow; B += 1.0 * glow;
      // the crescent itself: white at the rim, violet inside
      const inside = 1 - smooth(-aa, aa, d);
      if (inside > 0) {
        const t = smooth(0, 0.6, -cv * 0.6 + cu * 0.4 + 0.3);
        const cr = mix(1.0, 0.72, t), cg = mix(0.97, 0.55, t), cb = mix(1.0, 1.0, t);
        R = mix(R, cr, inside); G = mix(G, cg, inside); B = mix(B, cb, inside);
      }
      // a few small stars
      for (const [sx, sy, sr] of [[0.55, 0.55, 0.035], [0.7, 0.15, 0.022], [0.35, 0.75, 0.018]]) {
        const s = 1 - smooth(0, sr * scale, Math.hypot(u - sx * scale, v - sy * scale));
        R = mix(R, 1, s); G = mix(G, 0.95, s); B = mix(B, 1, s);
      }
      // rounded corners for the plain icons (the maskable one is full bleed)
      let A = 1;
      if (rounded) {
        const k = 0.36, qx = Math.max(Math.abs(u) - (1 - k), 0), qy = Math.max(Math.abs(v) - (1 - k), 0);
        A = 1 - smooth(-aa, aa, Math.hypot(qx, qy) - k);
      }
      const o = (y * size + x) * 4;
      px[o] = Math.round(clamp(R) * 255);
      px[o + 1] = Math.round(clamp(G) * 255);
      px[o + 2] = Math.round(clamp(B) * 255);
      px[o + 3] = Math.round(A * 255);
    }
  }
  return png(size, px);
}

const files = [
  ['icon-64.png', 64, 1, true],
  ['icon-192.png', 192, 1, true],
  ['icon-512.png', 512, 1, true],
  ['maskable-512.png', 512, 0.72, false], // Android crops these to a circle or squircle
  ['apple-touch-icon-180.png', 180, 0.92, false],
];
for (const [name, size, scale, rounded] of files) {
  fs.writeFileSync(path.join(OUT, name), draw(size, scale, rounded));
}

// SVG favicon for the browser tab
fs.writeFileSync(path.join(OUT, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><radialGradient id="g" cx="45%" cy="45%" r="70%"><stop offset="0" stop-color="#2a1452"/><stop offset="1" stop-color="#09050f"/></radialGradient>
  <filter id="f"><feGaussianBlur stdDeviation="2.2"/></filter></defs>
  <rect width="64" height="64" rx="14" fill="url(#g)"/>
  <path d="M38 12a19 19 0 1 0 14 31A16 16 0 1 1 38 12z" fill="#8a4dff" filter="url(#f)"/>
  <path d="M38 12a19 19 0 1 0 14 31A16 16 0 1 1 38 12z" fill="#e6d8ff"/>
</svg>
`);
console.log('icons written to ' + OUT);
