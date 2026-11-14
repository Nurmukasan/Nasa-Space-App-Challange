import { GameRoom, LAUNCH_COUNTDOWN_S, TICK_DT } from '@rs/shared';
import { clearSnaps, pushSnap } from '../../state/snapshots';
import { store } from '../../state/store';
/** Actual MC + three EVA simulation, thirty seconds after touchdown. */
export function baseFixture() {
  let nextId = 0;
  const room = new GameRoom({
    code: 'DEMO',
    seed: 42,
    allowDebug: true,
    makeId: () => `demo-${++nextId}`,
    emit: () => undefined,
  });
  for (let index = 0; index < 4; index++) {
    const player = room.join({ name: `Crew ${index + 1}` });
    if (!player.ok) throw new Error('Fixture join failed');
    room.handle(player.playerId, { t: 'lobby:role', role: index === 0 ? 'mc' : 'eva' });
  }
  room.handle(room.state.hostId, { t: 'lobby:start', quick: true });
  const ticks = Math.round((LAUNCH_COUNTDOWN_S + 30) / TICK_DT);
  for (let tick = 0; tick < ticks; tick++) room.tick(TICK_DT);
  if (!room.simulation) throw new Error('Fixture did not launch');
  return { room, snap: structuredClone(room.simulation.pub) };
}
export function installFixture({ room, snap }: ReturnType<typeof baseFixture>): void {
  const copy = structuredClone(snap);
  clearSnaps();
  pushSnap(copy);
  store.setState({
    conn: 'online',
    mode: 'local',
    playerId: room.state.hostId,
    room: structuredClone(room.state),
    hud: copy,
    error: null,
  });
}
