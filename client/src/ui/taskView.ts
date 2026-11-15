import type { PersonalTask, Sample, TaskBoard } from '@rs/shared';
import { t } from '../i18n';

export function taskName(task: PersonalTask, board: TaskBoard): string {
  return t(`tasks.kind.${task.kind}`, {
    id: task.target?.id === 'lander' ? t('tasks.lander') : (task.target?.id ?? '—'),
    tier: t(`tasks.${task.target?.tier ?? 'surface'}`),
    player: board.crew.find((p) => p.id === task.target?.playerId)?.name ?? '—',
  });
}

export function ownTasks(board: TaskBoard, playerId: string): PersonalTask[] {
  return board.tasks.filter((task) => task.ownerId === playerId);
}

/** A delivery starts at the collection site until the matching sample is actually carried. */
export function taskDestination(
  task: PersonalTask,
  lander: { x: number; y: number },
  carrying: readonly Pick<Sample, 'siteId' | 'tier'>[] = [],
) {
  if (
    task.kind === 'deliver' &&
    carrying.some((s) => s.siteId === task.target?.id && s.tier === task.target?.tier)
  )
    return lander;
  return task.target;
}
