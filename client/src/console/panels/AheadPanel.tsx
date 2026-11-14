import type { EvaState, MissionParams } from '@rs/shared';
import { t } from '../../i18n';
import { upcoming } from '../ahead';

const URGENT = new Set(['storm', 'flare', 'window']);

/** Two minutes of what is coming that the crew can honestly know (docs/product-logic.md 7.8). */
export function AheadPanel({ snap, params }: { snap: EvaState; params: MissionParams | null }) {
  if (!params) return null;
  const items = upcoming(snap, params);
  return (
    <section className="panel ahead">
      <h2>{t('console.ahead')}</h2>
      {items.length === 0 && <div className="dim">{t('console.ahead.none')}</div>}
      {items.map((i) => (
        <div key={`${i.kind}-${i.at}`} className={URGENT.has(i.kind) ? 'err' : ''}>
          <b>{Math.max(0, Math.ceil(i.at - snap.t))}s</b> {t(`console.ahead.${i.kind}`)}
        </div>
      ))}
    </section>
  );
}
