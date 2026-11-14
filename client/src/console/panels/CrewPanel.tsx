import { O2 } from '@rs/shared';
import type { EvaState, MissionParams, PlayerInfo } from '@rs/shared';
import { send } from '../../net/session';
import { t } from '../../i18n';
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
  return (
    <section className="panel">
      <h2>{t('console.crew')}</h2>
      {snap.astronauts.map((a) => {
        const seconds =
          Math.hypot(a.x - snap.lander.x, a.y - snap.lander.y) / (params?.walkSpeed ?? 1);
        const remaining = a.o2 / (O2.walk + (a.leak ? O2.leakExtra : 0));
        const verdict =
          a.status === 'inside' || remaining >= seconds * 1.25
            ? 'ok'
            : remaining >= seconds
              ? 'tight'
              : 'no';
        return (
          <div key={a.id}>
            <button className={target === a.id ? 'on' : ''} onClick={() => select(a.id)}>
              {players.find((p) => p.id === a.id)?.name ?? a.id}
            </button>
            <span>
              {Math.round((a.o2 / a.o2Max) * 100)}% · {t(`status.${a.status}`)} ·{' '}
              {t(`return.${verdict}`)}
            </span>
            <meter min={0} max={a.o2Max} value={a.o2} />
            {a.wantsRefill && (
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
