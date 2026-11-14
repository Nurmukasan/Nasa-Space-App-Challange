import type { AddressInfo } from 'node:net';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { EV_JOIN, EV_MSG } from '@rs/shared';
import type { ClientMsg, EvaState, JoinResult, RoomState, ServerMsg } from '@rs/shared';
import { createGameServer } from '../src/app';
import type { GameServer } from '../src/app';

let server: GameServer;
let url = '';

beforeAll(async () => {
  server = createGameServer({ allowDebug: true });
  await new Promise<void>((resolve) => server.http.listen(0, resolve));
  url = `http://localhost:${(server.http.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await server.close();
});

interface TestClient {
  socket: Socket;
  state: RoomState | null;
  snap: EvaState | null;
  join(name: string, code?: string): Promise<JoinResult>;
  send(msg: ClientMsg): void;
}

function client(): TestClient {
  const socket = connect(url, { transports: ['websocket'], forceNew: true });
  const c: TestClient = {
    socket,
    state: null,
    snap: null,
    join: (name, code) => new Promise((resolve) => socket.emit(EV_JOIN, { name, code }, resolve)),
    send: (msg) => socket.emit(EV_MSG, msg),
  };
  socket.on(EV_MSG, (m: ServerMsg) => {
    if (m.t === 'state') c.state = m.state;
    if (m.t === 'snap') c.snap = m.snap;
  });
  return c;
}

async function until(cond: () => boolean, ms = 4000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timeout waiting for condition');
    await new Promise((r) => setTimeout(r, 20));
  }
}

describe('socket server', () => {
  it('two clients create/join a room, start, and receive snapshots', async () => {
    const a = client();
    const b = client();
    const ja = await a.join('Alice');
    if (!ja.ok) throw new Error('join a');
    const jb = await b.join('Bob', ja.code.toLowerCase());
    if (!jb.ok) throw new Error('join b');
    await until(() => a.state?.players.length === 2 && b.state?.players.length === 2);

    a.send({ t: 'lobby:role', role: 'mc' });
    b.send({ t: 'lobby:role', role: 'eva' });
    b.send({ t: 'lobby:class', crewClass: 'scout' });
    await until(
      () =>
        b.state?.players.every((p) => p.role !== null && (p.role === 'mc' || p.classChosen)) ===
        true,
    );
    a.send({ t: 'lobby:start', quick: true });
    await until(() => a.state?.phase === 'eva' && a.snap !== null && b.snap !== null);
    await until(() => (b.snap?.t ?? -1) >= 0, 8000);

    const me = b.snap!.astronauts[0]!;
    b.send({ t: 'eva:move', x: me.x + 2, y: me.y, facing: 0, moving: true, running: false });
    await until(() => (a.snap?.astronauts[0]?.x ?? 0) > me.x);

    a.socket.close();
    b.socket.close();
  });

  it('reports unknown rooms', async () => {
    const c = client();
    expect(await c.join('X', 'ZZZZ')).toEqual({ ok: false, error: 'room_not_found' });
    c.socket.close();
  });
});

describe('connection resilience', () => {
  it('resumes the same EVA slot using its token and receives fresh snapshots', async () => {
    const first = client();
    let resumed: TestClient | null = null;
    try {
      const joined = await first.join('Pilot');
      if (!joined.ok) throw new Error('join');
      first.send({ t: 'lobby:role', role: 'solo' });
      first.send({ t: 'lobby:class', crewClass: 'engineer' });
      first.send({ t: 'lobby:start', quick: true });
      await until(() => first.snap !== null);
      const tick = first.snap!.tick;
      first.socket.close();
      await until(() => server.rooms.get(joined.code)?.room.state.players[0]?.connected === false);
      resumed = client();
      const result = await new Promise<JoinResult>((resolve) =>
        resumed!.socket.emit(
          EV_JOIN,
          { name: 'Pilot', code: joined.code, token: joined.token },
          resolve,
        ),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('resume');
      expect(result.playerId).toBe(joined.playerId);
      expect(result.state.players).toHaveLength(1);
      expect(result.state.players[0]?.connected).toBe(true);
      await until(() => (resumed?.snap?.tick ?? 0) > tick);
    } finally {
      first.socket.close();
      resumed?.socket.close();
    }
  });
  it('drops messages above 60 per second and accepts messages in the next window', async () => {
    const c = client();
    try {
      const joined = await c.join('Flood');
      if (!joined.ok) throw new Error('join');
      const room = server.rooms.get(joined.code)!.room;
      const handle = vi.spyOn(room, 'handle');
      await new Promise((resolve) => setTimeout(resolve, 650));
      for (let i = 0; i < 80; i++) c.send({ t: 'lobby:ready', ready: true });
      await new Promise<JoinResult>((resolve) =>
        c.socket.emit(EV_JOIN, { name: 'Barrier' }, resolve),
      );
      expect(handle).toHaveBeenCalledTimes(60);
      await new Promise((resolve) => setTimeout(resolve, 450));
      c.send({ t: 'lobby:ready', ready: false });
      await new Promise<JoinResult>((resolve) =>
        c.socket.emit(EV_JOIN, { name: 'Barrier' }, resolve),
      );
      expect(handle).toHaveBeenCalledTimes(60);
      await new Promise((resolve) => setTimeout(resolve, 600));
      c.send({ t: 'lobby:ready', ready: false });
      await until(() => handle.mock.calls.length === 61);
      handle.mockRestore();
    } finally {
      c.socket.close();
    }
  });
});
