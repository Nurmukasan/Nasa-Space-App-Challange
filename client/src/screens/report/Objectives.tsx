import type { Objective } from '@rs/shared';
import { t } from '../../i18n';
export function Objectives({ objectives }: { objectives: Objective[] }) {
  if (!objectives.length) return null;
  return (
    <section className="panel report-objectives">
      <h2 className="panel-title">{t('reportUi.objectives')}</h2>
      {objectives.map((o) => (
        <div key={o.id} className={`debrief-objective objective-${o.state}`}>
          <b aria-label={t(`reportUi.state.${o.state}`)}>
            {o.state === 'done' ? '✓' : o.state === 'failed' ? '✗' : '◇'}
          </b>
          <span>
            {t(`objective.${o.kind}`)}
            <small>{t(o.primary ? 'reportUi.primary' : 'reportUi.secondary')}</small>
          </span>
          <strong>
            {o.progress}/{o.target}
          </strong>
        </div>
      ))}
    </section>
  );
}
