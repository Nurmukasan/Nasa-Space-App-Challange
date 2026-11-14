import { t } from '../../i18n';
import { REPORT_TIMING } from './constants';

/** The big rubber stamp that slams onto the debrief. */
export function Stamp({ success }: { success: boolean }) {
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
