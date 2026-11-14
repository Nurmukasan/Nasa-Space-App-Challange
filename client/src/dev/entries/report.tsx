import { useEffect } from 'react';
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
    const report = {
      score: {
        science: 312,
        safety: 205,
        efficiency: 141,
        teamwork: 96,
        total: 754,
        grade: 'A',
        success: true,
      },
      stats: {},
      insights: [
        { code: 'xl_tanks_good', tone: 'good', params: { count: 2 } },
        { code: 'net_good', tone: 'good', params: { count: 3 } },
        { code: 'breach', tone: 'bad', params: { count: 1 } },
        { code: 'ran_too_much', tone: 'neutral', params: { pct: 38 } },
        { code: 'all_aboard', tone: 'good', params: { count: 3 } },
        { code: 'twin_insight', tone: 'neutral' },
      ],
      design: room.design,
      seed: 42,
    } as unknown as MissionReport;
    store.setState({ room: { ...room, phase: 'report', report } });
  }, []);
  return <ReportScreen />;
}
export default { name: 'report', render: () => <Demo /> };
