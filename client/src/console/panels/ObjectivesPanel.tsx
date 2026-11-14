import type { EvaState } from '@rs/shared';
import { t } from '../../i18n';

const MARK = { active: '·', done: '✓', failed: '✗' } as const;

/** Mission objectives with progress; primary ones first (docs/product-logic.md 7.18). */
export function ObjectivesPanel({ snap }: { snap: EvaState }) {
  if (snap.objectives.length === 0) return null;
  const list = [...snap.objectives].sort((a, b) => Number(b.primary) - Number(a.primary));
  return (
    <section className="panel objectives">
      <h2>{t('console.objectives')}</h2>
      {list.map((o) => (
        <div key={o.id} className={o.state === 'done' ? 'ok' : o.state === 'failed' ? 'err' : ''}>
          {MARK[o.state]} {o.primary ? <b>{t(`objective.${o.kind}`)}</b> : t(`objective.${o.kind}`)}{' '}
          {o.target > 1 && `${o.progress}/${o.target}`}
        </div>
      ))}
    </section>
  );
}
