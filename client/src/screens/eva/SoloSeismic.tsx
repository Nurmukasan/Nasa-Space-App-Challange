import { useEffect, useRef } from 'react';
import { FAULTS } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { t } from '../../i18n';
import { send } from '../../net/session';
import { Seismograph } from '../../console/Seismograph';

const KINDS = ['quake', 'impact', 'wind'] as const;
const KEYS = ['z', 'x', 'c'];
function Trace({ eventId }: { eventId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const graph = new Seismograph(canvas.current, eventId);
    return () => graph.destroy();
  }, [eventId]);
  return <canvas ref={canvas} width={256} height={90} aria-label={t('eva.seismic_trace')} />;
}

export function SoloSeismic({ snap, playerId }: { snap: EvaState; playerId: string }) {
  const event = snap.seismic.find(
    (e) => e.truth === null && e.guess === null && snap.t >= e.t0 && snap.t < e.deadline,
  );
  const eventId = event?.id;
  const signal = event?.signal;
  useEffect(() => {
    if (!eventId || signal) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.repeat ||
        target?.isContentEditable ||
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '') ||
        document.querySelector('[role="dialog"]')
      )
        return;
      const index = KEYS.indexOf(e.key.toLowerCase());
      const kind = KINDS[index];
      if (!kind) return;
      e.preventDefault();
      send({ t: 'mc:classify', eventId, kind });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [eventId, signal]);
  // Nothing to decide or repair: render nothing, so no empty frame hangs on the screen.
  if (!event && snap.lander.faults.length === 0) return null;
  return (
    <aside className="solo-tools">
      <section className="solo-seismic">
        {event && (
          <div className="solo-event" key={event.id}>
            <h2>{t(event.signal ? 'eva.signal_contact' : 'eva.seismic_contact')}</h2>
            <Trace eventId={event.id} />
            <progress
              max={event.deadline - event.t0}
              value={Math.max(0, event.deadline - snap.t)}
              aria-label={t('eva.decision_time')}
            />
            <small>
              {t('eva.decision_seconds', { n: Math.max(0, Math.ceil(event.deadline - snap.t)) })}
            </small>
            {event.signal ? (
              <p>{t('eva.auto_locating')}</p>
            ) : (
              <div className="solo-classify">
                {KINDS.map((kind, i) => (
                  <button
                    key={kind}
                    onClick={() => send({ t: 'mc:classify', eventId: event.id, kind })}
                  >
                    <kbd>{KEYS[i]!.toUpperCase()}</kbd> {t(`event.${kind}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {snap.lander.faults.map((fault) => (
          <div className="solo-fault" key={fault.id}>
            <b>{t(`eva.fault.${fault.kind}`)}</b>
            <span>{t('eva.repair_port', { port: t(`eva.port.${fault.port}`) })}</span>
            <progress max={1} value={fault.progress} aria-label={t('eva.repair_progress')} />
            <button
              onClick={() => {
                const offsets = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] } as const;
                const [x, y] = offsets[fault.port];
                send({
                  t: 'mc:waypoint',
                  playerId,
                  x: snap.lander.x + x * FAULTS.portDist,
                  y: snap.lander.y + y * FAULTS.portDist,
                });
              }}
            >
              {t('eva.mark_port')}
            </button>
          </div>
        ))}
      </section>
    </aside>
  );
}
