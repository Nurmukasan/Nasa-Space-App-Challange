import { useEffect, useRef } from 'react';
import type { EvaState } from '@rs/shared';
import { Seismograph } from '../Seismograph';
import { send } from '../../net/session';
import { t } from '../../i18n';
function Chart({ eventId }: { eventId?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const graph = new Seismograph(canvas.current, eventId);
    return () => graph.destroy();
  }, [eventId]);
  return (
    <canvas
      style={{ width: '100%' }}
      ref={canvas}
      width={400}
      height={180}
      aria-label={t('console.seismic')}
    />
  );
}
export function SeismicPanel({ snap }: { snap: EvaState }) {
  return (
    <section className="panel">
      <h2>{t('console.seismic')}</h2>
      {snap.seismic.length === 0 && <Chart />}
      {snap.seismic.map((e) => (
        <div key={e.id}>
          <Chart eventId={e.id} />
          <progress max={e.deadline - e.t0} value={Math.max(0, e.deadline - snap.t)} />
          <span>{Math.max(0, Math.ceil(e.deadline - snap.t))}s</span>
          <div>
            {(['quake', 'impact', 'wind'] as const).map((kind) => (
              <button
                key={kind}
                disabled={e.guess !== null || snap.t < e.t0 || snap.t >= e.deadline}
                onClick={() => send({ t: 'mc:classify', eventId: e.id, kind })}
              >
                {t(`event.${kind}`)}
                <small style={{ display: 'block' }}>{t(`signal.${kind}`)}</small>
              </button>
            ))}
          </div>
          {e.truth && <span>{t(`event.${e.truth}`)}</span>}
        </div>
      ))}
    </section>
  );
}
