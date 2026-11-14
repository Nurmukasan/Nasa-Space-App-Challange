// HTTP + Socket.IO wrapper around GameRoom. All game logic lives in @rs/shared.
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { ALL, EV_JOIN, EV_MSG, GameRoom, TICK_DT, TICK_HZ } from '@rs/shared';
import type { JoinRequest, JoinResult, ServerMsg } from '@rs/shared';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const MAX_ROOMS = 200;
const MAX_MESSAGES_PER_SECOND = 60;
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000;

interface RoomEntry {
  room: GameRoom;
  /** playerId -> socket id */
  sockets: Map<string, string>;
  emptySince: number | null;
}

export interface GameServer {
  http: HttpServer;
  io: Server;
  rooms: Map<string, RoomEntry>;
  close(): Promise<void>;
}

export function createGameServer(opts: { allowDebug?: boolean } = {}): GameServer {
  const app = express();
  const http = createServer(app);
  const io = new Server(http, { serveClient: false });
  const rooms = new Map<string, RoomEntry>();

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, rooms: rooms.size });
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, '../../client/dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: '1h', index: false }));
    app.use((_req, res) => {
      res.sendFile(path.join(dist, 'index.html'));
    });
  }

  function newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  function createRoom(): RoomEntry {
    const code = newCode();
    const sockets = new Map<string, string>();
    const emit = (target: string, msg: ServerMsg): void => {
      if (target === ALL) io.to(code).emit(EV_MSG, msg);
      else {
        const sid = sockets.get(target);
        if (sid) io.to(sid).emit(EV_MSG, msg);
      }
    };
    const room = new GameRoom({
      code,
      seed: Math.floor(Math.random() * 0xffffffff),
      emit,
      allowDebug: opts.allowDebug,
    });
    const entry: RoomEntry = { room, sockets, emptySince: null };
    rooms.set(code, entry);
    return entry;
  }

  io.on('connection', (socket) => {
    socket.on('latency', (ack: unknown) => {
      if (typeof ack === 'function') ack();
    });
    let bound: { code: string; playerId: string } | null = null;

    socket.on(EV_JOIN, (req: unknown, ack: unknown) => {
      const reply = (r: JoinResult): void => {
        if (typeof ack === 'function') (ack as (r: JoinResult) => void)(r);
      };
      if (bound || typeof req !== 'object' || req === null)
        return reply({ ok: false, error: 'bad_request' });
      const r = req as Partial<JoinRequest>;
      const name = typeof r.name === 'string' ? r.name : '';
      const code = typeof r.code === 'string' ? r.code.trim().toUpperCase() : '';
      let entry: RoomEntry | undefined;
      if (code) {
        entry = rooms.get(code);
        if (!entry) return reply({ ok: false, error: 'room_not_found' });
      } else {
        if (rooms.size >= MAX_ROOMS) return reply({ ok: false, error: 'server_full' });
        entry = createRoom();
      }
      // Join the socket room first so this client also receives the broadcast.
      void socket.join(entry.room.code);
      const result = entry.room.join({
        name,
        token: typeof r.token === 'string' ? r.token : undefined,
      });
      if (!result.ok) {
        void socket.leave(entry.room.code);
        if (entry.room.playerCount === 0) rooms.delete(entry.room.code);
        return reply(result);
      }
      entry.sockets.set(result.playerId, socket.id);
      entry.emptySince = null;
      bound = { code: entry.room.code, playerId: result.playerId };
      reply(result);
    });

    let windowStart = performance.now();
    let messageCount = 0;
    socket.on(EV_MSG, (msg: unknown) => {
      const now = performance.now();
      if (now - windowStart >= 1000) {
        windowStart = now;
        messageCount = 0;
      }
      if (++messageCount > MAX_MESSAGES_PER_SECOND || !bound) return;
      rooms.get(bound.code)?.room.handle(bound.playerId, msg);
    });

    socket.on('disconnect', () => {
      if (!bound) return;
      const entry = rooms.get(bound.code);
      if (!entry) return;
      if (entry.sockets.get(bound.playerId) === socket.id) {
        entry.sockets.delete(bound.playerId);
        entry.room.disconnect(bound.playerId);
      }
      if (entry.room.connectedCount === 0) entry.emptySince = Date.now();
    });
  });

  // One fixed-step loop for all rooms. Accumulator keeps 15 Hz despite timer jitter.
  let last = performance.now();
  let acc = 0;
  const timer = setInterval(
    () => {
      const now = performance.now();
      acc += (now - last) / 1000;
      last = now;
      if (acc > TICK_DT * 5) acc = TICK_DT * 5;
      while (acc >= TICK_DT) {
        for (const entry of rooms.values()) entry.room.tick(TICK_DT);
        acc -= TICK_DT;
      }
      const t = Date.now();
      for (const [code, entry] of rooms) {
        if (entry.emptySince !== null && t - entry.emptySince > EMPTY_ROOM_TTL_MS)
          rooms.delete(code);
      }
    },
    1000 / TICK_HZ / 2,
  );

  return {
    http,
    io,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(timer);
        void io.close(() => resolve());
      }),
  };
}
