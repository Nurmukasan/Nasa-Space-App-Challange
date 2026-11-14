import { useEffect, useRef } from 'react';
import type { EvaState } from '@rs/shared';
import { Seismograph } from '../Seismograph';
import { command as send } from '../actions';
import { t } from '../../i18n';
import { PixelIcon } from '../../ui/PixelIcon';
import { audio } from '../../audio';
import { AHEAD } from '../ahead';

/** One warning tone per undecided event as its decision window runs out. */
function useUrgentTone(snap: EvaState) {
  const warned = useRef(new Set<string>());
  useEffect(() => {
    for (const e of snap.seismic) {
      const left = e.deadline - snap.t;
      const open = e.signal ? e.pick === null : e.guess === null;
      if (open && left > 0 && left <= AHEAD.urgentS && !warned.current.has(e.id)) {
        warned.current.add(e.id);
        audio.sfx('ui_error');
      }
    }
  }, [snap]);
}

function Chart({ eventId }: { eventId?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const graph = new Seismograph(canvas.current, eventId);
    return () => graph.destroy();
  }, [eventId]);
  return (
    <canvas
      className="seismo-canvas"
      ref={canvas}
      width={400}
      height={180}
      aria-label={t('console.seismic')}
    />
  );
}
export function SeismicPanel({
  snap,
  locating,
  setLocating,
}: {
  snap: EvaState;
  locating: string | null;
  setLocating: (id: string | null) => void;
}) {
  useUrgentTone(snap);
  return (
    <section className="panel">
      <h2 className="panel-title">
        <PixelIcon name="icon_seismo_net" scale={1} />
        {t('console.seismic')}
      </h2>
      {snap.seismic.length === 0 && <Chart />}
      {snap.seismic.map((e) => (
        <div key={e.id} className="seismic-event">
          <Chart eventId={e.id} />
          <progress
            className={e.deadline - snap.t <= AHEAD.urgentS ? 'urgent' : ''}
            max={e.deadline - e.t0}
            value={Math.max(0, e.deadline - snap.t)}
          />
          <span>{Math.max(0, Math.ceil(e.deadline - snap.t))}s</span>
          {e.signal && <b className="signal-label">{t('console.redSignal')}</b>}
          <button
            className={locating === e.id ? 'on' : ''}
            disabled={snap.t >= e.deadline}
            onClick={() => setLocating(locating === e.id ? null : e.id)}
          >
            {t(locating === e.id ? 'console.locating' : 'console.locate')}
          </button>
          <div className="classify-row" hidden={e.signal}>
            {(['quake', 'impact', 'wind'] as const).map((kind) => (
              <button
                key={kind}
                disabled={e.guess !== null || snap.t < e.t0 || snap.t >= e.deadline}
                onClick={() => send({ t: 'mc:classify', eventId: e.id, kind })}
              >
                {t(`event.${kind}`)}
                <small>{t(`signal.${kind}`)}</small>
              </button>
            ))}
          </div>
          {e.truth && <span>{t(`event.${e.truth}`)}</span>}
        </div>
      ))}
    </section>
  );
}
