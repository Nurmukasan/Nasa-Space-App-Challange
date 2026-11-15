// Training and Free keep the v1 valley; the big world is RED SIGNAL only (docs/product-logic.md 7.24).
import { expect, it } from 'vitest';
import {
  CLASSIC_WORLD_PX,
  LANDER_POS,
  PRESETS,
  SAND,
  SITES,
  WORLD_EDGE,
  WORLD_MAX,
  WORLD_MIN,
  biomeAt,
  clampToWorld,
  deriveParams,
  sandAt,
  worldBounds,
  worldFor,
} from '../src';
import { handleSimMsg } from '../src/sim/input';
import { terrainMul } from '../src/sim/devils';
import { createSim } from '../src/sim/sim';
import type { ScenarioId } from '../src';

const SALTS = Object.values(SITES).map((s) => s.terrainSalt);

it('classic scenarios keep the v1 bounds, RED SIGNAL opens the big world', () => {
  expect(worldBounds(false)).toEqual({ min: 0, max: CLASSIC_WORLD_PX });
  expect(worldBounds(true)).toEqual({ min: WORLD_MIN, max: WORLD_MAX });
  expect(clampToWorld(-500, false)).toBe(WORLD_EDGE);
  expect(clampToWorld(5000, false)).toBe(CLASSIC_WORLD_PX - WORLD_EDGE);
  expect(clampToWorld(-500, true)).toBe(-500);
});

it('no lava tube reaches into the classic valley', () => {
  for (const salt of SALTS)
    for (const tube of worldFor(salt).tubes)
      expect(
        tube.x0 > CLASSIC_WORLD_PX || tube.x1 < 0 || tube.y0 > CLASSIC_WORLD_PX || tube.y1 < 0,
      ).toBe(true);
});

for (const scenario of ['training', 'free'] as ScenarioId[])
  it(`${scenario}: a walker stops at the v1 edge`, () => {
    const sim = createSim(deriveParams(PRESETS.balanced, 5, scenario), ['a']);
    const a = sim.pub.astronauts[0]!;
    a.status = 'active';
    sim.pub.t = 1;
    a.x = 20;
    a.y = LANDER_POS.y;
    sim.hidden.lastMoveT.a = 0;
    handleSimMsg(sim, 'a', true, false, {
      t: 'eva:move',
      x: -100,
      y: a.y,
      facing: 0,
      moving: true,
      running: false,
    });
    expect(a.x).toBe(WORLD_EDGE);
  });

it('training corners behave like the v1 plain: no dunes, ice or lava rules', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 5, 'training'), ['a']);
  for (const salt of SALTS)
    for (let x = 0; x <= CLASSIC_WORLD_PX; x += 32)
      for (let y = 0; y <= CLASSIC_WORLD_PX; y += 32) {
        if (biomeAt(x, y, salt) === 'plains') continue;
        const mul = terrainMul(sim.pub, salt, x, y);
        const sand = sandAt(x, y, salt, false);
        expect(mul.o2).toBe(sand ? SAND.o2Mul : 1);
        expect(mul.speed).toBe(sand ? SAND.speedMul : 1);
      }
});
