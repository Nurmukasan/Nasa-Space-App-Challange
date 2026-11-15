import type { createRng } from '@rs/shared';

/** Tones of the baked scenery (chunk decor draws craters and rocks with these). */
export const DECOR = {
  rockTones: ['#4a2f2c', '#5d3b33', '#6e4a3c', '#3d2a2e', '#7a5a48'],
  shadow: 'rgba(24,10,16,0.45)',
  light: 'rgba(255,214,168,0.55)',
};

type Ctx = CanvasRenderingContext2D;
const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

type Rng = ReturnType<typeof createRng>;

export function crater(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
  for (let dy = -r - 1; dy <= r + 1; dy++)
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      const d = Math.hypot(dx, dy * 1.2) / r;
      if (d > 1.15) continue;
      const lit = dx + dy < 0;
      if (d > 0.82) rect(ctx, x + dx, y + dy, 1, 1, lit ? DECOR.light : DECOR.shadow);
      else rect(ctx, x + dx, y + dy, 1, 1, lit ? 'rgba(40,16,22,0.55)' : 'rgba(24,10,16,0.35)');
    }
  if (r > 10 && rng.next() < 0.6) rock(ctx, x + rng.int(-2, 2), y + rng.int(-2, 2), 3, rng);
}

/** A little lumpy stone: shadow to the lower right, lit top left edge. */
export function rock(ctx: Ctx, x: number, y: number, size: number, rng: Rng): void {
  const base = DECOR.rockTones[rng.int(0, DECOR.rockTones.length - 1)]!;
  const w = size,
    h = Math.max(2, Math.round(size * 0.7));
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) rect(ctx, x + dx + 2, y + dy + 2, 1, 1, DECOR.shadow);
  for (let dy = 0; dy < h; dy++) {
    const inset = dy === 0 || dy === h - 1 ? 1 : 0;
    for (let dx = inset; dx < w - inset; dx++) {
      if (rng.next() < 0.08) continue;
      rect(ctx, x + dx, y + dy, 1, 1, base);
    }
  }
  rect(ctx, x + 1, y, Math.max(1, w - 3), 1, 'rgba(255,214,168,0.6)');
  rect(ctx, x, y + 1, 1, Math.max(1, h - 2), 'rgba(255,214,168,0.35)');
  rect(ctx, x + w - 1, y + h - 1, 1, 1, 'rgba(20,8,12,0.6)');
}
