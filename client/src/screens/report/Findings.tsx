import type { CSSProperties } from 'react';
import { MODULES } from '@rs/shared';
import type { Insight } from '@rs/shared';
import { t } from '../../i18n';
import { REPORT_TIMING } from './constants';
const MARKS = { good: '+', bad: '!', neutral: '·' };
export function Findings({
  insights,
  at,
  isHost,
  redesign,
}: {
  insights: Insight[];
  at: number;
  isHost: boolean;
  redesign: (fix?: Insight['fix']) => void;
}) {
  return (
    <section className="panel findings">
      <h2 className="panel-title">{t('report.findings')}</h2>
      <ol>
        {insights.map((i, n) => {
          const key = `insight.${i.code}`;
          const text = t(key, i.params);
          const fallback = t(`reportUi.insight.${i.code}`, i.params);
          const detail =
            text !== key
              ? text
              : fallback !== `reportUi.insight.${i.code}`
                ? fallback
                : t('reportUi.insight.other');
          const module = i.fix?.module;
          return (
            <li
              key={i.code}
              className={`finding ${i.tone}`}
              style={{ '--delay': `${at + n * REPORT_TIMING.findingStepMs}ms` } as CSSProperties}
            >
              <span className="finding-mark">{MARKS[i.tone]}</span>
              <div>
                <b className="because-label">{t('reportUi.because')}</b>
                <span>{detail}</span>
                {module && Object.prototype.hasOwnProperty.call(MODULES, module) && (
                  <button className="try-chip" disabled={!isHost} onClick={() => redesign(i.fix)}>
                    {t('reportUi.try', { name: t(`module.${module}.name`) })}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
