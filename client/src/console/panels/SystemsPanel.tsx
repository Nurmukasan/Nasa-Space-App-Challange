import { portPos } from '@rs/shared';
import type { EvaState, ServicePort } from '@rs/shared';
import { command as send } from '../actions';
import { t } from '../../i18n';

const PORTS: ServicePort[] = ['n', 'e', 's', 'w'];
const CELL: Record<ServicePort, { row: number; col: number }> = {
  n: { row: 1, col: 2 },
  e: { row: 2, col: 3 },
  s: { row: 3, col: 2 },
  w: { row: 2, col: 1 },
};

/** Lander schematic: the faulty hatch blinks; SEND TO PORT sets the selected astronaut's beacon. */
export function SystemsPanel({ snap, target }: { snap: EvaState; target: string | null }) {
  const faults = snap.lander.faults;
  return (
    <section className={`panel systems ${faults.length > 0 ? 'alarm' : ''}`}>
      <h2>{t('console.systems')}</h2>
      <div className="systems-grid">
        <div className="systems-hull">TULPAR-1</div>
        {PORTS.map((port) => {
          const fault = faults.find((f) => f.port === port);
          return (
            <div
              key={port}
              className={`systems-port ${fault ? 'broken' : ''}`}
              style={{ gridRow: CELL[port].row, gridColumn: CELL[port].col }}
            >
              {t(`port.${port}`)}
            </div>
          );
        })}
      </div>
      {faults.length === 0 && <p className="ok">{t('console.systemsOk')}</p>}
      {faults.map((f) => (
        <div key={f.id} className="systems-fault">
          <b>{t(`fault.${f.kind}`)}</b> · {t(`port.${f.port}`)} · {Math.round(f.progress * 100)}%
          <button
            disabled={!target}
            onClick={() =>
              target && send({ t: 'mc:waypoint', playerId: target, ...portPos(f.port) })
            }
          >
            {t('console.sendToPort')}
          </button>
        </div>
      ))}
    </section>
  );
}
