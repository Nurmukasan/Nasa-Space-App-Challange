// A6: RED SIGNAL (docs/phases.md, task A6; docs/product-logic.md 7.12).
import { expect, it } from 'vitest';
import { LANDER_POS, PRESETS, SIGNAL, deriveParams, nearLedge, sampleValue } from '../src';
import { createSim } from '../src/sim/sim';
import { handleSimMsg } from '../src/sim/input';
import { makeRoom } from './helpers';

function mission(seed = 1234) {
  const h = makeRoom(seed);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
  h.send(a.playerId, { t: 'lobby:scenario', id: 'signal' });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  const sim = h.room.simulation!;
  sim.pub.astronauts[0]!.status = 'inside';
  const until = (t: number) => h.seconds(t - sim.pub.t);
  return { h, sim, until, id: a.playerId };
}
const pulses = (sim: ReturnType<typeof mission>['sim']) =>
  sim.hidden.schedule.filter((e) => e.signal);

it('places a deterministic hidden source in range, at a ledge, as a hidden site', () => {
  const p = deriveParams(PRESETS.balanced, 42, 'signal');
  const a = createSim(p, ['x']),
    b = createSim(p, ['x']);
  const src = a.hidden.signalSource!;
  expect(src).toEqual(b.hidden.signalSource);
  const d = Math.hypot(src.x - LANDER_POS.x, src.y - LANDER_POS.y);
  expect(d).toBeGreaterThanOrEqual(SIGNAL.sourceMinDist - 1);
  expect(d).toBeLessThanOrEqual(SIGNAL.sourceMaxDist + 1);
  expect(nearLedge(src.x, src.y, a.salt, 40)).toBe(true);
  expect(a.hidden.hiddenSites.find((s) => s.kind === 'signal')).toMatchObject(src);
  expect(a.pub.sites.some((s) => s.kind === 'signal')).toBe(false);
  expect(createSim(deriveParams(PRESETS.balanced, 42), ['x']).hidden.signalSource).toBeNull();
});

it('pulses start at 1:35 and are never classified', () => {
  const { sim, until } = mission();
  until(SIGNAL.firstS - 1);
  expect(pulses(sim)).toHaveLength(0);
  const s = sim.hidden.stats;
  const answered = () => s.classifyCorrect + s.classifyMissed + s.classifyWrong;
  const before = answered(); // the director's tutorial wind already counted
  until(SIGNAL.firstS + 1);
  expect(pulses(sim)).toHaveLength(1);
  const e = sim.pub.seismic.find((x) => x.signal)!;
  expect(e.deadline - e.t0).toBeCloseTo(sim.params.classifyWindowS * SIGNAL.windowMul);
  handleSimMsg(sim, 'mc', false, true, { t: 'mc:classify', eventId: e.id, kind: 'quake' });
  expect(e.guess).toBeNull();
  until(e.deadline + 1);
  expect(answered()).toBe(before);
  expect(sim.hidden.pendingRockfalls).toHaveLength(0);
});

it('a close pick narrows the zone to located; pulses then stop', () => {
  const { sim, until } = mission();
  until(SIGNAL.firstS + 1);
  const src = sim.hidden.signalSource!;
  const e = sim.pub.seismic.find((x) => x.signal)!;
  handleSimMsg(sim, 'mc', false, true, { t: 'mc:locate', eventId: e.id, x: src.x + 20, y: src.y });
  until(e.deadline + 1);
  expect(sim.pub.signal.zone!.r).toBeCloseTo(20 * SIGNAL.zoneErrMul + SIGNAL.zoneSlack);
  expect(sim.pub.signal.located).toBe(true);
  expect(sim.pub.log.at(-1)?.key).toBe('story.signal.located');
  const n = pulses(sim).length;
  until(SIGNAL.lastS);
  expect(pulses(sim)).toHaveLength(n);
});

it('a bad pick never widens the zone; without picks it narrows by station count', () => {
  const { sim, until } = mission(7);
  until(SIGNAL.firstS + 1);
  const e1 = sim.pub.seismic.find((x) => x.signal)!;
  until(e1.deadline + 1);
  const auto = sim.pub.signal.zone!;
  expect(auto.r).toBe(SIGNAL.autoR1); // one lander-mounted station
  const src = sim.hidden.signalSource!;
  expect(Math.hypot(auto.x - src.x, auto.y - src.y)).toBeLessThanOrEqual(auto.r);
  until(sim.hidden.director.nextPulseAt + 1);
  const e2 = sim.pub.seismic.find((x) => x.signal && x.id !== e1.id)!;
  handleSimMsg(sim, 'mc', false, true, { t: 'mc:locate', eventId: e2.id, x: 10, y: 10 });
  until(e2.deadline + 1);
  expect(sim.pub.signal.zone!.r).toBe(auto.r);
  expect(sim.pub.signal.located).toBe(false);
});

it('pulses are felt strongly near the source and not at all far away', () => {
  const { sim, until } = mission();
  const a = sim.pub.astronauts[0]!;
  until(SIGNAL.firstS - 0.5);
  const src = sim.hidden.signalSource!;
  Object.assign(a, { status: 'active', x: src.x + 50, y: src.y, o2: a.o2Max });
  until(SIGNAL.firstS + 0.5);
  expect(sim.pub.fx.find((f) => f.type === 'signal_pulse')?.n).toBe(2);
});

it('the delivered signal sample is retrieved and unlocks the reveal', () => {
  const { h, sim, until } = mission();
  const site = sim.hidden.hiddenSites.find((s) => s.kind === 'signal')!;
  expect(sampleValue(site, 'deep', sim.params)).toBe(SIGNAL.sampleValue);
  expect(sampleValue(site, 'core', sim.params)).toBe(SIGNAL.sampleValue * 1.5);
  until(10);
  sim.pub.lander.cache.push({ siteId: 'SIG', kind: 'signal', tier: 'deep', value: 60, by: 'x' });
  until(11);
  expect(sim.pub.signal.retrieved).toBe(true);
  expect(sim.hidden.stats.signalRetrieved).toBe(true);
  h.send(h.room.state.hostId, { t: 'mc:liftoff' });
  h.ticks(1);
  expect(h.room.state.report!.reveal).toBe(`reveal.${sim.params.site}`);
});

it('debug event_signal queues a pulse', () => {
  const { h, sim, until } = mission();
  until(5);
  h.send(h.room.state.hostId, { t: 'debug', cmd: 'event_signal' });
  expect(pulses(sim)).toHaveLength(1);
});
