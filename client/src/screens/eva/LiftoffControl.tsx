import { useState } from 'react';
import { t } from '../../i18n';
import { send } from '../../net/session';
import { useApp } from '../../state/store';

/** Solo liftoff lives in the Esc menu: it asks twice, and nothing sits on the HUD all mission. */
export function LiftoffControl() {
  const hud = useApp((s) => s.hud);
  const [armed, setArmed] = useState(false);
  if (!hud) return null;
  const outside = hud.astronauts.filter((a) => a.status === 'active' || a.status === 'down').length;
  return (
    <div className="setting-launch">
      {armed && <small>{t('eva.launch_outside', { n: outside })}</small>}
      <button
        disabled={hud.t < 0}
        onClick={() => {
          if (armed) send({ t: 'mc:liftoff' });
          else setArmed(true);
        }}
      >
        {t(armed ? 'eva.confirm_launch' : 'eva.liftoff')}
      </button>
      {armed && <button onClick={() => setArmed(false)}>{t('eva.cancel_launch')}</button>}
    </div>
  );
}
