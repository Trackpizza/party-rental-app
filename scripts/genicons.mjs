// PWA icon generator — dependency-free (Node's zlib only).
//
// Draws a white glyph on a brand-colored rounded square and writes the four
// PNGs a PWA needs, with 4x supersampled anti-aliasing. Reusable across apps:
// change the CONFIG block and the drawGlyph() shape, then run:
//
//   node scripts/genicons.mjs ./public
//
// Outputs: icon-192.png, icon-512.png (rounded corners), icon-maskable-512.png
// and apple-touch-icon.png (full-bleed, for Android adaptive + iOS home screen).
// Pair these with a matching public/icon.svg (hand-authored) for the crisp
// favicon + the manifest's scalable icon.

import zlib from "node:zlib";
import { writeFileSync } from "node:fs";

// ─── CONFIG ──────────────────────────────────────────────────────────────
// Brand background gradient (top → bottom) and how much of the square the glyph
// fills. Swap these per app. (This copy is party-rental-app: purple #7c2d91.)
const BG_TOP = [0x9a, 0x3b, 0xb5];
const BG_BOTTOM = [0x5f, 0x22, 0x70];
const CONTENT_SCALE = 0.82; // glyph size on rounded icons (0..1)
const MASKABLE_SCALE = 0.66; // smaller, to sit inside Android's mask safe zone
const CORNER = 0.22; // rounded-corner radius as a fraction of the icon size

/**
 * The glyph, in a local [0,1]×[0,1] box (x → right, y → down). Return true for
 * pixels that should be white. Compose from simple primitives: circles,
 * squares, and triangles (helpers below). THIS is the per-app drawing.
 * (This copy: a party popper — striped cone with a confetti burst.)
 */
function drawGlyph(x, y) {
  // popper cone (tip lower-left, opening faces upper-right) with two stripes
  if (tri(x, y, 0.23, 0.8, 0.43, 0.43, 0.55, 0.61)) {
    const p = (x - 0.23) * 0.68 + (y - 0.8) * -0.733; // projection along the cone axis
    if ((p > 0.15 && p < 0.19) || (p > 0.25 && p < 0.29)) return false; // stripe gaps
    return true;
  }
  const confetti = [
    ["c", 0.57, 0.43, 0.03], ["s", 0.63, 0.34, 0.026], ["c", 0.69, 0.41, 0.028],
    ["c", 0.6, 0.27, 0.024], ["s", 0.73, 0.29, 0.024], ["c", 0.79, 0.36, 0.026],
    ["s", 0.67, 0.2, 0.022], ["c", 0.52, 0.33, 0.022], ["c", 0.83, 0.25, 0.02],
  ];
  for (const it of confetti) {
    if (it[0] === "c") { if (circle(x, y, it[1], it[2], it[3])) return true; }
    else if (square(x, y, it[1], it[2], it[3])) return true;
  }
  return false;
}
// ─────────────────────────────────────────────────────────────────────────

// ── glyph primitive helpers (all in local [0,1] coords) ──
const circle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
const square = (x, y, cx, cy, h) => Math.abs(x - cx) <= h && Math.abs(y - cy) <= h;
function tri(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
}

const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];

function insideSquare(px, py, size, r) {
  const half = size / 2;
  const dx = Math.abs(px - half), dy = Math.abs(py - half);
  const ax = Math.max(dx - (half - r), 0), ay = Math.max(dy - (half - r), 0);
  return ax * ax + ay * ay <= r * r; // r=0 ⇒ full-bleed square
}

function render(size, { maskable }) {
  const r = maskable ? 0 : size * CORNER;
  const cs = maskable ? MASKABLE_SCALE : CONTENT_SCALE;
  const S = 4; // supersample factor
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let sr = 0, sg = 0, sb = 0, cnt = 0;
      for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
        const fx = px + (sx + 0.5) / S, fy = py + (sy + 0.5) / S;
        if (!insideSquare(fx, fy, size, r)) continue;
        const nx = fx / size, ny = fy / size;
        const lx = (nx - 0.5) / cs + 0.5, ly = (ny - 0.5) / cs + 0.5;
        const col = drawGlyph(lx, ly) ? [255, 255, 255] : mix(BG_TOP, BG_BOTTOM, ny);
        sr += col[0]; sg += col[1]; sb += col[2]; cnt++;
      }
      const total = S * S, i = (py * size + px) * 4;
      if (!cnt) { buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 0; }
      else {
        buf[i] = Math.round(sr / cnt); buf[i + 1] = Math.round(sg / cnt);
        buf[i + 2] = Math.round(sb / cnt); buf[i + 3] = Math.round((cnt / total) * 255);
      }
    }
  }
  return buf;
}

// ── minimal PNG encoder ──
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) { c ^= buf[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) { raw[y * (size * 4 + 1)] = 0; rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4); }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

const out = process.argv[2] || "./public";
for (const [name, size, opts] of [
  ["icon-192.png", 192, { maskable: false }],
  ["icon-512.png", 512, { maskable: false }],
  ["icon-maskable-512.png", 512, { maskable: true }],
  ["apple-touch-icon.png", 180, { maskable: true }],
]) {
  writeFileSync(`${out}/${name}`, encodePng(size, render(size, opts)));
  console.log("wrote", `${out}/${name}`);
}
