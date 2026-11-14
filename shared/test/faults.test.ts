// A7: lander faults and repairs (docs/phases.md, task A7; docs/product-logic.md 7.16).
import { expect, it } from 'vitest';
import { FAULTS, PRESETS, WEATHER, deriveParams } from '../src';
import { createSim } from '../src/sim/sim';
import { stepSim } from '../src/sim/step';
import { handleSimMsg } from '../src/sim/input';
import { clearFault, faultActive, portPos, spawnFault } from '../src/sim/faults';

function setup(preset: keyof typeof PRESETS = 'balanced') {
  // Neither class has the engineer repair perk, so FAULTS.repairS is the plain rate.
  const sim = createSim(
    deriveParams(PRESETS[preset], 3, 'signal'),
    ['a', 'b'],
    ['scout', 'geologist'],
  );
  sim.pub.t = 10;
  for (const a of sim.pub.astronauts) a.status = 'inside';
  return sim;
}
const run = (sim: ReturnType<typeof setup>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 15); i++) stepSim(sim, 1 / 15);
};
function atPort(sim: ReturnType<typeof setup>, id: 'a' | 'b', port: 'n' | 'e' | 's' | 'w') {
  const a = sim.pub.astronauts.find((x) => x.id === id)!;
  Object.assign(a, { status: 'active', ...portPos(port), o2: a.o2Max, moving: false });
  sim.hidden.lastMoveT[id] = sim.pub.t;
  return a;
}

it('each fault cuts its own system and lets go once repaired', () => {
  const sim = setup();
  run(sim, 1);
  const store = sim.pub.lander.o2Store;
  spawnFault(sim, 'moxie_clog');
  run(sim, 2);
  expect(sim.pub.lander.o2Store).toBe(store);
  const power = sim.pub.lander.power.availW;
  spawnFault(sim, 'panel_dust');
  run(sim, 0.2);
  expect(sim.pub.lander.power.availW).toBeLessThan(power);
  clearFault(sim, 'moxie_clog');
  clearFault(sim, 'panel_dust');
  run(sim, 1);
  expect(sim.pub.lander.o2Store).toBeGreaterThan(store);
});

it('antenna drift shrinks the comms range', () => {
  const sim = setup();
  const far = atPort(sim, 'a', 'n');
  far.y -= sim.params.commsRange * 0.8;
  run(sim, 0.2);
  expect(far.linked).toBe(true);
  spawnFault(sim, 'antenna_drift');
  run(sim, 0.2);
  expect(far.linked).toBe(false);
});

it('E at the right port repairs in six seconds; the wrong port does nothing', () => {
  const sim = setup();
  spawnFault(sim, 'moxie_clog');
  const a = atPort(sim, 'a', 'w');
  handleSimMsg(sim, 'a', true, false, { t: 'eva:interact' });
  expect(a.repairing).toBeNull();
  const b = atPort(sim, 'b', FAULTS.ports.moxie_clog);
  handleSimMsg(sim, 'b', true, false, { t: 'eva:interact' });
  expect(b.repairing).not.toBeNull();
  run(sim, FAULTS.repairS + 0.2);
  expect(faultActive(sim, 'moxie_clog')).toBe(false);
  expect(sim.hidden.stats.repairs).toBe(1);
  expect(sim.pub.fx.some((f) => f.type === 'repair_done' && f.playerId === 'b')).toBe(true);
});

it('progress is kept when the repair is interrupted; two people are not faster', () => {
  const sim = setup();
  spawnFault(sim, 'antenna_drift');
  const port = FAULTS.ports.antenna_drift;
  const a = atPort(sim, 'a', port);
  const b = atPort(sim, 'b', port);
  handleSimMsg(sim, 'a', true, false, { t: 'eva:interact' });
  handleSimMsg(sim, 'b', true, false, { t: 'eva:interact' });
  run(sim, 3);
  const fault = sim.pub.lander.faults[0]!;
  expect(fault.progress).toBeCloseTo(3 / FAULTS.repairS, 1);
  a.x += 100;
  b.x += 100;
  run(sim, 1);
  expect(a.repairing).toBeNull();
  expect(fault.progress).toBeCloseTo(3 / FAULTS.repairS, 1);
});

it('limits active faults, skips battery faults without a battery', () => {
  const sim = setup();
  spawnFault(sim, 'moxie_clog');
  spawnFault(sim, 'moxie_clog');
  spawnFault(sim, 'antenna_drift');
  spawnFault(sim, 'panel_dust');
  expect(sim.pub.lander.faults.map((f) => f.kind)).toEqual(['moxie_clog', 'antenna_drift']);
  const noBattery = setup('science');
  spawnFault(noBattery, 'battery_fault');
  expect(noBattery.pub.lander.faults).toHaveLength(0);
});

it('a storm always leaves dust on the panels in v2, never in the free mission', () => {
  for (const scenario of ['signal', 'free'] as const) {
    const sim = createSim(deriveParams(PRESETS.balanced, 3, scenario), ['a']);
    sim.pub.astronauts[0]!.status = 'inside';
    sim.pub.t = 100;
    sim.hidden.storm = { tStart: 100, tEnd: 100 + WEATHER.stormDurS };
    run(sim, WEATHER.stormDurS + 1);
    expect(faultActive(sim, 'panel_dust')).toBe(scenario === 'signal');
  }
});
