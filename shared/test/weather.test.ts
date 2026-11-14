import { expect, it } from 'vitest';
import { PRESETS, deriveParams } from '../src';
import { createSim } from '../src/sim/sim';
import { weatherSystem } from '../src/sim/weather';
import { powerSystem } from '../src/sim/power';
import { commsSystem } from '../src/sim/comms';
import { moveSpeed } from '../src/sim/movement';

it('generates deterministic storm probability and timings within the landing-site bounds', () => {
  const run = (seed: number) => createSim(deriveParams(PRESETS.balanced, seed), ['a']);
  let storms = 0;
  for (let seed = 0; seed < 100; seed++) {
    const sim = run(seed);
    expect(sim.hidden.storm).toEqual(run(seed).hidden.storm);
    const storm = sim.hidden.storm;
    if (storm) {
      storms++;
      expect(storm.tStart).toBeGreaterThanOrEqual(330);
      expect(storm.tStart).toBeLessThanOrEqual(420);
      expect(storm.tEnd - storm.tStart).toBe(90);
    }
  }
  expect(storms).toBeGreaterThan(20);
  expect(storms).toBeLessThan(80);
});
for (const hasWeather of [false, true])
  it(`reveals forecasts only ${hasWeather ? 60 : 15}s before the storm`, () => {
    const sim = createSim({ ...deriveParams(PRESETS.balanced, 1), hasWeather }, ['a']);
    sim.hidden.storm = { tStart: 360, tEnd: 450 };
    sim.pub.t = 360 - (hasWeather ? 60 : 15) - 0.1;
    weatherSystem(sim, 0);
    expect(sim.pub.weather.storm).toBeNull();
    expect(sim.pub.weather.stormForecastAt).toBeNull();
    sim.pub.t += 0.1;
    weatherSystem(sim, 0);
    expect(sim.pub.weather.storm?.tStart).toBe(360);
    expect(moveSpeed(sim.params, sim.pub.weather, false)).toBe(sim.params.walkSpeed);
    sim.pub.t = 360;
    weatherSystem(sim, 0);
    expect(moveSpeed(sim.params, sim.pub.weather, false)).toBeCloseTo(sim.params.walkSpeed * 0.85);
    weatherSystem(sim, 0);
    expect(sim.pub.fx.filter((f) => f.type === 'storm_start')).toHaveLength(1);
    sim.pub.t = 450;
    weatherSystem(sim, 0);
    expect(sim.pub.fx.filter((f) => f.type === 'storm_end')).toHaveLength(1);
    expect(moveSpeed(sim.params, sim.pub.weather, false)).toBe(sim.params.walkSpeed);
  });
it('storm reduces solar power even with battery and shrinks the communications radius', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a']);
  sim.hidden.storm = { tStart: 10, tEnd: 100 };
  sim.pub.t = 9;
  weatherSystem(sim, 0);
  powerSystem(sim, 0);
  const watts = sim.pub.lander.power.availW;
  const a = sim.pub.astronauts[0]!;
  Object.assign(a, { x: sim.pub.lander.x + 400, y: sim.pub.lander.y });
  commsSystem(sim, 0);
  expect(a.linked).toBe(true);
  sim.pub.t = 10;
  weatherSystem(sim, 0);
  powerSystem(sim, 0);
  commsSystem(sim, 0);
  expect(sim.pub.lander.power.availW).toBeLessThan(watts * 0.5);
  expect(a.linked).toBe(false);
});
it('low-orbit relay opens at 60s for 35s every 120s; stationary range applies once', () => {
  const sim = createSim(deriveParams(PRESETS.science, 1), ['a']);
  const a = sim.pub.astronauts[0]!;
  a.x = 1500;
  a.y = 1500;
  for (const [t, open, next] of [
    [59, false, 60],
    [60, true, 95],
    [95, false, 180],
    [180, true, 215],
  ] as const) {
    sim.pub.t = t;
    commsSystem(sim, 0);
    expect(a.linked).toBe(open);
    expect(sim.pub.relay).toEqual({ open, nextChangeAt: next });
  }
  const stationary = createSim(deriveParams({ ...PRESETS.budget, relay: 'areostationary' }, 1), [
    'a',
  ]);
  const b = stationary.pub.astronauts[0]!;
  b.y = stationary.pub.lander.y;
  b.x = stationary.pub.lander.x + 470;
  commsSystem(stationary, 0);
  expect(b.linked).toBe(true);
  b.x = stationary.pub.lander.x + 490;
  commsSystem(stationary, 0);
  expect(b.linked).toBe(false);
});
