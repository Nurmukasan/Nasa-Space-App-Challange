import { useEffect, useRef, useState } from 'react';
import { send } from '../../net/session';
import { t } from '../../i18n';
export function Commands({ target }: { target: string | null }) {
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
      {(['evac', 'return', 'hold'] as const).map((kind) => (
        <button
          key={kind}
          disabled={!target}
          onClick={() => {
            if (target) send({ t: 'mc:alert', playerId: target, kind });
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
    </div>
  );
}
