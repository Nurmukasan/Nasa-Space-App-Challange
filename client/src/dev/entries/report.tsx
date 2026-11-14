import { useEffect } from 'react';
import { buildReport } from '@rs/shared';
import type { MissionReport } from '@rs/shared';
import { ReportScreen } from '../../screens/ReportScreen';
import { baseFixture, installFixture } from '../fixtures/base';
import { store } from '../../state/store';

/** A good mission, so the count-up and the grade seal have something to show. */
function Demo() {
  useEffect(() => {
    const fixture = baseFixture();
    installFixture(fixture);
    const room = store.getState().room;
    if (!room) return;
    const report: MissionReport = {
      ...buildReport(fixture.room.simulation!, room.design, room.check),
      score: {
        science: 312,
        safety: 205,
        efficiency: 141,
        teamwork: 96,
        total: 754,
        grade: 'A',
        success: true,
      },
      insights: [
        { code: 'xl_tanks_good', tone: 'good', params: { count: 2 } },
        { code: 'net_good', tone: 'good', params: { count: 3 } },
        {
          code: 'no_drill_deep',
          tone: 'bad',
          params: { seconds: 20, oxygen: 32 },
          fix: { module: 'drill' },
        },
        { code: 'ran_too_much', tone: 'neutral', params: { pct: 38 } },
        { code: 'all_aboard', tone: 'good', params: { count: 3 } },
        { code: 'twin_insight', tone: 'neutral' },
      ],
      design: room.design,
      seed: 42,
      scenario: 'signal',
      objectives: [
        { id: 'samples', kind: 'deliver', target: 3, progress: 3, primary: true, state: 'done' },
      ],
      timeline: [
        { t: 40, type: 'deploy', playerId: room.players[1]!.id },
        { t: 90, type: 'discovery', playerId: room.players[1]!.id },
        { t: 180, type: 'deposit', n: 2 },
        { t: 430, type: 'liftoff' },
      ],
      awards: [{ code: 'explorer', playerId: room.players[1]!.id }],
      reveal: 'reveal.jezero',
    };
    store.setState({ room: { ...room, phase: 'report', report } });
  }, []);
  return <ReportScreen />;
}
export default { name: 'report', render: () => <Demo /> };
