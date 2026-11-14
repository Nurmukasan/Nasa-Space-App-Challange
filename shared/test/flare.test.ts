// A8: solar flare and radiation dose (docs/phases.md, task A8; docs/product-logic.md 7.15).
import { expect, it } from 'vitest';
import { FLARE, PRESETS, checkDesign, deriveParams } from '../src';
import { createSim } from '../src/sim/sim';
import { stepSim } from '../src/sim/step';
import { scheduleFlare, dosePenalty } from '../src/sim/flare';
import { scoreMission } from '../src/sim/scoring';
import { makeRoom } from './helpers';

function setup() {
  const sim = createSim(deriveParams(PRESETS.balanced, 4, 'signal'), ['out', 'in']);
  sim.pub.t = 10;
  const [out, inside] = sim.pub.astronauts;
  inside!.status = 'inside';
  out!.o2 = 1e6; // keep the outside astronaut breathing through the test
  return { sim, out: out!, inside: inside! };
}
const run = (sim: ReturnType<typeof setup>['sim'], seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 15); i++) stepSim(sim, 1 / 15);
};

it('stays secret until the warning, then shows the whole plan', () => {
  const { sim } = setup();
  scheduleFlare(sim, 20, 30, 25);
  run(sim, 9);
  expect(sim.pub.flare).toBeNull();
  run(sim, 2);
  expect(sim.pub.flare).toEqual({ warnAt: 20, tStart: 50, tEnd: 75 });
  expect(sim.pub.fx.some((f) => f.type === 'flare_warn')).toBe(true);
});

it('doses only crew outside, and only while the flare is active', () => {
  const { sim, out, inside } = setup();
  scheduleFlare(sim, 10, 5, 10);
  run(sim, 4.9);
  expect(out.dose).toBe(0);
  run(sim, 10.2);
  expect(out.dose).toBeCloseTo(FLARE.doseRate * 10, 0);
  expect(inside.dose).toBe(0);
  const after = out.dose;
  run(sim, 5);
  expect(out.dose).toBe(after);
  expect(sim.hidden.stats.doseMax).toBeCloseTo(after, 5);
  const types = sim.hidden.timeline.map((e) => e.type);
  expect(types).toContain('flare_start');
});

it('penalises safety only above the dose limit', () => {
  expect(dosePenalty(FLARE.doseLimit)).toBe(0);
  expect(dosePenalty(FLARE.doseLimit + 9)).toBe(0);
  expect(dosePenalty(FLARE.doseLimit + 25)).toBe(2 * FLARE.penaltyPer10);
  const { sim } = setup();
  const check = checkDesign(PRESETS.balanced, 'signal');
  const safe = scoreMission(sim.hidden.stats, sim.params, check).safety;
  sim.hidden.stats.doseMax = FLARE.doseLimit + 30;
  expect(scoreMission(sim.hidden.stats, sim.params, check).safety).toBe(
    safe - 3 * FLARE.penaltyPer10,
  );
});

it('training warns at 3:05 and the flare follows 30 s later', () => {
  const h = makeRoom(5);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
  h.send(a.playerId, { t: 'lobby:scenario', id: 'training' });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  const sim = h.room.simulation!;
  sim.pub.astronauts[0]!.status = 'inside';
  h.seconds(5 + 186);
  const f = sim.pub.flare!; // the beat runs on the first tick after 185 s
  expect(f.warnAt).toBeCloseTo(185, 0);
  expect(f.tStart - f.warnAt).toBeCloseTo(30, 5);
  expect(f.tEnd - f.tStart).toBeCloseTo(25, 5);
  expect(sim.pub.log.some((l) => l.key === 'story.training.flare')).toBe(true);
  expect(sim.pub.objectives.some((o) => o.kind === 'deploy_stations')).toBe(true);
});

it('debug flare schedules the standard flare', () => {
  const h = makeRoom(6);
  const a = h.room.join({ name: 'A' });
  if (!a.ok) throw new Error('join');
  h.send(a.playerId, { t: 'lobby:role', role: 'solo' });
  h.send(a.playerId, { t: 'lobby:class', crewClass: 'geologist' });
  h.send(a.playerId, { t: 'lobby:start', quick: true });
  h.seconds(6);
  h.send(a.playerId, { t: 'debug', cmd: 'flare' });
  const plan = h.room.simulation!.hidden.flare!;
  expect(plan.tStart - plan.warnAt).toBe(FLARE.leadS);
  expect(plan.tEnd - plan.tStart).toBe(FLARE.durS);
});
