import { expect, it } from 'vitest';
import { LANDER_POS, O2, PRESETS, deriveParams } from '../src';
import { returnCost } from '../src/sim/movement';
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
