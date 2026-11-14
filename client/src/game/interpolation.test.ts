import { describe, expect, it } from 'vitest';
import type { EvaState } from '@rs/shared';
import { RemoteInterpolator } from './interpolation';
import type { Point } from './interpolation';

const DT = 1 / 15;
const SPEED = 44;
const snap = (t: number, x: number): EvaState =>
  ({ t, astronauts: [{ id: 'p2', x, y: 0 }] }) as unknown as EvaState;
const make = () => new RemoteInterpolator(0.1, 6, 0.1, 0.5);

/** Feeds a walker at constant speed and returns the per-frame steps seen on screen. */
function frameSteps(arrivalJitterMs: (i: number) => number): number[] {
  const r = make();
  const out: Point = { x: 0, y: 0 };
  const steps: number[] = [];
  let next = 0;
  let last: number | null = null;
  for (let frame = 0; frame < 240; frame++) {
    const now = 1000 + frame * (1000 / 60);
    while (1000 + next * DT * 1000 + arrivalJitterMs(next) <= now) {
      r.observe(
        snap(next * DT, next * DT * SPEED),
        1000 + next * DT * 1000 + arrivalJitterMs(next),
      );
      next++;
    }
    if (next === 0 || !r.position('p2', now, out)) continue;
    if (last !== null && frame > 30) steps.push(out.x - last);
    last = out.x;
  }
  return steps;
}

describe('RemoteInterpolator', () => {
  it('moves a steady walker by an even amount every frame', () => {
    const steps = frameSteps(() => 0);
    const expected = SPEED / 60;
    for (const s of steps) expect(s).toBeCloseTo(expected, 1);
  });

  it('stays smooth when snapshots arrive with network jitter', () => {
    const steps = frameSteps((i) => [0, 25, 5, 30, 10][i % 5]!);
    expect(Math.min(...steps)).toBeGreaterThan(0);
    expect(Math.max(...steps)).toBeLessThan((SPEED / 60) * 2);
  });

  it('renders the newest position when no newer snapshot exists', () => {
    const r = make();
    r.observe(snap(1, 10), 1000);
    const out: Point = { x: 0, y: 0 };
    expect(r.position('p2', 5000, out)).toBe(true);
    expect(out.x).toBe(10);
    expect(r.position('nobody', 5000, out)).toBe(false);
  });

  it('drops old history when the mission clock goes backwards', () => {
    const r = make();
    r.observe(snap(100, 500), 1000);
    r.observe(snap(-5, 7), 1100);
    const out: Point = { x: 0, y: 0 };
    r.position('p2', 1100, out);
    expect(out.x).toBe(7);
  });
});
