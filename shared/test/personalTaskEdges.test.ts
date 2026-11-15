import { expect, it } from 'vitest';
import { LANDER_POS, TASKS } from '../src';
import { handleSimMsg } from '../src/sim/input';
import { maintainTasks } from '../src/sim/tasks/maintenance';
import { taskMission } from './personalTasks.helpers';

it("does not reserve a recipient's existing sample again after a handoff and retarget", () => {
  const { h, sim, ids, host } = taskMission(3, 'training', 'budget');
  const original = sim.pub.taskBoard!.tasks.find((t) => t.ownerId === ids[1])!;
  const recipientTask = sim.pub.taskBoard!.tasks.find((t) => t.ownerId === ids[2])!;
  sim.pub.astronauts.find((a) => a.id === ids[1])!.status = 'lost';
  h.send(host, { t: 'task:offer', taskId: original.id, playerId: ids[2]! });
  h.send(ids[2]!, { t: 'task:accept', taskId: original.id });
  expect(original.ownerId).toBe(ids[2]);
  for (const site of sim.pub.sites) {
    if (site.id !== recipientTask.target!.id) site.taken.push('surface');
  }
  maintainTasks(sim);
  expect(original.state).toBe('blocked');
  expect(original.reason).toBe('no_work');
  expect(recipientTask.state).toBe('active');
});

it('rejects wrong, late and replayed observation input instead of completing MC work', () => {
  const { sim, host } = taskMission(2, 'signal');
  const [guide, observe] = sim.pub.taskBoard!.tasks;
  guide!.state = 'done';
  observe!.state = 'active';
  // No live public observation exists yet; arbitrary IDs and non-finite points are invalid.
  for (const msg of [
    { t: 'mc:locate', eventId: 'missing', x: LANDER_POS.x, y: LANDER_POS.y },
    { t: 'mc:locate', eventId: 'missing', x: NaN, y: 1 },
    { t: 'mc:classify', eventId: 'missing', kind: 'quake' },
  ] as const)
    handleSimMsg(sim, host, false, true, msg);
  expect(observe!.state).toBe('active');
});

it('honours host-only task selection and preserves completed assignments on reconnect', () => {
  const { h, sim, ids, host, tokens } = taskMission(3, 'training', 'budget');
  h.send(ids[1]!, { t: 'lobby:tasks', enabled: false });
  h.send(host, { t: 'lobby:tasks', enabled: false });
  expect(h.room.state.personalTasks).toBe(true); // In-flight mode is frozen, even for the host.
  const task = sim.pub.taskBoard!.tasks.find((t) => t.ownerId === ids[1])!;
  task.state = 'done';
  task.completedAt = 10;
  h.room.disconnect(ids[1]!);
  sim.pub.t = TASKS.disconnectGraceS + 1;
  maintainTasks(sim);
  expect(h.room.join({ name: 'back', token: tokens[1] })).toMatchObject({
    ok: true,
    playerId: ids[1],
  });
  expect(task.state).toBe('done');
  expect(task.completedAt).toBe(10);
});

it('fits a full four-player RED SIGNAL timeline within the snapshot budget', () => {
  const { h, sim } = taskMission(4, 'signal');
  for (const a of sim.pub.astronauts) a.status = 'inside';
  let maximum = 0;
  for (let i = 0; i < sim.pub.durationS * 15 && !sim.pub.ended; i++) {
    h.ticks(1);
    if (i % 30 === 0) maximum = Math.max(maximum, JSON.stringify(sim.pub).length);
  }
  expect(maximum).toBeLessThan(16000);
});
