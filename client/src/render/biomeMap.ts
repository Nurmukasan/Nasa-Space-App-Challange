// Whole-world overview for maps (wrist map, console radar): biome tints, terrace relief and the
// lava tubes, one map pixel per RES world pixels. Built once per landing site and cached.
import { WORLD, WORLD_MIN, WORLD_PX, biomeAt, levelAt, worldFor } from '@rs/shared';
import { BIOME_TINT } from './worldPaint';

/** World px per map px. */
export const BIOME_MAP_RES = 16;
const SIZE = WORLD_PX / BIOME_MAP_RES;
const cache = new Map<number, HTMLCanvasElement>();

/** Overview canvas of the whole world; `mapX = (worldX - WORLD_MIN) / BIOME_MAP_RES`. */
export function biomeMap(salt: number): HTMLCanvasElement {
  const known = cache.get(salt);
  if (known) return known;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const wx = WORLD_MIN + (x + 0.5) * BIOME_MAP_RES,
        wy = WORLD_MIN + (y + 0.5) * BIOME_MAP_RES;
      const tint = BIOME_TINT[biomeAt(wx, wy, salt)];
      // A hint of the terraces so the map is not flat colour.
      const relief = 0.55 + levelAt(wx, wy, salt) * 0.09;
      const i = (y * SIZE + x) * 4;
      img.data[i] = tint[0] * relief;
      img.data[i + 1] = tint[1] * relief;
      img.data[i + 2] = tint[2] * relief;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  // Lava tubes: a lit rim around a black floor.
  for (const tube of worldFor(salt).tubes) {
    const path = () => {
      ctx.beginPath();
      tube.points.forEach((p, i) => {
        const x = (p.x - WORLD_MIN) / BIOME_MAP_RES,
          y = (p.y - WORLD_MIN) / BIOME_MAP_RES;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#b89e8c';
    ctx.lineWidth = ((tube.halfWidth + WORLD.rimPx) * 2) / BIOME_MAP_RES;
    path();
    ctx.stroke();
    ctx.strokeStyle = '#0c0a10';
    ctx.lineWidth = (tube.halfWidth * 2) / BIOME_MAP_RES;
    path();
    ctx.stroke();
  }
  cache.set(salt, canvas);
  return canvas;
}
