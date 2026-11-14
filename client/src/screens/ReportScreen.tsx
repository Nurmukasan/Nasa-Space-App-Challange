import { send } from '../net/session';
import { me, useApp } from '../state/store';
import { t } from '../i18n';
export function ReportScreen() {
  const report = useApp((s) => s.room?.report ?? null),
    self = useApp(me);
  if (!report || !self) return null;
  const score = report.score;
  return (
    <main className="screen">
      <h1 className={score.success ? 'ok' : 'err'}>
        {t(score.success ? 'report.success' : 'report.failed')}
      </h1>
      <section className="panel">
        <h2>
          {t('report.grade')} {score.grade}
        </h2>
        <p>
          {t('report.total')} {score.total}
        </p>
        {(['science', 'safety', 'efficiency', 'teamwork'] as const).map((key) => (
          <div key={key}>
            {t(`report.${key}`)} <b>{score[key]}</b>
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>{t('report.findings')}</h2>
        <ol>
          {report.insights
            .filter((i) => !i.code.startsWith('twin_'))
            .map((i) => (
              <li
                key={i.code}
                className={i.tone === 'bad' ? 'warn' : i.tone === 'good' ? 'ok' : ''}
              >
                {t(`insight.${i.code}`, i.params)}
              </li>
            ))}
        </ol>
      </section>
      {report.insights
        .filter((i) => i.code.startsWith('twin_'))
        .map((i) => (
          <aside className="panel" key={i.code}>
            <h2>{t('report.twin')}</h2>
            <p>{t(`insight.${i.code}`, i.params)}</p>
          </aside>
        ))}
      {self.isHost && (
        <div className="row">
          <button onClick={() => send({ t: 'report:again', redesign: true })}>
            {t('report.redesign')}
          </button>
          <button onClick={() => send({ t: 'report:again', redesign: false })}>
            {t('report.again')}
          </button>
        </div>
      )}
    </main>
  );
}
