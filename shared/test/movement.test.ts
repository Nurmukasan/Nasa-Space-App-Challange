import { expect, it } from 'vitest';
import {
  LANDER_POS,
  MOVE,
  O2,
  PRESETS,
  SAND,
  TICK_DT,
  deriveParams,
  fieldSpeed,
  sandAt,
} from '../src';
import { returnCost } from '../src/sim/movement';
import { handleSimMsg } from '../src/sim/input';
import { oxygenSystem } from '../src/sim/oxygen';
import { createSim } from '../src/sim/sim';
import { weatherSystem } from '../src/sim/weather';

it('return oxygen cost increases with distance and accounts for walking speed', () => {
  const p = deriveParams(PRESETS.balanced, 1),
    weather = createSim(p, ['a']).pub.weather;
  const near = returnCost(p, weather, LANDER_POS.x + 200, LANDER_POS.y);
  const far = returnCost(p, weather, LANDER_POS.x + 400, LANDER_POS.y);
  expect(far).toBeGreaterThan(near);
  expect(far).toBeCloseTo(((400 - O2.airlockRadius) / p.walkSpeed) * O2.walk * 1.15 + 5);
  expect(
    returnCost({ ...p, walkSpeed: p.walkSpeed * 0.9 }, weather, LANDER_POS.x + 400, LANDER_POS.y),
  ).toBeGreaterThan(far);
});
it('only the five-unit safety reserve remains at or inside the airlock', () => {
  const p = deriveParams(PRESETS.balanced, 1),
    w = createSim(p, ['a']).pub.weather;
  expect(returnCost(p, w, LANDER_POS.x, LANDER_POS.y)).toBe(5);
  expect(returnCost(p, w, LANDER_POS.x + O2.airlockRadius, LANDER_POS.y)).toBe(5);
});
it('a storm costs more oxygen to return, while a forecast alone does not', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a']);
  sim.hidden.storm = { tStart: 360, tEnd: 450 };
  const x = LANDER_POS.x + 500;
  sim.pub.t = 330;
  weatherSystem(sim, 0);
  const before = returnCost(sim.params, sim.pub.weather, x, LANDER_POS.y);
  sim.pub.t = 360;
  weatherSystem(sim, 0);
  expect(returnCost(sim.params, sim.pub.weather, x, LANDER_POS.y)).toBeGreaterThan(before);
  sim.pub.t = 451;
  weatherSystem(sim, 0);
  expect(returnCost(sim.params, sim.pub.weather, x, LANDER_POS.y)).toBeCloseTo(before);
});

it('sand slows the shared legal speed and costs more suit oxygen', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1, 'training'), ['a']);
  sim.pub.t = 10;
  const a = sim.pub.astronauts[0]!;
  let point: { x: number; y: number } | null = null;
  for (let y = 100; y < 1400 && !point; y += 8)
    for (let x = 100; x < 1400; x += 8)
      if (sandAt(x, y, sim.salt, sim.params.bigWorld)) {
        point = { x, y };
        break;
      }
  expect(point).not.toBeNull();
  Object.assign(a, point);
  const speed = fieldSpeed(sim.params, sim.pub, a.x, a.y, false);
  expect(speed).toBeCloseTo(sim.params.walkSpeed * SAND.speedMul);
  const before = a.o2;
  oxygenSystem(sim, 1);
  expect(before - a.o2).toBeCloseTo(O2.idle * SAND.o2Mul);
  expect(sim.hidden.stats.sandSeconds).toBe(1);
  const x = a.x;
  handleSimMsg(sim, 'a', true, false, {
    t: 'eva:move',
    x: x + 1000,
    y: a.y,
    facing: 0,
    moving: true,
    running: false,
  });
  expect(a.x - x).toBeCloseTo(speed * TICK_DT * MOVE.slack);
});

it('free keeps the original legal speed and oxygen cost even on sand', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a']);
  sim.pub.t = 10;
  const a = sim.pub.astronauts[0]!;
  a.x = 100;
  a.y = 100;
  expect(fieldSpeed(sim.params, sim.pub, a.x, a.y, true)).toBe(sim.params.runSpeed);
  const before = a.o2;
  oxygenSystem(sim, 1);
  expect(before - a.o2).toBeCloseTo(O2.idle);
});
