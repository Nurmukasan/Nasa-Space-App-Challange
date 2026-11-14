import { expect, it } from 'vitest';
import { LANDER_POS, PRESETS, STATIONS, deriveParams, sandAt } from '../src';
import { createSim } from '../src/sim/sim';
import type { Sim } from '../src/sim/sim';
import { tryDeployKit } from '../src/sim/stations';
import { seismicSystem } from '../src/sim/seismic';
import { objectivesSystem } from '../src/sim/objectives';

function mission() {
  const sim = createSim(deriveParams(PRESETS.balanced, 11, 'training'), ['a']);
  sim.pub.t = 0;
  return sim;
}
function ground(sim: Sim, sand = false) {
  for (let y = 100; y < 1400; y += 8)
    for (let x = 100; x < 1400; x += 8) {
      if (Math.hypot(x - LANDER_POS.x, y - LANDER_POS.y) < STATIONS.minFromLander) continue;
      if (sim.pub.stations.some((s) => Math.hypot(x - s.x, y - s.y) < STATIONS.minBetween))
        continue;
      if (sandAt(x, y, sim.salt) === sand) return { x, y };
    }
  throw new Error('No suitable terrain');
}

it('deploys one kit, records it once, and advances the contracted objective', () => {
  const sim = mission();
  const a = sim.pub.astronauts[0]!;
  a.kits = 1;
  Object.assign(a, ground(sim));
  sim.pub.objectives.push({
    id: 'deploy',
    kind: 'deploy_stations',
    primary: false,
    target: 1,
    progress: 0,
    state: 'active',
  });
  expect(tryDeployKit(sim, a)).toBe(true);
  expect(a.kits).toBe(0);
  expect(sim.pub.stations.at(-1)).toEqual({ x: a.x, y: a.y });
  expect(sim.hidden.stats.stationsDeployed).toBe(1);
  expect(sim.pub.fx.filter((f) => f.type === 'deploy')).toHaveLength(1);
  expect(sim.pub.log.at(-1)?.key).toBe('log.deploy');
  expect(tryDeployKit(sim, a)).toBe(false);
  objectivesSystem(sim, 0);
  expect(sim.pub.objectives.find((o) => o.id === 'deploy')?.state).toBe('done');
});

it('rejects lander proximity, station proximity, sand, no kit, countdown and inactive crew', () => {
  const sim = mission();
  const a = sim.pub.astronauts[0]!;
  a.kits = 1;
  a.x = LANDER_POS.x + STATIONS.minFromLander - 1;
  a.y = LANDER_POS.y;
  expect(tryDeployKit(sim, a)).toBe(false);
  Object.assign(a, ground(sim));
  sim.pub.stations.push({ x: a.x + STATIONS.minBetween - 1, y: a.y });
  expect(tryDeployKit(sim, a)).toBe(false);
  sim.pub.stations.pop();
  Object.assign(a, ground(sim, true));
  expect(tryDeployKit(sim, a)).toBe(false);
  Object.assign(a, ground(sim));
  a.kits = 0;
  expect(tryDeployKit(sim, a)).toBe(false);
  a.kits = 1;
  sim.pub.t = -1;
  expect(tryDeployKit(sim, a)).toBe(false);
  sim.pub.t = 0;
  for (const status of ['inside', 'down', 'lost'] as const) {
    a.status = status;
    expect(tryDeployKit(sim, a)).toBe(false);
  }
  expect(sim.hidden.stats.stationsDeployed).toBe(0);
  expect(sim.pub.stations).toHaveLength(1);
});

it('includes a deployed station in the next seismic event measurements', () => {
  const sim = mission();
  const a = sim.pub.astronauts[0]!;
  Object.assign(a, ground(sim));
  expect(tryDeployKit(sim, a)).toBe(true);
  sim.hidden.schedule.push({
    id: 'test-quake',
    kind: 'quake',
    t0: 0,
    x: 900,
    y: 900,
    fired: false,
  });
  seismicSystem(sim, 0);
  const signals = sim.pub.seismic[0]!.signals;
  expect(signals).toHaveLength(2);
  expect(signals[1]!.stationIdx).toBe(1);
  expect(signals[1]!.distEst).toBeGreaterThan(0);
});

it('free keeps its auto-placed network and cannot deploy even a forged kit', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 11), ['a']);
  const before = structuredClone(sim.pub.stations);
  const a = sim.pub.astronauts[0]!;
  sim.pub.t = 0;
  a.kits = 1;
  Object.assign(a, ground(sim));
  expect(tryDeployKit(sim, a)).toBe(false);
  expect(sim.pub.stations).toEqual(before);
});
