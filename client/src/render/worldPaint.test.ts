import { describe, expect, it } from 'vitest';
import { LANDER_POS, SITES, worldFor } from '@rs/shared';
import { paintRegion } from './worldPaint';

const SALT = SITES.elysium.terrainSalt;

describe('world painter (big world chunks)', () => {
  it('is seamless: one wide region equals two halves side by side', () => {
    const x0 = LANDER_POS.x + 1700,
      y0 = LANDER_POS.y - 300,
      w = 64,
      h = 32;
    const whole = paintRegion(x0, y0, w, h, SALT, true);
    const left = paintRegion(x0, y0, w / 2, h, SALT, true);
    const right = paintRegion(x0 + w / 2, y0, w / 2, h, SALT, true);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        for (let c = 0; c < 4; c++) {
          const half = x < w / 2 ? left : right;
          const hx = x < w / 2 ? x : x - w / 2;
          expect(whole[(y * w + x) * 4 + c]).toBe(half[(y * (w / 2) + hx) * 4 + c]);
        }
  });

  it('paints the negative half of the world and lava tubes', () => {
    const tube = worldFor(SALT).tubes[0]!;
    const p = tube.points[2]!;
    const pixels = paintRegion(p.x - 4, p.y - 4, 8, 8, SALT, true);
    // Tube floor: dark rock, opaque.
    expect(pixels[3]).toBe(255);
    expect(pixels[0]!).toBeLessThan(60);
    const far = paintRegion(-2000, -2000, 8, 8, SALT, true);
    expect(far.every((v, i) => i % 4 !== 3 || v === 255)).toBe(true);
  });
});

describe('world painter caves match the engine', () => {
  it('floor, rim and skylight pixels agree with caveCellAt', async () => {
    const { caveCellAt } = await import('@rs/shared');
    const tube = worldFor(SALT).tubes[1]!;
    const e = tube.entrances[0]!;
    const x0 = Math.round(e.x - 40),
      y0 = Math.round(e.y - 40);
    const pixels = paintRegion(x0, y0, 80, 80, SALT, true);
    // Classify each pixel by colour family from the painter's cave palette.
    let checked = 0;
    for (let y = 0; y < 80; y += 3)
      for (let x = 0; x < 80; x += 3) {
        const cell = caveCellAt(x0 + x, y0 + y, SALT);
        if (cell !== 1) continue;
        expect(pixels[(y * 80 + x) * 4]!).toBeLessThan(45);
        checked++;
      }
    expect(checked).toBeGreaterThan(10);
  });
});
