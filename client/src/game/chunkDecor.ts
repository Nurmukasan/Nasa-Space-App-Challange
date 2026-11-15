// Scenery baked into each terrain chunk: craters, rocks, boulders, frost cracks, spatter cones.
// Deterministic per chunk; items that overlap a border are drawn by both chunks, so no seams.
import { LANDER_POS, biomeAt, caveCellAt, createRng } from '@rs/shared';
import type { BiomeId, Vec2 } from '@rs/shared';
import { crater, rock } from './terrainDecor';

/** Chunk side, world px. Small enough to paint in a few milliseconds. */
export const CHUNK = 128;

/** Items per chunk at density 1 (v1 decor density over its 1536 px world). */
const BASE = { craters: 0.5, rocks: 2.6, boulders: 0.4, pebbles: 10, cracks: 0 };
const MUL: Record<BiomeId, typeof BASE> = {
  plains: { craters: 1, rocks: 1, boulders: 1, pebbles: 1, cracks: 0 },
  delta: { craters: 0.7, rocks: 0.5, boulders: 0.6, pebbles: 0.6, cracks: 0 },
  dunes: { craters: 0.2, rocks: 0.1, boulders: 0.2, pebbles: 0.2, cracks: 0 },
  ice: { craters: 0.5, rocks: 0.3, boulders: 0.4, pebbles: 0.3, cracks: 4 },
  lava: { craters: 1.2, rocks: 2.5, boulders: 3, pebbles: 1.5, cracks: 0 },
};
const CLEAR_LANDER = 90;
const CLEAR_SITE = 28;
const PEBBLE_TONES = ['#4a2f2c', '#5d3b33', '#6e4a3c', '#3d2a2e', '#7a5a48'];
const ICE_PEBBLE = '#3b3f52';

type Item =
  | { kind: 'crater'; x: number; y: number; r: number; seed: number }
  | { kind: 'rock'; x: number; y: number; size: number; seed: number }
  | { kind: 'pebble'; x: number; y: number; w: number; color: string }
  | { kind: 'crack'; x: number; y: number; len: number; angle: number };

const itemCache = new Map<string, Item[]>();

/** Fractional counts become 0/1 extra items by chance, so sparse decor still appears. */
function count(rng: ReturnType<typeof createRng>, mean: number): number {
  const whole = Math.floor(mean);
  return whole + (rng.next() < mean - whole ? 1 : 0);
}

function itemsOf(salt: number, cx: number, cy: number, keepClear: readonly Vec2[]): Item[] {
  const key = `${salt}:${cx}:${cy}`;
  const known = itemCache.get(key);
  if (known) return known;
  const rng = createRng((Math.imul(cx, 0x9e3779b1) ^ Math.imul(cy, 0x85ebca6b) ^ salt) >>> 0);
  const x0 = cx * CHUNK,
    y0 = cy * CHUNK;
  const biome = biomeAt(x0 + CHUNK / 2, y0 + CHUNK / 2, salt);
  const m = MUL[biome];
  const free = (x: number, y: number, margin: number) =>
    Math.hypot(x - LANDER_POS.x, y - LANDER_POS.y) >= CLEAR_LANDER + margin &&
    keepClear.every((s) => Math.hypot(x - s.x, y - s.y) >= CLEAR_SITE + margin) &&
    caveCellAt(x, y, salt) === 0;
  const at = () => ({ x: x0 + rng.range(0, CHUNK), y: y0 + rng.range(0, CHUNK) });
  const items: Item[] = [];
  for (let i = count(rng, BASE.craters * m.craters); i > 0; i--) {
    const p = at();
    const r = rng.int(5, 22);
    if (free(p.x, p.y, 12)) items.push({ kind: 'crater', ...p, r, seed: rng.int(0, 1e9) });
  }
  for (let i = count(rng, BASE.pebbles * m.pebbles); i > 0; i--) {
    const p = at();
    const color = biome === 'ice' ? ICE_PEBBLE : PEBBLE_TONES[rng.int(0, PEBBLE_TONES.length - 1)]!;
    if (free(p.x, p.y, 0)) items.push({ kind: 'pebble', ...p, w: rng.int(1, 2), color });
  }
  const rocks = count(rng, BASE.rocks * m.rocks),
    boulders = count(rng, BASE.boulders * m.boulders);
  for (let i = 0; i < rocks + boulders; i++) {
    const p = at();
    const size = i < rocks ? rng.int(3, 6) : rng.int(8, 14);
    if (free(p.x, p.y, 6)) items.push({ kind: 'rock', ...p, size, seed: rng.int(0, 1e9) });
  }
  for (let i = count(rng, m.cracks); i > 0; i--) {
    const p = at();
    items.push({ kind: 'crack', ...p, len: rng.int(10, 40), angle: rng.range(0, Math.PI) });
  }
  itemCache.set(key, items);
  return items;
}

/** Draw the decor of chunk (cx, cy) and of its neighbours' items that reach into it. */
export function decorateChunk(
  ctx: CanvasRenderingContext2D,
  salt: number,
  cx: number,
  cy: number,
  keepClear: readonly Vec2[],
): void {
  ctx.save();
  ctx.translate(-cx * CHUNK, -cy * CHUNK);
  ctx.imageSmoothingEnabled = false;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      for (const item of itemsOf(salt, cx + dx, cy + dy, keepClear)) {
        if (dx !== 0 || dy !== 0) {
          // Only neighbours' items within reach of this chunk.
          const reach = 26;
          if (
            item.x < cx * CHUNK - reach ||
            item.x > (cx + 1) * CHUNK + reach ||
            item.y < cy * CHUNK - reach ||
            item.y > (cy + 1) * CHUNK + reach
          )
            continue;
        }
        draw(ctx, item);
      }
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, item: Item): void {
  switch (item.kind) {
    case 'crater':
      crater(ctx, Math.round(item.x), Math.round(item.y), item.r, createRng(item.seed));
      return;
    case 'rock':
      rock(ctx, Math.round(item.x), Math.round(item.y), item.size, createRng(item.seed));
      return;
    case 'pebble':
      ctx.fillStyle = item.color;
      ctx.fillRect(Math.round(item.x), Math.round(item.y), item.w, 1);
      return;
    case 'crack': {
      // Thin blue-white frost fracture with a dark lip.
      const dx = Math.cos(item.angle),
        dy = Math.sin(item.angle);
      for (let k = 0; k < item.len; k++) {
        const wobble = Math.round(Math.sin(k / 4) * 1.5);
        const x = Math.round(item.x + dx * k - dy * wobble),
          y = Math.round(item.y + dy * k + dx * wobble);
        ctx.fillStyle = 'rgba(70,86,120,0.55)';
        ctx.fillRect(x, y + 1, 1, 1);
        ctx.fillStyle = 'rgba(245,250,255,0.75)';
        ctx.fillRect(x, y, 1, 1);
      }
      return;
    }
  }
}
