import { ALL, GameRoom, TICK_DT } from '../src';
import type { ClientMsg, EvaState, RoomState, ServerMsg } from '../src';

export interface Harness {
  room: GameRoom;
  sent: Array<{ target: string; msg: ServerMsg }>;
  lastSnap(): EvaState | null;
  lastState(): RoomState;
  ticks(n: number): void;
  seconds(s: number): void;
  send(playerId: string, msg: ClientMsg): void;
}

export function makeRoom(seed = 1234): Harness {
  const sent: Harness['sent'] = [];
  let n = 0;
  const room = new GameRoom({
    code: 'TEST',
    seed,
    emit: (target, msg) => sent.push({ target, msg }),
    makeId: () => `id${++n}`,
    allowDebug: true,
  });
  const h: Harness = {
    room,
    sent,
    lastSnap: () => {
      for (let i = sent.length - 1; i >= 0; i--) {
        const m = sent[i]!.msg;
        if (m.t === 'snap') return m.snap;
      }
      return null;
    },
    lastState: () => room.state,
    ticks: (k) => {
      for (let i = 0; i < k; i++) room.tick(TICK_DT);
    },
    seconds: (s) => h.ticks(Math.round(s / TICK_DT)),
    send: (playerId, msg) => room.handle(playerId, msg),
  };
  return h;
}

/** Room with one MC and `eva` astronauts, already launched with the balanced preset. */
export function launched(eva = 2, seed = 1234): { h: Harness; mc: string; crew: string[] } {
  const h = makeRoom(seed);
  const ids: string[] = [];
  for (let i = 0; i < eva + 1; i++) {
    const r = h.room.join({ name: `P${i}` });
    if (!r.ok) throw new Error('join failed');
    ids.push(r.playerId);
  }
  const mc = ids[0]!;
  const crew = ids.slice(1);
  h.send(mc, { t: 'lobby:role', role: 'mc' });
  for (const id of crew) h.send(id, { t: 'lobby:role', role: 'eva' });
  h.send(mc, { t: 'lobby:start', quick: true });
  return { h, mc, crew };
}

export { ALL };
