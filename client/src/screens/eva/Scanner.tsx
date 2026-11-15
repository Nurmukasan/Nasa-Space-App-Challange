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
  // Nothing to point at: no box at all, the scanner only appears while it has a contact.
  if (!enabled || !astronaut.scan) return null;
  return (
    <aside className="helmet-scanner scanner-found" aria-label={t('eva.scanner')}>
      <small>{t('eva.scanner')}</small>
      <b
        className="scanner-arrow"
        style={{ transform: `rotate(${astronaut.scan.bearing - astronaut.facing}rad)` }}
      >
        ↑
      </b>
      <strong>
        {t('eva.scanner_distance', { n: Math.ceil(astronaut.scan.dist * HUD.metresPerPx) })}
      </strong>
    </aside>
  );
}
