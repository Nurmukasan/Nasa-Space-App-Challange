import { useEffect, useRef, useState } from 'react';
import type { EvaState, PowerAlloc } from '@rs/shared';
import { command as send } from '../actions';
import { t } from '../../i18n';
import { PixelIcon } from '../../ui/PixelIcon';

const systems = ['moxie', 'comms', 'scan'] as const;
const ICONS = { moxie: 'icon_moxie_s', comms: 'icon_antenna_hg', scan: 'icon_gpr' } as const;
export function PowerPanel({ snap }: { snap: EvaState }) {
  const [alloc, setAlloc] = useState(snap.lander.power.alloc);
  useEffect(() => {
    setAlloc(snap.lander.power.alloc);
  }, [snap.lander.power.alloc.moxie, snap.lander.power.alloc.comms, snap.lander.power.alloc.scan]);
  const pending = useRef<PowerAlloc | null>(null);
  useEffect(() => {
    const timer = setInterval(() => {
      if (pending.current) {
        send({ t: 'mc:power', alloc: pending.current });
        pending.current = null;
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);
  return (
    <section className="panel">
      <h2 className="panel-title">
        <PixelIcon name="icon_battery" scale={1} />
        {t('console.power')} · {Math.round(snap.lander.power.availW)} W
      </h2>
      {systems.map((key) => (
        <label key={key} className="power-row">
          <PixelIcon name={ICONS[key]} scale={1} />
          {t(`power.${key}`)} {Math.round(alloc[key] * 100)}% · {t('console.efficiency')}{' '}
          {Math.round(snap.lander.power.eff[key] * 100)}%
          <input
            aria-label={t(`power.${key}`)}
            type="range"
            min={0}
            max={100}
            value={Math.round(alloc[key] * 100)}
            onChange={(e) => {
              const value = Number(e.target.value) / 100;
              const others = systems.filter((s) => s !== key);
              const total = others.reduce((sum, s) => sum + alloc[s], 0);
              const next = { ...alloc, [key]: value };
              for (const s of others)
                next[s] = total ? (alloc[s] / total) * (1 - value) : (1 - value) / 2;
              setAlloc(next);
              pending.current = next;
            }}
          />
        </label>
      ))}
      <div className="store-line">
        <PixelIcon name="icon_o2_reserve" scale={1} />
        {t('console.store')} {Math.round(snap.lander.o2Store)} / {snap.lander.o2StoreMax}
      </div>
    </section>
  );
}
