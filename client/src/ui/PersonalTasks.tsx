import { METERS_PER_PX } from '@rs/shared';
import type { EvaState, PersonalTask, TaskBoard } from '@rs/shared';
import { t } from '../i18n';
import { send } from '../net/session';
import { me, useApp } from '../state/store';
import { ownTasks, taskDestination, taskName } from './taskView';
import './personalTasks.css';

function TaskRow({
  task,
  board,
  readonly,
}: {
  task: PersonalTask;
  board: TaskBoard;
  readonly: boolean;
}) {
  const self = useApp(me);
  const players = useApp((s) => s.room?.players);
  const owner = board.crew.find((p) => p.id === task.ownerId)?.name ?? task.ownerId;
  const original =
    board.crew.find((p) => p.id === task.originalOwnerId)?.name ?? task.originalOwnerId;
  const offerTo = board.crew.find((p) => p.id === task.offerTo)?.name;
  const transfer = task.reason === 'lost' || task.reason === 'disconnected';
  const mcTask = task.kind === 'guide' || task.kind === 'observe';
  return (
    <li className={`personal-task task-${task.state}`} data-task={task.id}>
      <span>
        <b>{owner}</b> · {t(`tasks.state.${task.state}`)}
      </span>
      <span>{taskName(task, board)}</span>
      {task.reason && <small>{t(`tasks.reason.${task.reason}`)}</small>}
      {task.state === 'queued' && <small>{t('tasks.wait_previous')}</small>}
      {task.ownerId !== task.originalOwnerId && (
        <small>{t('tasks.original', { player: original })}</small>
      )}
      {task.changes?.map((change, i) => (
        <small key={i}>
          {t('tasks.changed', {
            kind: t(`tasks.change.${change.reason}`),
            time: Math.round(change.at),
            player: board.crew.find((p) => p.id === change.ownerId)?.name ?? change.ownerId,
          })}
        </small>
      ))}
      {offerTo && <small>{t('tasks.offered', { player: offerTo })}</small>}
      {!readonly &&
        transfer &&
        self?.isHost &&
        board.crew
          .filter(
            (p) =>
              p.id !== task.ownerId &&
              (mcTask ? p.role !== 'eva' : p.role !== 'mc') &&
              players?.some((live) => live.id === p.id && live.connected),
          )
          .map((p) => (
            <button
              key={p.id}
              onClick={() => send({ t: 'task:offer', taskId: task.id, playerId: p.id })}
            >
              {t('tasks.offer', { player: p.name })}
            </button>
          ))}
      {!readonly && task.offerTo === self?.id && (
        <button onClick={() => send({ t: 'task:accept', taskId: task.id })}>
          {t('tasks.accept')}
        </button>
      )}
    </li>
  );
}

export function PersonalTasks({ snap, compact = false }: { snap: EvaState; compact?: boolean }) {
  const self = useApp(me);
  const board = snap.taskBoard;
  if (!board || !self) return null;
  const mine = ownTasks(board, self.id);
  const active = mine.find((task) => task.state === 'active' || task.state === 'blocked');
  const next = mine.find((task) => task.state === 'queued');
  const done = mine.filter((task) => task.state === 'done').length;
  const a = snap.astronauts.find((p) => p.id === self.id);
  const destination = active && taskDestination(active, snap.lander, a?.carrying);
  const guide = active?.kind === 'guide' && active.target;
  return (
    <section
      className={`personal-tasks ${compact ? 'task-compact' : 'panel'}`}
      aria-label={t('tasks.mine')}
    >
      <h2>
        {t('tasks.mine')} <small>{t('tasks.count', { done, total: mine.length })}</small>
      </h2>
      <div role="status">{active ? taskName(active, board) : t('tasks.complete')}</div>
      {active?.reason && <small>{t(`tasks.reason.${active.reason}`)}</small>}
      {active?.kind === 'observe' && <small>{t('tasks.wait_observe')}</small>}
      {active?.state === 'active' && destination && a && (
        <span className="task-bearing">
          <i
            aria-hidden="true"
            style={{
              transform: `rotate(${Math.atan2(destination.y - a.y, destination.x - a.x)}rad)`,
            }}
          >
            ➤
          </i>
          {t('tasks.distance', {
            n: Math.round(Math.hypot(destination.x - a.x, destination.y - a.y) * METERS_PER_PX),
          })}
        </span>
      )}
      {guide && active?.state === 'active' && (
        <button
          onClick={() =>
            send({
              t: 'mc:waypoint',
              playerId: guide.playerId!,
              x: guide.x,
              y: guide.y,
            })
          }
        >
          {t('tasks.route', {
            player: board.crew.find((p) => p.id === guide.playerId)?.name ?? '—',
          })}
        </button>
      )}
      {next && <small>{t('tasks.next', { task: taskName(next, board) })}</small>}
      <details className="crew-task-list">
        <summary>{t('tasks.crew')}</summary>
        <ul>
          {board.tasks.map((task) => (
            <TaskRow key={task.id} task={task} board={board} readonly={false} />
          ))}
        </ul>
      </details>
    </section>
  );
}

export function PersonalTaskReport({ board }: { board?: TaskBoard }) {
  if (!board) return null;
  return (
    <section className="panel personal-tasks task-report">
      <h2 className="panel-title">{t('tasks.report')}</h2>
      <ul>
        {board.crew.map((p) => (
          <li key={p.id}>
            <h3>{p.name}</h3>
            <ul>
              {board.tasks
                .filter((task) => task.originalOwnerId === p.id)
                .map((task) => (
                  <TaskRow key={task.id} task={task} board={board} readonly />
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
