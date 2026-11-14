import { GameRoom, TICK_DT } from '@rs/shared';
import type { EvaState, MissionParams, RoomState } from '@rs/shared';
export type FieldState =
  | 'active'
  | 'low'
  | 'danger'
  | 'storm'
  | 'down'
  | 'inside'
  | 'lost'
  | 'countdown'
  | 'no_signal'
  | 'breach';
export const FIELD_STATES: FieldState[] = [
  'active',
  'low',
  'danger',
  'storm',
  'down',
  'inside',
  'lost',
  'countdown',
  'no_signal',
  'breach',
];
export function fieldFixture(state: FieldState = 'active'): {
  snap: EvaState;
  params: MissionParams;
  playerId: string;
  room: RoomState;
} {
  let n = 0;
  const room = new GameRoom({
    code: 'DEV',
    seed: 1234,
    emit: () => undefined,
    makeId: () => `fixture${++n}`,
  });
  const player = room.join({ name: 'TULPAR' });
  if (!player.ok) throw Error('fixture join');
  room.handle(player.playerId, { t: 'lobby:role', role: 'solo' });
  room.handle(player.playerId, { t: 'lobby:start', quick: true });
  for (let i = 0; i < 15 * 35; i++) room.tick(TICK_DT);
  const snap = structuredClone(room.simulation!.pub),
    params = room.state.params!;
  const a = snap.astronauts[0]!;
  a.waypoint = { x: 1100, y: 900 };
  snap.log = [{ id: 1, t: snap.t, from: 'mc', key: 'alert.return' }];
  if (state === 'low') a.o2 = a.o2Max * 0.15;
  if (state === 'danger') a.dangerUntil = snap.t + 9;
  if (state === 'storm') snap.weather.storm = { tStart: snap.t + 12, tEnd: snap.t + 102 };
  if (state === 'down') {
    a.status = 'down';
    a.downUntil = snap.t + 14;
  }
  if (state === 'inside') a.status = 'inside';
  if (state === 'lost') a.status = 'lost';
  if (state === 'countdown') snap.t = -4;
  if (state === 'no_signal') a.linked = false;
  if (state === 'breach') a.leak = true;
  return { snap, params, playerId: player.playerId, room: structuredClone(room.state) };
}
