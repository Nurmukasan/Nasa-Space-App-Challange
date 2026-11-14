import { useEffect, useState } from 'react';
import type { EvaState } from '@rs/shared';
import { t } from '../../i18n';
import { HUD } from './style';

export function MissionObjectives({ snap }: { snap: EvaState }) {
  const objectives = [...snap.objectives]
    .sort((a, b) => Number(b.primary) - Number(a.primary))
    .slice(0, 3);
  return (
    <div className="helmet-objectives">
      {objectives.map((o) => (
        <div key={o.id} data-objective={o.kind} className={`objective-${o.state}`}>
          <span aria-hidden="true">
            {o.state === 'done' ? '✓' : o.state === 'failed' ? '✗' : '◇'}
          </span>
          <span>{t(`objective.${o.kind}`)}</span>
          <b>
            {o.progress}/{o.target}
          </b>
        </div>
      ))}
    </div>
  );
}

export function ActTitle({ snap }: { snap: EvaState }) {
  const [visible, setVisible] = useState(true);
  const started = snap.t >= 0;
  useEffect(() => {
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), HUD.actTitleMs);
    return () => clearTimeout(timer);
  }, [snap.act, snap.scenario, started]);
  if (!visible || snap.t < 0 || snap.scenario === 'free') return null;
  return (
    <div className="helmet-act-title" key={snap.act}>
      {t('eva.act', { n: snap.act })}
      <strong>{t(`eva.act.${snap.act}`)}</strong>
    </div>
  );
}
