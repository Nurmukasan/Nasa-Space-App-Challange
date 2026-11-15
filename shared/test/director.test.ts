// A5: the event director (docs/phases.md, task A5; docs/product-logic.md 7.17).
import { expect, it } from 'vitest';
import { DIRECTOR, LAUNCH_COUNTDOWN_S, SCENARIOS } from '../src';
import { makeRoom } from './helpers';

/** Solo signal mission; the astronaut shelters unless `outside`. */
function mission(seed = 1234, outside = false) {
  const h = makeRoom(seed);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
  h.send(a.playerId, { t: 'lobby:scenario', id: 'signal' });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  const sim = h.room.simulation!;
  if (!outside) sim.pub.astronauts[0]!.status = 'inside';
  return { h, sim };
}
const until = (h: ReturnType<typeof mission>['h'], t: number) =>
  h.seconds(t - h.room.simulation!.pub.t);
const directed = (sim: ReturnType<typeof mission>['sim']) =>
  sim.hidden.schedule.filter((e) => e.id.startsWith('D'));

it('is deterministic for the same seed and inputs', () => {
  const run = () => {
    const { h, sim } = mission(77);
    until(h, 470);
    return JSON.stringify([sim.hidden.schedule, sim.hidden.director, sim.hidden.storm]);
  };
  expect(run()).toBe(run());
});

it('opens with the tutorial wind between 45 and 60 seconds', () => {
  for (const seed of [1, 2, 3, 4]) {
    const { h, sim } = mission(seed);
    until(h, DIRECTOR.firstWindMaxS + 1);
    const first = directed(sim)[0]!;
    expect(first.kind).toBe('wind');
    expect(first.t0).toBeGreaterThanOrEqual(DIRECTOR.firstWindMinS);
  }
});

it('keeps gaps inside the act bounds and never exceeds the pools', () => {
  const acts = SCENARIOS.signal.acts;
  for (const seed of [5, 6, 7]) {
    const { h, sim } = mission(seed);
    until(h, 479);
    const events = directed(sim);
    expect(events.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < events.length; i++) {
      const gap = events[i]!.t0 - events[i - 1]!.t0;
      const min = Math.min(...acts.map((a) => a.gapS[0]));
      expect(gap).toBeGreaterThanOrEqual(min - 0.1);
    }
    const quakesAct2 = events.filter((e) => e.kind === 'quake' && e.t0 >= 150 && e.t0 < 330);
    expect(quakesAct2.length).toBeLessThanOrEqual(acts[1]!.pool.quake!);
  }
});

it('holds events while someone is low on oxygen', () => {
  const { h, sim } = mission(9, true);
  until(h, 1);
  const a = sim.pub.astronauts[0]!;
  until(h, 40);
  const before = directed(sim).length;
  for (let i = 0; i < 15 * 30; i++) {
    a.o2 = a.o2Max * 0.1; // stays in trouble
    h.ticks(1);
  }
  expect(directed(sim).length).toBe(before);
  expect(sim.hidden.director.nextAt).toBeGreaterThan(sim.pub.t - 1);
});

it('decides exactly one third-act crisis and schedules a storm in time', () => {
  const kinds = new Set<string>();
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    const { h, sim } = mission(seed);
    until(h, 1);
    const d = sim.hidden.director;
    expect(['storm', 'flare']).toContain(d.crisis);
    expect(d.crisisAt).toBeGreaterThanOrEqual(DIRECTOR.crisisMinS);
    expect(d.crisisAt).toBeLessThanOrEqual(DIRECTOR.crisisMaxS);
    kinds.add(d.crisis!);
    until(h, d.crisisAt + 1);
    expect(d.crisisDone).toBe(true);
    if (d.crisis === 'storm') expect(sim.hidden.storm?.tStart).toBe(d.crisisAt);
  }
  expect(kinds.size).toBe(2);
});

it('training and free missions have no director events', () => {
  for (const id of ['training', 'free'] as const) {
    const h = makeRoom(3);
    const a = h.room.join({ name: 'A' });
    if (!a.ok) throw new Error('join');
    h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
    h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
    h.send(a.playerId, { t: 'lobby:scenario', id });
    h.send(a.playerId, { t: 'lobby:start', quick: true });
    h.room.simulation!.pub.astronauts[0]!.status = 'inside';
    h.seconds(LAUNCH_COUNTDOWN_S + 200);
    expect(h.room.simulation!.hidden.schedule.some((e) => e.id.startsWith('D'))).toBe(false);
  }
});

it('director impacts land 400–650 px from the lander (docs/product-logic.md 7.17)', () => {
  for (const seed of [3, 9, 21, 42, 77]) {
    const { h, sim } = mission(seed);
    until(h, 470);
    for (const e of directed(sim).filter((x) => x.kind === 'impact')) {
      const d = Math.hypot(e.x - sim.pub.lander.x, e.y - sim.pub.lander.y);
      expect(d).toBeGreaterThanOrEqual(DIRECTOR.impactMinDist - 1);
      expect(d).toBeLessThanOrEqual(DIRECTOR.impactMaxDist + 1);
    }
  }
});
