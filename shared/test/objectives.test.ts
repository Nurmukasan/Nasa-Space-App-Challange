// A2: mission objectives (docs/phases.md, task A2; docs/product-logic.md 7.18).
import { expect, it } from 'vitest';
import { OBJECTIVE, PRESETS, checkDesign, deriveParams } from '../src';
import type { ScenarioId } from '../src';
import { createSim } from '../src/sim/sim';
import { endMission } from '../src/sim/endcheck';
import { objectivesSystem } from '../src/sim/objectives';
import { scoreMission } from '../src/sim/scoring';

function sim(scenario: ScenarioId = 'free') {
  const s = createSim(deriveParams(PRESETS.balanced, 5, scenario), ['a', 'b']);
  s.pub.t = 10;
  return s;
}
const byKind = (s: ReturnType<typeof sim>) =>
  Object.fromEntries(s.pub.objectives.map((o) => [o.kind, o]));

it('free mission: quota and deep quota are primary, all aboard is secondary', () => {
  const s = sim();
  expect(s.pub.objectives.map((o) => [o.kind, o.primary, o.target])).toEqual([
    ['deliver', true, 5],
    ['deliver_deep', true, 2],
    ['all_aboard', false, 1],
  ]);
});

it('signal: reduced quota, signal sample is primary, kits come from the design', () => {
  const o = byKind(sim('signal'));
  expect(o.deliver!.target).toBe(4);
  expect(o.retrieve_signal!.primary).toBe(true);
  expect(o.deliver_deep!.primary).toBe(false);
  expect(o.deploy_stations!.target).toBe(2);
  const noKits = createSim(deriveParams(PRESETS.budget, 5, 'signal'), ['a']);
  expect(noKits.pub.objectives.some((x) => x.kind === 'deploy_stations')).toBe(false);
});

it('progress follows deliveries, done is sticky and announced once', () => {
  const s = sim('training');
  s.hidden.stats.samplesDeposited = 1;
  objectivesSystem(s, 0);
  expect(byKind(s).deliver!.progress).toBe(1);
  s.hidden.stats.samplesDeposited = 3;
  objectivesSystem(s, 0);
  objectivesSystem(s, 0);
  expect(byKind(s).deliver!).toMatchObject({ progress: 2, state: 'done' });
  expect(s.pub.fx.filter((f) => f.type === 'objective_done' && f.s === 'deliver')).toHaveLength(1);
  s.hidden.stats.samplesDeposited = 0;
  objectivesSystem(s, 0);
  expect(byKind(s).deliver!.state).toBe('done');
});

it('liftoff fails unmet objectives and judges end-only ones', () => {
  const s = sim('signal');
  for (const a of s.pub.astronauts) a.status = 'inside';
  endMission(s);
  const o = byKind(s);
  expect(o.deliver!.state).toBe('failed');
  expect(o.retrieve_signal!.state).toBe('failed');
  expect(o.all_aboard!.state).toBe('done');
  expect(o.repair_all!.state).toBe('done');
});

it('repair_all fails if a fault is still open at liftoff', () => {
  const s = sim('signal');
  s.pub.lander.faults.push({ id: 'F1', kind: 'moxie_clog', port: 'e', since: 0, progress: 0 });
  endMission(s);
  expect(byKind(s).repair_all!.state).toBe('failed');
});

it('signal success needs the signal sample even with the quota met', () => {
  const s = sim('signal');
  s.hidden.stats.samplesDeposited = 6;
  s.hidden.stats.deepDeposited = 3;
  for (const a of s.pub.astronauts) a.status = 'inside';
  endMission(s);
  const check = checkDesign(PRESETS.balanced, 'signal');
  expect(scoreMission(s.hidden.stats, s.params, check, s.pub.objectives).success).toBe(false);
  const t = sim('signal');
  t.hidden.stats.samplesDeposited = 6;
  t.pub.signal.retrieved = true;
  for (const a of t.pub.astronauts) a.status = 'inside';
  endMission(t);
  expect(scoreMission(t.hidden.stats, t.params, check, t.pub.objectives).success).toBe(true);
});

it('free success with objectives equals the v1 quota rule', () => {
  const check = checkDesign(PRESETS.balanced);
  for (const [samples, deep] of [
    [5, 2],
    [5, 1],
    [4, 2],
  ] as const) {
    const s = sim();
    s.hidden.stats.samplesDeposited = samples;
    s.hidden.stats.deepDeposited = deep;
    for (const a of s.pub.astronauts) a.status = 'inside';
    endMission(s);
    const withObjectives = scoreMission(s.hidden.stats, s.params, check, s.pub.objectives);
    const v1 = scoreMission(s.hidden.stats, s.params, check);
    expect(withObjectives.success).toBe(v1.success);
    expect(withObjectives.teamwork).toBe(v1.teamwork);
  }
});

it('each done secondary objective except all aboard adds teamwork', () => {
  const s = sim('training');
  s.hidden.stats.classifyCorrect = 2;
  for (const a of s.pub.astronauts) a.status = 'inside';
  endMission(s);
  const check = checkDesign(PRESETS.balanced, 'training');
  const score = scoreMission(s.hidden.stats, s.params, check, s.pub.objectives);
  const base = scoreMission(s.hidden.stats, s.params, check);
  expect(score.teamwork - base.teamwork).toBe(OBJECTIVE.secondaryBonus);
});
