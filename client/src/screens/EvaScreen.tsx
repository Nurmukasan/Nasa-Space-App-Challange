import { useEffect, useRef } from 'react';
import { createGame } from '../game/createGame';
import { HelmetHud } from './eva/HelmetHud';
import '../ui/hud.css';
import { useApp } from '../state/store';

export function EvaScreen() {
  const host = useRef<HTMLDivElement>(null);
  const hud = useApp((s) => s.hud);
  const myId = useApp((s) => s.playerId);

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
    </div>
  );
}
