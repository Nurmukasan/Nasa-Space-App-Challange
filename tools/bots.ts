// Headless test players. Usage:
//   npm run bots -- --code ABCD --n 2            (join an existing room as EVA crew)
//   npm run bots -- --n 3 --url http://localhost:3001   (create a room: 1 MC bot + 2 EVA bots, auto-start)
import { io } from 'socket.io-client';
import { DIG, O2, EV_JOIN, EV_MSG, TICK_HZ, moveSpeed } from '@rs/shared';
import type { ClientMsg, EvaState, JoinResult, RoomState, ServerMsg } from '@rs/shared';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const url = arg('url', 'http://localhost:3001');
const n = Number(arg('n', '2'));
let code = arg('code', '');
const createdRoom = code === '';

async function spawn(index: number): Promise<void> {
  const socket = io(url, { transports: ['websocket'] });
  const send = (m: ClientMsg): boolean => !!socket.emit(EV_MSG, m);
  const join: JoinResult = await new Promise((resolve) =>
    socket.emit(EV_JOIN, { name: `BOT${index}`, code: code || undefined }, resolve),
  );
  if (!join.ok) {
    console.error(`bot ${index}: join failed: ${join.error}`);
    socket.close();
    return;
  }
  code = join.code;
  const me = join.playerId;
  const isMc = createdRoom && index === 0;
  console.log(`bot ${index} joined room ${code} as ${isMc ? 'mc' : 'eva'}`);
  send({ t: 'lobby:role', role: isMc ? 'mc' : 'eva' });

  let state: RoomState = join.state;
  let snap: EvaState | null = null;
  let returning = false;
  const answered = new Set<string>();
  socket.on(EV_MSG, (m: ServerMsg) => {
    if (m.t === 'state') state = m.state;
    if (m.t === 'snap') snap = m.snap;
  });

  const timer = setInterval(() => {
    if (state.phase === 'lobby' && isMc && state.hostId === me) {
      const ready = state.players.length === n && state.players.every((p) => p.role !== null);
      if (ready) send({ t: 'lobby:start', quick: true });
    }
    if (state.phase === 'report') {
      console.log(`bot ${index}: report ${state.report?.score.grade}`);
      clearInterval(timer);
      socket.close();
      return;
    }
    if (state.phase !== 'eva' || !snap) return;
    if (isMc) {
      for (const event of snap.seismic)
        if (
          !answered.has(event.id) &&
          event.guess === null &&
          snap.t >= event.t0 &&
          snap.t < event.deadline
        ) {
          answered.add(event.id);
          const kinds = ['quake', 'impact', 'wind'] as const;
          send({
            t: 'mc:classify',
            eventId: event.id,
            kind: kinds[Math.floor(Math.random() * kinds.length)]!,
          });
        }
      for (const a of snap.astronauts)
        if (a.wantsRefill) send({ t: 'mc:dispense', playerId: a.id });
      return;
    }
    const a = snap.astronauts.find((x) => x.id === me);
    if (!a || a.status === 'lost' || a.status === 'down' || snap.t < 0 || !state.params) return;
    if (a.status === 'inside') {
      if (snap.t < snap.durationS - 45) send({ t: 'eva:interact' });
      return;
    }
    if (
      a.o2 < a.o2Max * 0.45 ||
      a.carrying.length >= state.params.carryCap ||
      snap.t > snap.durationS - 45
    )
      returning = true;
    if (returning && Math.hypot(snap.lander.x - a.x, snap.lander.y - a.y) < O2.airlockRadius) {
      send({ t: 'eva:dig', on: false });
      send({ t: 'eva:move', x: a.x, y: a.y, facing: a.facing, moving: false, running: false });
      if (a.o2 >= a.o2Max * 0.98 && a.carrying.length === 0) {
        returning = false;
        if (snap.t > snap.durationS - 45) send({ t: 'eva:interact' });
      } else send({ t: 'eva:interact' });
      return;
    }
    const sites = snap.sites.filter(
      (s) => (s.expiresAt === null || s.expiresAt > snap!.t) && s.depth < state.params!.maxDepth,
    );
    const site = sites.reduce<(typeof sites)[number] | undefined>(
      (best, s) =>
        !best || Math.hypot(s.x - a.x, s.y - a.y) < Math.hypot(best.x - a.x, best.y - a.y)
          ? s
          : best,
      undefined,
    );
    const target = returning || !site ? snap.lander : site;
    const distance = Math.hypot(target.x - a.x, target.y - a.y);
    if (!returning && site && distance < DIG.reach) {
      send({ t: 'eva:move', x: a.x, y: a.y, facing: a.facing, moving: false, running: false });
      send({ t: 'eva:dig', on: true });
      return;
    }
    const ang = Math.atan2(target.y - a.y, target.x - a.x);
    const step = Math.min(distance, moveSpeed(state.params, snap.weather, false) / TICK_HZ);
    send({
      t: 'eva:move',
      x: a.x + Math.cos(ang) * step,
      y: a.y + Math.sin(ang) * step,
      facing: ang,
      moving: step > 0,
      running: false,
    });
  }, 1000 / TICK_HZ);
}

for (let i = 0; i < n; i++) {
  await spawn(i);
}
