import { useEffect, useState } from 'react';
import { ConsoleScreen } from './screens/ConsoleScreen';
import { DesignScreen } from './screens/DesignScreen';
import { EvaScreen } from './screens/EvaScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { ReportScreen } from './screens/ReportScreen';
import { me, useApp } from './state/store';
import { AI_ART_NOTICE_TEXT, SHOW_AI_ART_NOTICE } from './ui/aiNotice';

export function App() {
  const phase = useApp((s) => s.room?.phase ?? 'lobby');
  const role = useApp((s) => me(s)?.role ?? null);
  const conn = useApp((s) => s.conn);
  const [soloConsole, setSoloConsole] = useState(false);

  // Solo players switch between helmet view and wrist console with TAB.
  useEffect(() => {
    if (role !== 'solo') return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Tab') {
        e.preventDefault();
        setSoloConsole((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [role]);

  let screen = <LobbyScreen />;
  if (phase === 'design') screen = <DesignScreen />;
  else if (phase === 'report') screen = <ReportScreen />;
  else if (phase === 'eva') {
    const showConsole = role === 'mc' || (role === 'solo' && soloConsole);
    screen = showConsole ? <ConsoleScreen /> : <EvaScreen />;
  }
  return (
    <>
      {conn === 'reconnecting' && <div className="banner">RECONNECTING…</div>}
      {screen}
      {SHOW_AI_ART_NOTICE && <div className="ai-note">{AI_ART_NOTICE_TEXT}</div>}
    </>
  );
}
