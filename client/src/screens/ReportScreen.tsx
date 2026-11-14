import type { CSSProperties } from 'react';
import '../ui/menu.css';
import '../ui/report.css';
import { send } from '../net/session';
import { me, useApp } from '../state/store';
import { t } from '../i18n';
import { GradeSeal } from './report/GradeSeal';
import { ScoreRow } from './report/ScoreRow';
import { Stamp } from './report/Stamp';
import { REPORT_TIMING, SCORE_ROWS } from './report/constants';

const MARKS = { good: '+', bad: '!', neutral: '·' } as const;

export function ReportScreen() {
  const report = useApp((s) => s.room?.report ?? null),
    self = useApp(me);
  if (!report || !self) return null;
  const { score, design } = report;
  const findings = report.insights.filter((i) => !i.code.startsWith('twin_'));
  const twins = report.insights.filter((i) => i.code.startsWith('twin_'));
  const findingsAt =
    REPORT_TIMING.rowsStartMs +
    SCORE_ROWS.length * REPORT_TIMING.rowStepMs +
    REPORT_TIMING.totalGapMs +
    REPORT_TIMING.barMs +
    REPORT_TIMING.sealGapMs +
    REPORT_TIMING.findingsGapMs;
  return (
    <main className="screen report-screen">
      <div className="report-body">
        <div className="report-kicker">{t('report.debrief')}</div>
        <div className="report-where">
          {t(`site.${design.site}.name`)} · {t(`objective.${design.objective}.name`)}
        </div>
        <Stamp success={score.success} />
        <div className="report-grid">
          <section className="panel scoreboard">
            <h2 className="panel-title">{t('report.scores')}</h2>
            {SCORE_ROWS.map((row, i) => (
              <ScoreRow
                key={row.key}
                label={t(`report.${row.key}`)}
                value={score[row.key]}
                max={row.max}
                index={i}
              />
            ))}
            <GradeSeal grade={score.grade} total={score.total} />
          </section>
          <section className="panel findings">
            <h2 className="panel-title">{t('report.findings')}</h2>
            <ol>
              {findings.map((i, n) => (
                <li
                  key={i.code}
                  className={`finding ${i.tone}`}
                  style={
                    {
                      '--delay': `${findingsAt + n * REPORT_TIMING.findingStepMs}ms`,
                    } as CSSProperties
                  }
                >
                  <span className="finding-mark">{MARKS[i.tone]}</span>
                  <span>{t(`insight.${i.code}`, i.params)}</span>
                </li>
              ))}
            </ol>
            {twins.map((i) => (
              <aside
                className="twin"
                key={i.code}
                style={
                  {
                    '--delay': `${findingsAt + findings.length * REPORT_TIMING.findingStepMs}ms`,
                  } as CSSProperties
                }
              >
                <h3>{t('report.twin')}</h3>
                <p>{t(`insight.${i.code}`, i.params)}</p>
              </aside>
            ))}
          </section>
        </div>
        {self.isHost && (
          <div className="row report-actions">
            <button
              className="btn-main"
              onClick={() => send({ t: 'report:again', redesign: true })}
            >
              {t('report.redesign')}
            </button>
            <button
              className="btn-main"
              onClick={() => send({ t: 'report:again', redesign: false })}
            >
              {t('report.again')}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
