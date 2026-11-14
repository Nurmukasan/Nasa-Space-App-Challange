import { useRef } from 'react';
import { Telemetry } from '../telemetry';
import { O2, moveSpeed } from '@rs/shared';
import type { EvaState, MissionParams, PlayerInfo } from '@rs/shared';
import { command as send } from '../actions';
import { t } from '../../i18n';
import { PixelIcon } from '../../ui/PixelIcon';

export function CrewPanel({
  snap,
  params,
  players,
  target,
  select,
}: {
  snap: EvaState;
  params: MissionParams | null;
  players: PlayerInfo[];
  target: string | null;
  select: (id: string) => void;
}) {
  const cache = useRef(new Telemetry());
  cache.current.observe(snap);
  return (
    <section className="panel">
      <h2 className="panel-title">
        <PixelIcon name="icon_vehicle_medium" scale={1} />
        {t('console.crew')}
      </h2>
      {snap.astronauts.map((live) => {
        const a = cache.current.contacts.get(live.id)?.crew ?? live;
        const seconds =
          Math.hypot(a.x - snap.lander.x, a.y - snap.lander.y) /
          (params ? moveSpeed(params, snap.weather, false) : 1);
        const remaining = a.o2 / (O2.walk + (a.leak ? O2.leakExtra : 0));
        const verdict =
          a.status === 'inside' || remaining >= seconds * 1.25
            ? 'ok'
            : remaining >= seconds
              ? 'tight'
              : 'no';
        return (
          <div key={a.id} className={`crew-row verdict-${live.linked ? verdict : 'lost'}`}>
            <button className={target === a.id ? 'on' : ''} onClick={() => select(a.id)}>
              {players.find((p) => p.id === a.id)?.name ?? a.id}
            </button>
            <span className="crew-stat">
              {cache.current.contacts.has(live.id) ? `${Math.round((a.o2 / a.o2Max) * 100)}%` : '—'}{' '}
              · {t(`status.${a.status}`)} ·{' '}
              {live.linked ? t(`return.${verdict}`) : t('console.noSignal')}
            </span>
            <meter min={0} max={a.o2Max} value={cache.current.contacts.has(live.id) ? a.o2 : 0} />
            {live.linked && a.wantsRefill && (
              <button
                disabled={a.refillGranted}
                onClick={() => send({ t: 'mc:dispense', playerId: a.id })}
              >
                {t('console.dispense')}
              </button>
            )}
          </div>
        );
      })}
      <label>
        <input
          type="checkbox"
          checked={snap.lander.ration}
          onChange={(e) => send({ t: 'mc:ration', on: e.target.checked })}
        />
        {t('console.ration')}
      </label>
    </section>
  );
}
