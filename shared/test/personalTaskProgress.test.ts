import { expect, it } from 'vitest';
import { DIG, LANDER_POS, PRESETS, checkDesign } from '../src';
import { excavate } from '../src/sim/digging';
import { discoverySystem } from '../src/sim/discovery';
import { endMission } from '../src/sim/endcheck';
import { handleSimMsg } from '../src/sim/input';
import { buildReport } from '../src/sim/scoring';
import { seismicSystem } from '../src/sim/seismic';
import { tryDeployKit } from '../src/sim/stations';
import { maintainTasks } from '../src/sim/tasks/maintenance';
import { taskFact } from '../src/sim/tasks/progress';
import { taskMission } from './personalTasks.helpers';

it('credits actual owner collection and deposit exactly once, with no extra mission score', () => {
  const { sim, ids } = taskMission(1, 'training', 'budget', 1, ['biologist']);
  const [first, second] = sim.pub.taskBoard!.tasks;
  expect(first!.kind).toBe('collect');
  const a = sim.pub.astronauts[0]!;
  taskFact(sim, { kind: 'collect', actor: 'stranger', siteId: first!.target!.id, tier: 'surface' });
  expect(first!.state).toBe('active');
  a.x = first!.target!.x;
  a.y = first!.target!.y;
  // Training digs by strokes (PL 7.5.1); collect through the shared excavation path.
  const site = sim.pub.sites.find((s) => s.id === first!.target!.id)!;
  excavate(sim, a, site, DIG.surfaceDepth + 0.001);
  expect(first!.state).toBe('done');
  expect(second!.state).toBe('active');
  expect(second!.kind).toBe('deliver');
  a.x = LANDER_POS.x;
  a.y = LANDER_POS.y;
  handleSimMsg(sim, ids[0]!, true, true, { t: 'eva:interact' });
  expect(second!.state).toBe('done');
  const at = second!.completedAt;
  handleSimMsg(sim, ids[0]!, true, true, { t: 'eva:interact' });
  maintainTasks(sim);
  expect(second!.completedAt).toBe(at);
  expect(sim.hidden.stats.samplesDeposited).toBe(1);
  const check = checkDesign(PRESETS.budget, 'training');
  const withTasks = buildReport(sim, PRESETS.budget, check);
  delete sim.pub.taskBoard;
  expect(buildReport(sim, PRESETS.budget, check).score).toEqual(withTasks.score);
});

it('counts a station only when the assigned astronaut successfully deploys at the target', () => {
  const missions = Array.from({ length: 30 }, (_, i) =>
    taskMission(1, 'signal', 'science', i, ['engineer']),
  );
  const { sim } = missions.find(({ sim }) => sim.pub.taskBoard!.tasks[0]!.kind === 'deploy')!;
  const first = sim.pub.taskBoard!.tasks[0]!;
  const a = sim.pub.astronauts[0]!;
  expect(tryDeployKit(sim, a)).toBe(false);
  expect(first.state).toBe('active');
  a.x = first.target!.x;
  a.y = first.target!.y;
  expect(tryDeployKit(sim, a)).toBe(true);
  expect(first.state).toBe('done');
  expect(sim.pub.taskBoard!.tasks[1]!.state).toBe('active');
});

it('uses the public anomaly until the owner actually discovers its site', () => {
  const missions = Array.from({ length: 80 }, (_, i) =>
    taskMission(1, 'signal', 'science', i, ['scout']),
  );
  const { sim } = missions.find(({ sim }) => sim.pub.taskBoard!.tasks[0]!.kind === 'discover')!;
  const [first, second] = sim.pub.taskBoard!.tasks;
  const site = sim.hidden.hiddenSites.find((s) => s.id === first!.target!.id)!;
  const anomaly = sim.pub.anomalies.find((s) => s.id === site.id)!;
  expect(first!.target).toMatchObject({ x: anomaly.x, y: anomaly.y, r: anomaly.r });
  expect(first!.target!.id).not.toBe('SIG');
  const a = sim.pub.astronauts[0]!;
  a.x = site.x;
  a.y = site.y;
  discoverySystem(sim, 0);
  expect(first!.state).toBe('done');
  expect(second!.target).toMatchObject({ id: site.id, x: site.x, y: site.y });
  expect(second!.target!.r).toBeUndefined();
});

it('requires a fresh MC waypoint followed by the named EVA arrival', () => {
  const { sim, host, ids } = taskMission(2, 'training', 'budget');
  const [guide, observe] = sim.pub.taskBoard!.tasks;
  const a = sim.pub.astronauts[0]!;
  a.x = guide!.target!.x;
  a.y = guide!.target!.y;
  maintainTasks(sim);
  expect(guide!.state).not.toBe('done');
  a.x = LANDER_POS.x;
  a.y = LANDER_POS.y;
  maintainTasks(sim);
  handleSimMsg(sim, host, false, true, {
    t: 'mc:waypoint',
    playerId: ids[1]!,
    x: guide!.target!.x,
    y: guide!.target!.y,
  });
  expect(guide!.state).toBe('active');
  a.x = guide!.target!.x;
  a.y = guide!.target!.y;
  maintainTasks(sim);
  expect(guide!.state).toBe('done');
  expect(observe!.state).toBe('active');
  sim.hidden.schedule.push({ id: 'lesson', kind: 'wind', t0: 0, x: a.x, y: a.y, fired: false });
  seismicSystem(sim, 0);
  handleSimMsg(sim, host, false, true, { t: 'mc:classify', eventId: 'lesson', kind: 'wind' });
  expect(observe!.state).toBe('done');
});

it('retargets a consumed sample without losing completed history or changing the task count', () => {
  const { sim } = taskMission(1, 'training', 'budget', 1, ['biologist']);
  const first = sim.pub.taskBoard!.tasks[0]!;
  const oldId = first.target!.id;
  const site = sim.pub.sites.find((s) => s.id === oldId)!;
  site.taken.push('surface');
  maintainTasks(sim);
  expect(first.target!.id).not.toBe(oldId);
  expect(first.state).toBe('active');
  expect(first.changes![0]!.reason).toBe('consumed');
  expect(sim.pub.taskBoard!.tasks).toHaveLength(2);
  sim.pub.astronauts[0]!.status = 'inside';
  endMission(sim);
  const report = buildReport(sim, PRESETS.budget, checkDesign(PRESETS.budget, 'training'));
  expect(report.taskBoard!.tasks.every((t) => t.state === 'failed')).toBe(true);
  const target = report.taskBoard!.tasks[0]!.target!.id;
  first.target!.id = 'mutated';
  expect(report.taskBoard!.tasks[0]!.target!.id).toBe(target);
});
