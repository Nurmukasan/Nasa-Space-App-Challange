import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Insight } from '@rs/shared';
import '../ui/menu.css';
import '../ui/report.css';
import '../ui/reportV2.css';
import { send } from '../net/session';
import { me, useApp } from '../state/store';
import { designHint } from '../state/designHint';
import { t } from '../i18n';
import { GradeSeal } from './report/GradeSeal';
import { InkFilter } from './report/InkFilter';
import { ScoreRow } from './report/ScoreRow';
import { Takeoff, TAKEOFF_MS } from './report/Takeoff';
import { Stamp } from './report/Stamp';
import { Objectives } from './report/Objectives';
import { Timeline } from './report/Timeline';
import { Awards } from './report/Awards';
import { Findings } from './report/Findings';
import { Reveal } from './report/Reveal';
import { REPORT_TIMING, SCORE_ROWS } from './report/constants';

export function ReportScreen({ skipTakeoff = false }: { skipTakeoff?: boolean }) {
  const report = useApp((s) => s.room?.report ?? null),
    self = useApp(me);
  const [ready, setReady] = useState(skipTakeoff);
  useEffect(() => {
    if (skipTakeoff) {
      setReady(true);
      return;
    }
    const timer = setTimeout(() => setReady(true), TAKEOFF_MS);
    return () => clearTimeout(timer);
  }, [skipTakeoff]);
  const players = useApp((s) => s.room?.players ?? []);
  if (!report || !self) return null;
  if (!ready) return <Takeoff />;
  const { score, design } = report;
  const findings = report.insights.filter((i) => !i.code.startsWith('twin_'));
  const twins = report.insights.filter((i) => i.code.startsWith('twin_'));
  const detailsAt =
    REPORT_TIMING.rowsStartMs +
    SCORE_ROWS.length * REPORT_TIMING.rowStepMs +
    REPORT_TIMING.totalGapMs +
    REPORT_TIMING.barMs +
    REPORT_TIMING.sealGapMs +
    REPORT_TIMING.findingsGapMs;
  const redesign = (preferred?: Insight['fix']) => {
    if (!self.isHost) return;
    const fix =
      preferred ??
      findings.find((i) => i.tone === 'bad' && i.fix)?.fix ??
      findings.find((i) => i.fix)?.fix;
    designHint.setState({ fix: fix ?? null });
    send({ t: 'report:again', redesign: true });
  };
  return (
    <main className="screen report-screen">
      <InkFilter />
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
          <Objectives objectives={report.objectives ?? []} />
        </div>
        <div className="report-details" style={{ '--delay': `${detailsAt}ms` } as CSSProperties}>
          <Timeline entries={report.timeline ?? []} players={players} />
          <Awards awards={report.awards ?? []} players={players} />
          <Findings insights={findings} at={0} isHost={self.isHost} redesign={redesign} />
          <Reveal reveal={report.reveal} />
          {twins.length > 0 && (
            <section className="panel report-v2-twins">
              <h2 className="panel-title">{t('report.twin')}</h2>
              {twins.map((i) => (
                <p key={i.code}>{t(`insight.${i.code}`, i.params)}</p>
              ))}
            </section>
          )}
        </div>
        {self.isHost && (
          <div className="row report-actions">
            <button className="btn-main" onClick={() => redesign()}>
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
