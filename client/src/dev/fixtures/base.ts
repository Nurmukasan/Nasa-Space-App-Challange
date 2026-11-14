import { GameRoom, TICK_DT } from '@rs/shared';
import type { EvaState } from '@rs/shared';
import { pushSnap, clearSnaps } from '../../state/snapshots';
import { store } from '../../state/store';
export function baseFixture() {
  let snap: EvaState | null = null;
  const room = new GameRoom({
    code: 'DEMO',
    seed: 42,
    allowDebug: true,
    emit: (_target, msg) => {
      if (msg.t === 'snap') snap = structuredClone(msg.snap);
    },
  });
  for (let i = 0; i < 4; i++) {
    const player = room.join({ name: `Crew ${i + 1}` });
    if (!player.ok) throw new Error('Fixture join failed');
    room.handle(player.playerId, { t: 'lobby:role', role: i === 0 ? 'mc' : 'eva' });
  }
  room.handle(room.state.hostId, { t: 'lobby:start', quick: true });
  for (let i = 0; i < 35 / TICK_DT; i++) room.tick(TICK_DT);
  if (!snap) throw new Error('Fixture did not launch');
  return { room, snap: snap as EvaState };
}
export function installFixture(fixture: ReturnType<typeof baseFixture>): void {
  clearSnaps();
  pushSnap(fixture.snap);
  store.setState({
    conn: 'online',
    mode: 'local',
    playerId: fixture.room.state.hostId,
    room: structuredClone(fixture.room.state),
    hud: fixture.snap,
    error: null,
  });
}
