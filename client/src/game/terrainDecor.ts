import { LANDER_POS, WORLD_PX, createRng } from '@rs/shared';
import type { SampleSite } from '@rs/shared';

/** Baked once into the terrain canvas, so none of this costs anything per frame. */
export const DECOR = {
  patches: 150,
  patchMin: 40,
  patchMax: 130,
  patchAlpha: 0.05,
  ripples: 220,
  craters: 70,
  craterMin: 5,
  craterMax: 22,
  pebbles: 1400,
  rocks: 380,
  boulders: 55,
  clearLanderPx: 90,
  clearSitePx: 28,
  rockTones: ['#4a2f2c', '#5d3b33', '#6e4a3c', '#3d2a2e', '#7a5a48'],
  shadow: 'rgba(24,10,16,0.45)',
  light: 'rgba(255,214,168,0.55)',
};

type Ctx = CanvasRenderingContext2D;
const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
};

export function decorateTerrain(ctx: Ctx, scale: number, salt: number, sites: SampleSite[]): void {
  const rng = createRng(0x7e44a1 ^ Math.floor(salt * 1000));
  const free = (x: number, y: number, margin: number): boolean => {
    if (Math.hypot(x - LANDER_POS.x, y - LANDER_POS.y) < DECOR.clearLanderPx + margin) return false;
    return !sites.some((s) => Math.hypot(x - s.x, y - s.y) < DECOR.clearSitePx + margin);
  };
  const at = (): [number, number] => [rng.range(8, WORLD_PX - 8), rng.range(8, WORLD_PX - 8)];
  ctx.save();
  ctx.setTransform(1 / scale, 0, 0, 1 / scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  patches(ctx, rng, at);
  ripples(ctx, rng, at);
  for (let i = 0; i < DECOR.craters; i++) {
    const [x, y] = at();
    if (free(x, y, 12)) crater(ctx, x, y, rng.int(DECOR.craterMin, DECOR.craterMax), rng);
  }
  for (let i = 0; i < DECOR.pebbles; i++) {
    const [x, y] = at();
    if (free(x, y, 0))
      rect(ctx, x, y, rng.int(1, 2), 1, DECOR.rockTones[rng.int(0, DECOR.rockTones.length - 1)]!);
  }
  for (let i = 0; i < DECOR.rocks + DECOR.boulders; i++) {
    const [x, y] = at();
    if (!free(x, y, 6)) continue;
    rock(ctx, x, y, i < DECOR.rocks ? rng.int(3, 6) : rng.int(8, 14), rng);
  }
  ctx.restore();
}

type Rng = ReturnType<typeof createRng>;

/** Large soft smudges of lighter and darker dust break up the flat colour. */
function patches(ctx: Ctx, rng: Rng, at: () => [number, number]): void {
  for (let i = 0; i < DECOR.patches; i++) {
    const [x, y] = at();
    const r = rng.range(DECOR.patchMin, DECOR.patchMax);
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = i % 2 ? '255,206,150' : '60,24,24';
    grad.addColorStop(0, `rgba(${tone},${DECOR.patchAlpha * 1.6})`);
    grad.addColorStop(1, `rgba(${tone},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

/** Wind ripples: short lit ridges with a shaded side, in loose bunches. */
function ripples(ctx: Ctx, rng: Rng, at: () => [number, number]): void {
  for (let i = 0; i < DECOR.ripples; i++) {
    const [x, y] = at();
    const rows = rng.int(2, 4);
    for (let r = 0; r < rows; r++) {
      const len = rng.int(10, 26);
      for (let k = 0; k < len; k++) {
        const wave = Math.round(Math.sin((k / len) * Math.PI) * -2);
        rect(ctx, x + k, y + r * 4 + wave, 1, 1, 'rgba(255,220,176,0.32)');
        rect(ctx, x + k, y + r * 4 + wave + 1, 1, 1, 'rgba(46,18,22,0.28)');
      }
    }
  }
}

function crater(ctx: Ctx, x: number, y: number, r: number, rng: Rng): void {
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
function rock(ctx: Ctx, x: number, y: number, size: number, rng: Rng): void {
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
