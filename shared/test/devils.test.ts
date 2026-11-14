import { expect, it, vi } from 'vitest';
import { DEVIL, LANDER_POS, PRESETS, WORLD_PX, deriveParams, sandAt, terrainMul } from '../src';
import type { FaultKind } from '../src';
import type { Sim } from '../src/sim/sim';
import { createSim } from '../src/sim/sim';
import { devilSystem, spawnDevil } from '../src/sim/devils';
import { oxygenSystem } from '../src/sim/oxygen';
import { clearFault } from '../src/sim/faults';

// A7's clearFault is a phase-0 stub until A implements it. Verify B6's delegation
// against that hook's contract; this is not the real A7 integration playthrough.
vi.mock('../src/sim/faults', async (original) => ({
  ...(await original<typeof import('../src/sim/faults')>()),
  clearFault: vi.fn((sim: Sim, kind: FaultKind) => {
    sim.pub.lander.faults = sim.pub.lander.faults.filter((f) => f.kind !== kind);
  }),
}));

function mission() {
  const sim = createSim(deriveParams(PRESETS.balanced, 37, 'signal'), ['a']);
  sim.pub.t = 10;
  return sim;
}

it('spawns toward the crew with deterministic bounds, motion and expiration', () => {
  const a = mission(),
    b = mission();
  for (const sim of [a, b]) spawnDevil(sim, sim.pub.astronauts[0]!);
  expect(a.pub.devils).toHaveLength(1);
  expect(a.pub.devils).toEqual(b.pub.devils);
  const first = { ...a.pub.devils[0]! };
  const distance = Math.hypot(first.x - LANDER_POS.x, first.y - (LANDER_POS.y + 22));
  expect(distance).toBeGreaterThanOrEqual(DEVIL.spawnMin);
  expect(distance).toBeLessThanOrEqual(DEVIL.spawnMax);
  expect(Math.hypot(first.vx, first.vy)).toBeGreaterThanOrEqual(DEVIL.speedMin);
  expect(first.r).toBeGreaterThanOrEqual(DEVIL.rMin);
  expect(first.r).toBeLessThanOrEqual(DEVIL.rMax);
  for (let i = 0; i < 50; i++)
    for (const sim of [a, b]) {
      sim.pub.t += 0.2;
      devilSystem(sim, 0.2);
    }
  expect(a.pub.devils).toEqual(b.pub.devils);
  expect(a.pub.devils[0]!.x).not.toBe(first.x);
  a.pub.t = first.until;
  devilSystem(a, 0);
  expect(a.pub.devils).toEqual([]);
});

it('bounces inside world bounds and removes devils at night', () => {
  const sim = mission();
  spawnDevil(sim, sim.pub.astronauts[0]!);
  const d = sim.pub.devils[0]!;
  Object.assign(d, { x: WORLD_PX - d.r - 1, vx: 20, vy: 0 });
  devilSystem(sim, 1);
  expect(d.x).toBeLessThanOrEqual(WORLD_PX - d.r);
  expect(d.vx).toBeLessThan(0);
  sim.pub.weather.light = DEVIL.minLight - 0.01;
  devilSystem(sim, 1);
  spawnDevil(sim, sim.pub.astronauts[0]!);
  expect(sim.pub.devils).toEqual([]);
});

it('inside a devil slows movement and adds 0.8 oxygen per second, even while idle', () => {
  const sim = mission();
  const a = sim.pub.astronauts[0]!;
  // Deliberately choose firm terrain so the additive devil cost is isolated.
  for (let x = 300; x < 1400; x += 8)
    if (!sandAt(x, 500, sim.salt)) {
      a.x = x;
      a.y = 500;
      break;
    }
  const before = a.o2;
  oxygenSystem(sim, 1);
  const baseline = before - a.o2;
  sim.pub.devils.push({ id: 'D', x: a.x, y: a.y, r: 20, vx: 0, vy: 0, until: 100 });
  expect(terrainMul(sim.pub, sim.salt, a.x, a.y).speed).toBe(DEVIL.speedMul);
  const prior = a.o2;
  oxygenSystem(sim, 1);
  expect(prior - a.o2).toBeCloseTo(baseline + DEVIL.o2Extra);
  expect(sim.hidden.stats.devilSeconds).toBe(1);
});

it('delegates panel cleaning to the A7 hook once and emits a truthful effect/log', () => {
  const sim = mission();
  sim.pub.lander.faults.push({ id: 'dust', kind: 'panel_dust', port: 's', since: 0, progress: 0 });
  sim.pub.devils.push({ id: 'D', ...LANDER_POS, r: 20, vx: 0, vy: 0, until: 100 });
  const calls = vi.mocked(clearFault).mock.calls.length;
  devilSystem(sim, 0);
  devilSystem(sim, 0);
  expect(vi.mocked(clearFault).mock.calls.length).toBe(calls + 1);
  expect(sim.pub.fx.filter((f) => f.type === 'panel_clean')).toHaveLength(1);
  expect(sim.pub.log.at(-1)?.key).toBe('log.panel_clean');
});

it('does not add devils or terrain effects to Free mission', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 37), ['a']);
  sim.pub.t = 10;
  spawnDevil(sim, sim.pub.astronauts[0]!);
  expect(sim.pub.devils).toEqual([]);
  expect(terrainMul(sim.pub, sim.salt, 200, 200)).toEqual({ speed: 1, o2: 1, o2Extra: 0 });
});
