import { expect, it } from 'vitest';
import { gust, stormLevel } from './stormMath';

const snap = (t: number) =>
  ({ t, weather: { storm: { tStart: 10, tEnd: 40 } } }) as unknown as Parameters<
    typeof stormLevel
  >[0];

it('ramps the storm in and out and is silent outside it', () => {
  expect(stormLevel(snap(5))).toBe(0);
  expect(stormLevel(snap(11.5))).toBeCloseTo(0.5);
  expect(stormLevel(snap(25))).toBe(1);
  expect(stormLevel(snap(38.5))).toBeCloseTo(0.5);
  expect(stormLevel(snap(41))).toBe(0);
});

it('keeps gusts between 0 and 1 and actually pulses', () => {
  let min = 1,
    max = 0;
  for (let t = 0; t < 200; t += 0.1) {
    const g = gust(t);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(g).toBeLessThanOrEqual(1);
    min = Math.min(min, g);
    max = Math.max(max, g);
  }
  expect(min).toBe(0);
  expect(max).toBeGreaterThan(0.9);
});
