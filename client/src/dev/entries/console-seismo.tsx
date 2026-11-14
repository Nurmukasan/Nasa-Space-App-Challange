import { SIGNALS } from '@rs/shared';
import { useEffect } from 'react';
import { ConsoleScreen } from '../../screens/ConsoleScreen';
import { consoleFixture } from '../fixtures/console';
import { installFixture } from '../fixtures/base';
import { pushSnap, clearSnaps } from '../../state/snapshots';
import { store } from '../../state/store';
function Demo() {
  useEffect(() => {
    const fixture = consoleFixture();
    const s = fixture.snap;
    s.t = 20;
    s.seismic = (['quake', 'impact', 'wind'] as const).map((kind, i) => ({
      id: kind,
      t0: 8,
      deadline: 28,
      guess: null,
      truth: null,
      estimate: null,
      signal: false,
      pick: null,
      signals: Array.from({ length: kind === 'wind' ? 1 : 3 }, (_, stationIdx) => ({
        stationIdx: kind === 'wind' ? 2 : stationIdx,
        delayS: stationIdx * 0.8,
        amp: 0.8,
        distEst: 0,
        bearingEst: null,
        ...SIGNALS[kind],
      })),
    }));
    if (fixture.room.state.params) fixture.room.state.params.hasWeather = true;
    installFixture(fixture);
    const timer = setInterval(() => {
      s.t = s.t >= 32 ? 8 : s.t + 0.2;
      pushSnap(structuredClone(s));
      store.setState({ hud: structuredClone(s) });
    }, 200);
    return () => {
      clearInterval(timer);
      clearSnaps();
    };
  }, []);
  return <ConsoleScreen />;
}
export default { name: 'console-seismo', render: () => <Demo /> };
