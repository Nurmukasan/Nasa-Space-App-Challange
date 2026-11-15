// Repository audit (2026-11-15): regressions for the logic errors it found.
import { expect, it } from 'vitest';
import { EFFICIENCY, PRESETS, SCORE, checkDesign, deriveParams } from '../src';
import { createSim } from '../src/sim/sim';
import { buildInsights, scoreMission } from '../src/sim/scoring';
import { makeRoom } from './helpers';
import { objectivesSystem } from '../src/sim/objectives';
import { spawnFault } from '../src/sim/faults';

it('efficiency parts stop at their caps (PL 8.1): a cheaper design no longer scores more', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 1), ['a']);
  const s = { ...sim.hidden.stats, endedAtS: sim.params.durationS, o2StoreLeft: 0 };
  const check = checkDesign(PRESETS.balanced);
  const at = (costFrac: number, endedFrac: number) =>
    scoreMission({ ...s, endedAtS: sim.params.durationS * endedFrac }, sim.params, {
      ...check,
      totals: {
        ...check.totals,
        cost: check.totals.budget * costFrac,
        massKg: check.totals.massCapKg,
      },
    }).efficiency;
  expect(at(0.5, 1)).toBe(EFFICIENCY.budget);
  expect(at(0, 1)).toBe(EFFICIENCY.budget); // used to be 160
  expect(at(1, 0.5)).toBe(EFFICIENCY.time);
  expect(at(1, 0)).toBe(EFFICIENCY.time); // used to be 80
  const caps = EFFICIENCY.budget + EFFICIENCY.mass + EFFICIENCY.store + EFFICIENCY.time;
  expect(caps).toBe(SCORE.efficiencyMax);
});

it('the training report and design check use the forced landing site', () => {
  const h = makeRoom(3);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'scout' });
  h.send(a.playerId, { t: 'lobby:scenario', id: 'training' });
  h.send(a.playerId, { t: 'lobby:start', quick: false });
  h.send(a.playerId, { t: 'design:set', field: 'site', value: 'arcadia' });
  expect(h.room.state.design.site).toBe('arcadia');
  // Arcadia has weaker sun: the check must show the Jezero mission that will actually fly.
  const jezero = checkDesign({ ...h.room.state.design, site: 'jezero' }, 'training');
  expect(h.room.state.check.totals.powerGenW).toBe(jezero.totals.powerGenW);
  h.send(a.playerId, { t: 'design:launch' });
  expect(h.room.state.params!.site).toBe('jezero');
  h.room.simulation!.pub.astronauts[0]!.status = 'inside';
  h.send(a.playerId, { t: 'debug', cmd: 'skip_phase' });
  expect(h.room.state.report!.design.site).toBe('jezero');
});

it('station findings follow the stations that actually listened', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 2, 'signal'), ['a']);
  sim.hidden.stats.classifyCorrect = 3;
  const codes = () => buildInsights(sim, PRESETS.balanced).map((i) => i.code);
  // seismo_net in the design, but no kit deployed: only the lander-mounted station listened.
  expect(sim.pub.stations).toHaveLength(1);
  expect(codes()).not.toContain('net_good');
  sim.pub.stations.push({ x: 600, y: 600 }, { x: 900, y: 900 });
  expect(codes()).toContain('net_good');
  sim.pub.stations.length = 1;
  sim.hidden.stats.classifyWrong = 1;
  expect(codes()).toContain('single_station');
});

it('RATION mode does not exist in solo (PL 7.4)', () => {
  const h = makeRoom(4);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'engineer' });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  h.seconds(6);
  h.send(a.playerId, { t: 'mc:ration', on: true });
  expect(h.room.simulation!.pub.lander.ration).toBe(false);
});

it('the report timeline says which objective was met and which system broke', () => {
  const sim = createSim(deriveParams(PRESETS.balanced, 5, 'signal'), ['a']);
  sim.pub.t = 10;
  sim.hidden.stats.samplesDeposited = 99;
  objectivesSystem(sim, 0);
  spawnFault(sim, 'moxie_clog');
  const done = sim.hidden.timeline.find((e) => e.type === 'objective_done');
  expect(done?.s).toBe('deliver');
  expect(sim.hidden.timeline.find((e) => e.type === 'fault')?.s).toBe('moxie_clog');
});
