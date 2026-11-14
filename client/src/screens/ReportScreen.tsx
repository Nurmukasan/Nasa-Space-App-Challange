import { send } from '../net/session';
import { me, useApp } from '../state/store';

export function ReportScreen() {
  const report = useApp((s) => s.room?.report ?? null);
  const self = useApp(me);
  if (!report || !self) return null;
  const s = report.score;
  return (
    <div className="screen">
      <h1 className={s.success ? 'ok' : 'err'}>
        {s.success ? 'MISSION SUCCESS' : 'MISSION FAILED'}
      </h1>
      <div className="panel">
        <div>GRADE {s.grade}</div>
        <div>TOTAL {s.total}</div>
        <div className="dim">
          SCIENCE {s.science} · SAFETY {s.safety} · EFFICIENCY {s.efficiency} · TEAMWORK{' '}
          {s.teamwork}
        </div>
      </div>
      {self.isHost && (
        <div className="row">
          <button onClick={() => send({ t: 'report:again', redesign: true })}>REDESIGN</button>
          <button onClick={() => send({ t: 'report:again', redesign: false })}>FLY AGAIN</button>
        </div>
      )}
    </div>
  );
}
