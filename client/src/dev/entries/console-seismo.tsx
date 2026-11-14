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
      signals: Array.from({ length: kind === 'wind' ? 1 : 3 }, (_, stationIdx) => ({
        stationIdx,
        delayS: stationIdx * 0.8,
        amp: 0.8,
        riseS: [3.5, 0.25, 1.5][i]!,
        decayS: [14, 2.5, 4][i]!,
        freqHz: [1.2, 4, 2.2][i]!,
        noise: kind === 'wind' ? 0.35 : 0.08,
        pressureDip: kind === 'wind' ? 0.8 : 0,
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
