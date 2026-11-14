import { WORLD_PX, levelAt, sandAt } from '@rs/shared';
import { decorateTerrain } from '../game/terrainDecor';
import { terrainPaint } from '../render/terrainPaint';

const BASE = {
  /** The relief is baked at half resolution, then scaled to the radar. */
  scale: 2,
  dark: [16, 8, 9],
  light: [172, 100, 52],
  /** Keeps the map a backdrop: markers must always win against it. */
  strength: 0.62,
  vignette: 0.55,
  /** Dunes seen from orbit (PL 7.1): one dot per this many world px. */
  sandStep: 12,
  sandDot: 'rgba(240, 206, 150, 0.45)',
};

/**
 * The same terrain the astronauts walk on (same generator and rocks as the field view), graded to
 * the console's amber so craters and ridges give the operator real landmarks.
 */
export function buildBasemap(size: number, salt: number, sand = false): HTMLCanvasElement {
  const n = WORLD_PX / BASE.scale;
  const levels = new Uint8Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) levels[y * n + x] = levelAt(x * BASE.scale, y * BASE.scale, salt);
  const src = document.createElement('canvas');
  src.width = src.height = n;
  const sctx = src.getContext('2d')!;
  sctx.putImageData(new ImageData(new Uint8ClampedArray(terrainPaint(levels, n, n)), n, n), 0, 0);
  decorateTerrain(sctx, BASE.scale, salt, []);

  const out = document.createElement('canvas');
  out.width = out.height = size;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, size, size);

  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const half = size / 2;
  for (let i = 0; i < d.length; i += 4) {
    const luma = (d[i]! * 0.3 + d[i + 1]! * 0.59 + d[i + 2]! * 0.11) / 255;
    const v = Math.min(1, Math.max(0, (luma - 0.12) / 0.62)) ** 1.15 * BASE.strength;
    const px = (i / 4) % size,
      py = Math.floor(i / 4 / size);
    const edge = Math.hypot(px - half, py - half) / (half * 1.25);
    const fade = 1 - Math.min(1, edge ** 3) * BASE.vignette;
    for (let c = 0; c < 3; c++)
      d[i + c] = (BASE.dark[c]! + (BASE.light[c]! - BASE.dark[c]!) * v) * fade;
    d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  if (sand) {
    ctx.fillStyle = BASE.sandDot;
    const k = size / WORLD_PX;
    for (let y = BASE.sandStep / 2; y < WORLD_PX; y += BASE.sandStep)
      for (let x = BASE.sandStep / 2; x < WORLD_PX; x += BASE.sandStep)
        if (sandAt(x, y, salt)) ctx.fillRect(Math.round(x * k), Math.round(y * k), 1, 1);
  }
  return out;
}
