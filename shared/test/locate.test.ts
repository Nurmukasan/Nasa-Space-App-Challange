// A3: epicentre rings and picks (docs/phases.md, task A3; docs/product-logic.md 7.11).
import { expect, it } from 'vitest';
import { LOCATE, PRESETS, SEISMIC, checkDesign, deriveParams } from '../src';
import type { ScenarioId } from '../src';
import { createSim } from '../src/sim/sim';
import { seismicSystem } from '../src/sim/seismic';
import { hazardSystem } from '../src/sim/hazards';
import { handleSimMsg } from '../src/sim/input';
import { scoreMission } from '../src/sim/scoring';

const EPI = { x: 700, y: 500 };

function setup(scenario: ScenarioId = 'signal', stations = 3) {
  const sim = createSim(deriveParams(PRESETS.balanced, 1, scenario), ['a', 'b']);
  // Deterministic geometry: three listening stations in every scenario.
  sim.pub.stations = [
    { x: 768, y: 794 },
    { x: 1000, y: 700 },
    { x: 540, y: 700 },
  ].slice(0, stations);
  sim.hidden.schedule = [{ id: 'Q', kind: 'quake', ...EPI, t0: 10, fired: false }];
  sim.pub.t = 10;
  seismicSystem(sim, 0);
  return sim;
}
const mc = (sim: ReturnType<typeof setup>, msg: Parameters<typeof handleSimMsg>[4]) =>
  handleSimMsg(sim, 'mc', false, true, msg);

it('each station gets a noisy distance ring within the error bound', () => {
  const sim = setup();
  const e = sim.pub.seismic[0]!;
  e.signals.forEach((s) => {
    const st = sim.pub.stations[s.stationIdx]!;
    const d = Math.hypot(st.x - EPI.x, st.y - EPI.y);
    expect(Math.abs(s.distEst - d)).toBeLessThanOrEqual(d * LOCATE.distErr + 1e-9);
  });
  expect(JSON.stringify(setup().pub.seismic[0]!.signals)).toBe(JSON.stringify(e.signals));
});

it('only station 0 reports a bearing, within the bearing error', () => {
  const e = setup().pub.seismic[0]!;
  const st = { x: 768, y: 794 };
  const truth = Math.atan2(EPI.y - st.y, EPI.x - st.x);
  const b = e.signals[0]!.bearingEst!;
  const diff = Math.atan2(Math.sin(b - truth), Math.cos(b - truth));
  expect(Math.abs(diff)).toBeLessThanOrEqual(LOCATE.bearingErr + 1e-9);
  expect(e.signals.slice(1).every((s) => s.bearingEst === null)).toBe(true);
});

it('validates mc:locate: role, event, deadline, numbers; clamps; last pick wins', () => {
  const sim = setup();
  handleSimMsg(sim, 'a', true, false, { t: 'mc:locate', eventId: 'Q', x: 1, y: 1 });
  expect(sim.pub.seismic[0]!.pick).toBeNull();
  mc(sim, { t: 'mc:locate', eventId: 'nope', x: 1, y: 1 });
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: NaN, y: 1 });
  expect(sim.pub.seismic[0]!.pick).toBeNull();
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: -50, y: 99999 });
  expect(sim.pub.seismic[0]!.pick).toEqual({ x: 8, y: 1528 });
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: 600, y: 600 });
  expect(sim.pub.seismic[0]!.pick).toEqual({ x: 600, y: 600 });
  sim.pub.t = 30;
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: 700, y: 500 });
  expect(sim.pub.seismic[0]!.pick).toEqual({ x: 600, y: 600 });
});

it('v2: the warning zone follows the pick, then jumps to the real epicentre', () => {
  const sim = setup();
  const [a, b] = sim.pub.astronauts;
  Object.assign(a!, { x: 1000, y: 900, linked: true, status: 'active' });
  Object.assign(b!, { x: EPI.x, y: EPI.y, linked: true, status: 'active' });
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: 1000, y: 900 });
  mc(sim, { t: 'mc:classify', eventId: 'Q', kind: 'quake' });
  const zone = sim.pub.hazards[0]!;
  expect([zone.x, zone.y, zone.r]).toEqual([1000, 900, LOCATE.warnRadius]);
  expect(a!.dangerUntil).toBeGreaterThan(0);
  expect(b!.dangerUntil).toBe(0); // the pick missed: the people at the epicentre are not warned
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: EPI.x + 10, y: EPI.y });
  expect(zone.x).toBe(EPI.x + 10);
  expect(b!.dangerUntil).toBeGreaterThan(0);
  sim.pub.t = 10 + SEISMIC.rockfallDelayS;
  hazardSystem(sim, 0);
  expect([zone.x, zone.y, zone.r]).toEqual([EPI.x, EPI.y, SEISMIC.rockfallRadius]);
});

it('free: picks never move the warning zone', () => {
  const sim = setup('free');
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: 1000, y: 900 });
  mc(sim, { t: 'mc:classify', eventId: 'Q', kind: 'quake' });
  expect([sim.pub.hazards[0]!.x, sim.pub.hazards[0]!.y]).toEqual([EPI.x, EPI.y]);
});

it('without a pick the zone sits on the estimate, worse with one station', () => {
  for (const [n, r] of [
    [3, SEISMIC.uncertainty3],
    [1, SEISMIC.uncertainty1],
  ] as const) {
    const sim = setup('signal', n);
    mc(sim, { t: 'mc:classify', eventId: 'Q', kind: 'quake' });
    const e = sim.pub.seismic[0]!;
    expect(e.estimate!.r).toBe(r);
    expect([sim.pub.hazards[0]!.x, sim.pub.hazards[0]!.y]).toEqual([e.estimate!.x, e.estimate!.y]);
  }
});

it('scores each pick once after the deadline; a good pick adds teamwork', () => {
  const sim = setup();
  mc(sim, { t: 'mc:locate', eventId: 'Q', x: EPI.x + 30, y: EPI.y });
  sim.pub.t = 30;
  seismicSystem(sim, 0);
  seismicSystem(sim, 0);
  const s = sim.hidden.stats;
  expect([s.locatePicks, s.locateGood]).toEqual([1, 1]);
  expect(s.locateErrorSum).toBeCloseTo(30);
  const check = checkDesign(PRESETS.balanced, 'signal');
  const withPick = scoreMission(s, sim.params, check).teamwork;
  const without = scoreMission({ ...s, locateGood: 0 }, sim.params, check).teamwork;
  expect(withPick - without).toBe(LOCATE.goodBonus);
});
