import { SIGNAL, TASKS } from '../../balance';
import { SCENARIOS } from '../../scenarios';
import type { PersonalTask, TaskCrew, TaskTarget } from '../../types';
import { dist } from '../sim';
import type { Sim } from '../sim';
import { sampleTarget } from './allocation';
import { checkTaskRoutes } from './progress';
import { recordChange, unfinished } from './state';

function replace(sim: Sim, task: PersonalTask, crew: TaskCrew): void {
  const ignoreIds = sim.pub
    .taskBoard!.tasks.filter((t) => t.id === task.id || t.after === task.id)
    .map((t) => t.id);
  const target = sampleTarget(sim, crew, sim.hidden.tasks!.decisions++, false, ignoreIds);
  if (!target) {
    task.state = 'blocked';
    task.reason = 'no_work';
    return;
  }
  recordChange(sim, task, 'consumed');
  // A completed first milestone stays history; a replacement delivery still needs an actual deposit.
  task.target = target;
  if (!task.after) task.kind = 'collect';
  task.state = 'active';
  delete task.reason;
  for (const next of sim.pub.taskBoard!.tasks)
    if (next.after === task.id && unfinished(next)) {
      next.target = { ...target };
      next.kind = 'deliver';
    }
}

function targetConsumed(sim: Sim, task: PersonalTask): boolean {
  if (!task.target) return true;
  const site = sim.pub.sites.find((s) => s.id === task.target!.id);
  if (task.kind === 'discover') return !!site;
  if (task.kind !== 'collect' && task.kind !== 'deliver') return false;
  const carried = sim.pub.astronauts.some(
    (a) =>
      a.id === task.ownerId &&
      a.carrying.some((s) => s.siteId === task.target!.id && s.tier === task.target!.tier),
  );
  if (task.kind === 'deliver' && carried) return false;
  if (site?.expiresAt !== null && site?.expiresAt !== undefined && site.expiresAt <= sim.pub.t)
    return true;
  // A sample lost with a dead astronaut cannot be retrieved from their inventory.
  return !!site && site.taken.includes(task.target.tier ?? 'surface');
}

function observationsOver(sim: Sim): boolean {
  if (sim.pub.seismic.some((e) => e.truth === null && e.deadline > sim.pub.t)) return false;
  if (sim.params.scenario === 'signal')
    return (
      sim.pub.signal.located ||
      sim.pub.t > SIGNAL.lastS + sim.params.classifyWindowS * SIGNAL.windowMul
    );
  const events = SCENARIOS[sim.params.scenario].beats.filter((b) => b.action.kind === 'event');
  return sim.pub.t > Math.max(...events.map((b) => b.at)) + sim.params.classifyWindowS;
}

function refreshRoute(sim: Sim, task: PersonalTask): void {
  if (sim.hidden.tasks!.routes[task.id]) return;
  const targetPlayer =
    sim.pub.astronauts.find((p) => p.id === task.target?.playerId && p.status === 'active') ??
    sim.pub.astronauts.find((p) => p.status === 'active');
  const work = sim.pub.taskBoard!.tasks.find(
    (t) => t.ownerId === targetPlayer?.id && t.state === 'active' && t.target,
  );
  const headingHome =
    work?.kind === 'deliver' &&
    targetPlayer?.carrying.some(
      (s) => s.siteId === work.target?.id && s.tier === work.target?.tier,
    );
  const target: TaskTarget =
    task.target?.id !== 'lander' && work?.target && !headingHome
      ? work.target
      : {
          id: 'lander',
          x: sim.pub.lander.x,
          y: sim.pub.lander.y,
        };
  if (
    !targetPlayer ||
    dist(targetPlayer.x, targetPlayer.y, target.x, target.y) <= (target.r ?? TASKS.arrivalRadius)
  ) {
    task.state = 'blocked';
    task.reason = 'no_work';
    return;
  }
  if (task.target?.id !== target.id || task.target?.playerId !== targetPlayer.id) {
    recordChange(sim, task, 'unavailable');
    task.target = { ...target, playerId: targetPlayer.id };
  }
  task.state = 'active';
  delete task.reason;
}

export function maintainTasks(sim: Sim): void {
  if (!sim.pub.taskBoard || !sim.hidden.tasks || sim.pub.t < 0 || sim.pub.ended) return;
  checkTaskRoutes(sim);
  for (const task of sim.pub.taskBoard.tasks) {
    if (!unfinished(task) || task.state === 'queued') continue;
    const crew = sim.pub.taskBoard.crew.find((p) => p.id === task.ownerId)!;
    const a = sim.pub.astronauts.find((p) => p.id === task.ownerId);
    const disconnectedAt = sim.hidden.tasks.disconnectedAt[task.ownerId];
    const unavailable =
      a?.status === 'lost'
        ? 'lost'
        : disconnectedAt !== undefined && sim.pub.t - disconnectedAt >= TASKS.disconnectGraceS
          ? 'disconnected'
          : null;
    if (unavailable) {
      task.state = 'blocked';
      task.reason = unavailable;
      continue;
    }
    delete task.offerTo;
    if (task.reason === 'lost' || task.reason === 'disconnected') {
      task.state = 'active';
      delete task.reason;
    }
    if (crew.role === 'mc') {
      if (task.kind === 'guide') refreshRoute(sim, task);
      if (task.kind === 'observe' && observationsOver(sim)) {
        const returning = sim.pub.astronauts.find(
          (p) =>
            p.status === 'active' &&
            dist(p.x, p.y, sim.pub.lander.x, sim.pub.lander.y) > TASKS.arrivalRadius,
        );
        if (returning) {
          recordChange(sim, task, 'unavailable');
          task.kind = 'guide';
          task.state = 'active';
          task.target = {
            id: 'lander',
            x: sim.pub.lander.x,
            y: sim.pub.lander.y,
            playerId: returning.id,
          };
          delete task.reason;
        } else {
          task.state = 'blocked';
          task.reason = 'no_work';
        }
      }
      continue;
    }
    if (task.kind === 'deploy' && a && a.kits === 0) replace(sim, task, crew);
    else if (task.kind !== 'deploy' && targetConsumed(sim, task)) replace(sim, task, crew);
  }
}

export function finishTasks(sim: Sim): void {
  for (const task of sim.pub.taskBoard?.tasks ?? [])
    if (unfinished(task)) {
      task.state = 'failed';
      delete task.offerTo;
    }
}
