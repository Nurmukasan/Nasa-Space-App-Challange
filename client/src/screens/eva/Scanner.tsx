import { useEffect, useRef } from 'react';
import type { Astronaut } from '@rs/shared';
import { audio } from '../../audio';
import { t } from '../../i18n';
import { HUD } from './style';

export function Scanner({ astronaut }: { astronaut: Astronaut }) {
  const latest = useRef(astronaut.scan);
  latest.current = astronaut.scan;
  const enabled = astronaut.status === 'active' && !!astronaut.scan;
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    const ping = () => {
      const scan = latest.current;
      if (!scan) return;
      audio.sfx('scanner_ping', { volume: 0.35 });
      const fraction = Math.min(1, scan.dist / HUD.scannerFarPx);
      timer = setTimeout(
        ping,
        HUD.scannerNearMs + fraction * (HUD.scannerFarMs - HUD.scannerNearMs),
      );
    };
    ping();
    return () => clearTimeout(timer);
  }, [enabled]);
  return (
    <aside
      className={`helmet-scanner ${enabled ? 'scanner-found' : ''}`}
      aria-label={t('eva.scanner')}
    >
      <small>{t('eva.scanner')}</small>
      {enabled && astronaut.scan ? (
        <>
          <b
            className="scanner-arrow"
            style={{ transform: `rotate(${astronaut.scan.bearing - astronaut.facing}rad)` }}
          >
            ↑
          </b>
          <strong>
            {t('eva.scanner_distance', { n: Math.ceil(astronaut.scan.dist * HUD.metresPerPx) })}
          </strong>
        </>
      ) : (
        <span>{t('eva.scanner_clear')}</span>
      )}
    </aside>
  );
}
