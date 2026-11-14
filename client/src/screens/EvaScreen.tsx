import { useEffect, useRef } from 'react';
import { createGame } from '../game/createGame';
import { useApp } from '../state/store';

function clock(t: number): string {
  const s = Math.max(0, Math.floor(t));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function EvaScreen() {
  const host = useRef<HTMLDivElement>(null);
  const hud = useApp((s) => s.hud);
  const myId = useApp((s) => s.playerId);

  useEffect(() => {
    if (!host.current) return;
    const game = createGame(host.current);
    return () => game.destroy(true);
  }, []);

  const mine = hud?.astronauts.find((a) => a.id === myId);
  return (
    <div className="stage">
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      {hud && (
        <div className="hud">
          {hud.t < 0 ? `T-${Math.ceil(-hud.t)}` : `${clock(hud.durationS - hud.t)} LEFT`}
          {mine && (
            <div>
              O2 {Math.round((mine.o2 / mine.o2Max) * 100)}% · {mine.status.toUpperCase()}
              {mine.linked ? '' : ' · NO SIGNAL'}
            </div>
          )}
          <div style={{ fontSize: 16 }}>WASD move · SHIFT run · E airlock · SPACE dig</div>
        </div>
      )}
    </div>
  );
}
