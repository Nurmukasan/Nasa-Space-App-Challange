import { t } from '../../i18n';
import { REPORT_TIMING } from './constants';

/** The big rubber stamp that slams onto the debrief. */
export function Stamp({ success }: { success: boolean }) {
  return (
    <div
      className={`stamp ${success ? 'good' : 'bad'}`}
      style={{ '--dur': `${REPORT_TIMING.stampMs}ms` } as React.CSSProperties}
    >
      <span>{t(success ? 'report.success' : 'report.failed')}</span>
    </div>
  );
}
