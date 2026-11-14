import { useEffect } from 'react';
import { ConsoleScreen } from '../../screens/ConsoleScreen';
import { installFixture } from '../fixtures/base';
import { consoleFixture } from '../fixtures/console';
import { pushSnap, clearSnaps } from '../../state/snapshots';
import { store } from '../../state/store';
function Demo() {
  useEffect(() => {
    const fixture = consoleFixture();
    installFixture(fixture);
    const timer = setInterval(() => {
      const s = structuredClone(fixture.snap);
      s.t += 1;
      fixture.snap = s;
      if (s.astronauts[1]) s.astronauts[1].linked = false;
      pushSnap(s);
      store.setState({ hud: s });
    }, 1000);
    return () => {
      clearInterval(timer);
      clearSnaps();
    };
  }, []);
  return <ConsoleScreen />;
}
export default { name: 'console', render: () => <Demo /> };
