// A1: scenarios and scripted beats (docs/phases.md, task A1; docs/product-logic.md 9.1).
import { expect, it } from 'vitest';
import { DIFFICULTIES, DIRECTOR, LAUNCH_COUNTDOWN_S, SCENARIOS, SEISMIC, nearLedge } from '../src';
import type { ScenarioId } from '../src';
import { makeRoom } from './helpers';

/** Solo player launches `scenario` with Quick start; returns the harness. */
function solo(scenario: ScenarioId, seed = 1234, shelter = true) {
  const h = makeRoom(seed);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:scenario', id: scenario });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  // A lone idle astronaut would run out of oxygen; keep them inside for long timelines.
  if (shelter && h.room.simulation) h.room.simulation.pub.astronauts[0]!.status = 'inside';
  return { h, id: a.playerId };
}

/** Advance to mission time `t` (the countdown starts at -LAUNCH_COUNTDOWN_S). */
function at(h: ReturnType<typeof solo>['h'], t: number): void {
  const sim = h.room.simulation!;
  h.seconds(t - sim.pub.t);
}

it('training is the same mission whatever the room seed', () => {
  const run = (seed: number) => {
    const { h } = solo('training', seed);
    at(h, 160);
    return JSON.stringify(h.room.simulation!.hidden.schedule);
  };
  expect(run(1)).toBe(run(777));
});

it('training beats fire at their seconds', () => {
  const { h } = solo('training');
  const sim = h.room.simulation!;
  at(h, 1);
  expect(sim.pub.log.map((l) => [l.from, l.key])).toContainEqual([
    'tulpar',
    'story.training.touchdown',
  ]);
  at(h, 54);
  expect(sim.hidden.schedule).toHaveLength(0);
  at(h, 56);
  expect(sim.hidden.schedule.map((e) => e.kind)).toEqual(['wind']);
  expect(sim.pub.seismic.some((e) => e.id === sim.hidden.schedule[0]!.id)).toBe(true);
  at(h, 96);
  expect(sim.hidden.schedule.map((e) => e.kind)).toEqual(['wind', 'quake']);
  at(h, 149);
  expect(sim.pub.fx.some((f) => f.type === 'fireball')).toBe(true);
  expect(sim.pub.sites.some((s) => s.kind === 'impact')).toBe(false);
  at(h, 151);
  expect(sim.pub.sites.some((s) => s.kind === 'impact')).toBe(true);
  at(h, 211);
  expect(sim.hidden.timeline.some((e) => e.type === 'window_closing')).toBe(true);
  expect(sim.pub.log.at(-1)?.key).toBe('story.training.window');
});

it('the training quake strikes near the crew, at a ledge', () => {
  const { h } = solo('training', 1234, false);
  const sim = h.room.simulation!;
  at(h, 94);
  const crew = { x: sim.pub.astronauts[0]!.x, y: sim.pub.astronauts[0]!.y };
  at(h, 96);
  const quake = sim.hidden.schedule.find((e) => e.kind === 'quake')!;
  const d = Math.hypot(quake.x - crew.x, quake.y - crew.y);
  expect(d).toBeLessThanOrEqual(DIRECTOR.nearCrewMax + 1);
  expect(nearLedge(quake.x, quake.y, sim.salt, SEISMIC.epicentreLedgeDist)).toBe(true);
});

it('training ends with a liftoff at four minutes', () => {
  const { h } = solo('training');
  h.seconds(LAUNCH_COUNTDOWN_S + SCENARIOS.training.durationS + 1);
  expect(h.room.state.phase).toBe('report');
  expect(h.room.state.report!.scenario).toBe('training');
});

it('solo gets a longer decision window in v2 scenarios only', () => {
  const window = DIFFICULTIES.flight.classifyWindowS;
  expect(solo('training').h.room.state.params!.classifyWindowS).toBe(window * 1.5);
  expect(solo('free').h.room.state.params!.classifyWindowS).toBe(window);
});

it('signal story beats switch acts and warn about the launch window', () => {
  const { h } = solo('signal');
  const sim = h.room.simulation!;
  at(h, 149);
  expect(sim.pub.act).toBe(1);
  at(h, 151);
  expect(sim.pub.act).toBe(2);
  at(h, 331);
  expect(sim.pub.act).toBe(3);
  at(h, 421);
  const acts = sim.hidden.timeline.filter((e) => e.type === 'act').map((e) => e.n);
  expect(acts).toEqual([2, 3]);
  expect(sim.hidden.timeline.some((e) => e.type === 'window_closing')).toBe(true);
});

it('free mission runs no beats', () => {
  const { h } = solo('free');
  at(h, 30);
  expect(h.room.simulation!.pub.log).toEqual([]);
  expect(h.room.simulation!.hidden.director.beatsDone).toBe(0);
});

it('v2 scenarios start without the classic schedule or a random storm', () => {
  for (const id of ['training', 'signal'] as const)
    for (const seed of [1, 2, 3, 4, 5]) {
      const sim = solo(id, seed).h.room.simulation!;
      expect(sim.hidden.schedule).toEqual([]);
      expect(sim.hidden.storm).toBeNull();
    }
  expect(solo('free').h.room.simulation!.hidden.schedule.length).toBeGreaterThan(0);
});
