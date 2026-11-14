// Headless test players. Usage:
//   npm run bots -- --code ABCD --n 2            (join an existing room as EVA crew)
//   npm run bots -- --n 3 --url http://localhost:3001   (create a room: 1 MC bot + 2 EVA bots, auto-start)
//   npm run bots -- --n 3 --scenario signal             (scenario for a created room: free by default)
// Decisions live in tools/botBrain.ts; tools/mission-soak.ts runs the same bots without a server.
import { io } from 'socket.io-client';
import { CREW_CLASS_IDS, EV_JOIN, EV_MSG, SCENARIOS, TICK_HZ } from '@rs/shared';
import type { ClientMsg, EvaState, JoinResult, RoomState, ScenarioId, ServerMsg } from '@rs/shared';
import { EvaBrain, McBrain } from './botBrain';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const url = arg('url', 'http://localhost:3001');
const n = Number(arg('n', '2'));
if (!Number.isInteger(n) || n < 1 || n > 4) throw new Error('--n must be an integer from 1 to 4');
let code = arg('code', '');
const scenario = arg('scenario', 'free') as ScenarioId;
if (!Object.prototype.hasOwnProperty.call(SCENARIOS, scenario)) throw new Error('bad --scenario');
const createdRoom = code === '';

async function spawn(index: number): Promise<void> {
  const socket = io(url, { transports: ['websocket'] });
  const send = (m: ClientMsg): boolean => !!socket.emit(EV_MSG, m);
  const join: JoinResult = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, error: 'room_not_found' }), 8000);
    socket.emit(EV_JOIN, { name: `BOT${index}`, code: code || undefined }, (result: JoinResult) => {
      clearTimeout(timer);
      resolve(result);
    });
  });
  if (!join.ok) {
    console.error(`bot ${index}: join failed: ${join.error}`);
    socket.close();
    process.exitCode = 1;
    return;
  }
  code = join.code;
  const me = join.playerId;
  const isMc = createdRoom && index === 0;
  console.log(`bot ${index} joined room ${code} as ${isMc ? 'mc' : 'eva'}`);
  send({ t: 'lobby:role', role: isMc ? (n === 1 ? 'solo' : 'mc') : 'eva' });
  // Every astronaut must pick a specialty before launch; bots spread over the classes.
  send({ t: 'lobby:class', crewClass: CREW_CLASS_IDS[index % CREW_CLASS_IDS.length]! });

  socket.on('connect', () =>
    socket.emit(
      EV_JOIN,
      { name: `BOT${index}`, code: join.code, token: join.token },
      (r: JoinResult) => {
        if (!r.ok) {
          console.error(`bot ${index}: reconnect failed`);
          socket.close();
          process.exitCode = 1;
        }
      },
    ),
  );
  let state: RoomState = join.state;
  let snap: EvaState | null = null;
  socket.on(EV_MSG, (m: ServerMsg) => {
    if (m.t === 'state') state = m.state;
    if (m.t === 'snap') snap = m.snap;
  });
  const solo = isMc && n === 1;
  const mc = isMc ? new McBrain() : null;
  const eva = !isMc || solo ? new EvaBrain(me, createdRoom ? Math.max(0, index - 1) : index) : null;

  const timer = setInterval(() => {
    if (state.phase === 'lobby' && isMc && state.hostId === me) {
      const ready =
        state.players.length === n &&
        state.players.every((p) => p.role !== null && (p.role === 'mc' || p.classChosen));
      if (ready) {
        if (state.scenario !== scenario) send({ t: 'lobby:scenario', id: scenario });
        else send({ t: 'lobby:start', quick: true });
      }
    }
    if (state.phase === 'report') {
      console.log(`bot ${index}: report ${state.report?.score.grade}`);
      clearInterval(timer);
      socket.close();
      return;
    }
    if (state.phase !== 'eva' || !snap || !state.params) return;
    for (const m of mc?.decide(snap, state.params) ?? []) send(m);
    for (const m of eva?.decide(snap, state.params) ?? []) send(m);
  }, 1000 / TICK_HZ);
}

for (let i = 0; i < n; i++) {
  await spawn(i);
}
