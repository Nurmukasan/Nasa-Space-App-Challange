import { useEffect, useRef, useState } from 'react';
import { command as send } from '../actions';
import { t } from '../../i18n';
export function Commands({
  target,
  crew,
  outside,
}: {
  target: string | null;
  crew: string[];
  /** Names of crew not inside the lander: they are lost at liftoff (PL 7.21). */
  outside: string[];
}) {
  const [all, setAll] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };
  const start = () => {
    if (timer.current) return;
    setHolding(true);
    timer.current = setTimeout(() => {
      send({ t: 'mc:liftoff' });
      cancel();
    }, 1000);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="row">
      <label>
        <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
        {t('console.allCrew')}
      </label>
      {(['evac', 'return', 'hold'] as const).map((kind) => (
        <button
          key={kind}
          disabled={!target}
          onClick={() => {
            for (const id of all ? crew : target ? [target] : [])
              send({ t: 'mc:alert', playerId: id, kind });
          }}
        >
          {t(`command.${kind}`)}
        </button>
      ))}
      <button
        onPointerDown={start}
        onPointerUp={cancel}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            start();
          }
        }}
        onKeyUp={cancel}
        onBlur={cancel}
      >
        {t(holding ? 'console.confirming' : 'console.liftoff')}
      </button>
      <span className={outside.length ? 'err liftoff-list' : 'ok liftoff-list'}>
        {outside.length
          ? t('console.liftoffOutside', { names: outside.join(', ') })
          : t('console.liftoffAllIn')}
      </span>
    </div>
  );
}
