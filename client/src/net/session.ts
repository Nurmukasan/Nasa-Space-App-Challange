import { fxBus } from '../fx/FxBus';
import type { ClientMsg } from '@rs/shared';
import { clearSnaps, pushSnap } from '../state/snapshots';
import { store } from '../state/store';
import { LocalTransport } from './localTransport';
import { SocketTransport } from './socketTransport';
import type { Transport } from './transport';

let transport: Transport | null = null;
let snapCount = 0;
const HUD_EVERY = 3; // 15 Hz snapshots -> 5 Hz React updates

export async function startSession(
  mode: 'online' | 'local',
  name: string,
  code?: string,
): Promise<void> {
  endSession();
  store.setState({ conn: 'connecting', mode, error: null });
  const t: Transport = mode === 'local' ? new LocalTransport() : new SocketTransport();
  t.onMessage((m) => {
    if (m.t === 'state') {
      const phaseChanged = store.getState().room?.phase !== m.state.phase;
      if (phaseChanged && m.state.phase !== 'eva') {
        clearSnaps();
        store.setState({ room: m.state, hud: null });
      } else {
        store.setState({ room: m.state });
      }
    } else if (m.t === 'snap') {
      pushSnap(m.snap);
      fxBus.consume(m.snap);
      if (snapCount++ % HUD_EVERY === 0) store.setState({ hud: m.snap });
    } else {
      store.setState({ error: m.code });
    }
  });
  t.onStatus((s) => store.setState({ conn: s }));
  const r = await t.join({ name, code });
  if (!r.ok) {
    t.close();
    store.setState({ conn: 'idle', mode: null, error: r.error });
    return;
  }
  transport = t;
  store.setState({ conn: 'online', playerId: r.playerId, room: r.state });
}

export function send(msg: ClientMsg): void {
  transport?.send(msg);
}

export function endSession(): void {
  transport?.close();
  transport = null;
  clearSnaps();
  fxBus.reset();
  store.setState({ conn: 'idle', mode: null, playerId: null, room: null, hud: null });
}
