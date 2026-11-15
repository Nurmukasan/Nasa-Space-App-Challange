import { TASKS } from '../../balance';
import type { PersonalTaskKind, SampleTier, TaskTarget } from '../../types';
import { dist } from '../sim';
import type { Sim } from '../sim';
import { completeTask } from './state';

export type TaskFact = {
  kind: Exclude<PersonalTaskKind, 'guide'>;
  actor: string;
  siteId?: string;
  tier?: SampleTier;
  x?: number;
  y?: number;
};

/** Called only at the successful authoritative action, never from an FX snapshot. */
export function taskFact(sim: Sim, fact: TaskFact): void {
  if (!sim.pub.taskBoard || sim.pub.t < 0 || sim.pub.ended) return;
  const matches = sim.pub.taskBoard.tasks.filter((t) => t.state === 'active');
  for (const task of matches) {
    if (task.ownerId !== fact.actor || task.kind !== fact.kind) continue;
    const target = task.target;
    if (fact.kind === 'collect' || fact.kind === 'deliver' || fact.kind === 'discover') {
      if (!target || target.id !== fact.siteId) continue;
      if (fact.kind !== 'discover' && target.tier !== fact.tier) continue;
    }
    if (
      fact.kind === 'deploy' &&
      (!target ||
        fact.x === undefined ||
        fact.y === undefined ||
        dist(target.x, target.y, fact.x, fact.y) > TASKS.arrivalRadius)
    )
      continue;
    completeTask(sim, task);
  }
  // A discovered site's exact coordinates are now public, including for its queued delivery.
  if (fact.kind === 'discover') {
    const site = sim.pub.sites.find((s) => s.id === fact.siteId && s.known);
    if (site)
      for (const task of sim.pub.taskBoard.tasks) {
        if (task.target?.id !== site.id) continue;
        task.target = { ...task.target, x: site.x, y: site.y };
        delete task.target.r;
      }
  }
}

/** A route is earned by an MC command followed by actual travel to the assigned target. */
export function taskWaypoint(
  sim: Sim,
  actor: string,
  playerId: string,
  point: TaskTarget | null,
): void {
  if (!sim.hidden.tasks || sim.pub.t < 0 || sim.pub.ended) return;
  for (const task of sim.pub.taskBoard?.tasks ?? []) {
    if (
      task.kind !== 'guide' ||
      task.state !== 'active' ||
      task.ownerId !== actor ||
      task.target?.playerId !== playerId
    )
      continue;
    delete sim.hidden.tasks.routes[task.id];
    if (!point) continue;
    const a = sim.pub.astronauts.find((p) => p.id === playerId);
    const radius = task.target.r ?? TASKS.arrivalRadius;
    if (
      !a ||
      a.status !== 'active' ||
      dist(a.x, a.y, point.x, point.y) <= radius ||
      dist(task.target.x, task.target.y, point.x, point.y) > radius
    )
      continue;
    sim.hidden.tasks.routes[task.id] = { x: point.x, y: point.y, playerId };
  }
}

export function checkTaskRoutes(sim: Sim): void {
  for (const task of sim.pub.taskBoard?.tasks ?? []) {
    if (task.kind !== 'guide' || task.state !== 'active') continue;
    const route = sim.hidden.tasks?.routes[task.id];
    const a = sim.pub.astronauts.find((p) => p.id === route?.playerId);
    if (!route || !a || a.status === 'lost' || a.status === 'down') continue;
    if (a.waypoint?.x !== route.x || a.waypoint?.y !== route.y) continue;
    if (dist(a.x, a.y, route.x, route.y) <= (task.target?.r ?? TASKS.arrivalRadius)) {
      completeTask(sim, task);
      delete sim.hidden.tasks!.routes[task.id];
    }
  }
}
