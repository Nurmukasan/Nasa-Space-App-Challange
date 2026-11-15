import { TASKS } from '../../balance';
import type { PlayerInfo, TaskCrew } from '../../types';
import type { Sim } from '../sim';
import { recordChange, unfinished } from './state';

export function syncTaskConnections(sim: Sim, players: readonly PlayerInfo[]): void {
  const runtime = sim.hidden.tasks;
  if (!runtime) return;
  for (const p of players) {
    if (p.connected) delete runtime.disconnectedAt[p.id];
    else runtime.disconnectedAt[p.id] ??= Math.max(0, sim.pub.t);
  }
  for (const task of sim.pub.taskBoard?.tasks ?? []) {
    if (task.offerTo && !unavailable(sim, task.ownerId)) delete task.offerTo;
  }
}

function compatible(taskKind: string, crew: TaskCrew): boolean {
  return taskKind === 'guide' || taskKind === 'observe' ? crew.role !== 'eva' : crew.role !== 'mc';
}

function unavailable(sim: Sim, ownerId: string): boolean {
  const a = sim.pub.astronauts.find((p) => p.id === ownerId);
  const since = sim.hidden.tasks?.disconnectedAt[ownerId];
  return (
    a?.status === 'lost' || (since !== undefined && sim.pub.t - since >= TASKS.disconnectGraceS)
  );
}

/** Host offers; the connected recipient explicitly accepts. Slots and roles never change. */
export function taskTransfer(
  sim: Sim,
  actor: string,
  hostId: string,
  msg: { t: 'task:offer'; taskId: string; playerId: string } | { t: 'task:accept'; taskId: string },
): void {
  if (
    !sim.pub.taskBoard ||
    !sim.hidden.tasks ||
    sim.pub.ended ||
    sim.pub.t < 0 ||
    typeof msg.taskId !== 'string'
  )
    return;
  const task = sim.pub.taskBoard.tasks.find((t) => t.id === msg.taskId);
  if (!task || !unfinished(task) || !unavailable(sim, task.ownerId)) return;
  const targetId = msg.t === 'task:offer' ? msg.playerId : actor;
  if (typeof targetId !== 'string' || targetId === task.ownerId) return;
  const crew = sim.pub.taskBoard.crew.find((p) => p.id === targetId);
  const a = sim.pub.astronauts.find((p) => p.id === targetId);
  if (
    !crew ||
    !compatible(task.kind, crew) ||
    sim.hidden.tasks.disconnectedAt[targetId] !== undefined ||
    a?.status === 'lost' ||
    a?.status === 'down'
  )
    return;
  if (msg.t === 'task:offer') {
    if (actor === hostId) task.offerTo = targetId;
    return;
  }
  if (task.offerTo !== actor) return;
  recordChange(sim, task, 'transfer');
  task.ownerId = actor;
  delete task.offerTo;
  delete task.reason;
  delete sim.hidden.tasks.routes[task.id];
  const previous = sim.pub.taskBoard.tasks.find((t) => t.id === task.after);
  task.state = previous && unfinished(previous) ? 'queued' : 'active';
}
