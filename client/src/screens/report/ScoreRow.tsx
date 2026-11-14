import type { CSSProperties } from 'react';
import { t } from '../../i18n';
import { CountUp } from './CountUp';
import { REPORT_TIMING } from './constants';

interface Props {
  label: string;
  value: number;
  max: number;
  index: number;
}

/** One score line: name, bar filling up, number counting up, and the maximum. */
export function ScoreRow({ label, value, max, index }: Props) {
  const delay = REPORT_TIMING.rowsStartMs + index * REPORT_TIMING.rowStepMs;
  const style = {
    '--fill': `${Math.min(100, (value / max) * 100)}%`,
    '--delay': `${delay}ms`,
    '--dur': `${REPORT_TIMING.barMs}ms`,
  } as CSSProperties;
  return (
    <div className="score-row" style={style}>
      <span className="score-name">{label}</span>
      <div className="score-bar" />
      <span className="score-num">
        <CountUp value={value} delayMs={delay} durationMs={REPORT_TIMING.barMs} />
        <small>
          {t('report.of')} {max}
        </small>
      </span>
    </div>
  );
}
