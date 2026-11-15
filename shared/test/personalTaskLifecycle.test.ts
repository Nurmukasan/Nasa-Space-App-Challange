import { expect, it } from 'vitest';
import { LANDER_POS, SIGNAL, TASKS } from '../src';
import { maintainTasks } from '../src/sim/tasks/maintenance';
import { taskFact } from '../src/sim/tasks/progress';
import { taskMission } from './personalTasks.helpers';

it('accepts transfers only after grace, from the host, and with recipient consent', () => {
  const { h, sim, ids, host } = taskMission(3, 'training', 'budget');
  const task = sim.pub.taskBoard!.tasks.find((t) => t.ownerId === ids[1])!;
  const recipient = ids[2]!;
  h.room.disconnect(ids[1]!);
  h.send(host, { t: 'task:offer', taskId: task.id, playerId: recipient });
  expect(task.offerTo).toBeUndefined();
  sim.pub.t = TASKS.disconnectGraceS;
  maintainTasks(sim);
  expect(task.reason).toBe('disconnected');
  h.send(recipient, { t: 'task:offer', taskId: task.id, playerId: recipient });
  expect(task.offerTo).toBeUndefined();
  h.send(host, { t: 'task:offer', taskId: task.id, playerId: host });
  expect(task.offerTo).toBeUndefined();
  h.send(host, { t: 'task:offer', taskId: task.id, playerId: recipient });
  expect(task.ownerId).toBe(ids[1]);
  expect(task.offerTo).toBe(recipient);
  h.send(recipient, { t: 'task:accept', taskId: task.id });
  expect(task.ownerId).toBe(recipient);
  expect(task.originalOwnerId).toBe(ids[1]);
  expect(task.changes).toHaveLength(1);
  h.send(recipient, { t: 'task:accept', taskId: task.id });
  expect(task.changes).toHaveLength(1);
  expect(sim.pub.taskBoard!.tasks).toHaveLength(6);
});

it('preserves tasks on token reconnect and rejects stale offers after the owner returns', () => {
  const { h, sim, host, ids, tokens } = taskMission(3, 'training', 'budget');
  h.room.disconnect(ids[1]!);
  sim.pub.t = TASKS.disconnectGraceS;
  const task = sim.pub.taskBoard!.tasks.find((t) => t.ownerId === ids[1])!;
  h.send(host, { t: 'task:offer', taskId: task.id, playerId: ids[2]! });
  expect(task.offerTo).toBe(ids[2]);
  expect(h.room.join({ name: 'returning', token: tokens[1] })).toMatchObject({
    ok: true,
    playerId: ids[1],
  });
  h.ticks(1);
  expect(task.offerTo).toBeUndefined();
  h.send(ids[2]!, { t: 'task:accept', taskId: task.id });
  expect(task.ownerId).toBe(ids[1]);
});

it('freezes the launch roster, refreshes on fly again, and never accepts a late new player', () => {
  const { h, sim, ids, host } = taskMission(2, 'training', 'budget');
  const board = sim.pub.taskBoard!;
  h.room.disconnect(ids[1]!);
  expect(board.tasks).toHaveLength(4);
  expect(h.room.join({ name: 'late' })).toMatchObject({ ok: false, error: 'game_in_progress' });
  sim.pub.astronauts[0]!.status = 'inside';
  h.send(host, { t: 'mc:liftoff' });
  h.ticks(1);
  expect(h.room.state.report!.taskBoard!.tasks.every((t) => t.state === 'failed')).toBe(true);
  h.send(host, { t: 'report:again', redesign: false });
  expect(h.room.simulation!.pub.taskBoard!.crew.map((p) => p.id)).toEqual(ids);
  expect(h.room.simulation!.pub.taskBoard!.tasks).toHaveLength(4);
  expect(h.room.simulation!.pub.taskBoard!.tasks.some((t) => t.state === 'done')).toBe(false);
});

it('does not award tasks from queued actions, auto-picks, or invalid messages', () => {
  const { h, sim, host } = taskMission(2, 'signal');
  const observe = sim.pub.taskBoard!.tasks.find((t) => t.kind === 'observe')!;
  taskFact(sim, { kind: 'observe', actor: host });
  expect(observe.state).toBe('queued');
  for (const raw of [
    { t: 'task:accept', taskId: '__proto__' },
    { t: 'task:offer', taskId: {}, playerId: host },
    { t: 'task:offer', taskId: observe.id, playerId: null },
    { t: 'lobby:tasks', enabled: 'yes' },
  ])
    expect(() => h.room.handle(host, raw)).not.toThrow();
  expect(observe.state).toBe('queued');
});

it('waits for future observations and never sends an EVA out of shelter for a fallback', () => {
  const { sim, host } = taskMission(2, 'signal');
  const [guide, observe] = sim.pub.taskBoard!.tasks;
  guide!.state = 'done';
  observe!.state = 'active';
  sim.pub.t = 180;
  maintainTasks(sim);
  expect(observe!.kind).toBe('observe');
  sim.pub.t = SIGNAL.lastS + sim.params.classifyWindowS * SIGNAL.windowMul + 1;
  const a = sim.pub.astronauts[0]!;
  a.status = 'inside';
  maintainTasks(sim);
  expect(observe!.state).toBe('blocked');
  expect(observe!.ownerId).toBe(host);
  a.status = 'active';
  a.x = LANDER_POS.x + 200;
  maintainTasks(sim);
  expect(observe!.kind).toBe('guide');
  expect(observe!.target!.id).toBe('lander');
});

it('retains the 16 KB snapshot budget for the largest crew', () => {
  const { sim } = taskMission(4, 'signal');
  expect(JSON.stringify(sim.pub).length).toBeLessThan(16000);
});
