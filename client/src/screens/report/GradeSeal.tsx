import type { CSSProperties } from 'react';
import type { Grade } from '@rs/shared';
import { t } from '../../i18n';
import { CountUp } from './CountUp';
import { GRADE_COLORS, REPORT_TIMING, SCORE_ROWS, SCORE_TOTAL_MAX } from './constants';

interface Props {
  grade: Grade;
  total: number;
}

/** Total counts up first, then the grade letter pops in last. */
export function GradeSeal({ grade, total }: Props) {
  const totalAt =
    REPORT_TIMING.rowsStartMs +
    SCORE_ROWS.length * REPORT_TIMING.rowStepMs +
    REPORT_TIMING.totalGapMs;
  const sealAt = totalAt + REPORT_TIMING.barMs + REPORT_TIMING.sealGapMs;
  return (
    <div className="seal-wrap">
      <div className="total-line">
        <span>{t('report.total')}</span>
        <b>
          <CountUp value={total} delayMs={totalAt} durationMs={REPORT_TIMING.barMs} />
        </b>
        <small>
          {t('report.of')} {SCORE_TOTAL_MAX}
        </small>
      </div>
      <div
        className="seal"
        style={{ '--grade': GRADE_COLORS[grade], '--delay': `${sealAt}ms` } as CSSProperties}
        aria-label={`${t('report.grade')} ${grade}`}
      >
        <div className="seal-ink">
          <small>{t('report.grade')}</small>
          <b>{grade}</b>
        </div>
      </div>
    </div>
  );
}
