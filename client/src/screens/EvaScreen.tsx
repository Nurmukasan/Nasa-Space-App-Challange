import { useEffect, useRef } from 'react';
import type Phaser from 'phaser';
import { createGame } from '../game/createGame';
import { HelmetHud } from './eva/HelmetHud';
import { useApp } from '../state/store';
import { send } from '../net/session';
import { me } from '../state/store';
import { SoloSeismic } from './eva/SoloSeismic';
import '../ui/solo.css';

export function EvaScreen({ active = true }: { active?: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const hud = useApp((s) => s.hud);
  const myId = useApp((s) => s.playerId);
  const gameRef = useRef<Phaser.Game | null>(null);
  const solo = useApp((s) => me(s)?.role === 'solo');

  useEffect(() => {
    if (!host.current) return;
    const game = createGame(host.current);
    gameRef.current = game;
    return () => game.destroy(true);
  }, []);

  useEffect(() => {
    const kb = gameRef.current?.input.keyboard;
    if (!kb) return;
    kb.enabled = active;
    if (!active) {
      gameRef.current?.scene.scenes[0]?.input.keyboard?.resetKeys();
      send({ t: 'eva:dig', on: false });
    }
  }, [active]);

  const down = useApp((s) => s.hud?.astronauts.find((a) => a.id === s.playerId)?.status === 'down');
  const params = useApp((s) => s.room?.params);
  // Inside the lander the helmet is off: the interior scene draws its own small header.
  const inside = useApp(
    (s) => s.hud?.astronauts.find((a) => a.id === s.playerId)?.status === 'inside',
  );
  return (
    <div className={`stage ${down ? 'is-down' : ''}`}>
      <div ref={host} style={{ width: '100%', height: '100%' }} />
      {hud && myId && params && !inside && <HelmetHud snap={hud} playerId={myId} params={params} />}
      {solo && hud && myId && !inside && (
        <aside className="solo-tools">
          <SoloSeismic snap={hud} playerId={myId} />
        </aside>
      )}
    </div>
  );
}
