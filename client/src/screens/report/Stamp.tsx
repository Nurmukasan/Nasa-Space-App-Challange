import { useEffect } from 'react';
import { audio } from '../../audio';
import { t } from '../../i18n';
import { REPORT_TIMING } from './constants';

/** The big rubber stamp that slams onto the debrief. */
export function Stamp({ success }: { success: boolean }) {
  // The slam keyframes hit at ~70% of the duration, after the 120 ms delay.
  useEffect(() => {
    const id = setTimeout(
      () => audio.sfx(success ? 'stamp_win' : 'stamp_fail'),
      120 + REPORT_TIMING.stampMs * 0.7,
    );
    return () => clearTimeout(id);
  }, [success]);
  return (
    <div
      className={`stamp ${success ? 'good' : 'bad'}`}
      style={{ '--dur': `${REPORT_TIMING.stampMs}ms` } as React.CSSProperties}
    >
      <div className="stamp-ink">
        <small>{t('report.stampTop')}</small>
        <span>{t(success ? 'report.success' : 'report.failed')}</span>
        <small>{t('report.stampBottom')}</small>
      </div>
    </div>
  );
}
