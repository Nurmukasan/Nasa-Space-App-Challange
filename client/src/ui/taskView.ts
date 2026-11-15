import type { PersonalTask, TaskBoard } from '@rs/shared';
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

/** Point to the airlock for delivery, not back to the sample's collection site. */
export function taskDestination(task: PersonalTask, lander: { x: number; y: number }) {
  if (task.kind === 'deliver') return lander;
  return task.target;
}
