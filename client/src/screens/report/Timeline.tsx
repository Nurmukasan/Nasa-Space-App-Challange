import { REPORT } from '@rs/shared';
import type { PlayerInfo, TimelineEntry } from '@rs/shared';
import { t } from '../../i18n';
export function missionTime(time: number) {
  const s = Math.max(0, Math.floor(time));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const ICON: Record<string, string> = {
  act: '◆',
  deposit: '▣',
  discovery: '✦',
  deploy: '△',
  tremor: '≈',
  impact: '☄',
  breach: '!',
  rescue: '+',
  fault: '⚙',
  signal_found: '◎',
  liftoff: '↑',
};
export function Timeline({
  entries,
  players,
}: {
  entries: TimelineEntry[];
  players: PlayerInfo[];
}) {
  if (!entries.length) return null;
  return (
    <section className="panel report-timeline">
      <h2 className="panel-title">{t('reportUi.timeline')}</h2>
      <ol>
        {entries
          .slice(0, REPORT.timelineMax)
          .sort((a, b) => a.t - b.t)
          .map((e, index) => {
            const key = `reportUi.event.${e.type}`,
              text = t(key);
            const base = text === key ? t('reportUi.event.default') : text;
            // Which objective was met, which system broke or was repaired.
            const detail =
              e.s && e.type === 'objective_done'
                ? t(`objective.${e.s}`)
                : e.s && (e.type === 'fault' || e.type === 'repair_done')
                  ? t(`fault.${e.s}`)
                  : null;
            const label = detail ? `${base} · ${detail}` : base;
            const name = players.find((p) => p.id === e.playerId)?.name;
            return (
              <li
                key={`${e.t}-${index}`}
                tabIndex={0}
                title={`${missionTime(e.t)} · ${label}${name ? ` · ${name}` : ''}${e.n !== undefined ? ` · ${e.n}` : ''}`}
              >
                <time>{missionTime(e.t)}</time>
                <b aria-hidden="true">{ICON[e.type] ?? '•'}</b>
                <span>{label}</span>
                {name && <small>{name}</small>}
              </li>
            );
          })}
      </ol>
    </section>
  );
}
