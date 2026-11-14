import { useEffect, useRef } from 'react';
import { createGame } from '../game/createGame';
import { HelmetHud } from './eva/HelmetHud';
import '../ui/hud.css';
import { useApp } from '../state/store';
import { me } from '../state/store';
import { WristMap } from './eva/WristMap';
import { SoloSeismic } from './eva/SoloSeismic';
import '../ui/solo.css';

export function EvaScreen() {
  const host = useRef<HTMLDivElement>(null);
  const hud = useApp((s) => s.hud);
  const myId = useApp((s) => s.playerId);
  const solo = useApp((s) => me(s)?.role === 'solo');

  useEffect(() => {
    if (!host.current) return;
    const game = createGame(host.current);
    return () => game.destroy(true);
  }, []);

  const params = useApp((s) => s.room?.params);
  return (
    <div className="stage">
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      {hud && myId && params && <HelmetHud snap={hud} playerId={myId} params={params} />}
      {solo && hud && myId && (
        <aside className="solo-tools">
          <WristMap playerId={myId} />
          <SoloSeismic snap={hud} playerId={myId} />
        </aside>
      )}
    </div>
  );
}
