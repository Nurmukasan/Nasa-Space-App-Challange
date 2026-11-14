// Headless test players. Usage:
//   npm run bots -- --code ABCD --n 2            (join an existing room as EVA crew)
//   npm run bots -- --n 3 --url http://localhost:3001   (create a room: 1 MC bot + 2 EVA bots, auto-start)
import { io } from 'socket.io-client';
import { EV_JOIN, EV_MSG, TICK_HZ } from '@rs/shared';
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
  let heading = Math.random() * Math.PI * 2;
  socket.on(EV_MSG, (m: ServerMsg) => {
    if (m.t === 'state') state = m.state;
    if (m.t === 'snap') snap = m.snap;
  });

  setInterval(() => {
    if (state.phase === 'lobby' && isMc && state.hostId === me) {
      const ready = state.players.length === n && state.players.every((p) => p.role !== null);
      if (ready) send({ t: 'lobby:start', quick: true });
    }
    if (state.phase !== 'eva' || !snap || isMc) return;
    const a = snap.astronauts.find((x) => x.id === me);
    if (!a || a.status !== 'active' || snap.t < 0) return;
    if (Math.random() < 0.03) heading += (Math.random() - 0.5) * 2;
    const home = a.o2 < a.o2Max * 0.45;
    const ang = home ? Math.atan2(snap.lander.y - a.y, snap.lander.x - a.x) : heading;
    const step = 44 / TICK_HZ;
    send({
      t: 'eva:move',
      x: a.x + Math.cos(ang) * step,
      y: a.y + Math.sin(ang) * step,
      facing: ang,
      moving: true,
      running: false,
    });
    if (home && Math.hypot(snap.lander.x - a.x, snap.lander.y - a.y) < 20)
      send({ t: 'eva:interact' });
  }, 1000 / TICK_HZ);
}

for (let i = 0; i < n; i++) {
  await spawn(i);
}
