import { TASKS } from '../../balance';
import type { PersonalTask, TaskChange } from '../../types';
import type { Sim } from '../sim';

export interface TaskRuntime {
  disconnectedAt: Record<string, number>;
  /** Valid MC waypoint facts waiting for the named EVA's arrival. */
  routes: Record<string, { x: number; y: number; playerId: string }>;
  /** Replacement decisions use an independent stream and a bounded counter. */
  decisions: number;
}

export const unfinished = (t: PersonalTask): boolean => t.state !== 'done' && t.state !== 'failed';

export function recordChange(sim: Sim, task: PersonalTask, reason: TaskChange['reason']): void {
  task.changes ??= [];
  task.changes.push({ at: sim.pub.t, ownerId: task.ownerId, kind: task.kind, reason });
  if (task.changes.length > TASKS.historyLimit) task.changes.shift();
}

export function completeTask(sim: Sim, task: PersonalTask): void {
  if (task.state !== 'active') return;
  task.state = 'done';
  task.completedAt = sim.pub.t;
  delete task.reason;
  delete task.offerTo;
  for (const next of sim.pub.taskBoard?.tasks ?? []) {
    if (next.after === task.id && next.state === 'queued') next.state = 'active';
  }
}
